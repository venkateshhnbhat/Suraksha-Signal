import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth, functions, isFirebaseConfigured } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import ContactForm from '@/components/ContactForm';
import ContactItem from '@/components/ContactItem';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '@/App';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  confirmed: boolean;
  createdAt: any;
}

const DEFAULT_DEMO_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'National Emergency Service',
    phone: '+91112',
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

interface Props {
  user?: AppUser;
  onLogout?: () => void;
}

const ContactsPage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isDemo = user?.isDemo || !isFirebaseConfigured() || !auth.currentUser;

  const fetchContacts = async () => {
    if (isDemo) {
      const saved = localStorage.getItem('safesignal_contacts');
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
          return;
        } catch {}
      }
      setContacts(DEFAULT_DEMO_CONTACTS);
      localStorage.setItem('safesignal_contacts', JSON.stringify(DEFAULT_DEMO_CONTACTS));
    } else {
      if (!auth.currentUser) return;
      try {
        const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
        const q = query(contactsRef, orderBy('createdAt'));
        const snapshot = await getDocs(q);
        const list: Contact[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<Contact, 'id'>;
          list.push({ id: docSnap.id, ...data });
        });
        setContacts(list);
      } catch (err: any) {
        console.warn('Firestore fetch failed:', err);
        setError('Could not load contacts from cloud: ' + err.message);
      }
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (contact: Omit<Contact, 'id' | 'createdAt' | 'confirmed'>) => {
    setError(null);
    setSuccessMsg(null);

    if (contacts.length >= 5) {
      setError('You can add up to 5 emergency contacts.');
      return;
    }

    if (isDemo) {
      const newContact: Contact = {
        id: 'contact_' + Date.now(),
        ...contact,
        confirmed: true,
        createdAt: new Date().toISOString()
      };
      const updated = [...contacts, newContact];
      setContacts(updated);
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setSuccessMsg(`✓ Added ${contact.name} to emergency list.`);
      return;
    }

    if (!auth.currentUser) return;
    try {
      const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
      const docRef = await addDoc(contactsRef, {
        ...contact,
        confirmed: false,
        createdAt: new Date()
      });
      try {
        const sendConsent = httpsCallable(functions, 'sendContactConsent');
        await sendConsent({ contactId: docRef.id, uid: auth.currentUser.uid });
      } catch (e) {
        console.warn('Callable function sendContactConsent warning:', e);
      }
      fetchContacts();
      setSuccessMsg(`✓ Added ${contact.name} to emergency list.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (contact: Contact) => {
    setError(null);
    if (isDemo) {
      const updated = contacts.map((c) => (c.id === contact.id ? contact : c));
      setContacts(updated);
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setEditingContact(null);
      setSuccessMsg(`✓ Updated ${contact.name}.`);
      return;
    }

    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'contacts', contact.id);
      await updateDoc(docRef, {
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship
      });
      setEditingContact(null);
      fetchContacts();
      setSuccessMsg(`✓ Updated ${contact.name}.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    if (isDemo) {
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setSuccessMsg('✓ Contact removed.');
      return;
    }

    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'contacts', id);
      await deleteDoc(docRef);
      fetchContacts();
      setSuccessMsg('✓ Contact removed.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 transition"
          >
            <span>← Back to SOS Dashboard</span>
          </button>
          <span className="text-xs text-slate-400">
            {contacts.length}/5 Contacts Registered
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Emergency Contacts</h2>
          <p className="text-xs text-slate-400 mt-1">
            When SOS is triggered, an SMS with your live GPS location will be broadcast to these trusted contacts.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-200">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-200">
            {successMsg}
          </div>
        )}

        {/* Add Contact Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span>➕ Add Trusted Contact</span>
          </h3>
          <ContactForm
            onSubmit={handleAdd}
            disabled={contacts.length >= 5}
            submitLabel="Add to Emergency Contacts"
          />
        </div>

        {/* Contacts List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Active Contact Directory
          </h3>
          {contacts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs">
              No emergency contacts added yet. Add at least one trusted friend, family member, or authority.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {contacts.map((contact) => (
                <ContactItem
                  key={contact.id}
                  contact={contact}
                  onEdit={() => setEditingContact(contact)}
                  onDelete={() => handleDelete(contact.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Edit Modal */}
        {editingContact && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
              <h3 className="text-base font-bold text-white mb-4">Edit Emergency Contact</h3>
              <ContactForm
                initial={editingContact}
                onSubmit={(data) => handleUpdate({ ...editingContact, ...data })}
                onCancel={() => setEditingContact(null)}
                submitLabel="Save Changes"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ContactsPage;
