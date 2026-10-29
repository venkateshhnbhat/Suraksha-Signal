import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, doc, query, orderBy, getDocs, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, functions, isFirebaseConfigured } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import SOSButton from '@/components/SOSButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppUser, Contact, ActiveAlert, SOSStatus, LocationStatus } from '@/types';
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

// Persist active alert ID in sessionStorage so page refresh can restore it
const ACTIVE_ALERT_KEY = 'suraksha_active_alert';

const HomePage: React.FC<Props> = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('unavailable');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [showNoContactsModal, setShowNoContactsModal] = useState(false);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [sosInFlight, setSosInFlight] = useState(false);

  // Siren AudioContext and Oscillators refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const carrierOscRef = useRef<OscillatorNode | null>(null);
  const lfoOscRef = useRef<OscillatorNode | null>(null);

  // Persist/restore active alert across page refreshes
  const persistAlert = useCallback((alert: ActiveAlert | null) => {
    setActiveAlert(alert);
    if (alert && !alert.isDemo) {
      sessionStorage.setItem(ACTIVE_ALERT_KEY, JSON.stringify(alert));
    } else {
      sessionStorage.removeItem(ACTIVE_ALERT_KEY);
    }
  }, []);

  // Restore active alert from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(ACTIVE_ALERT_KEY);
    if (saved && !user.isDemo && isFirebaseConfigured() && auth.currentUser) {
      try {
        const parsed = JSON.parse(saved) as ActiveAlert;
        if (parsed.id && (parsed.status === 'sending' || parsed.status === 'sent' || parsed.status === 'preparing')) {
          const alertRef = doc(db, 'alerts', parsed.id);
          getDoc(alertRef).then((snap) => {
            if (snap.exists()) {
              const data = snap.data();
              if (data.status === 'active') {
                setActiveAlert({
                  ...parsed,
                  status: data.deliveryStatus === 'sent' || data.deliveryStatus === 'partial' ? 'sent' : parsed.status,
                  sentCount: data.summary?.sent ?? parsed.sentCount,
                  totalCount: data.summary?.total ?? parsed.totalCount
                });
              } else if (data.status === 'resolved' || data.status === 'dismissed') {
                sessionStorage.removeItem(ACTIVE_ALERT_KEY);
              }
            } else {
              sessionStorage.removeItem(ACTIVE_ALERT_KEY);
            }
          }).catch(() => {
            setActiveAlert(parsed);
          });
        }
      } catch {
        sessionStorage.removeItem(ACTIVE_ALERT_KEY);
      }
    }
  }, [user]);

  // Load contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (user.isDemo || !isFirebaseConfigured() || !auth.currentUser) {
        const saved = localStorage.getItem('suraksha_contacts') || localStorage.getItem('safesignal_contacts');
        if (saved) {
          try {
            setContacts(JSON.parse(saved));
            localStorage.setItem('suraksha_contacts', saved);
            return;
          } catch {
            // fallback
          }
        }
        setContacts(DEFAULT_DEMO_CONTACTS);
        localStorage.setItem('suraksha_contacts', JSON.stringify(DEFAULT_DEMO_CONTACTS));
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
          setContacts(list);
        } catch (err) {
          console.warn('Firestore fetch failed:', err);
          setContacts([]);
        }
      }
    };

    loadContacts();
  }, [user]);

  // Geolocation tracking — NEVER fabricate coordinates
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported by this browser');
      setLocationStatus('unavailable');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        if (newCoords.lat >= -90 && newCoords.lat <= 90 &&
            newCoords.lng >= -180 && newCoords.lng <= 180) {
          setCoords(newCoords);
          setLocationStatus('acquired');
          setGeoError(null);
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        setGeoError(err.message);
        if (err.code === 1) {
          setLocationStatus('denied');
        } else if (err.code === 3) {
          setLocationStatus('stale');
        } else {
          setLocationStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Live Location stream: Update alert document in Firestore every ~10s while alert is active
  useEffect(() => {
    if (!activeAlert || activeAlert.status === 'failed' || activeAlert.status === 'resolved' || activeAlert.isDemo || !coords) {
      return;
    }

    const pushLocation = async () => {
      try {
        const alertDocRef = doc(db, 'alerts', activeAlert.id);
        await updateDoc(alertDocRef, {
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy,
          locationStatus: locationStatus,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Live location update warning:', e);
      }
    };

    pushLocation();
    const intervalId = setInterval(pushLocation, 10000);

    return () => clearInterval(intervalId);
  }, [activeAlert, coords, locationStatus]);

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

        const carrier = ctx.createOscillator();
        carrier.type = 'sawtooth';
        carrier.frequency.setValueAtTime(900, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(1.5, ctx.currentTime);

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(450, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(carrier.frequency);

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

  useEffect(() => {
    return () => {
      stopSiren();
    };
  }, []);

  // SOS activation handler
  const handleSOS = async () => {
    if (sosInFlight) return;
    if (activeAlert && activeAlert.status !== 'failed' && activeAlert.status !== 'resolved') {
      return;
    }

    const confirmedList = contacts.filter((c) => c.confirmed);

    if (!user.isDemo && confirmedList.length === 0) {
      setShowNoContactsModal(true);
      return;
    }

    const alertId = 'ALERT_' + Date.now().toString(36).toUpperCase();
    const timeStr = new Date().toLocaleTimeString();

    const newAlert: ActiveAlert = {
      id: alertId,
      time: timeStr,
      status: 'preparing',
      locationStatus: locationStatus,
      isDemo: user.isDemo
    };
    persistAlert(newAlert);
    setSosInFlight(true);

    if (user.isDemo || !isFirebaseConfigured() || !auth.currentUser) {
      persistAlert({ ...newAlert, status: 'sending' });
      setTimeout(() => {
        persistAlert({
          id: alertId,
          time: timeStr,
          status: 'sent',
          sentCount: contacts.length,
          totalCount: contacts.length,
          isDemo: true
        });
        setSosInFlight(false);
      }, 700);
      return;
    }

    try {
      persistAlert({ ...newAlert, status: 'sending' });
      const alertDocRef = doc(db, 'alerts', alertId);
      await setDoc(alertDocRef, {
        ownerUid: auth.currentUser.uid,
        ownerName: user.displayName || 'Unknown',
        status: 'active',
        deliveryStatus: 'preparing',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        accuracy: coords?.accuracy ?? null,
        locationStatus: locationStatus
      });

      const triggerSOSFn = httpsCallable<
        { sessionId: string },
        { sent: number; failed: number; total: number; deliveryStatus?: string; idempotent?: boolean }
      >(functions, 'triggerSOS');
      const res = await triggerSOSFn({ sessionId: alertId });

      const { sent, total, deliveryStatus: ds } = res.data;
      const finalStatus: SOSStatus = ds === 'failed' ? 'failed' : 'sent';
      persistAlert({
        id: alertId,
        time: timeStr,
        status: finalStatus,
        sentCount: sent,
        totalCount: total,
        isDemo: false,
        error: ds === 'failed' ? 'No confirmed contacts could be notified.' : undefined
      });
    } catch (err: any) {
      console.error('Backend SOS broadcast failed:', err);
      persistAlert({
        id: alertId,
        time: timeStr,
        status: 'failed',
        error: err.message || 'Network error while broadcasting distress signal.',
        isDemo: false
      });
    } finally {
      setSosInFlight(false);
    }
  };

  const handleResolveSOS = async (reason?: string) => {
    if (!activeAlert) return;

    if (activeAlert.isDemo || !isFirebaseConfigured() || !auth.currentUser) {
      persistAlert(null);
      return;
    }

    try {
      const resolveSOSFn = httpsCallable<
        { sessionId: string; reason?: string },
        { success: boolean }
      >(functions, 'resolveSOS');
      await resolveSOSFn({ sessionId: activeAlert.id, reason: reason || 'Resolved by user' });
    } catch {
      try {
        const alertDocRef = doc(db, 'alerts', activeAlert.id);
        await updateDoc(alertDocRef, {
          status: 'resolved',
          updatedAt: serverTimestamp()
        });
      } catch (e2) {
        console.warn('Error resolving alert in firestore:', e2);
      }
    }

    persistAlert(null);
    stopSiren();
  };

  const handleDismissAlert = async () => {
    await handleResolveSOS('Dismissed by user');
  };

  const centerPos: [number, number] | null = coords ? [coords.lat, coords.lng] : null;
  const confirmedCount = contacts.filter((c) => c.confirmed).length;

  const getLocationStatusText = () => {
    switch (locationStatus) {
      case 'acquired':
        return coords ? `±${Math.round(coords.accuracy)}m accuracy` : 'Acquiring GPS';
      case 'denied':
        return '⚠️ Location permission denied';
      case 'stale':
        return '⚠️ Location may be stale';
      case 'unavailable':
      default:
        return 'Acquiring GPS…';
    }
  };

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
              <h1 className="text-base font-bold text-white leading-tight">{t('brand.name')}</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{t('brand.monitoring')}</span>
                {user.isDemo && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded font-mono">
                    {t('brand.demoMode')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/contacts')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              👥 {t('nav.contactsActive', { count: confirmedCount })}
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Active Emergency Alert Banner */}
        {activeAlert && (
          <div
            className={`p-4 rounded-2xl border shadow-lg transition-all ${
              activeAlert.status === 'preparing' || activeAlert.status === 'sending'
                ? 'bg-amber-950/70 border-amber-500/80 shadow-amber-900/20'
                : activeAlert.status === 'failed'
                ? 'bg-rose-950 border-rose-600 shadow-rose-950/50'
                : activeAlert.status === 'resolved'
                ? 'bg-slate-900 border-slate-700'
                : 'bg-gradient-to-r from-red-950 to-rose-950 border-red-600/80 shadow-red-900/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">
                  {activeAlert.status === 'preparing' || activeAlert.status === 'sending'
                    ? '⏳'
                    : activeAlert.status === 'failed'
                    ? '❌'
                    : activeAlert.status === 'resolved'
                    ? '✅'
                    : '🚨'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">
                      {activeAlert.status === 'preparing'
                        ? 'PREPARING EMERGENCY INCIDENT…'
                        : activeAlert.status === 'sending'
                        ? 'BROADCASTING EMERGENCY DISTRESS SIGNAL…'
                        : activeAlert.status === 'failed'
                        ? 'SOS DISPATCH FAILED'
                        : activeAlert.status === 'resolved'
                        ? 'INCIDENT RESOLVED'
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

                  {activeAlert.locationStatus === 'denied' && (
                    <p className="text-xs text-amber-300 mt-1">
                      ⚠️ Location permission was denied — alert sent without GPS coordinates.
                    </p>
                  )}

                  {(activeAlert.status === 'preparing' || activeAlert.status === 'sending') && (
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
                          disabled={sosInFlight}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
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

                  {activeAlert.status === 'sent' && !activeAlert.isDemo && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleResolveSOS('I am safe now')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition"
                      >
                        ✅ I&apos;m Safe — Resolve Incident
                      </button>
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
            {locationStatus === 'denied' && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠️ GPS permission denied — SOS will still work but without your location
              </p>
            )}
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
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                locationStatus === 'acquired'
                  ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                  : locationStatus === 'denied'
                  ? 'bg-red-500/10 text-red-300 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}>
                {getLocationStatusText()}
              </span>
            </div>

            {coords && centerPos ? (
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
                {locationStatus === 'denied' ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center text-2xl mb-2">🚫</div>
                    <p className="text-xs font-semibold text-red-300">Location Permission Denied</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enable location access in your browser settings to share GPS coordinates with emergency contacts.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-xs">Connecting to device GPS sensor…</p>
                    {geoError && <p className="text-[11px] text-amber-400 mt-1">{geoError}</p>}
                  </>
                )}
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
