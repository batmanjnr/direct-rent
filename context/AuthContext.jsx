import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  collection,
  onSnapshot,
  setDoc as fsSetDoc,
  deleteDoc,
} from "firebase/firestore";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { getVerifyParams } from "../lib/verifyStore";
import { useTheme } from "./ThemeContext";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Favorites (saved listings) and currently selected listing for details/modals
  const [favorites, setFavorites] = useState([]);
  const [currentListing, setCurrentListing] = useState(null);

  // Refs used to avoid feedback loops and to track unsubscribe handlers
  const themeSyncedFromProfile = useRef(null);
  const lastFirestoreTheme = useRef(null);
  const unsubscribeUserRef = useRef(null);

  const fetchUserProfile = async (uid) => {
    try {
      const docRef = doc(db, "users", uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (err) {
      console.warn("Failed to fetch user profile", err);
      return null;
    }
  };

  // Sync theme to firestore when it changes locally (avoid feedback loops)
  useEffect(() => {
    if (!user || !user.id) return;
    if (themeSyncedFromProfile.current !== user.id) return;
    if (user.theme === theme || theme === lastFirestoreTheme.current) return;
    try {
      updateDoc(doc(db, "users", user.id), { theme }).catch((err) => {
        console.warn("[Auth] failed to sync theme to firestore", err);
      });
      lastFirestoreTheme.current = theme;
    } catch (e) {
      console.warn("[Auth] theme sync error", e);
    }
  }, [theme, user?.id]);

  // Replace existing onAuthStateChanged effect with a more robust listener that mirrors
  // the website behavior: attach a realtime user doc listener, prefer pending verify
  // profiles when present, avoid auto-creating a users doc for unverified users and
  // perform a minimal create for verified users. Also register push token if available.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // cleanup any previous user listener
      if (unsubscribeUserRef.current) {
        try {
          unsubscribeUserRef.current();
        } catch (e) {}
        unsubscribeUserRef.current = null;
      }

      if (fbUser) {
        let profileUnsub = null;
        try {
          const userRef = doc(db, "users", fbUser.uid);
          profileUnsub = onSnapshot(
            userRef,
            async (snap) => {
              if (snap && snap.exists()) {
                const userData = { ...snap.data(), id: fbUser.uid };

                // Ensure hasPassword flag is populated
                if (userData.hasPassword === undefined) {
                  userData.hasPassword = fbUser.providerData.some(
                    (p) => p.providerId === "password",
                  );
                }

                // Sync theme from user profile (only once per user session to avoid feedback loops)
                if (
                  userData.theme &&
                  themeSyncedFromProfile.current !== fbUser.uid &&
                  userData.theme !== theme
                ) {
                  setTheme(userData.theme);
                }
                themeSyncedFromProfile.current = fbUser.uid;
                lastFirestoreTheme.current = userData.theme || null;

                setUser(userData);
                setLoading(false);
              } else {
                // No user doc exists in Firestore
                // Check for a pending verification profile stored by signup
                let pendingProfile = null;
                try {
                  const stored = getVerifyParams && getVerifyParams();
                  if (
                    stored &&
                    stored.pending &&
                    stored.pending.uid === fbUser.uid
                  ) {
                    pendingProfile = stored.pending.profile || null;
                  }
                } catch (e) {
                  // ignore
                }

                const fallback = {
                  id: fbUser.uid,
                  email: fbUser.email,
                  firstName: fbUser.displayName || "",
                  lastName: "",
                  role: "tenant",
                  avatarUrl: fbUser.photoURL || null,
                };

                if (pendingProfile) {
                  const local = {
                    id: fbUser.uid,
                    email: fbUser.email,
                    ...pendingProfile,
                  };
                  setUser(local);
                  console.debug(
                    "[Auth] using pending verify profile for",
                    fbUser.uid,
                  );
                  setLoading(false);
                } else if (!fbUser.emailVerified) {
                  // Unverified user without a pending profile: set local fallback but DO NOT write to Firestore
                  setUser(fallback);
                  console.debug(
                    "[Auth] unverified user, skipping auto-create users doc for",
                    fbUser.uid,
                  );
                  setLoading(false);
                } else {
                  // Verified user: create minimal users doc (merge) to ensure downstream rules pass
                  setUser(fallback);
                  try {
                    await setDoc(
                      userRef,
                      {
                        id: fbUser.uid,
                        name: (fbUser.displayName || "").trim(),
                        email: fbUser.email || null,
                        role: "tenant",
                        createdAt: serverTimestamp(),
                      },
                      { merge: true },
                    );
                    console.debug(
                      "[Auth] created minimal users doc for",
                      fbUser.uid,
                    );
                  } catch (e) {
                    console.warn(
                      "[Auth] failed to create minimal users doc (may be due to rules)",
                      e,
                    );
                  }
                  setLoading(false);
                }
              }

              // After ensuring local user state, attempt push token registration
              try {
                if (Device.isDevice) {
                  const { status: existingStatus } =
                    await Notifications.getPermissionsAsync();
                  let finalStatus = existingStatus;
                  if (existingStatus !== "granted") {
                    const { status } =
                      await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                  }
                  if (finalStatus === "granted") {
                    const tokenData =
                      await Notifications.getExpoPushTokenAsync();
                    const token = tokenData.data;
                    try {
                      await updateDoc(doc(db, "users", fbUser.uid), {
                        pushToken: token,
                      });
                    } catch (e) {
                      console.warn("[Auth] Failed to save push token", e);
                    }
                  }
                }
              } catch (e) {
                console.warn("[Auth] Push token registration failed", e);
              }
            },
            (err) => {
              console.warn("[Auth] users/{uid} onSnapshot error", err);
              setLoading(false);
            },
          );
        } catch (e) {
          console.warn("[Auth] failed to attach profile listener", e);
          setLoading(false);
        }

        unsubscribeUserRef.current = profileUnsub;
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      try {
        unsubscribeAuth();
      } catch (e) {}
      if (unsubscribeUserRef.current) {
        try {
          unsubscribeUserRef.current();
        } catch (e) {}
      }
    };
  }, []);

  // Subscribe to the user's favorites subcollection so UI updates in real-time
  useEffect(() => {
    if (!user || !user.id) {
      setFavorites([]);
      return;
    }

    const favCol = collection(db, "users", user.id, "favorites");
    const unsubscribe = onSnapshot(
      favCol,
      (snap) => {
        const ids = snap.docs.map((d) => d.id);
        // also include numeric variants so favorites.includes(listing.id) works
        const expanded = ids.reduce((acc, id) => {
          acc.push(id);
          const num = Number(id);
          if (!isNaN(num)) acc.push(num);
          return acc;
        }, []);
        setFavorites(expanded);
      },
      (err) => {
        console.warn("Failed to subscribe to favorites", err);
      },
    );

    return () => unsubscribe();
  }, [user]);

  // Toggle favorite: add or remove a listing from the user's favorites
  const toggleFavorite = async (listingId) => {
    if (!user || !user.id) {
      console.warn("toggleFavorite: no authenticated user");
      return;
    }

    try {
      const favDocRef = doc(
        db,
        "users",
        user.id,
        "favorites",
        String(listingId),
      );
      const exists =
        favorites.includes(String(listingId)) || favorites.includes(listingId);
      if (exists) {
        await deleteDoc(favDocRef);
      } else {
        await fsSetDoc(favDocRef, {
          listingId: String(listingId),
          createdAt: serverTimestamp(),
        });
      }
      // optimistic update will be handled by the onSnapshot listener above
    } catch (err) {
      console.warn("Failed to toggle favorite", err);
    }
  };

  // Expose a helper to set the current listing for details/modals
  const _setCurrentListing = (listing) => {
    setCurrentListing(listing);
  };

  // Auth helpers exposed to the app
  const login = async (email, password) => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged listener will populate user
    return res.user;
  };

  const signUp = async (email, password, profile = {}) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const uid = res.user.uid;
    const userProfile = {
      id: uid,
      name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
      email,
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      role: profile.role || "tenant",
      city: profile.city || "",
      phoneNumber: profile.phoneNumber || "",
      nin: profile.nin || "",
      avatarUrl: profile.avatarUrl || null,
      verificationStatus: "none",
      createdAt: new Date().toISOString(),
    };
    // Create Firestore user document
    try {
      await setDoc(doc(db, "users", uid), userProfile);
    } catch (e) {
      console.warn("signUp: failed to write user doc", e);
      // Even if Firestore write fails (rules/token race), we'll try to read the doc below
    }

    // Try to load canonical profile from Firestore (poll briefly)
    try {
      const start = Date.now();
      let fetched = null;
      while (Date.now() - start < 6000) {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            fetched = snap.data();
            break;
          }
        } catch (e) {
          console.warn("signUp: getDoc attempt failed", e);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (fetched) {
        setUser(fetched);
      } else {
        setUser(userProfile);
      }
    } catch (e) {
      console.warn("signUp: failed to fetch user doc after create", e);
      setUser(userProfile);
    }

    // update firebase auth profile displayName if provided
    if (profile.firstName || profile.lastName) {
      try {
        await updateAuthProfile(auth.currentUser, {
          displayName:
            `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
        });
      } catch (e) {
        console.warn("signUp: failed to update auth profile", e);
      }
    }
    return userProfile;
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFavorites([]);
      setCurrentListing(null);
    } catch (err) {
      console.warn("Logout failed", err);
    }
  };

  const updateProfile = async (patch) => {
    if (!user || !user.id) throw new Error("No user to update");
    const docRef = doc(db, "users", user.id);
    try {
      // Use setDoc with merge so we can create the doc if it doesn't exist
      await fsSetDoc(docRef, patch, { merge: true });

      // If display name changed, update Auth profile displayName
      if (patch.firstName || patch.lastName) {
        const authPatch = {};
        if (patch.firstName || patch.lastName) {
          authPatch.displayName =
            `${patch.firstName || user.firstName || ""} ${patch.lastName || user.lastName || ""}`.trim();
        }
        try {
          if (Object.keys(authPatch).length > 0) {
            await updateAuthProfile(auth.currentUser, authPatch);
          }
        } catch (e) {
          console.warn("[Auth] failed to update firebase auth profile", e);
        }
      }

      // refresh local user object
      const updatedSnap = await getDoc(docRef);
      if (updatedSnap.exists()) setUser(updatedSnap.data());
      return true;
    } catch (err) {
      console.warn("Failed to update profile", err);
      throw err;
    }
  };

  // Helper to register for push notifications and return token (used by registerPushToken)
  const registerForPushNotificationsAsync = async () => {
    try {
      if (!Device.isDevice) return null;
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return null;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch (e) {
      console.warn("registerForPushNotificationsAsync failed", e);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeTab,
        favorites,
        currentListing,
        setActiveTab,
        toggleFavorite,
        _setCurrentListing,
        setCurrentListing: _setCurrentListing,
        login,
        signUp,
        logout,
        updateProfile,
        registerForPushNotificationsAsync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
