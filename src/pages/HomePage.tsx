import React, { useEffect, useState, useRef } from 'react';
import { collection, doc, query, orderBy, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, functions, isFirebaseConfigured } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import SOSButton from '@/components/SOSButton';
import { useNavigate } from 'react-router-dom';
import type { AppUser, Contact, ActiveAlert } from '@/types';
import { DEFAULT_DEMO_CONTACTS } from '@/constants';
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

const HomePage: React.FC<Props> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [showNoContactsModal, setShowNoContactsModal] = useState(false);
  const [sirenPlaying, setSirenPlaying] = useState(false);

  // Siren AudioContext and Oscillators refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const carrierOscRef = useRef<OscillatorNode | null>(null);
  const lfoOscRef = useRef<OscillatorNode | null>(null);

  // Load contacts (Firestore for real users; LocalStorage for demo)
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
          // Real users get their actual contacts, NO fallback to demo contacts!
          setContacts(list);
        } catch (err) {
          console.warn('Firestore fetch failed:', err);
          setContacts([]);
        }
      }
    };

    loadContacts();
  }, [user]);

  // Geolocation tracking
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported by this browser');
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
        setCoords((prev) => prev || { lat: 12.9716, lng: 77.5946, accuracy: 50 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Live Location stream: Update alert document in Firestore every ~10s while alert is active
  useEffect(() => {
    if (!activeAlert || activeAlert.status === 'failed' || activeAlert.isDemo || !coords) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const alertDocRef = doc(db, 'alerts', activeAlert.id);
        await updateDoc(alertDocRef, {
          latitude: coords.lat,
          longitude: coords.lng,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Live location update warning:', e);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [activeAlert, coords]);

  // Cleanup siren audio nodes and context
  const stopSiren = () => {
    try {
      if (carrierOscRef.current) {
        carrierOscRef.current.stop();
        carrierOscRef.current.disconnect();
        carrierOscRef.current = null;
      }
      if (lfoOscRef.current) {
        lfoOscRef.current.stop();
        lfoOscRef.current.disconnect();
        lfoOscRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping siren audio:', e);
    }
    setSirenPlaying(false);
  };

  // Web Audio emergency siren with looping LFO
  const toggleSiren = () => {
    if (sirenPlaying) {
      stopSiren();
    } else {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        // Carrier oscillator (primary tone ~900Hz)
        const carrier = ctx.createOscillator();
        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(900, ctx.currentTime);

        // LFO oscillator (~1.5Hz pitch modulator for classic police/emergency wail)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(1.5, ctx.currentTime);

        // LFO depth
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(450, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(carrier.frequency);

        // Master volume
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.2, ctx.currentTime);
        carrier.connect(masterGain);
        masterGain.connect(ctx.destination);

        carrier.start();
        lfo.start();

        carrierOscRef.current = carrier;
        lfoOscRef.current = lfo;
        setSirenPlaying(true);
      } catch (e) {
        console.warn('Audio siren error:', e);
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopSiren();
    };
  }, []);

  // SOS activation handler
  const handleSOS = async () => {
    // Check confirmed contacts for real users
    const confirmedList = contacts.filter((c) => c.confirmed);

    if (!user.isDemo && confirmedList.length === 0) {
      setShowNoContactsModal(true);
      return;
    }

    const alertId = 'ALERT_' + Date.now().toString(36).toUpperCase();
    const timeStr = new Date().toLocaleTimeString();

    // Set initial sending state
    setActiveAlert({
      id: alertId,
      time: timeStr,
      status: 'sending',
      isDemo: user.isDemo
    });

    if (user.isDemo || !isFirebaseConfigured() || !auth.currentUser) {
      // Simulate realistic demo send
      setTimeout(() => {
        setActiveAlert({
          id: alertId,
          time: timeStr,
          status: 'sent',
          sentCount: contacts.length,
          totalCount: contacts.length,
          isDemo: true
        });
      }, 700);
      return;
    }

    try {
      // 1. Create alert document in Firestore with owner and initial coordinates
      const alertDocRef = doc(db, 'alerts', alertId);
      await setDoc(alertDocRef, {
        ownerUid: auth.currentUser.uid,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        latitude: coords?.lat || null,
        longitude: coords?.lng || null
      });

      // 2. Invoke triggerSOS Cloud Function
      const triggerSOSFn = httpsCallable<{ sessionId: string }, { sent: number; failed: number; total: number }>(
        functions,
        'triggerSOS'
      );
      const res = await triggerSOSFn({ sessionId: alertId });

      const { sent, total } = res.data;
      setActiveAlert({
        id: alertId,
        time: timeStr,
        status: 'sent',
        sentCount: sent,
        totalCount: total,
        isDemo: false
      });
    } catch (err: any) {
      console.error('Backend SOS broadcast failed:', err);
      setActiveAlert({
        id: alertId,
        time: timeStr,
        status: 'failed',
        error: err.message || 'Network error while broadcasting distress signal.',
        isDemo: false
      });
    }
  };

  const handleDismissAlert = async () => {
    if (activeAlert && !activeAlert.isDemo && isFirebaseConfigured() && auth.currentUser) {
      try {
        const alertDocRef = doc(db, 'alerts', activeAlert.id);
        await updateDoc(alertDocRef, {
          status: 'dismissed',
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Error dismissing alert in firestore:', e);
      }
    }
    setActiveAlert(null);
  };

  const centerPos: [number, number] = coords ? [coords.lat, coords.lng] : [12.9716, 77.5946];
  const confirmedCount = contacts.filter((c) => c.confirmed).length;

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
                {user.isDemo && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded font-mono">
                    DEMO MODE
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/contacts')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              👥 Contacts ({confirmedCount} active)
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
        {/* Active Emergency Alert Banner with Real States */}
        {activeAlert && (
          <div
            className={`p-4 rounded-2xl border shadow-lg transition-all ${
              activeAlert.status === 'sending'
                ? 'bg-amber-950/70 border-amber-500/80 shadow-amber-900/20'
                : activeAlert.status === 'failed'
                ? 'bg-rose-950 border-rose-600 shadow-rose-950/50'
                : 'bg-gradient-to-r from-red-950 to-rose-950 border-red-600/80 shadow-red-900/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">
                  {activeAlert.status === 'sending' ? '⏳' : activeAlert.status === 'failed' ? '❌' : '🚨'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">
                      {activeAlert.status === 'sending'
                        ? 'BROADCASTING EMERGENCY DISTRESS SIGNAL…'
                        : activeAlert.status === 'failed'
                        ? 'SOS DISPATCH FAILED'
                        : 'DISTRESS SIGNAL BROADCAST ACTIVE'}
                    </h3>
                    {activeAlert.isDemo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 uppercase">
                        DEMO: no real messages were sent
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mt-1 font-mono">
                    Triggered at {activeAlert.time} • Alert ID: {activeAlert.id}
                  </p>

                  {activeAlert.status === 'sending' && (
                    <p className="text-xs text-amber-300 mt-1">
                      Dispatching encrypted location and panic signals to your emergency contacts…
                    </p>
                  )}

                  {activeAlert.status === 'sent' && (
                    <p className="text-xs text-emerald-300 mt-1 font-medium">
                      ✓ Successfully sent distress SMS to {activeAlert.sentCount} of {activeAlert.totalCount} confirmed contacts.
                    </p>
                  )}

                  {activeAlert.status === 'failed' && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-rose-200 bg-rose-900/40 p-2 rounded-lg border border-rose-800">
                        {activeAlert.error || 'Could not deliver SMS dispatch to emergency contacts.'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={handleSOS}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
                        >
                          🔄 Retry SOS Dispatch
                        </button>
                        <a
                          href="tel:112"
                          className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md shadow-red-600/30 flex items-center gap-1.5"
                        >
                          <span>📞 Call 112 Immediately</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleDismissAlert}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
              >
                Dismiss
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
                  <span>🛡️ Emergency Contacts ({confirmedCount} active)</span>
                </h3>
                <button
                  onClick={() => navigate('/contacts')}
                  className="text-xs text-teal-400 hover:text-teal-300 font-medium"
                >
                  Manage →
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center text-xs text-slate-400">
                  <p>No emergency contacts added yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Add trusted friends or family so they receive distress alerts.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {contacts.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-200">{c.name}</p>
                          {c.confirmed ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                              Verified
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 font-mono text-[11px]">{c.phone}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {c.relationship || 'Emergency'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Zero Confirmed Contacts Blocking Modal */}
      {showNoContactsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-3xl">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Confirmed Contacts</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              SOS cannot be triggered because you do not have any confirmed emergency contacts. Please add at least one trusted contact who has confirmed via SMS before broadcasting distress alerts.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setShowNoContactsModal(false);
                  navigate('/contacts');
                }}
                className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-teal-500/20"
              >
                Go to Emergency Contacts →
              </button>
              <button
                onClick={() => setShowNoContactsModal(false)}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs border border-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
