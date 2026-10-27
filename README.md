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

## 📄 License
MIT License