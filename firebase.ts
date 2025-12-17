
import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA-CWCpze1FiHqM1QHkVwRKmRDX4H2J0RQ",
    authDomain: "icat-blr-student-portal.firebaseapp.com",
    projectId: "icat-blr-student-portal",
    storageBucket: "icat-blr-student-portal.firebasestorage.app",
    messagingSenderId: "631520843796",
    appId: "1:631520843796:web:baa95af1425c0b3b52af01",
    measurementId: "G-ZE8RZPEH55"
};

let app: any;
let db: Firestore | null = null;
const analytics: any = null;

try {
    // Initialize Firebase
    // Direct modular usage ensures no "fragmented code" issues with namespace/compat layers
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
} catch (error: any) {
    // Graceful degradation for offline or config issues
    console.error("Firebase initialization failed. App running in offline/local mode.", error?.message);
}

export { app, db, analytics };
