import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as crypto from 'crypto';
import { getSMSProvider } from './sms';
import { getEmailProvider } from './email';

initializeApp();
const db = getFirestore();
const auth = getAuth();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_TRIGGERS_PER_WINDOW = 3;

/**
 * Callable: triggerSOS({ sessionId, contacts })
 * - Requires authenticated caller
 * - Ignores client-supplied contacts; queries caller's confirmed contacts from Firestore
 * - Rate limits caller to max 3 triggers per minute
 * - Sends emergency SMS with user's name, Google Maps link, and alert ID
 * - Updates alert document with per-contact delivery results and returns summary
 */
export const triggerSOS = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to trigger SOS.');
    }

    const uid = request.auth.uid;
    const { sessionId } = request.data as { sessionId?: string; contacts?: any };

    if (!sessionId) {
      throw new HttpsError('invalid-argument', 'sessionId is required.');
    }

    // 1. Rate-limiting check
    const rateLimitRef = db.collection('users').doc(uid).collection('rateLimits').doc('triggerSOS');
    const now = Date.now();
    const rateLimitDoc = await rateLimitRef.get();
    let timestamps: number[] = [];

    if (rateLimitDoc.exists) {
      const data = rateLimitDoc.data();
      if (Array.isArray(data?.timestamps)) {
        timestamps = data.timestamps.filter((ts: number) => now - ts < RATE_LIMIT_WINDOW_MS);
      }
    }

    if (timestamps.length >= MAX_TRIGGERS_PER_WINDOW) {
      throw new HttpsError(
        'resource-exhausted',
        'Rate limit exceeded: You can trigger SOS at most 3 times per minute. Please wait.'
      );
    }

    timestamps.push(now);
    await rateLimitRef.set({ timestamps, lastTriggeredAt: FieldValue.serverTimestamp() });

    // 2. Fetch caller's details
    let callerName = request.auth.token.name || 'A Suraksha Signal User';
    try {
      const userRecord = await auth.getUser(uid);
      if (userRecord.displayName) {
        callerName = userRecord.displayName;
      }
    } catch {
      // Use fallback name
    }

    // 3. Fetch ONLY confirmed contacts from users/{uid}/contacts
    const contactsSnap = await db
      .collection('users')
      .doc(uid)
      .collection('contacts')
      .where('confirmed', '==', true)
      .get();

    const confirmedContacts = contactsSnap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || 'Emergency Contact',
      phone: doc.data().phone
    })).filter((c) => Boolean(c.phone));

    // 4. Retrieve alert document to get location
    const alertRef = db.collection('alerts').doc(sessionId);
    const alertSnap = await alertRef.get();
    let lat: number | null = null;
    let lng: number | null = null;

    if (alertSnap.exists) {
      const alertData = alertSnap.data();
      lat = alertData?.latitude ?? null;
      lng = alertData?.longitude ?? null;
    }

    const mapsLink =
      lat !== null && lng !== null
        ? `https://maps.google.com/?q=${lat},${lng}`
        : 'Location unavailable';

    const baseUrl = process.env.APP_BASE_URL || 'https://suraksha-signal.web.app';
    const trackingLink = `${baseUrl}/track/${sessionId}`;

    const smsBody = `🚨 EMERGENCY ALERT: ${callerName} has triggered an SOS! Location: ${mapsLink} Live Tracking: ${trackingLink} (Alert ID: ${sessionId})`;

    // 5. Send SMS to all confirmed contacts
    const smsProvider = getSMSProvider();
    const deliveryResults: Array<{
      contactId: string;
      name: string;
      phone: string;
      status: 'sent' | 'failed';
      messageId?: string;
      error?: string;
    }> = [];

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of confirmedContacts) {
      const sendResult = await smsProvider.sendSMS({
        to: contact.phone,
        body: smsBody
      });

      if (sendResult.success) {
        sentCount++;
        deliveryResults.push({
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          status: 'sent',
          messageId: sendResult.messageId
        });
      } else {
        failedCount++;
        deliveryResults.push({
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          status: 'failed',
          error: sendResult.error
        });
      }
    }

    const summary = {
      sent: sentCount,
      failed: failedCount,
      total: confirmedContacts.length
    };

    // 6. Write per-contact delivery results to alert document
    await alertRef.set(
      {
        deliveryResults,
        summary,
        status: 'active',
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return summary;
  }
);

/**
 * Callable: sendContactConsent({ contactId })
 * - Requests authenticated user's contact to confirm by replying YES via SMS
 */
