import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db, auth, functions } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import ContactForm from '@/components/ContactForm';
import ContactItem from '@/components/ContactItem';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  confirmed: boolean;
  createdAt: any;
}

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    if (!auth.currentUser) return;
    const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
    const q = query(contactsRef, orderBy('createdAt'));
    const snapshot = await getDocs(q);
    const list: Contact[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Omit<Contact, 'id'>;
      list.push({ id: docSnap.id, ...data });
    });
    setContacts(list);
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (contact: Omit<Contact, 'id' | 'createdAt' | 'confirmed'>) => {
    if (!auth.currentUser) return;
    try {
      const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
      const docRef = await addDoc(contactsRef, {
        ...contact,
        confirmed: false,
        createdAt: new Date()
      });
      // Fire the consent SMS via Cloud Function (callable)
      const sendConsent = httpsCallable(functions, 'sendContactConsent');
      await sendConsent({ contactId: docRef.id, uid: auth.currentUser.uid });
      fetchContacts();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (contact: Contact) => {
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
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'contacts', id);
      await deleteDoc(docRef);
      fetchContacts();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Trusted Contacts</h1>
      {error && <div className="mb-2 text-red-600">{error}</div>}
      <ContactForm
        onSubmit={handleAdd}
        disabled={contacts.length >= 5}
        submitLabel="Add Contact"
      />
      <ul className="mt-6 space-y-3">
        {contacts.map(contact => (
          <ContactItem
            key={contact.id}
            contact={contact}
            onEdit={() => setEditingContact(contact)}
            onDelete={() => handleDelete(contact.id)}
          />
        ))}
      </ul>
      {editingContact && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-medium mb-4">Edit Contact</h2>
            <ContactForm
              initial={editingContact}
              onSubmit={(data) => handleUpdate({ ...editingContact, ...data })}
              onCancel={() => setEditingContact(null)}
              submitLabel="Save"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
