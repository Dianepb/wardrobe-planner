
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDsh6yKmtlz6AyJax6tswqkxEOs8wTNru4",
  authDomain: "wardrobe-planner-55f26.firebaseapp.com",
  projectId: "wardrobe-planner-55f26",
  storageBucket: "wardrobe-planner-55f26.firebasestorage.app",
  messagingSenderId: "131534614811",
  appId: "1:131534614811:web:90891f6f535cef0f9f63be",
  measurementId: "G-HKCSF0PWS5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}