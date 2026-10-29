/**
 * Phase 8 — Automated Tests for 12 Required Scenarios
 * Tests the triggerSOS / resolveSOS core handlers with mock DB, SMS, and auth.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleTriggerSOS, handleResolveSOS } from '../../functions/src/index';

// ── Mock Infrastructure ──────────────────────────────────────

class MockDocRef {
  constructor(private store: Map<string, any>, public id: string) {}

  async get() {
    const data = this.store.get(this.id);
    return {
      exists: Boolean(data),
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data: any, opts?: { merge?: boolean }) {
    if (opts?.merge) {
      const prev = this.store.get(this.id) || {};
      this.store.set(this.id, { ...prev, ...data });
    } else {
      this.store.set(this.id, { ...data });
    }
  }

  async update(data: any) {
    const prev = this.store.get(this.id) || {};
    this.store.set(this.id, { ...prev, ...data });
  }
}

class MockQuerySnapshot {
  constructor(public docs: Array<{ id: string; data: () => any; ref: MockDocRef }>) {}
  get empty() { return this.docs.length === 0; }
}

class MockCollection {
  private _whereFilters: Array<{ field: string; op: string; value: any }> = [];

  constructor(private store: Map<string, any>, private prefix: string) {}

  doc(id: string) {
    return new MockDocRef(this.store, `${this.prefix}/${id}`);
  }

  where(field: string, op: string, value: any) {
    this._whereFilters.push({ field, op, value });
    return this;
  }

  async get(): Promise<MockQuerySnapshot> {
    const docs: Array<{ id: string; data: () => any; ref: MockDocRef }> = [];
    for (const [key, val] of this.store.entries()) {
      if (key.startsWith(this.prefix + '/')) {
        let matches = true;
        for (const filter of this._whereFilters) {
          if (filter.op === '==') {
            if (val[filter.field] !== filter.value) matches = false;
          }
        }
        if (matches) {
          const docId = key.substring(this.prefix.length + 1);
          const ref = new MockDocRef(this.store, key);
          docs.push({ id: docId, data: () => ({ ...val }), ref });
        }
      }
    }
    this._whereFilters = [];
    return new MockQuerySnapshot(docs);
  }
}

class MockDb {
  public store = new Map<string, any>();

  collection(name: string) {
    return {
      doc: (id: string) => {
        const ref = new MockDocRef(this.store, `${name}/${id}`);
        return {
          ...ref,
          get: () => ref.get(),
          set: (data: any, opts?: any) => ref.set(data, opts),
          update: (data: any) => ref.update(data),
          collection: (subName: string) => {
            const subPrefix = `${name}/${id}/${subName}`;
            return new MockCollection(this.store, subPrefix);
          }
        };
      }
    } as any;
  }
}

class MockAuth {
  public users = new Map<string, any>();

  async getUser(uid: string) {
    for (const user of this.users.values()) {
      if (user.uid === uid) return user;
    }
    throw new Error('User not found');
  }
}

class MockSMSProvider {
  public sentMessages: Array<{ to: string; body: string }> = [];
  public shouldFail = false;
  public failMessage = 'SMS provider unavailable';

  async sendSMS(msg: { to: string; body: string }) {
    this.sentMessages.push(msg);
    if (this.shouldFail) {
      return { success: false, error: this.failMessage };
    }
    return { success: true, messageId: `msg_${Date.now()}_${this.sentMessages.length}` };
  }
}

// ── Test Suites ──────────────────────────────────────────────

describe('Phase 8: SOS End-to-End Workflow Tests', () => {
  let mockDb: MockDb;
  let mockAuth: MockAuth;
  let mockSMS: MockSMSProvider;
  const uid = 'test-user-001';
  const authCtx = { uid, token: { name: 'Test User' } };

  beforeEach(() => {
    mockDb = new MockDb();
    mockAuth = new MockAuth();
    mockSMS = new MockSMSProvider();
    mockAuth.users.set('test@test.com', { uid, displayName: 'Test User', email: 'test@test.com' });
  });

  // Helper to create an alert document & contacts
  async function setupAlertAndContacts(alertId: string, contacts: Array<{ id: string; name: string; phone: string; confirmed: boolean }>) {
    // Create alert doc
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: 12.97,
      longitude: 77.59,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Add contacts
    for (const c of contacts) {
      mockDb.store.set(`users/${uid}/contacts/${c.id}`, {
        name: c.name,
        phone: c.phone,
        confirmed: c.confirmed
      });
    }
  }

  // ── Scenario 1: Valid user can trigger SOS ──
  it('Scenario 1: Authenticated user can trigger SOS and get persistent incident', async () => {
    const alertId = 'ALERT_TEST1';
    await setupAlertAndContacts(alertId, [
      { id: 'c1', name: 'Alice', phone: '+919876543210', confirmed: true }
    ]);

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(1);
    expect(result.total).toBe(1);
    expect(result.deliveryStatus).toBe('sent');
    expect(mockSMS.sentMessages.length).toBe(1);
    expect(mockSMS.sentMessages[0].to).toBe('+919876543210');

    // Verify alert was updated in the mock DB
    const alertData = mockDb.store.get(`alerts/${alertId}`);
    expect(alertData.deliveryStatus).toBe('sent');
    expect(alertData.summary.sent).toBe(1);
  });

  // ── Scenario 2: Unauthenticated user is rejected ──
  it('Scenario 2: Unauthenticated user cannot access triggerSOS', async () => {
    await expect(
      handleTriggerSOS({ sessionId: 'ALERT_X' }, null, mockDb as any, mockSMS, mockAuth as any)
    ).rejects.toThrow('User must be authenticated');

    await expect(
      handleTriggerSOS({ sessionId: 'ALERT_X' }, undefined, mockDb as any, mockSMS, mockAuth as any)
    ).rejects.toThrow('User must be authenticated');
  });

  // ── Scenario 3: User can manage contacts (tested via contactsPage tests) ──
  // ContactForm and ContactItem tests already cover this scenario

  // ── Scenario 4: SOS creates persistent incident and retrieves it ──
  it('Scenario 4: SOS creates persistent incident with delivery results', async () => {
    const alertId = 'ALERT_PERSIST';
    await setupAlertAndContacts(alertId, [
      { id: 'c1', name: 'Bob', phone: '+919999888877', confirmed: true },
      { id: 'c2', name: 'Carol', phone: '+918888777766', confirmed: true }
    ]);

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(2);
    expect(result.total).toBe(2);
    expect(result.deliveryStatus).toBe('sent');

    const alertData = mockDb.store.get(`alerts/${alertId}`);
    expect(alertData.deliveryResults).toHaveLength(2);
    expect(alertData.deliveryResults[0].status).toBe('sent');
    expect(alertData.expiresAt).toBeDefined();
  });

  // ── Scenario 5: Repeated SOS submissions do not create duplicate incidents ──
  it('Scenario 5: Idempotent — second triggerSOS returns cached result without re-sending SMS', async () => {
    const alertId = 'ALERT_IDEM';
    await setupAlertAndContacts(alertId, [
      { id: 'c1', name: 'Dave', phone: '+911234567890', confirmed: true }
    ]);

    // First call
    const r1 = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );
    expect(r1.sent).toBe(1);
    expect(mockSMS.sentMessages.length).toBe(1);

    // Second call should NOT resend SMS (idempotent check)
    const r2 = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );
    expect(r2.idempotent).toBe(true);
    expect(r2.sent).toBe(1);
    // SMS count should still be 1 — no duplicate dispatches
    expect(mockSMS.sentMessages.length).toBe(1);
  });

  // ── Scenario 6: GPS denial does not crash the application ──
  it('Scenario 6: SOS succeeds even when GPS coordinates are null', async () => {
    const alertId = 'ALERT_NOGPS';
    // Alert doc with null location
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: null,
      longitude: null,
      locationStatus: 'denied',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    mockDb.store.set(`users/${uid}/contacts/c1`, {
      name: 'Eve', phone: '+919111222333', confirmed: true
    });

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(1);
    expect(result.deliveryStatus).toBe('sent');
    // SMS body should contain "Location unavailable"
    expect(mockSMS.sentMessages[0].body).toContain('Location unavailable');
  });

  // ── Scenario 7: Incident created with unavailable location ──
  it('Scenario 7: Incident with unavailable location stores null coords and proceeds', async () => {
    const alertId = 'ALERT_NOLOC';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: null,
      longitude: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    mockDb.store.set(`users/${uid}/contacts/c1`, {
      name: 'Frank', phone: '+919444555666', confirmed: true
    });

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(1);
    const alertData = mockDb.store.get(`alerts/${alertId}`);
    expect(alertData.latitude).toBeNull();
    expect(alertData.longitude).toBeNull();
  });

  // ── Scenario 8: Provider failures produce accurate failure states ──
  it('Scenario 8: SMS provider failure produces "failed" delivery status', async () => {
    const alertId = 'ALERT_FAIL';
    await setupAlertAndContacts(alertId, [
      { id: 'c1', name: 'Grace', phone: '+919555666777', confirmed: true }
    ]);

    mockSMS.shouldFail = true;
    mockSMS.failMessage = 'Twilio credentials not configured';

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.deliveryStatus).toBe('failed');

    const alertData = mockDb.store.get(`alerts/${alertId}`);
    expect(alertData.deliveryStatus).toBe('failed');
    expect(alertData.deliveryResults[0].status).toBe('failed');
    expect(alertData.deliveryResults[0].error).toBe('Twilio credentials not configured');
  });

  // ── Scenario 9: One user cannot access another user's incidents ──
  it('Scenario 9: User cannot trigger SOS on another user\'s alert', async () => {
    const alertId = 'ALERT_OTHER';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: 'different-user-999',
      status: 'active',
      latitude: 13.0,
      longitude: 77.6,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await expect(
      handleTriggerSOS(
        { sessionId: alertId },
        authCtx,
        mockDb as any,
        mockSMS,
        mockAuth as any
      )
    ).rejects.toThrow('You cannot trigger an alert owned by another user');
  });

  // ── Scenario 10: Incident status transitions follow defined rules ──
  it('Scenario 10: Status transitions from active → resolved via resolveSOS', async () => {
    const alertId = 'ALERT_RESOLVE';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      deliveryStatus: 'sent',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const result = await handleResolveSOS(
      { sessionId: alertId, reason: 'I am safe now' },
      authCtx,
      mockDb as any
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('resolved');

    const alertData = mockDb.store.get(`alerts/${alertId}`);
    expect(alertData.status).toBe('resolved');
    expect(alertData.resolutionReason).toBe('I am safe now');
    expect(alertData.resolvedBy).toBe(uid);
    expect(alertData.resolvedAt).toBeDefined();
  });

  // ── Scenario 10b: Cannot resolve another user's alert ──
  it('Scenario 10b: User cannot resolve another user\'s alert', async () => {
    const alertId = 'ALERT_RESOLVE_OTHER';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: 'other-user-123',
      status: 'active',
      createdAt: Date.now()
    });

    await expect(
      handleResolveSOS({ sessionId: alertId }, authCtx, mockDb as any)
    ).rejects.toThrow('You cannot resolve an alert owned by another user');
  });

  // ── Scenario 11: Honest failure report when no confirmed contacts exist ──
  it('Scenario 11: SOS with zero confirmed contacts reports failure honestly', async () => {
    const alertId = 'ALERT_NOCONTACTS';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: 12.97,
      longitude: 77.59,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    // Add an unconfirmed contact
    mockDb.store.set(`users/${uid}/contacts/c1`, {
      name: 'Henry', phone: '+919000000001', confirmed: false
    });

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    expect(result.sent).toBe(0);
    expect(result.total).toBe(0);
    expect(result.deliveryStatus).toBe('failed');
    expect((result as any).error).toContain('No confirmed emergency contacts');
    expect(mockSMS.sentMessages.length).toBe(0);
  });

  // ── Scenario 12: Missing sessionId is rejected ──
  it('Scenario 12: Missing or invalid sessionId is rejected', async () => {
    await expect(
      handleTriggerSOS({}, authCtx, mockDb as any, mockSMS, mockAuth as any)
    ).rejects.toThrow('sessionId is required');

    await expect(
      handleTriggerSOS({ sessionId: '' }, authCtx, mockDb as any, mockSMS, mockAuth as any)
    ).rejects.toThrow('sessionId is required');
  });

  // ── Scenario 12b: Non-existent alert is rejected ──
  it('Scenario 12b: triggerSOS on non-existent alert returns not-found', async () => {
    await expect(
      handleTriggerSOS({ sessionId: 'NONEXISTENT' }, authCtx, mockDb as any, mockSMS, mockAuth as any)
    ).rejects.toThrow('Emergency incident record not found');
  });

  // ── Scenario: Partial delivery (mixed success/failure) ──
  it('Reports partial delivery when some SMS succeed and others fail', async () => {
    const alertId = 'ALERT_PARTIAL';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: 12.97,
      longitude: 77.59,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    mockDb.store.set(`users/${uid}/contacts/c1`, {
      name: 'Alice', phone: '+919111111111', confirmed: true
    });
    mockDb.store.set(`users/${uid}/contacts/c2`, {
      name: 'BadNum', phone: '+910000000000', confirmed: true
    });

    // Make SMS succeed first, then fail second
    let callCount = 0;
    const mixedSMS = {
      async sendSMS(msg: { to: string; body: string }) {
        callCount++;
        if (callCount === 2) return { success: false, error: 'Invalid number' };
        return { success: true, messageId: `msg_${callCount}` };
      }
    };

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mixedSMS as any,
      mockAuth as any
    );

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.deliveryStatus).toBe('partial');
  });

  // ── Scenario: Coordinate validation ──
  it('Rejects out-of-range coordinates gracefully', async () => {
    const alertId = 'ALERT_BADCOORDS';
    mockDb.store.set(`alerts/${alertId}`, {
      ownerUid: uid,
      status: 'active',
      latitude: 999,    // Invalid
      longitude: -999,   // Invalid
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    mockDb.store.set(`users/${uid}/contacts/c1`, {
      name: 'Ivy', phone: '+919777888999', confirmed: true
    });

    const result = await handleTriggerSOS(
      { sessionId: alertId },
      authCtx,
      mockDb as any,
      mockSMS,
      mockAuth as any
    );

    // Should send SMS with "Location unavailable" instead of fake coords
    expect(mockSMS.sentMessages[0].body).toContain('Location unavailable');
  });
});

