import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/firebase';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface AlertTrackInfo {
  status: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt?: any;
  createdAt?: any;
}

const TrackPage: React.FC = () => {
  const { alertId } = useParams<{ alertId: string }>();
  const [alert, setAlert] = useState<AlertTrackInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!alertId) {
      setError('Invalid tracking URL: Alert ID missing.');
      setLoading(false);
      return;
    }

    // If Firebase is not configured, show simulated demo track
    if (!isFirebaseConfigured()) {
      setAlert({
        status: 'active',
        latitude: 12.9716,
        longitude: 77.5946,
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
          setAlert({
            status: data.status || 'active',
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
            createdAt: data.createdAt?.toDate?.() || data.createdAt
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
    alert?.latitude !== null && alert?.longitude !== null
      ? ([alert!.latitude!, alert!.longitude!] as [number, number])
      : null;

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
                Go to SafeSignal Home
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      alert?.status === 'active' ? 'bg-red-500 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                    {alert?.status === 'active' ? 'Distress Signal Active' : 'Alert Dismissed / Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Alert ID: <span className="text-slate-200">{alertId}</span>
                </p>
              </div>

              {alert?.updatedAt && (
                <div className="text-right text-[11px] text-slate-400">
                  <span>Last Location Update:</span>
                  <div className="font-mono text-slate-200">
                    {new Date(alert.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>

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
                  <Marker position={coords}>
                    <Popup>
                      <strong>Active SOS Location</strong>
                      <br />
                      Latitude: {coords[0]}
                      <br />
                      Longitude: {coords[1]}
                    </Popup>
                  </Marker>
                  <Circle
                    center={coords}
                    radius={35}
                    pathOptions={{ color: '#ef4444', fillColor: '#dc2626', fillOpacity: 0.25 }}
                  />
                </MapContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-xs text-slate-500">
                  Coordinates pending broadcast from device…
                </div>
              )}
            </div>

            <div className="text-center text-[11px] text-slate-500 pt-2">
              This page automatically updates every few seconds as the device sends new GPS telemetry.
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default TrackPage;
