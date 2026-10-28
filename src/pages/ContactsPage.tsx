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

    if (isDemo) {
      const newContact: Contact = {
        id: 'contact_' + Date.now(),
        ...contact,
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

  const handleDelete = async (id: string) => {
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
                  onDelete={() => handleDelete(contact.id)}
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
      </main>
    </div>
  );
};

export default ContactsPage;
