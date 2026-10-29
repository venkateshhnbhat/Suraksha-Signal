# Suraksha Signal (सुरक्षा सिग्नल) 🚨

A modern, responsive personal safety and emergency SOS web application designed for rapid distress alerting, real-time location sharing, and emergency contact coordination.

---

## 🌟 Key Features

- **One-Tap Emergency SOS**: Press-and-hold trigger with idempotency protection — no duplicate incidents on repeated taps.
- **Real-Time Geolocation & Interactive Map**: Leaflet map with live GPS tracking, accuracy circles, and coordinate validation. Never fabricates GPS coordinates — handles permission denial gracefully.
- **Emergency Contacts Management**: Add, edit, prioritize, and delete trusted contacts with E.164 phone normalization, duplicate blocking, and SMS consent verification via Twilio webhook.
- **Multi-Provider Authentication**: Firebase Phone OTP, passwordless Email OTP (Resend), Google OAuth (Supabase), and demo mode.
- **Live Distress Tracking Portal**: Shareable `/track/:alertId` links with real-time Firestore snapshots, telemetry freshness indicators, 24-hour TTL expiration, and resolved state display.
- **End-to-End Incident Lifecycle**: `preparing` → `sending` → `sent` → `failed` → `resolved` with honest delivery status reporting (never fabricates notification success).
- **Multilingual Support**: English, Hindi, Kannada via i18next.
- **Progressive Web App (PWA) Ready**: Offline-capable and installable.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18.2, TypeScript 5.5, Vite 5.4 |
| **Styling** | Tailwind CSS 3.4 |
| **Routing** | React Router DOM 6.22 (v7 flags enabled) |
| **Maps** | Leaflet 1.9 & React-Leaflet 4.2 (OpenStreetMap) |
| **i18n** | i18next 23.8 |
| **Auth** | Firebase Auth (Phone, Custom Token) + Supabase (Google OAuth) |
| **Backend** | Firebase Cloud Functions v2 (Node 20, TypeScript) |
| **Database** | Cloud Firestore |
| **SMS** | Twilio SDK 5.3 (2-way incoming webhook) |
| **Email** | Resend SDK 6.6 (passwordless OTP) |
| **Validation** | libphonenumber-js (E.164 normalization) |
| **Testing** | Vitest 4.1 + Happy-DOM (38 tests across 7 suites) |

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Installation
```bash
git clone https://github.com/venkateshhnbhat/Suraksha-Signal.git
cd Suraksha-Signal
npm install
cd functions && npm install && cd ..
```

### 3. Environment Setup
Copy the example environment file and add your credentials:
```bash
cp .env.example .env
```

**Required frontend variables** (`.env`):
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Supabase (Google OAuth)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Cloud Functions secrets** (set via Firebase CLI):
```bash
firebase functions:secrets:set RESEND_API_KEY        # Resend email OTP
firebase functions:secrets:set TWILIO_ACCOUNT_SID    # Twilio SMS
firebase functions:secrets:set TWILIO_AUTH_TOKEN      # Twilio SMS
firebase functions:secrets:set TWILIO_PHONE_NUMBER   # Twilio sender number
```

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). Without Firebase credentials, the app runs in **Demo Mode** with simulated contacts and local persistence.

### 5. Running Tests
```bash
npm test          # Run all 38 tests
npm run test:watch  # Interactive watch mode
```

### 6. Build for Production
```bash
npm run build                    # Frontend → dist/
cd functions && npm run build    # Cloud Functions → functions/lib/
```

### 7. Deploy
```bash
firebase deploy --only functions,firestore:rules,hosting
```

---

## 🔒 Security Architecture

- **Firestore Rules**: Owner-only read/write on contacts; owner-only location/status updates on alerts; public read-only for live tracking; email OTP records fully server-side.
- **Rate Limiting**: Max 3 SOS triggers per minute per user; 60s email OTP cooldown; max 3 OTP sends per 15 minutes.
- **Input Validation**: E.164 phone normalization, coordinate range checks (-90≤lat≤90, -180≤lng≤180), SHA-256 OTP hashing with timing-safe comparison.
- **No Fabricated Data**: GPS coordinates are never hardcoded or invented. SMS delivery status honestly reports actual provider response.

---

## 📋 Incident Lifecycle

```
preparing → sending → sent → resolved
                    ↘ failed → (retry) → sending
                    ↘ partial → resolved
```

- **preparing**: Alert document persisted in Firestore before any notifications
- **sending**: Cloud Function dispatching SMS to confirmed contacts
- **sent**: All SMS accepted by provider (does not guarantee delivery)
- **partial**: Some SMS sent, some failed
- **failed**: All SMS failed or no confirmed contacts
- **resolved**: User confirmed they are safe; tracking stops; link expires

---

## 🧪 Test Coverage (38 tests, 7 suites)

| Suite | Tests | Coverage |
| :--- | :--- | :--- |
| `sosWorkflow.test.ts` | 15 | Idempotency, auth, GPS denial, provider failure, ownership, resolution |
| `emailOtpFunctions.test.ts` | 5 | Rate limiting, SHA-256 hashing, custom token issuance |
| `ContactForm.test.tsx` | 5 | E.164 validation, required fields, form submission |
| `SOSButton.test.tsx` | 4 | Press-and-hold interaction, activation |
| `i18n.test.ts` | 4 | Language switching, translation keys |
| `ContactItem.test.tsx` | 3 | Verified/pending badges, contact display |
| `AuthPage.test.tsx` | 2 | Email input, demo mode |

---

## 📄 License
MIT License
