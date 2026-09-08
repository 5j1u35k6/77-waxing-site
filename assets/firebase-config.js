export const firebaseConfig = {
  apiKey: "AIzaSyB53YYJsuFybvuPfLD3gFSKxxKfTT20dWs",
  authDomain: "waxing-86909.firebaseapp.com",
  projectId: "waxing-86909",
  storageBucket: "waxing-86909.firebasestorage.app",
  messagingSenderId: "599089405147",
  appId: "1:599089405147:web:a4e91f170ee52fcfb780fe",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !String(value).startsWith("PASTE_FIREBASE_"),
);
