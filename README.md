# Suraksha Signal (सुरक्षा सिग्नल) 🚨

A modern, responsive personal safety and emergency SOS web application designed for rapid distress alerting, real-time location sharing, and emergency contact coordination.

---

## 🌟 Key Features

- **One-Tap Emergency SOS**: Instant trigger mechanism for sending distress signals with accurate GPS coordinates.
- **Real-Time Geolocation & Interactive Map**: Built-in Leaflet map displaying user location and proximity tracking.
- **Emergency Contacts Management**: Store, update, and prioritize primary and secondary emergency contacts with international phone number validation.
- **Firebase Authentication & Cloud Storage**: Secure phone OTP authentication with reCAPTCHA, Google Sign-In, and Firestore database integration.
- **Multilingual Support**: Internationalization (i18n) for regional language accessibility.
- **Progressive Web App (PWA) Ready**: Offline-capable structure and installable experience.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **Backend / BaaS**: Firebase (Auth, Firestore, Cloud Functions)
- **Mapping**: Leaflet, React-Leaflet
- **Internationalization**: i18next, react-i18next
- **Validation**: libphonenumber-js

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn

### 2. Installation
```bash
git clone https://github.com/venkateshhnbhat/Suraksha-Signal.git
cd Suraksha-Signal
npm install
```

### 3. Environment Setup
Copy the example environment file and add your Firebase credentials:
```bash
cp .env.example .env
```
Fill in the variables in `.env`:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## ✉️ Email OTP Authentication Setup (Resend & Cloud Functions)

> [!NOTE]
> **Firebase Blaze Plan Requirement**: Google Cloud Functions (2nd gen) requires the **Firebase Blaze (Pay as you go)** plan to permit outbound network calls (to Resend / SMS providers) and deploy cloud run services. The free quota covers extensive developmental usage.

### 1. Create a Resend Account & Verify Domain
1. Sign up for a free account at [Resend](https://resend.com/).
2. Navigate to **Domains** -> **Add Domain**.
3. Add your custom domain (e.g. `mail.yourdomain.com` or `yourdomain.com`).
4. Configure the DNS records (DKIM, SPF, MX) at your DNS registrar as specified by Resend until verified.
5. Create an API Key in **API Keys** with "Sending access".

### 2. Configure Firebase Secrets & Cloud Function Variables
Store your Resend API key securely in Google Cloud Secret Manager via the Firebase CLI (never commit keys to source control):
```bash
firebase functions:secrets:set RESEND_API_KEY
```
When prompted, paste your secret Resend API key (`re_...`).

Set the sending address in `functions/.env` or runtime environment:
```env
EMAIL_FROM="Suraksha Signal <noreply@yourdomain.com>"
```

### 3. Deploying Cloud Functions and Security Rules
Deploy your backend functions and Firestore security rules to production:
```bash
firebase deploy --only functions,firestore:rules
```

---

## 🧪 Local Emulators & Automated Testing

Suraksha Signal includes full local emulator configurations for Firebase Auth, Firestore, and Cloud Functions in `firebase.json`.

### 1. Running Firebase Emulators Locally
Make sure you have Java installed (required for the Firestore emulator), then run:
```bash
firebase emulators:start
```
This boots:
- **Auth Emulator**: `http://localhost:9099`
- **Firestore Emulator**: `http://localhost:8080`
- **Functions Emulator**: `http://localhost:5001`
- **Emulator UI Suite**: `http://localhost:4000`

### 2. Running Automated Tests
Run unit and integration test suites (including 6-digit OTP verification, rate limiting, timing-safe hashing, and AuthPage frontend flows):
```bash
npm test
```
To run tests in interactive watch mode:
```bash
npm run test:watch
```

---

## 📄 License
MIT License