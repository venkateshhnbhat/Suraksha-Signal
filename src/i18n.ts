import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' }
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  en: {
    translation: {
      brand: {
        name: 'Suraksha Signal',
        tagline: 'Discreet Emergency SOS and Real-time Location Broadcast',
        monitoring: 'Monitoring Active',
        demoMode: 'DEMO MODE'
      },
      nav: {
        contacts: 'Contacts',
        contactsActive: 'Contacts ({{count}} active)',
        signOut: 'Sign Out',
        backHome: '← Back to SOS Dashboard',
        switchLanguage: 'Language'
      },
      hero: {
        panicTitle: 'Emergency Panic Button',
        panicSubtitle: 'Press and hold to send instant distress alert with your location',
        instruction: 'Press & hold (or hold Space/Enter) for 3 seconds to broadcast emergency signal',
        keepHolding: 'Keep Holding…',
        testSiren: '📢 Test Audible Siren',
        stopSiren: '🔊 Stop Loud Siren',
        dial112: '📞 Dial National Emergency (112)'
      },
      alert: {
        sending: 'BROADCASTING EMERGENCY DISTRESS SIGNAL…',
        failed: 'SOS DISPATCH FAILED',
        active: 'DISTRESS SIGNAL BROADCAST ACTIVE',
        demoBadge: 'DEMO: no real messages were sent',
        triggeredAt: 'Triggered at {{time}} • Alert ID: {{id}}',
        sendingDesc: 'Dispatching encrypted location and panic signals to your emergency contacts…',
        sentSuccess: '✓ Successfully sent distress SMS to {{sent}} of {{total}} confirmed contacts.',
        retry: '🔄 Retry SOS Dispatch',
        call112Now: '📞 Call 112 Immediately',
        dismiss: 'Dismiss'
      },
      location: {
        liveGps: 'Live GPS Tracking',
        accuracy: '±{{acc}}m accuracy',
        acquiring: 'Acquiring GPS',
        latitude: 'LATITUDE',
        longitude: 'LONGITUDE',
        connecting: 'Connecting to device GPS sensor…'
      },
      contacts: {
        title: 'Emergency Contacts',
        subtitle: 'When SOS is triggered, an SMS with your live GPS location will be broadcast to these trusted contacts.',
        registeredCount: '{{count}}/5 Contacts Registered',
        activeCount: 'Emergency Contacts ({{count}} active)',
        manage: 'Manage →',
        addNew: '➕ Add Trusted Contact',
        editContact: 'Edit Emergency Contact',
        addEditBtn: '+ Add / Edit Emergency Contacts',
        directoryTitle: 'Active Contact Directory',
        noContactsHome: 'No emergency contacts added yet. Add trusted friends or family so they receive distress alerts.',
        noContactsPage: 'No emergency contacts added yet. Add at least one trusted contact who has confirmed via SMS.',
        verified: 'Verified',
        pending: 'Pending confirmation',
        call: '📞 Call',
        edit: 'Edit',
        delete: 'Delete',
        limitError: 'You can add up to 5 emergency contacts.',
        addedSuccess: '✓ Added {{name}} to emergency list.',
        updatedSuccess: '✓ Updated {{name}}.',
        deletedSuccess: '✓ Contact removed.',
        modalTitle: 'No Confirmed Contacts',
        modalDesc: 'SOS cannot be triggered because you do not have any confirmed emergency contacts. Please add at least one trusted contact who has confirmed via SMS before broadcasting distress alerts.',
        goToContacts: 'Go to Emergency Contacts →',
        cancel: 'Cancel'
      },
      form: {
        nameLabel: 'Contact Name *',
        namePlaceholder: 'e.g. Rahul Sharma',
        phoneLabel: 'Phone Number (with Country Code) *',
        phonePlaceholder: 'e.g. +91 9876543210 or 112',
        relLabel: 'Relationship (Optional)',
        relPlaceholder: 'e.g. Sister, Guardian, Doctor, Neighbor',
        addBtn: 'Add to Emergency Contacts',
        saveBtn: 'Save Changes',
        requiredError: 'Name and phone number are required',
        invalidPhone: 'Please enter a valid phone number with country code (e.g. +91 9876543210)'
      },
      auth: {
        welcomeBack: 'Welcome Back',
        createAccount: 'Create Suraksha Account',
        phoneVerification: 'Phone Verification',
        tagline: 'Discreet Emergency SOS & Live GPS Safety Network',
        emailTab: 'Email & Password',
        phoneTab: 'Phone OTP',
        signInSub: 'Sign In',
        createSub: 'Create Account',
        fullName: 'Full Name',
        emailAddr: 'Email Address',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        rememberMe: 'Remember this device for 30 days',
        forgotPassword: 'Forgot password?',
        submitSignIn: 'Sign In to Suraksha Signal',
        submitSignUp: 'Complete Registration',
        mobilePhone: 'Mobile Phone Number',
        phoneHint: 'Includes country code prefix (e.g. +91 for India, +1 for US)',
        sendOtp: '📨 Send One-Time SMS Code',
        sendingOtp: 'Sending Verification Code…',
        codeLabel: '6-Digit Security Code',
        verifyBtn: '✅ Verify & Sign In',
        changeNumber: 'Change number',
        orInstant: 'Or Instant Access',
        googleBtn: 'Continue with Google',
        demoCardTitle: 'Developer & Guest Testing',
        demoCardDesc: 'Bypass authentication and test the full SOS siren, GPS tracking, and emergency contacts.',
        demoLaunchBtn: '🚀 Launch Demo / Guest Session'
      }
    }
  },
  hi: {
    translation: {
      brand: {
        name: 'सुरक्षा सिग्नल',
        tagline: 'आपातकालीन एसओएस और रीयल-टाइम स्थान प्रसारण',
        monitoring: 'निगरानी सक्रिय है',
        demoMode: 'डेमो मोड'
      },
      nav: {
        contacts: 'संपर्क',
        contactsActive: 'संपर्क ({{count}} सक्रिय)',
        signOut: 'साइन आउट',
        backHome: '← एसओएस डैशबोर्ड पर वापस जाएं',
        switchLanguage: 'भाषा'
      },
      hero: {
        panicTitle: 'आपातकालीन पैनिक बटन',
        panicSubtitle: 'अपने स्थान के साथ तुरंत संकट चेतावनी भेजने के लिए दबाकर रखें',
        instruction: 'आपातकालीन सिग्नल प्रसारित करने के लिए 3 सेकंड दबाकर रखें (या स्पेस/एंटर दबाएं)',
        keepHolding: 'दबाए रखें…',
        testSiren: '📢 सायरन का परीक्षण करें',
        stopSiren: '🔊 सायरन बंद करें',
        dial112: '📞 राष्ट्रीय आपातकालीन नंबर (112) डायल करें'
      },
      alert: {
        sending: 'आपातकालीन संकट संकेत भेजा जा रहा है…',
        failed: 'एसओएस प्रसारण विफल रहा',
        active: 'संकट संकेत प्रसारण सक्रिय है',
        demoBadge: 'डेमो: कोई वास्तविक संदेश नहीं भेजा गया',
        triggeredAt: 'समय: {{time}} • चेतावनी आईडी: {{id}}',
        sendingDesc: 'आपके आपातकालीन संपर्कों को एन्क्रिप्टेड स्थान भेजा जा रहा है…',
        sentSuccess: '✓ {{total}} में से {{sent}} संपर्कों को सफलतापूर्वक संकट संदेश भेजा गया।',
        retry: '🔄 एसओएस पुनः प्रयास करें',
        call112Now: '📞 तुरंत 112 पर कॉल करें',
        dismiss: 'खारिज करें'
      },
      location: {
        liveGps: 'लाइव जीपीएस ट्रैकिंग',
        accuracy: 'सटीकता ±{{acc}} मी',
        acquiring: 'जीपीएस खोजा जा रहा है',
        latitude: 'अक्षांश (LATITUDE)',
        longitude: 'देशांतर (LONGITUDE)',
        connecting: 'डिवाइस जीपीएस सेंसर से जुड़ रहा है…'
      },
      contacts: {
        title: 'आपातकालीन संपर्क',
        subtitle: 'एसओएस सक्रिय होने पर, आपके लाइव स्थान के साथ इन संपर्कों को एसएमएस भेजा जाएगा।',
        registeredCount: '{{count}}/5 संपर्क पंजीकृत',
        activeCount: 'आपातकालीन संपर्क ({{count}} सक्रिय)',
        manage: 'प्रबंधन →',
        addNew: '➕ विश्वसनीय संपर्क जोड़ें',
        editContact: 'आपातकालीन संपर्क संपादित करें',
        addEditBtn: '+ आपातकालीन संपर्क जोड़ें / संपादित करें',
        directoryTitle: 'सक्रिय संपर्क सूची',
        noContactsHome: 'अभी तक कोई संपर्क नहीं जोड़ा गया। प्रियजनों को जोड़ें ताकि उन्हें अलर्ट मिल सके।',
        noContactsPage: 'कोई संपर्क नहीं मिला। कृपया कम से कम एक सत्यापित संपर्क जोड़ें।',
        verified: 'सत्यापित',
        pending: 'पुष्टि प्रतीक्षारत',
        call: '📞 कॉल',
        edit: 'संपादित करें',
        delete: 'हटाएं',
        limitError: 'आप अधिकतम 5 संपर्क जोड़ सकते हैं।',
        addedSuccess: '✓ {{name}} को आपातकालीन सूची में जोड़ा गया।',
        updatedSuccess: '✓ {{name}} का विवरण अद्यतित किया गया।',
        deletedSuccess: '✓ संपर्क हटाया गया।',
        modalTitle: 'कोई सत्यापित संपर्क नहीं',
        modalDesc: 'एसओएस नहीं भेजा जा सकता क्योंकि आपके पास कोई सत्यापित संपर्क नहीं है। कृपया पहले संपर्क जोड़ें।',
        goToContacts: 'संपर्क पृष्ठ पर जाएं →',
        cancel: 'रद्द करें'
      },
      form: {
        nameLabel: 'संपर्क का नाम *',
        namePlaceholder: 'जैसे राहुल शर्मा',
        phoneLabel: 'फ़ोन नंबर (देश कोड सहित) *',
        phonePlaceholder: 'जैसे +91 9876543210 या 112',
        relLabel: 'संबंध (वैकल्पिक)',
        relPlaceholder: 'जैसे बहन, अभिभावक, डॉक्टर, पड़ोसी',
        addBtn: 'आपातकालीन सूची में जोड़ें',
        saveBtn: 'परिवर्तन सहेजें',
        requiredError: 'नाम और फ़ोन नंबर आवश्यक हैं',
        invalidPhone: 'कृपया देश कोड के साथ एक मान्य फ़ोन नंबर दर्ज करें'
      },
      auth: {
        welcomeBack: 'वापसी पर स्वागत है',
        createAccount: 'सुरक्षा खाता बनाएं',
        phoneVerification: 'फ़ोन सत्यापन',
        tagline: 'गोपनीय आपातकालीन एसओएस और लाइव जीपीएस सुरक्षा नेटवर्क',
        emailTab: 'ईमेल और पासवर्ड',
        phoneTab: 'फ़ोन ओटीपी',
        signInSub: 'साइन इन करें',
        createSub: 'खाता बनाएं',
        fullName: 'पूरा नाम',
        emailAddr: 'ईमेल पता',
        password: 'पासवर्ड',
        confirmPassword: 'पासवर्ड की पुष्टि करें',
        rememberMe: '30 दिनों के लिए इस डिवाइस को याद रखें',
        forgotPassword: 'पासवर्ड भूल गए?',
        submitSignIn: 'सुरक्षा सिग्नल में साइन इन करें',
        submitSignUp: 'पंजीकरण पूरा करें',
        mobilePhone: 'मोबाइल फ़ोन नंबर',
        phoneHint: 'देश कोड उपसर्ग शामिल करें (जैसे भारत के लिए +91)',
        sendOtp: '📨 एक बार का एसएमएस कोड भेजें',
        sendingOtp: 'सत्यापन कोड भेजा जा रहा है…',
        codeLabel: '6-अंकीय सुरक्षा कोड',
        verifyBtn: '✅ सत्यापित करें और साइन इन करें',
        changeNumber: 'नंबर बदलें',
        orInstant: 'या त्वरित पहुंच',
        googleBtn: 'गूगल से जारी रखें',
        demoCardTitle: 'डेवलपर और अतिथि परीक्षण',
        demoCardDesc: 'लॉगिन के बिना पूरे एसओएस सायरन और जीपीएस ट्रैकिंग का परीक्षण करें।',
        demoLaunchBtn: '🚀 डेमो सत्र शुरू करें'
      }
    }
  },
  kn: {
    translation: {
      brand: {
        name: 'ಸುರಕ್ಷಾ ಸಿಗ್ನಲ್',
        tagline: 'ತುರ್ತು ಎಸ್‌ಒಎಸ್ ಮತ್ತು ನೈಜ-ಸಮಯದ ಸ್ಥಳ ಪ್ರಸಾರ',
        monitoring: 'ಮಾನಿಟರಿಂಗ್ ಸಕ್ರಿಯವಾಗಿದೆ',
        demoMode: 'ಡೆಮೊ ಮೋಡ್'
      },
      nav: {
        contacts: 'ಸಂಪರ್ಕಗಳು',
        contactsActive: 'ಸಂಪರ್ಕಗಳು ({{count}} ಸಕ್ರಿಯ)',
        signOut: 'ಸೈನ್ ಔಟ್',
        backHome: '← ಎಸ್‌ಒಎಸ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ',
        switchLanguage: 'ಭಾಷೆ'
      },
      hero: {
        panicTitle: 'ತುರ್ತು ಪ್ಯಾನಿಕ್ ಬಟನ್',
        panicSubtitle: 'ನಿಮ್ಮ ಸ್ಥಳದೊಂದಿಗೆ ತಕ್ಷಣದ ಎಚ್ಚರಿಕೆಯನ್ನು ಕಳುಹಿಸಲು ಒತ್ತಿ ಹಿಡಿಯಿರಿ',
        instruction: 'ತುರ್ತು ಸಂಕೇತವನ್ನು ಕಳುಹಿಸಲು 3 ಸೆಕೆಂಡುಗಳ ಕಾಲ ಒತ್ತಿ ಹಿಡಿಯಿರಿ (ಅಥವಾ Space/Enter ಬಳಸಿ)',
        keepHolding: 'ಒತ್ತಿ ಹಿಡಿದುಕೊಳ್ಳಿ…',
        testSiren: '📢 ಸೈರನ್ ಪರೀಕ್ಷಿಸಿ',
        stopSiren: '🔊 ಸೈರನ್ ನಿಲ್ಲಿಸಿ',
        dial112: '📞 ರಾಷ್ಟ್ರೀಯ ತುರ್ತು ಸಂಖ್ಯೆ (112) ಗೆ ಕರೆ ಮಾಡಿ'
      },
      alert: {
        sending: 'ತುರ್ತು ಸಂಕೇತವನ್ನು ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
        failed: 'ಎಸ್‌ಒಎಸ್ ರವಾನೆ ವಿಫಲವಾಗಿದೆ',
        active: 'ತುರ್ತು ಎಚ್ಚರಿಕೆ ಪ್ರಸಾರ ಸಕ್ರಿಯವಾಗಿದೆ',
        demoBadge: 'ಡೆಮೊ: ಯಾವುದೇ ನೈಜ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿಲ್ಲ',
        triggeredAt: 'ಸಮಯ: {{time}} • ಎಚ್ಚರಿಕೆ ID: {{id}}',
        sendingDesc: 'ನಿಮ್ಮ ತುರ್ತು ಸಂಪರ್ಕಗಳಿಗೆ ಲೈವ್ ಸ್ಥಳವನ್ನು ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
        sentSuccess: '✓ {{total}} ಸಂಪರ್ಕಗಳಲ್ಲಿ {{sent}} ಜನರಿಗೆ ಯಶಸ್ವಿಯಾಗಿ ಎಸ್‌ಒಎಸ್ ತಲುಪಿದೆ.',
        retry: '🔄 ಎಸ್‌ಒಎಸ್ ಮರುಪ್ರಯತ್ನಿಸಿ',
        call112Now: '📞 ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ',
        dismiss: 'ವಜಾಗೊಳಿಸಿ'
      },
      location: {
        liveGps: 'ಲೈವ್ ಜಿಪಿಎಸ್ ಟ್ರ್ಯಾಕಿಂಗ್',
        accuracy: '±{{acc}} ಮೀ ನಿಖರತೆ',
        acquiring: 'ಜಿಪಿಎಸ್ ಪಡೆಯಲಾಗುತ್ತಿದೆ',
        latitude: 'ಅಕ್ಷಾಂಶ (LATITUDE)',
        longitude: 'ರೇಖಾಂಶ (LONGITUDE)',
        connecting: 'ಸಾಧನದ ಜಿಪಿಎಸ್ ಸಂವೇದಕಕ್ಕೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…'
      },
      contacts: {
        title: 'ತುರ್ತು ಸಂಪರ್ಕಗಳು',
        subtitle: 'ಎಸ್‌ಒಎಸ್ ಒತ್ತಿದಾಗ, ನಿಮ್ಮ ನೈಜ ಸ್ಥಳದೊಂದಿಗೆ ಈ ಸಂಪರ್ಕಗಳಿಗೆ ಸಂದೇಶ ರವಾನೆಯಾಗುತ್ತದೆ.',
        registeredCount: '{{count}}/5 ಸಂಪರ್ಕಗಳು ನೋಂದಾಯಿಸಲಾಗಿದೆ',
        activeCount: 'ತುರ್ತು ಸಂಪರ್ಕಗಳು ({{count}} ಸಕ್ರಿಯ)',
        manage: 'ನಿರ್ವಹಿಸಿ →',
        addNew: '➕ ವಿಶ್ವಾಸಾರ್ಹ ಸಂಪರ್ಕ ಸೇರಿಸಿ',
        editContact: 'ತುರ್ತು ಸಂಪರ್ಕವನ್ನು ಸಂಪಾದಿಸಿ',
        addEditBtn: '+ ತುರ್ತು ಸಂಪರ್ಕ ಸೇರಿಸಿ / ಸಂಪಾದಿಸಿ',
        directoryTitle: 'ಸಕ್ರಿಯ ಸಂಪರ್ಕ ಡೈರೆಕ್ಟರಿ',
        noContactsHome: 'ಇನ್ನೂ ಯಾವುದೇ ಸಂಪರ್ಕಗಳನ್ನು ಸೇರಿಸಲಾಗಿಲ್ಲ. ಆಪತ್ಕಾಲದಲ್ಲಿ ಸಹಾಯ ಪಡೆಯಲು ಸಂಪರ್ಕಗಳನ್ನು ಸೇರಿಸಿ.',
        noContactsPage: 'ಯಾವುದೇ ಸಂಪರ್ಕಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಬ್ಬ ದೃಢೀಕೃತ ಸಂಪರ್ಕವನ್ನು ಸೇರಿಸಿ.',
        verified: 'ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
        pending: 'ದೃಢೀಕರಣ ಬಾಕಿ ಇದೆ',
        call: '📞 ಕರೆ ಮಾಡಿ',
        edit: 'ಸಂಪಾದಿಸಿ',
        delete: 'ಅಳಿಸಿ',
        limitError: 'ನೀವು ಗರಿಷ್ಠ 5 ತುರ್ತು ಸಂಪರ್ಕಗಳನ್ನು ಸೇರಿಸಬಹುದು.',
        addedSuccess: '✓ {{name}} ರನ್ನು ತುರ್ತು ಪಟ್ಟಿಗೆ ಸೇರಿಸಲಾಗಿದೆ.',
        updatedSuccess: '✓ {{name}} ವಿವರ ನವೀಕರಿಸಲಾಗಿದೆ.',
        deletedSuccess: '✓ ಸಂಪರ್ಕವನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ.',
        modalTitle: 'ದೃಢೀಕೃತ ಸಂಪರ್ಕಗಳಿಲ್ಲ',
        modalDesc: 'ನಿಮ್ಮ ಬಳಿ ಯಾವುದೇ ದೃಢೀಕೃತ ಸಂಪರ್ಕಗಳಿಲ್ಲದ ಕಾರಣ ಎಸ್‌ಒಎಸ್ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೊದಲು ಸಂಪರ್ಕ ಸೇರಿಸಿ.',
        goToContacts: 'ಸಂಪರ್ಕಗಳ ಪುಟಕ್ಕೆ ಹೋಗಿ →',
        cancel: 'ರದ್ದುಮಾಡಿ'
      },
      form: {
        nameLabel: 'ಸಂಪರ್ಕದ ಹೆಸರು *',
        namePlaceholder: 'ಉದಾ: ರಾಹುಲ್ ಶರ್ಮಾ',
        phoneLabel: 'ದೂರವಾಣಿ ಸಂಖ್ಯೆ (ದೇಶದ ಕೋಡ್ ನೊಂದಿಗೆ) *',
        phonePlaceholder: 'ಉದಾ: +91 9876543210 ಅಥವಾ 112',
        relLabel: 'ಸಂಬಂಧ (ಐಚ್ಛಿಕ)',
        relPlaceholder: 'ಉದಾ: ಸಹೋದರಿ, ಪೋಷಕರು, ವೈದ್ಯರು, ನೆರೆಹೊರೆಯವರು',
        addBtn: 'ತುರ್ತು ಸಂಪರ್ಕಕ್ಕೆ ಸೇರಿಸಿ',
        saveBtn: 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
        requiredError: 'ಹೆಸರು ಮತ್ತು ದೂರವಾಣಿ ಸಂಖ್ಯೆ ಅಗತ್ಯವಿದೆ',
        invalidPhone: 'ದಯವಿಟ್ಟು ದೇಶದ ಕೋಡ್‌ನೊಂದಿಗೆ ಮಾನ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ'
      },
      auth: {
        welcomeBack: 'ಮತ್ತೆ ಸ್ವಾಗತ',
        createAccount: 'ಸುರಕ್ಷಾ ಖಾತೆಯನ್ನು ರಚಿಸಿ',
        phoneVerification: 'ಫೋನ್ ಪರಿಶೀಲನೆ',
        tagline: 'ವಿವೇಚನಾಯುಕ್ತ ತುರ್ತು ಎಸ್‌ಒಎಸ್ ಮತ್ತು ಲೈವ್ ಜಿಪಿಎಸ್ ಸುರಕ್ಷತಾ ಜಾಲ',
        emailTab: 'ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್',
        phoneTab: 'ಫೋನ್ ಒಟಿಪಿ',
        signInSub: 'ಸೈನ್ ಇನ್',
        createSub: 'ಖಾತೆ ತೆರೆಯಿರಿ',
        fullName: 'ಪೂರ್ಣ ಹೆಸರು',
        emailAddr: 'ಇಮೇಲ್ ವಿಳಾಸ',
        password: 'ಪಾಸ್‌ವರ್ಡ್',
        confirmPassword: 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
        rememberMe: '30 ದಿನಗಳವರೆಗೆ ಈ ಸಾಧನವನ್ನು ನೆನಪಿಡಿ',
        forgotPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?',
        submitSignIn: 'ಸುರಕ್ಷಾ ಸಿಗ್ನಲ್ ಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ',
        submitSignUp: 'ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಿ',
        mobilePhone: 'ಮೊಬೈಲ್ ಫೋನ್ ಸಂಖ್ಯೆ',
        phoneHint: 'ದೇಶದ ಕೋಡ್ ಸೇರಿಸಿ (ಉದಾ: ಭಾರತಕ್ಕೆ +91)',
        sendOtp: '📨 ಒಟಿಪಿ ಕೋಡ್ ಕಳುಹಿಸಿ',
        sendingOtp: 'ಪರಿಶೀಲನಾ ಕೋಡ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
        codeLabel: '6-ಅಂಕಿಯ ಭದ್ರತಾ ಕೋಡ್',
        verifyBtn: '✅ ಪರಿಶೀಲಿಸಿ & ಸೈನ್ ಇನ್ ಮಾಡಿ',
        changeNumber: 'ಸಂಖ್ಯೆ ಬದಲಾಯಿಸಿ',
        orInstant: 'ಅಥವಾ ತಕ್ಷಣದ ಪ್ರವೇಶ',
        googleBtn: 'ಗೂಗಲ್ ಮೂಲಕ ಮುಂದುವರಿಯಿರಿ',
        demoCardTitle: 'ಡೆವಲಪರ್ ಮತ್ತು ಅತಿಥಿ ಪರೀಕ್ಷೆ',
        demoCardDesc: 'ಲಾಗಿನ್ ಮಾಡದೆಯೇ ಸಂಪೂರ್ಣ ಎಸ್‌ಒಎಸ್ ಸೈರನ್ ಮತ್ತು ಜಿಪಿಎಸ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಪರೀಕ್ಷಿಸಿ.',
        demoLaunchBtn: '🚀 ಡೆಮೊ ಸೆಷನ್ ಪ್ರಾರಂಭಿಸಿ'
      }
    }
  }
};

const initialLang = localStorage.getItem('suraksha_language') || 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

// Set document lang attribute
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('suraksha_language', lng);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;
