export interface Contact {
  id: string;
  name: string;
  phone: string; // E.164 normalized, e.g. +919876543210
  relationship: string;
  confirmed: boolean;
  priority?: number; // 1 = Primary, 2 = Secondary, etc.
  createdAt: any;
}

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  isDemo?: boolean;
}

export type SOSStatus = 'idle' | 'preparing' | 'sending' | 'sent' | 'failed' | 'acknowledged' | 'resolved';

export type LocationStatus = 'acquired' | 'unavailable' | 'denied' | 'stale';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface ActiveAlert {
  id: string;
  time: string;
  status: SOSStatus;
  locationStatus?: LocationStatus;
  sentCount?: number;
  totalCount?: number;
  error?: string;
  isDemo?: boolean;
}

export interface AlertData {
  id: string;
  ownerUid: string;
  ownerName?: string;
  ownerPhone?: string | null;
  status: 'active' | 'resolved' | 'dismissed';
  deliveryStatus?: 'preparing' | 'sending' | 'sent' | 'failed' | 'partial';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: LocationStatus;
  locationHistory?: LocationPoint[];
  createdAt: any;
  updatedAt: any;
  expiresAt?: any;
  resolvedAt?: any;
  resolvedBy?: string;
  resolutionReason?: string;
  summary?: {
    sent: number;
    failed: number;
    total: number;
  };
  deliveryResults?: Array<{
    contactId: string;
    name: string;
    phone: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
  }>;
  error?: string;
}
