import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

export const PUBLIC_FIREBASE_APP_NAME = "77waxing-public";

export function getPublicFirebase() {
  if (!firebaseConfigured) throw new Error("FIREBASE_NOT_READY");
  let app = getApps().find((candidate) => candidate.name === PUBLIC_FIREBASE_APP_NAME);
  if (!app) app = initializeApp(firebaseConfig, PUBLIC_FIREBASE_APP_NAME);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
