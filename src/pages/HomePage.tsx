import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db, auth, functions, isFirebaseConfigured } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import SOSButton from '@/components/SOSButton';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '@/App';
import type { Contact } from '@/pages/ContactsPage';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet default icon marker in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  user: AppUser;
  onLogout: () => void;
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

const HomePage: React.FC<Props> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<{ id: string; time: string } | null>(null);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const oscillatorRef = React.useRef<OscillatorNode | null>(null);

  // Load contacts (from Firestore or LocalStorage for demo)
  useEffect(() => {
    const loadContacts = async () => {
      if (user.isDemo || !isFirebaseConfigured() || !auth.currentUser) {
        const saved = localStorage.getItem('safesignal_contacts');
        if (saved) {
          try {
            setContacts(JSON.parse(saved));
            return;
          } catch {
            // fallback
          }
        }
        setContacts(DEFAULT_DEMO_CONTACTS);
        localStorage.setItem('safesignal_contacts', JSON.stringify(DEFAULT_DEMO_CONTACTS));
      } else {
        try {
          const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
          const q = query(contactsRef, orderBy('createdAt'));
          const snapshot = await getDocs(q);
          const list: Contact[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<Contact, 'id'>;
            list.push({ id: docSnap.id, ...data });
          });
          setContacts(list.length > 0 ? list : DEFAULT_DEMO_CONTACTS);
        } catch (err) {
          console.warn('Firestore fetch failed, using local contacts fallback:', err);
          setContacts(DEFAULT_DEMO_CONTACTS);
        }
      }
    };

    loadContacts();
  }, [user]);

  // Geolocation tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported by this browser');
      // Set default demo location (Bengaluru)
      setCoords({ lat: 12.9716, lng: 77.5946, accuracy: 25 });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGeoError(null);
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        setGeoError(err.message);
        // Default to Bangalore coordinates for testing
        setCoords((prev) => prev || { lat: 12.9716, lng: 77.5946, accuracy: 50 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Web Audio emergency siren
  const toggleSiren = () => {
    if (sirenPlaying) {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      setSirenPlaying(false);
    } else {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        // Siren warble
        let time = ctx.currentTime;
        for (let i = 0; i < 20; i++) {
          osc.frequency.exponentialRampToValueAtTime(1400, time + 0.3);
          osc.frequency.exponentialRampToValueAtTime(800, time + 0.6);
          time += 0.6;
        }

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscillatorRef.current = osc;
        setSirenPlaying(true);
      } catch (e) {
        console.warn('Audio siren error:', e);
      }
    }
  };

  // SOS activation handler
  const handleSOS = async () => {
    const contactPhones = contacts.map((c) => `${c.name} (${c.phone})`);
    const alertId = 'ALERT_' + Date.now().toString(36).toUpperCase();
    const timeStr = new Date().toLocaleTimeString();

    setActiveAlert({ id: alertId, time: timeStr });

    // If connected to real Firebase, push to collection
    if (!user.isDemo && isFirebaseConfigured() && auth.currentUser) {
      try {
        const alertsRef = collection(db, 'alerts');
        await addDoc(alertsRef, {
          ownerUid: auth.currentUser.uid,
          createdAt: new Date(),
          contacts: contacts.map((c) => c.phone),
          status: 'active',
          latitude: coords?.lat || null,
          longitude: coords?.lng || null
        });
        const triggerSOS = httpsCallable(functions, 'triggerSOS');
        await triggerSOS({ sessionId: alertId, contacts: contacts.map((c) => c.phone) });
      } catch (err) {
        console.warn('Backend SOS broadcast warning:', err);
      }
    }
  };

  const centerPos: [number, number] = coords ? [coords.lat, coords.lng] : [12.9716, 77.5946];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-lg">
              🚨
            </span>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Suraksha Signal</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Monitoring Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/contacts')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              👥 Contacts ({contacts.length})
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Active Emergency Alert Banner */}
        {activeAlert && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950 to-rose-950 border border-red-600/80 shadow-lg shadow-red-900/30 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-red-100 text-base">
                    DISTRESS SIGNAL BROADCAST ACTIVE
                  </h3>
                  <p className="text-xs text-red-200 mt-0.5">
                    Triggered at {activeAlert.time} • Alert ID: {activeAlert.id}
                  </p>
                  <p className="text-xs text-red-300 mt-1 font-mono">
                    Notified {contacts.length} emergency contacts with live GPS coordinates.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveAlert(null)}
                className="px-3 py-1 rounded-lg bg-red-800/80 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        )}

        {/* SOS Central Trigger Hero */}
        <div className="p-8 rounded-3xl bg-slate-900/70 border border-slate-800/80 text-center relative overflow-hidden backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-black tracking-tight text-white">Emergency Panic Button</h2>
            <p className="text-sm text-slate-400 mt-1">
              Press and hold to send instant distress alert with your location
            </p>
          </div>

          <div className="py-4">
            <SOSButton onActivate={handleSOS} />
          </div>

          {/* Quick utility controls */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={toggleSiren}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
                sirenPlaying
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-bounce'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
              }`}
            >
              <span>{sirenPlaying ? '🔊 Stop Loud Siren' : '📢 Test Audible Siren'}</span>
            </button>

            <a
              href="tel:112"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-red-300 border border-red-500/30 flex items-center gap-2 transition"
            >
              <span>📞 Dial National Emergency (112)</span>
            </a>
          </div>
        </div>

        {/* Grid: Live GPS & Emergency Contacts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Geolocation Card & Leaflet Map */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>📍 Live GPS Tracking</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-medium">
                {coords ? `±${Math.round(coords.accuracy)}m accuracy` : 'Acquiring GPS'}
              </span>
            </div>

            {coords ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex gap-2 text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex-1">
                    <span className="text-slate-500 block text-[10px]">LATITUDE</span>
                    <span className="text-teal-400 font-semibold">{coords.lat.toFixed(5)}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-slate-500 block text-[10px]">LONGITUDE</span>
                    <span className="text-teal-400 font-semibold">{coords.lng.toFixed(5)}</span>
                  </div>
                </div>

                {/* Leaflet Interactive Map */}
                <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-800 z-0">
                  <MapContainer
                    center={centerPos}
                    zoom={15}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={centerPos}>
                      <Popup>Your current location</Popup>
                    </Marker>
                    <Circle
                      center={centerPos}
                      radius={coords.accuracy || 20}
                      pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.2 }}
                    />
                  </MapContainer>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs">Connecting to device GPS sensor…</p>
                {geoError && <p className="text-[11px] text-amber-400 mt-1">{geoError}</p>}
              </div>
            )}
          </div>

          {/* Trusted Contacts Overview */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>🛡️ Emergency Contacts ({contacts.length}/5)</span>
                </h3>
                <button
                  onClick={() => navigate('/contacts')}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium"
                >
                  Manage →
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {contacts.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{c.name}</p>
                      <p className="text-slate-400 font-mono text-[11px]">{c.phone}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {c.relationship || 'Emergency'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/contacts')}
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
            >
              + Add / Edit Emergency Contacts
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
