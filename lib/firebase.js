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
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import appletConfig from '../firebase-applet-config.json';

// Your web app's Firebase configuration
const cfg = appletConfig || {};
// Normalize storageBucket: accept applet value or convert projectId to appspot.com
const storageBucket = cfg.storageBucket || (cfg.projectId ? `${cfg.projectId}.appspot.com` : undefined);

const firebaseConfig = {
  apiKey: cfg.apiKey || "",
  authDomain: cfg.authDomain || "",
  projectId: cfg.projectId || "",
  storageBucket: storageBucket || "",
  messagingSenderId: cfg.messagingSenderId || "",
  appId: cfg.appId || "",
};

// Warn when required keys are missing (helps diagnose recaptcha hanging)
const requiredKeys = ["apiKey", "authDomain", "projectId"];
const missing = requiredKeys.filter((k) => !firebaseConfig[k]);
if (missing.length) {
  console.warn(
    "firebaseConfig missing required keys from firebase-applet-config.json:",
    missing,
    "— please add them or check your firebase-applet-config.json"
  );
}

// Export the raw firebase config for use with recaptcha verifier (expo-firebase-recaptcha)
export { firebaseConfig };

// Initialize Firebase app (idempotent)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth (idempotent)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  // If auth already initialized, fall back to getAuth
  auth = getAuth(app);
}
export { auth };

// Initialize Firestore.
// If a non-default Firestore database id is specified in firebase-applet-config.json use that
// via getFirestore(app, databaseId). Otherwise initialize the default DB with RN-friendly settings.
const firestoreDbId = appletConfig?.firestoreDatabaseId || undefined;
export const db = firestoreDbId
  ? getFirestore(app, firestoreDbId)
  : initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
export const storage = getStorage(app);

// Helper: simple OperationType enum and centralized error handler for Firestore operations
export const OperationType = {
  GET: 'get',
  LIST: 'list',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

export function handleFirestoreError(err, operation = OperationType.GET, path = '') {
  // Log structured error for debugging and optionally extend to user-visible alerts
  try {
    console.error(`Firestore ${operation.toUpperCase()} error on ${path}:`, err);
  } catch (e) {
    console.error('Firestore error', err);
  }
  return null;
}