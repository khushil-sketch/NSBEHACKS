import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// This file should only export the configuration object.
// The initialization happens in your main app file.
const firebaseConfig = {
  apiKey: "AIzaSyD2B5ZIVbl2wB4U5UWkQwzx1TXYmzKbJqA",
  authDomain: "nsbehacks-song-battle.firebaseapp.com",
  projectId: "nsbehacks-song-battle",
  storageBucket: "nsbehacks-song-battle.firebasestorage.app",
  messagingSenderId: "69482332074",
  appId: "1:69482332074:web:2ba5b5f86fed3950f1f5d3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export the services to be used throughout the app
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);