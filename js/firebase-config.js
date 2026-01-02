// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as _onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { firebaseConfig } from "./config.js";

function assertConfig(cfg) {
  const required = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];

  const missing = required.filter((key) => !cfg?.[key]);
  if (missing.length) {
    throw new Error(`Configuração Firebase ausente: ${missing.join(", ")}`);
  }
}

assertConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

function signOutUser() {
  return signOut(auth);
}

// wrapper para facilitar o onAuthStateChanged
function onAuthChange(cb) {
  return _onAuthStateChanged(auth, cb);
}

export { db, auth, signInWithGoogle, signOutUser, onAuthChange };
