// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// WARNING: This is not a secure practice for production applications.
// These keys are visible to anyone who visits the website.
// The best practice is to use environment variables (Secrets).
const firebaseConfig = {
  apiKey: "AIzaSyCclGgjpJPa26efH2mahueWm-lhHS2wQV0",
  authDomain: "app-de-contas-f13e0.firebaseapp.com",
  projectId: "app-de-contas-f13e0",
  storageBucket: "app-de-contas-f13e0.firebasestorage.app",
  messagingSenderId: "203339846190",
  appId: "1:203339846190:web:8c4ac3942a875624c285bf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

