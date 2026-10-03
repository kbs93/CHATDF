// js/firebase-config.js
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { app, auth, provider, signOutUser } from "./firebase-app.js";

/* 🔵 FIRESTORE */
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

/* 🔵 REALTIME DATABASE */
const rtdb = getDatabase(app);

export {
  app,
  auth,
  db,
  provider,
  rtdb,
  signOutUser,
};