export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  confirmed: boolean;
  createdAt: any;
}

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  isDemo?: boolean;
}

export type SOSStatus = 'idle' | 'sending' | 'sent' | 'failed';

export interface ActiveAlert {
  id: string;
  time: string;
  status: SOSStatus;
  sentCount?: number;
  totalCount?: number;
  error?: string;
  isDemo?: boolean;
}

export interface AlertData {
  ownerUid: string;
  status: 'active' | 'dismissed';
  latitude: number | null;
  longitude: number | null;
  createdAt: any;
  updatedAt: any;
  summary?: {
    sent: number;
    failed: number;
    total: number;
  };
}
