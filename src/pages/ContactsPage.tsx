import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth, functions, isFirebaseConfigured } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import ContactForm from '@/components/ContactForm';
import ContactItem from '@/components/ContactItem';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppUser, Contact } from '@/types';
import { DEFAULT_DEMO_CONTACTS } from '@/constants';

interface Props {
  user?: AppUser;
  onLogout?: () => void;
}

const ContactsPage: React.FC<Props> = ({ user }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isDemo = user?.isDemo || !isFirebaseConfigured() || !auth.currentUser;

  const fetchContacts = async () => {
    if (isDemo) {
      const saved = localStorage.getItem('suraksha_contacts') || localStorage.getItem('safesignal_contacts');
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
          localStorage.setItem('suraksha_contacts', saved);
          return;
        } catch {}
      }
      setContacts(DEFAULT_DEMO_CONTACTS);
      localStorage.setItem('suraksha_contacts', JSON.stringify(DEFAULT_DEMO_CONTACTS));
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
        // Real user gets their actual contacts (no default demo contacts fallback)
        setContacts(list);
      } catch (err: any) {
        console.warn('Firestore fetch failed:', err);
        setError('Could not load contacts from cloud: ' + err.message);
      }
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAdd = async (contact: Omit<Contact, 'id' | 'createdAt' | 'confirmed'>) => {
    setError(null);
    setSuccessMsg(null);

    if (contacts.length >= 5) {
      setError(t('contacts.limitError'));
      return;
    }

    // Duplicate phone check
    const isDuplicate = contacts.some(
      (c) => c.phone.replace(/\s+/g, '') === contact.phone.replace(/\s+/g, '')
    );
    if (isDuplicate) {
      setError('An emergency contact with this phone number already exists.');
      return;
    }

    const priority = contacts.length + 1;

    if (isDemo) {
      const newContact: Contact = {
        id: 'contact_' + Date.now(),
        ...contact,
        priority,
        confirmed: true,
        createdAt: new Date().toISOString()
      };
      const updated = [...contacts, newContact];
      setContacts(updated);
      localStorage.setItem('suraksha_contacts', JSON.stringify(updated));
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setSuccessMsg(t('contacts.addedSuccess', { name: contact.name }));
      return;
    }

    if (!auth.currentUser) return;
    
    try {
      const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
      const docRef = await addDoc(contactsRef, {
        ...contact,
        priority,
        confirmed: false,
        createdAt: new Date()
      });
      try {
        const sendConsent = httpsCallable(functions, 'sendContactConsent');
        await sendConsent({ contactId: docRef.id });
      } catch (e) {
        console.warn('Callable function sendContactConsent warning:', e);
      }
      fetchContacts();
      setSuccessMsg(t('contacts.addedSuccess', { name: contact.name }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (contact: Contact) => {
    setError(null);

    // Duplicate phone check on other contacts
    const isDuplicate = contacts.some(
      (c) => c.id !== contact.id && c.phone.replace(/\s+/g, '') === contact.phone.replace(/\s+/g, '')
    );
    if (isDuplicate) {
      setError('Another emergency contact already uses this phone number.');
      return;
    }

    if (isDemo) {
      const updated = contacts.map((c) => (c.id === contact.id ? contact : c));
      setContacts(updated);
      localStorage.setItem('suraksha_contacts', JSON.stringify(updated));
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setEditingContact(null);
      setSuccessMsg(t('contacts.updatedSuccess', { name: contact.name }));
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
      setSuccessMsg(t('contacts.updatedSuccess', { name: contact.name }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    const id = contactToDelete.id;
    setContactToDelete(null);
    setError(null);

    if (isDemo) {
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);
      localStorage.setItem('suraksha_contacts', JSON.stringify(updated));
      localStorage.setItem('safesignal_contacts', JSON.stringify(updated));
      setSuccessMsg(t('contacts.deletedSuccess'));
      return;
    }

    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'contacts', id);
      await deleteDoc(docRef);
      fetchContacts();
      setSuccessMsg(t('contacts.deletedSuccess'));
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
            <span>{t('nav.backHome')}</span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="text-xs text-slate-400">
              {t('contacts.registeredCount', { count: contacts.length })}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{t('contacts.title')}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('contacts.subtitle')}
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
            <span>{t('contacts.addNew')}</span>
          </h3>
          <ContactForm
            onSubmit={handleAdd}
            disabled={contacts.length >= 5}
            submitLabel={t('form.addBtn')}
          />
        </div>

        {/* Contacts List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            {t('contacts.directoryTitle')}
          </h3>
          {contacts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs">
              {t('contacts.noContactsPage')}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {contacts.map((contact) => (
                <ContactItem
                  key={contact.id}
                  contact={contact}
                  onEdit={() => setEditingContact(contact)}
                  onDelete={() => setContactToDelete(contact)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Edit Modal */}
        {editingContact && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-base font-bold text-white mb-4">{t('contacts.editContact')}</h3>
              <ContactForm
                initial={{
                  name: editingContact.name,
                  phone: editingContact.phone,
                  relationship: editingContact.relationship
                }}
                onSubmit={async (data) => {
                  await handleUpdate({
                    ...editingContact,
                    ...data
                  });
                }}
                onCancel={() => setEditingContact(null)}
                submitLabel={t('form.saveBtn')}
              />
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {contactToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Remove Emergency Contact?</h3>
              <p className="text-xs text-slate-300 mb-1">
                Are you sure you want to remove <span className="font-semibold text-white">{contactToDelete.name}</span> ({contactToDelete.phone}) from your emergency contacts?
              </p>
              <p className="text-xs text-red-300 mb-5">
                They will no longer receive SOS alerts during emergencies.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setContactToDelete(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-red-600/20"
                >
                  Yes, Remove Contact
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ContactsPage;
