import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import ContactItem from '@/components/ContactItem';
import ContactForm from '@/components/ContactForm';
import { useNavigate } from 'react-router-dom';
import type { Contact } from '@/pages/ContactsPage';
import SOSButton from '@/components/SOSButton';
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auth guard – redirect to sign‑in if not logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate('/auth');
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchContacts = async () => {
    if (!auth.currentUser) return;
    const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
    const q = query(contactsRef, orderBy('createdAt'));
    const snapshot = await getDocs(q);
    const list: Contact[] = [];
    snapshot.forEach((docSnap) => {
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
    // The actual add logic lives in ContactsPage; here we just refresh the list.
    await fetchContacts();
  };

  // SOS handler – creates an alert session, starts location watch, and triggers mock SMS
  const handleSOS = async () => {
    if (!auth.currentUser) return;
    try {
      // Build contacts array (phone numbers only)
      const contactPhones = contacts.map((c) => c.phone);

      // Create alert document (initially without location)
      const alertsRef = collection(db, 'alerts');
      const alertDoc = await addDoc(alertsRef, {
        ownerUid: auth.currentUser.uid,
        createdAt: new Date(),
        contacts: contactPhones,
        status: 'active',
        latitude: null,
        longitude: null,
      });

      // Start watching device location and update the alert doc in real‑time
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          updateDoc(alertDoc.ref, { latitude, longitude });
        },
        (err) => console.error('Geolocation error:', err),
        { enableHighAccuracy: true }
      );

      // Store watchId in a ref so we could clear it later (optional)
      // (not used in this MVP but kept for future enhancements)

      // Call Cloud Function to send mock SMS to trusted contacts
      const triggerSOS = httpsCallable(functions, 'triggerSOS');
      await triggerSOS({ sessionId: alertDoc.id, contacts: contactPhones });

      alert('🚨 SOS sent! Trusted contacts have been notified.');
    } catch (e: any) {
      console.error('SOS error:', e);
      alert('Failed to send SOS: ' + e.message);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">My Trusted Contacts</h1>
      {error && <div className="mb-2 text-red-600">{error}</div>}
      <ContactForm
        onSubmit={handleAdd}
        disabled={contacts.length >= 5}
        submitLabel="Add Contact"
      />
      <ul className="mt-6 space-y-3">
        {contacts.map((contact) => (
          <ContactItem
            key={contact.id}
            contact={contact}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ))}
      </ul>
    </div>
  );
};

export default HomePage;
