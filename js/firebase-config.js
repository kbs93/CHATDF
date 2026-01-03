

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


// ------- COLE AQUI AS SUAS CREDENCIAIS DO FIREBASE ----------
const firebaseConfig = {
  apiKey: "AIzaSyA5ApoFDkyW9nyxrgCjzbWGiuAwP2ldUD0",
  authDomain: "chatdf-4102025.firebaseapp.com",
  projectId: "chatdf-4102025",
  storageBucket: "chatdf-4102025.appspot.com", // ✅ corrigido (.appspot.com)
  messagingSenderId: "74233540933",
  appId: "1:74233540933:web:df0e118e40c1e1513fce2c",
  measurementId: "G-1N8ZP3MK3N",
  
};
// -----------------------------------------------------------

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
