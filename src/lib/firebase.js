import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC-5-K8t4t9W4-xzvDVYXjZtwiwnKlAhsU",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "apollo-evens-2be21.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "apollo-evens-2be21",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "apollo-evens-2be21.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "598522726587",
  appId: env.VITE_FIREBASE_APP_ID || "1:598522726587:web:13d3ef280014cc24de419e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
