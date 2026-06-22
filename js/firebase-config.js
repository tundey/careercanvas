// ==========================================
// FIREBASE v12 CORE CONFIGURATION MODULE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// !!! REPLACE THIS OBJECT WITH YOUR ACTUAL FIREBASE PROJECT CREDENTIALS !!!
const firebaseConfig = {
  apiKey: "AIzaSyA7pE38P-6ofNzQf1qqW1-8BMCV5NCjVKc",
  authDomain: "careercanvas-dab4b.firebaseapp.com",
  projectId: "careercanvas-dab4b",
  storageBucket: "careercanvas-dab4b.firebasestorage.app",
  messagingSenderId: "716534849900",
  appId: "1:716534849900:web:945c048ec5f3c29a7e5349",
  measurementId: "G-FKZ8PTXRJZ"
};

// Initialize Core Firebase Instance
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Multi-Tab Offline Cache Engines Enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Authentication 
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();