import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { handleSendEmailOtp, handleVerifyEmailOtp } from '../../functions/src/index';

class MockDocRef {
  constructor(private store: Map<string, any>, public id: string) {}

  async get() {
    const data = this.store.get(this.id);
    return {
      exists: Boolean(data),
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data: any) {
    this.store.set(this.id, { ...data });
  }

  async update(data: any) {
    const prev = this.store.get(this.id) || {};
    this.store.set(this.id, { ...prev, ...data });
  }

  async delete() {
    this.store.delete(this.id);
  }
}

class MockCollection {
  constructor(private store: Map<string, any>) {}
  doc(id: string) {
    return new MockDocRef(this.store, id);
  }
}

class MockDb {
  public store = new Map<string, any>();

  collection(_name: string) {
    return new MockCollection(this.store);
  }

  async runTransaction(updateFunction: (t: any) => Promise<any>) {
    const transaction = {
      get: async (ref: MockDocRef) => ref.get(),
      update: (ref: MockDocRef, data: any) => ref.update(data),
      delete: (ref: MockDocRef) => ref.delete()
    };
    return updateFunction(transaction);
  }
}

class MockAuth {
  public users = new Map<string, any>();

  async getUserByEmail(email: string) {
    const user = this.users.get(email);
    if (!user) {
      const err: any = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return user;
  }

  async createUser(data: any) {
    const uid = 'uid_' + Math.random().toString(36).slice(2, 9);
    const user = { uid, ...data };
    this.users.set(data.email, user);
    return user;
  }

  async updateUser(uid: string, data: any) {
    for (const [email, user] of this.users.entries()) {
      if (user.uid === uid) {
        this.users.set(email, { ...user, ...data });
      }
    }
  }

  async createCustomToken(uid: string) {
    return `custom-jwt-token-for-${uid}`;
  }
}

class MockEmailProvider {
  public sentEmails: Array<{ to: string; code: string }> = [];

  async sendOtpEmail({ to, code }: { to: string; code: string }) {
    this.sentEmails.push({ to, code });
  }
}

describe('Cloud Functions Email OTP Requirements', () => {
  let mockDb: MockDb;
  let mockAuth: MockAuth;
  let mockEmailProvider: MockEmailProvider;
  const testEmail = 'pilot@surakshasignal.app';
  const emailHash = crypto.createHash('sha256').update(testEmail).digest('hex');

  beforeEach(() => {
    mockDb = new MockDb();
    mockAuth = new MockAuth();
    mockEmailProvider = new MockEmailProvider();
  });

  it('proves the code is stored hashed and never appears in function responses', async () => {
    const response = await handleSendEmailOtp(
      { email: testEmail },
      mockDb as any,
      mockEmailProvider as any
    );

    // 1. Response must strictly be generic success confirmation, never containing the code
    expect(response).toEqual({
      success: true,
      message: 'Verification code sent.'
    });
    expect((response as any).code).toBeUndefined();

    // 2. Email provider received the 6-digit code
    expect(mockEmailProvider.sentEmails).toHaveLength(1);
    const generatedCode = mockEmailProvider.sentEmails[0].code;
    expect(generatedCode).toMatch(/^\d{6}$/);

    // 3. Stored document in Firestore ONLY stores the SHA-256 hash, not plaintext code
    const storedDoc = mockDb.store.get(emailHash);
    expect(storedDoc).toBeDefined();
    expect(storedDoc.code).toBeUndefined();
    expect(storedDoc.codeHash).toBe(
      crypto.createHash('sha256').update(generatedCode).digest('hex')
    );
    expect(storedDoc.attempts).toBe(0);
  });

  it('proves a resend within 60s is blocked and the 4th send within 15 minutes is blocked', async () => {
    // First send: succeeds
    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);

    // 60-second cooldown check: second send immediately should fail
    await expect(
      handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any)
    ).rejects.toThrow(/wait 60 seconds/i);

    // Simulate 2nd send after 61 seconds
    const doc1 = mockDb.store.get(emailHash);
    doc1.lastSentAt = { toMillis: () => Date.now() - 65 * 1000 };
    mockDb.store.set(emailHash, doc1);

    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);
    expect(mockDb.store.get(emailHash).sendCount).toBe(2);

    // Simulate 3rd send after another 65 seconds
    const doc2 = mockDb.store.get(emailHash);
    doc2.lastSentAt = { toMillis: () => Date.now() - 65 * 1000 };
    mockDb.store.set(emailHash, doc2);

    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);
    expect(mockDb.store.get(emailHash).sendCount).toBe(3);

    // Simulate 4th send within the same 15-minute window after 65 seconds
    const doc3 = mockDb.store.get(emailHash);
    doc3.lastSentAt = { toMillis: () => Date.now() - 65 * 1000 };
    mockDb.store.set(emailHash, doc3);

    // 4th send must be blocked
    await expect(
      handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any)
    ).rejects.toThrow(/wait 15 minutes/i);
  });

  it('proves an expired code fails with generic message', async () => {
    // Send OTP
    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);
    const sentCode = mockEmailProvider.sentEmails[0].code;

    // Simulate expired document (expiresAt in past)
    const doc = mockDb.store.get(emailHash);
    doc.expiresAt = { toMillis: () => Date.now() - 5000 };
    mockDb.store.set(emailHash, doc);

    // Attempt verification with the actual code
    await expect(
      handleVerifyEmailOtp(
        { email: testEmail, code: sentCode },
        mockDb as any,
        mockAuth as any
      )
    ).rejects.toThrow('Invalid or expired code.');
  });

  it('proves 5 wrong attempts lock the code, even if the correct code is then entered', async () => {
    // Send OTP
    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);
    const correctCode = mockEmailProvider.sentEmails[0].code;

    // 5 wrong attempts with code '000000'
    for (let i = 1; i <= 5; i++) {
      await expect(
        handleVerifyEmailOtp(
          { email: testEmail, code: '000000' },
          mockDb as any,
          mockAuth as any
        )
      ).rejects.toThrow('Invalid or expired code.');

      expect(mockDb.store.get(emailHash).attempts).toBe(i);
    }

    // Attempt 6 with the CORRECT code -> Must be rejected because attempts >= 5
    await expect(
      handleVerifyEmailOtp(
        { email: testEmail, code: correctCode },
        mockDb as any,
        mockAuth as any
      )
    ).rejects.toThrow('Invalid or expired code.');
  });

  it('proves a correct code returns a token and the OTP doc is deleted', async () => {
    // Send OTP
    await handleSendEmailOtp({ email: testEmail }, mockDb as any, mockEmailProvider as any);
    const correctCode = mockEmailProvider.sentEmails[0].code;

    // Verify with correct code
    const result = await handleVerifyEmailOtp(
      { email: testEmail, code: correctCode },
      mockDb as any,
      mockAuth as any
    );

    // Returns custom token
    expect(result).toHaveProperty('token');
    expect(result.token).toMatch(/^custom-jwt-token-for-/);

    // Document in emailOtps collection is deleted
    expect(mockDb.store.get(emailHash)).toBeUndefined();

    // User is created with emailVerified: true
    const user = await mockAuth.getUserByEmail(testEmail);
    expect(user).toBeDefined();
    expect(user.emailVerified).toBe(true);
  });
});