export const sendContactConsent = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to send contact consent.');
    }

    const uid = request.auth.uid;
    const { contactId } = request.data as { contactId?: string };

    if (!contactId) {
      throw new HttpsError('invalid-argument', 'contactId is required.');
    }

    const contactRef = db.collection('users').doc(uid).collection('contacts').doc(contactId);
    const contactSnap = await contactRef.get();

    if (!contactSnap.exists) {
      throw new HttpsError('not-found', 'Contact not found.');
    }

    const contact = contactSnap.data();
    if (!contact?.phone) {
      throw new HttpsError('invalid-argument', 'Contact has no phone number.');
    }

    let callerName = request.auth.token.name || 'A trusted friend/family member';
    try {
      const userRecord = await auth.getUser(uid);
      if (userRecord.displayName) {
        callerName = userRecord.displayName;
      }
    } catch {
      // Ignore
    }

    const smsBody = `[Suraksha Signal] ${callerName} added you as an emergency contact. Reply YES to this message to agree to receive distress alerts during emergencies.`;

    const smsProvider = getSMSProvider();
    const result = await smsProvider.sendSMS({
      to: contact.phone,
      body: smsBody
    });

    await contactRef.set(
      {
        consentRequestedAt: FieldValue.serverTimestamp(),
        lastConsentError: result.error || null
      },
      { merge: true }
    );

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error
    };
  }
);

/**
 * HTTP Webhook: twilioWebhook
 * - Handles incoming SMS replies from emergency contacts
 * - If reply is "YES", marks confirmed = true for matching contacts
 */
export const twilioWebhook = onRequest(async (req, res) => {
  // Extract sender phone and body from urlencoded payload
  const from = req.body?.From || req.query?.From;
  const body = (req.body?.Body || req.query?.Body || '').toString().trim();

  if (!from) {
    res.status(400).send('Missing From field');
    return;
  }

  const isAffirmative = /^(YES|Y|AGREE|OK|ACCEPT)$/i.test(body);

  if (isAffirmative) {
    // Standardize phone search
    const cleanFrom = from.replace(/\s+/g, '');

    // Search contacts collectionGroup for phone matching sender
    const matchingContacts = await db
      .collectionGroup('contacts')
      .where('phone', '==', cleanFrom)
      .get();

    const batch = db.batch();
    matchingContacts.docs.forEach((doc) => {
      batch.update(doc.ref, {
        confirmed: true,
        confirmedAt: FieldValue.serverTimestamp()
      });
    });

    if (!matchingContacts.empty) {
      await batch.commit();
    }

    res.set('Content-Type', 'text/xml');
    res.status(200).send(
      '<Response><Message>Thank you! You are now confirmed as an emergency contact on Suraksha Signal.</Message></Response>'
    );
    return;
  }

  res.set('Content-Type', 'text/xml');
  res.status(200).send(
    '<Response><Message>Suraksha Signal: Please reply YES to confirm becoming an emergency contact.</Message></Response>'
  );
});

/**
 * Callable: sendEmailOtp({ email })
 * - Callable, no auth required
 * - Validate the email format and lowercase it.
 * - Generate a 6-digit code with crypto.randomInt (never Math.random).
 * - Store ONLY a SHA-256 hash of the code in Firestore at emailOtps/{sha256(email)} with:
 *   codeHash, expiresAt (now + 10 min), attempts: 0, lastSentAt, sendCount, windowStart.
 * - Rate limits: 60-second cooldown between sends to the same email,
 *   and max 3 sends per email per 15 minutes.
 * - Send email through email.ts with Resend (or mock in development/tests).
 * - Never log the code or return it to client.
 */
/**
 * Core handler: handleSendEmailOtp
 */
