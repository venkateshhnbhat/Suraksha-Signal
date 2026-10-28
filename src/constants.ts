import type { Contact } from './types';

export const DEFAULT_DEMO_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'National Emergency Service',
    phone: '112',
    relationship: 'Emergency Authority',
    confirmed: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'c2',
    name: 'Family Contact (Priya)',
    phone: '+919876543211',
    relationship: 'Sister',
    confirmed: true,
    createdAt: new Date().toISOString()
  }
];
