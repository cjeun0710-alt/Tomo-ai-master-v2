import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration loaded from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCq-34056G1n7ZlbvwdeCD0qQJsvGftiXo",
  authDomain: "tomo-ai-master.firebaseapp.com",
  projectId: "tomo-ai-master",
  storageBucket: "tomo-ai-master.firebasestorage.app",
  messagingSenderId: "276193678350",
  appId: "1:276193678350:web:2fbe89697115ede541985f"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = getFirestore(app, "ai-studio-remixaiv2-d3f6c0bd-cd61-46fc-be31-1ed875017525");