export async function handleSendEmailOtp(
  data: any,
  dbInstance = db,
  provider = getEmailProvider()
) {
  const rawEmail = data?.email;
  if (!rawEmail || typeof rawEmail !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }

  const email = rawEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'Please provide a valid email address.');
  }

  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const otpRef = dbInstance.collection('emailOtps').doc(emailHash);

  const now = Date.now();
  const existingSnap = await otpRef.get();

  let sendCount = 1;
  let windowStart: any = Timestamp ? Timestamp.fromMillis(now) : now;

  if (existingSnap.exists) {
    const docData = existingSnap.data()!;
    const lastSentMillis = docData.lastSentAt?.toMillis ? docData.lastSentAt.toMillis() : (docData.lastSentAt || 0);

    // 60-second cooldown between sends to the same email
    if (now - lastSentMillis < 60 * 1000) {
      throw new HttpsError(
        'resource-exhausted',
        'Please wait 60 seconds before requesting another code.'
      );
    }

    // 15-minute rate limit window (max 3 sends per email per 15 minutes)
    const windowStartMillis = docData.windowStart?.toMillis ? docData.windowStart.toMillis() : (docData.windowStart || 0);
    const isWithinWindow = now - windowStartMillis < 15 * 60 * 1000;

    if (isWithinWindow) {
      if ((docData.sendCount || 0) >= 3) {
        throw new HttpsError(
          'resource-exhausted',
          'Too many requests. Please wait 15 minutes before requesting another code.'
        );
      }
      sendCount = (docData.sendCount || 0) + 1;
      windowStart = docData.windowStart;
    } else {
      sendCount = 1;
      windowStart = Timestamp ? Timestamp.fromMillis(now) : now;
    }
  }

  // Generate 6-digit code with crypto.randomInt (never Math.random)
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = Timestamp ? Timestamp.fromMillis(now + 10 * 60 * 1000) : now + 10 * 60 * 1000; // 10 minutes expiry
  const lastSentAt = Timestamp ? Timestamp.fromMillis(now) : now;

  // Store ONLY a SHA-256 hash of the code in Firestore
  await otpRef.set({
    codeHash,
    expiresAt,
    attempts: 0,
    lastSentAt,
    sendCount,
    windowStart,
    emailHash
  });

  // Send email via provider
  try {
    await provider.sendOtpEmail({ to: email, code });
  } catch (err: any) {
    console.error('Error dispatching OTP email:', err?.message || err);
    throw new HttpsError('internal', 'Unable to send verification email. Please try again later.');
  }

  return {
    success: true,
    message: 'Verification code sent.'
  };
}

/**
 * Callable: sendEmailOtp({ email })
 */
export const sendEmailOtp = onCall(
  { cors: true },
  async (request) => {
    return handleSendEmailOtp(request.data);
  }
);

/**
 * Core handler: handleVerifyEmailOtp
 */
export async function handleVerifyEmailOtp(
  data: any,
  dbInstance = db,
  authInstance = auth
) {
  const rawEmail = data?.email;
  const rawCode = data?.code;

  const GENERIC_ERROR = 'Invalid or expired code.';

  if (!rawEmail || !rawCode || typeof rawEmail !== 'string' || typeof rawCode !== 'string') {
    throw new HttpsError('invalid-argument', GENERIC_ERROR);
  }

  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.trim();

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    throw new HttpsError('invalid-argument', GENERIC_ERROR);
  }

  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const otpRef = dbInstance.collection('emailOtps').doc(emailHash);

  const now = Date.now();

  await dbInstance.runTransaction(async (transaction: any) => {
    const docSnap = await transaction.get(otpRef);
    if (!docSnap.exists) {
      throw new HttpsError('invalid-argument', GENERIC_ERROR);
    }

    const docData = docSnap.data()!;
    const attempts = typeof docData.attempts === 'number' ? docData.attempts : 0;
    const expiresMillis = docData.expiresAt?.toMillis ? docData.expiresAt.toMillis() : (docData.expiresAt || 0);

    // Reject if attempts >= 5 or expired
    if (attempts >= 5 || expiresMillis <= now) {
      throw new HttpsError('invalid-argument', GENERIC_ERROR);
    }

    // Timing-safe comparison of SHA-256 hashes
    const incomingBuffer = crypto.createHash('sha256').update(code).digest();
    const storedBuffer = Buffer.from(docData.codeHash || '', 'hex');

    const isMatch =
      incomingBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(incomingBuffer, storedBuffer);

    if (!isMatch) {
      // Increment attempts on every failed try
      transaction.update(otpRef, { attempts: attempts + 1 });
      throw new HttpsError('invalid-argument', GENERIC_ERROR);
    }

    // On success: delete the OTP doc
    transaction.delete(otpRef);
  });

  // Find existing user or create one with emailVerified: true
  let uid: string;
  try {
    const userRecord = await authInstance.getUserByEmail(email);
    uid = userRecord.uid;
    if (!userRecord.emailVerified) {
      await authInstance.updateUser(uid, { emailVerified: true });
    }
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await authInstance.createUser({
        email,
        emailVerified: true
      });
      uid = newUser.uid;
    } else {
      console.error('Error finding or creating user:', err);
      throw new HttpsError('internal', 'Authentication processing failed.');
    }
  }

  const token = await authInstance.createCustomToken(uid);
  return { token };
}

/**
 * Callable: verifyEmailOtp({ email, code })
 */
export const verifyEmailOtp = onCall(
  { cors: true },
  async (request) => {
    return handleVerifyEmailOtp(request.data);
  }
);
