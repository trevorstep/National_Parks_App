import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD7UbYIqsmTlFimC8lXOZqwtXEdZMzr_kg",
  authDomain: "national-parks-7f32e.firebaseapp.com",
  projectId: "national-parks-7f32e",
  storageBucket: "national-parks-7f32e.firebasestorage.app",
  messagingSenderId: "931130710404",
  appId: "1:931130710404:web:f29f80b8b064859d8825d1",
  measurementId: "G-E5TN0P5T20"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, deleteDoc, collection, getDocs };