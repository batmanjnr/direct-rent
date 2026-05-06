import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  collection,
  onSnapshot,
  setDoc as fsSetDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Favorites (saved listings) and currently selected listing for details/modals
  const [favorites, setFavorites] = useState([]);
  const [currentListing, setCurrentListing] = useState(null);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.debug("[Auth] onAuthStateChanged fired, fbUser:", fbUser);
      if (fbUser) {
        // Try to load the richer profile from Firestore
        const profile = await fetchUserProfile(fbUser.uid);
        if (profile) {
          setUser(profile);
          console.debug("[Auth] loaded profile from Firestore for", fbUser.uid);
          // register push token for this device and save to user doc
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
                const tokenData = await Notifications.getExpoPushTokenAsync();
                const token = tokenData.data;
                try {
                  await updateDoc(doc(db, "users", fbUser.uid), {
                    pushToken: token,
                  });
                } catch (e) {
                  console.warn("Failed to save push token", e);
                }
              }
            }
          } catch (e) {
            console.warn("Push token registration failed", e);
          }
        } else {
          // Fallback: create a minimal profile object from firebase user
          const fallback = {
            id: fbUser.uid,
            email: fbUser.email,
            firstName: fbUser.displayName || "",
            lastName: "",
            role: "tenant",
            avatarUrl: fbUser.photoURL || null,
          };
          setUser(fallback);
          console.debug("[Auth] set fallback profile for", fbUser.uid);
        }
      } else {
        setUser(null);
        console.debug("[Auth] no firebase user, set user=null");
      }
      setLoading(false);
    });

    return unsubscribe;
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
      await updateDoc(docRef, patch);
      // If avatar or display name changed, sync to firebase auth profile
      if (patch.avatarUrl || patch.firstName || patch.lastName) {
        const authPatch = {};
        if (patch.avatarUrl) authPatch.photoURL = patch.avatarUrl;
        if (patch.firstName || patch.lastName) {
          authPatch.displayName =
            `${patch.firstName || user.firstName || ""} ${patch.lastName || user.lastName || ""}`.trim();
        }
        try {
          await updateAuthProfile(auth.currentUser, authPatch);
        } catch (e) {
          // ignore
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

  const registerPushToken = async (uid) => {
    try {
      if (!uid) return;
      // guard: projectId may not be available in some dev environments; wrap and tolerate failures
      const token = await registerForPushNotificationsAsync().catch((e) => {
        console.warn("Push token registration failed", e);
        return null;
      });
      if (!token) return;
      await setDoc(
        doc(db, "users", uid),
        { pushToken: token },
        { merge: true },
      );
    } catch (e) {
      console.warn("Failed to save push token to user profile", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        activeTab, // Now accessible via useAuth()[cite: 6]
        setActiveTab, // Now accessible via useAuth()[cite: 6]
        favorites,
        toggleFavorite,
        currentListing,
        setCurrentListing: _setCurrentListing,
        login,
        signUp,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
