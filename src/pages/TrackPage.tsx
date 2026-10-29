import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper: recenter map when coordinates change
const MapRecenter: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

interface AlertTrackInfo {
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus?: string;
  ownerName?: string;
  updatedAt?: any;
  createdAt?: any;
  expiresAt?: any;
  resolvedAt?: any;
  resolutionReason?: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const TrackPage: React.FC = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const [alert, setAlert] = useState<AlertTrackInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update "now" every 5 seconds for freshness display
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!alertId) {
      setError('Invalid tracking URL: Alert ID missing.');
      setLoading(false);
      return;
    }

    // If Firebase is not configured, show simulated demo track (no fabricated GPS!)
    if (!isFirebaseConfigured()) {
      setAlert({
        status: 'active',
        latitude: null,
        longitude: null,
        accuracy: null,
        locationStatus: 'unavailable',
        ownerName: 'Demo User',
        updatedAt: new Date()
      });
      setLoading(false);
      return;
    }

    try {
      const alertRef = doc(db, 'alerts', alertId);
      const unsubscribe = onSnapshot(
        alertRef,
        (snap) => {
          setLoading(false);
          if (!snap.exists()) {
            setError(`Alert "${alertId}" not found or expired.`);
            return;
          }
          const data = snap.data();

          // TTL check: if alert has expired, show expiration message
          const expiresAtMs = data.expiresAt?.toMillis?.() || data.expiresAt;
          if (expiresAtMs && Date.now() > expiresAtMs) {
            setError('This tracking link has expired. Location sharing has ended for privacy.');
            return;
          }

          // Fallback TTL: if no expiresAt, check if createdAt is > 24h ago
          const createdAtMs = data.createdAt?.toMillis?.() || data.createdAt;
          if (!expiresAtMs && createdAtMs && Date.now() - createdAtMs > TWENTY_FOUR_HOURS_MS) {
            setError('This tracking link has expired (24-hour limit). Location sharing has ended.');
            return;
          }

          setAlert({
            status: data.status || 'active',
            latitude: typeof data.latitude === 'number' ? data.latitude : null,
            longitude: typeof data.longitude === 'number' ? data.longitude : null,
            accuracy: typeof data.accuracy === 'number' ? data.accuracy : null,
            locationStatus: data.locationStatus || 'unavailable',
            ownerName: data.ownerName || undefined,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
            resolvedAt: data.resolvedAt?.toDate?.() || data.resolvedAt,
            resolutionReason: data.resolutionReason
          });
        },
        (err) => {
          console.warn('Real-time tracking snapshot error:', err);
          setError('Failed to load live tracking data: ' + err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (e: any) {
      setError(e.message || 'Error subscribing to alert.');
      setLoading(false);
    }
  }, [alertId]);

  const coords =
    alert?.latitude !== null && alert?.longitude !== null && alert?.latitude !== undefined && alert?.longitude !== undefined
      ? ([alert.latitude, alert.longitude] as [number, number])
      : null;

  // Compute telemetry freshness
  const getFreshnessText = () => {
    if (!alert?.updatedAt) return null;
    const updatedMs = alert.updatedAt instanceof Date ? alert.updatedAt.getTime() : Number(alert.updatedAt);
    if (isNaN(updatedMs)) return null;
    const diffSec = Math.floor((now - updatedMs) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const freshnessText = getFreshnessText();
  const updatedMs = alert?.updatedAt instanceof Date ? alert.updatedAt.getTime() : Number(alert?.updatedAt || 0);
  const isStale = !isNaN(updatedMs) && updatedMs > 0 && (now - updatedMs > 60_000);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚨</span>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Suraksha Signal</h1>
              <p className="text-[10px] text-teal-400">Live Distress Tracking Portal</p>
            </div>
          </div>
          <a
            href="tel:112"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-600/30"
          >
            <span>📞 Call 112</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Connecting to live distress signal…</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-800/60 text-center">
            <span className="text-3xl block mb-2">⚠️</span>
            <h2 className="text-base font-bold text-red-200 mb-1">Tracking Unavailable</h2>
            <p className="text-xs text-red-300 max-w-md mx-auto">{error}</p>
            <div className="mt-4">
              <Link
                to="/"
                className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Go to Suraksha Signal Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Resolved notice */}
            {alert?.status === 'resolved' && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-center">
                <span className="text-3xl block mb-2">✅</span>
                <h2 className="text-base font-bold text-emerald-200 mb-1">Incident Resolved</h2>
                <p className="text-xs text-emerald-300 max-w-md mx-auto">
                  {alert.resolutionReason || 'The person has confirmed they are safe.'}
                  {alert.resolvedAt && (
                    <span className="block mt-1 text-slate-400 font-mono">
                      Resolved at {new Date(alert.resolvedAt).toLocaleTimeString()}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      alert?.status === 'active' ? 'bg-red-500 animate-ping' :
                      alert?.status === 'resolved' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    alert?.status === 'active' ? 'text-red-400' :
                    alert?.status === 'resolved' ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {alert?.status === 'active' ? 'Distress Signal Active' :
                     alert?.status === 'resolved' ? 'Incident Resolved' : 'Alert Dismissed / Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Alert ID: <span className="text-slate-200">{alertId}</span>
                </p>
                {alert?.ownerName && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    From: <span className="text-slate-200 font-semibold">{alert.ownerName}</span>
                  </p>
                )}
              </div>

              {/* Freshness indicator */}
              <div className="text-right">
                {freshnessText && (
                  <div className="text-[11px] text-slate-400">
                    <span>Last Update:</span>
                    <div className={`font-mono font-semibold ${isStale ? 'text-amber-400' : 'text-slate-200'}`}>
                      {freshnessText}
                    </div>
                    {isStale && (
                      <span className="text-[10px] text-amber-500">⚠ Signal may be stale</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Location status notice */}
            {alert?.locationStatus === 'denied' && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 text-center">
                ⚠️ The person&apos;s device denied GPS access. Location coordinates are unavailable.
              </div>
            )}

            {/* Coordinates info */}
            {coords ? (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-900 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">CURRENT LATITUDE</span>
                  <span className="text-teal-400 font-semibold">{coords[0].toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">CURRENT LONGITUDE</span>
                  <span className="text-teal-400 font-semibold">{coords[1].toFixed(5)}</span>
                </div>
              </div>
            ) : null}

            {/* Live Leaflet Map */}
            <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-800 relative z-0">
              {coords ? (
                <MapContainer
                  center={coords}
                  zoom={16}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapRecenter center={coords} />
                  <Marker position={coords}>
                    <Popup>
                      <strong>Active SOS Location</strong>
                      <br />
                      Latitude: {coords[0]}
                      <br />
                      Longitude: {coords[1]}
                      {alert?.accuracy && <><br />Accuracy: ±{Math.round(alert.accuracy)}m</>}
                    </Popup>
                  </Marker>
                  <Circle
                    center={coords}
                    radius={alert?.accuracy || 35}
                    pathOptions={{ color: '#ef4444', fillColor: '#dc2626', fillOpacity: 0.25 }}
                  />
                </MapContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-xs text-slate-500 gap-2">
                  <span className="text-2xl">📡</span>
                  <p>
                    {alert?.locationStatus === 'denied'
                      ? 'GPS access was denied on the sender\'s device.'
                      : 'Waiting for GPS coordinates from the device…'}
                  </p>
                </div>
              )}
            </div>

            <div className="text-center text-[11px] text-slate-500 pt-2">
              {alert?.status === 'active'
                ? 'This page automatically updates every few seconds as the device sends new GPS telemetry.'
                : 'Location updates have stopped — the incident is no longer active.'}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default TrackPage;
