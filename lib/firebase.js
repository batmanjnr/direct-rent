// import { initializeApp } from 'firebase/app';
// import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
// import { getFirestore } from 'firebase/firestore';
// import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// const firebaseConfig = {
//   apiKey: "...",
//   authDomain: "...",
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "..."
// };

// const app = initializeApp(firebaseConfig);

// export const auth = initializeAuth(app, {
//   persistence: getReactNativePersistence(ReactNativeAsyncStorage)
// });

// export const db = getFirestore(app);

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
 import { getFirestore } from 'firebase/firestore';
 import { getStorage } from 'firebase/storage';
 import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import appletConfig from '../firebase-applet-config.json';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCBv-26uO4ri0keoaWlbz3J6m1iGfXCkWc",
  authDomain: "gen-lang-client-0583982573.firebaseapp.com",
  projectId: "gen-lang-client-0583982573",
  storageBucket: "gen-lang-client-0583982573.firebasestorage.app",
  messagingSenderId: "140826777180",
  appId: "1:140826777180:web:e28de16da13ed294e5b899"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

 export const auth = initializeAuth(app, {
   persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// If firebase-applet-config.json specifies a non-default Firestore database id, pass it to getFirestore
const firestoreDbId = appletConfig?.firestoreDatabaseId || undefined;
export const db = getFirestore(app, firestoreDbId);
export const storage = getStorage(app);