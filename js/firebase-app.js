// js/firebase-app.js - Base de Autenticação Leve (Home e Geral)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5ApoFDkyW9nyxrgCjzbWGiuAwP2ldUD0",
  authDomain: "chatdf.com.br",
  projectId: "chatdf-4102025",
  storageBucket: "chatdf-4102025.firebasestorage.app",
  messagingSenderId: "74233540933",
  appId: "1:74233540933:web:df0e118e40c1e1513fce2c",
  measurementId: "G-1N8ZP3MK3N",
  databaseURL: "https://chatdf-4102025-default-rtdb.firebaseio.com",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const signOutUser = () => signOut(auth);