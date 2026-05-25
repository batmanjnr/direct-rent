import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { auth, db } from "../../lib/firebase";
import { sendEmailVerification, signOut } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import {
  getVerifyParams,
  setVerifyParams,
  loadVerifyParamsFromStorage,
} from "../../lib/verifyStore";
import { firebaseConfig } from "../../lib/firebase";

export default function VerifyEmail() {
  const router = useRouter();
  const [pending, setPending] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Force-refresh the current user's ID token to reduce stale-token related permission errors
  async function ensureFreshAuth() {
    try {
      if (!auth || !auth.currentUser) throw new Error("No authenticated user");
      if (typeof auth.currentUser.getIdToken === "function") {
        await auth.currentUser.getIdToken(true);
      }
      return auth.currentUser.uid;
    } catch (e) {
      console.error("[VerifyEmail] ensureFreshAuth failed", e);
      throw e;
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await loadVerifyParamsFromStorage();
        const p = getVerifyParams && getVerifyParams();
        if (mounted && p && p.pending) {
          setPending(p.pending);
          return;
        }
        if (mounted && loaded && loaded.pending) {
          setPending(loaded.pending);
          return;
        }
        // fallback: use currently signed-in user (if any)
        if (mounted && auth.currentUser) {
          setPending({ uid: auth.currentUser.uid, profile: null });
          return;
        }
        if (mounted) setPending(null);
      } catch (e) {
        console.warn("[VerifyEmail] failed to load pending verify params", e);
        if (auth.currentUser)
          setPending({ uid: auth.currentUser.uid, profile: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleResend = async () => {
    if (!auth.currentUser) {
      Alert.alert(
        "Not signed in",
        "Please sign in first to resend verification.",
      );
      return;
    }
    try {
      setIsResending(true);
      await sendEmailVerification(auth.currentUser);
      Alert.alert("Email Sent", "Verification email resent. Check your inbox.");
    } catch (err) {
      console.error("[VerifyEmail] resend failed", err);
      // Handle rate-limiting gracefully
      if (err && err.code === "auth/too-many-requests") {
        Alert.alert(
          "Too many requests",
          "You have requested verification too many times. Please wait a few minutes before trying again.",
        );
      } else {
        Alert.alert(
          "Error",
          err?.message || "Failed to resend verification email.",
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    if (!auth.currentUser) {
      Alert.alert("Not signed in", "Please sign in to complete verification.");
      return;
    }
    try {
      setIsChecking(true);
      await auth.currentUser.reload();
      const user = auth.currentUser;
      if (user.emailVerified) {
        // build profile to write to Firestore
        const stored = getVerifyParams && getVerifyParams();
        const pendingData = stored && stored.pending ? stored.pending : pending;
        const profile = (pendingData && pendingData.profile) || {};
        // ensure uid and some fields
        const uid = user.uid;
        // Build userDoc using server timestamps to satisfy strict rules and avoid client clock skew.
        const userDoc = {
          ...profile,
          id: uid,
          email: user.email,
          verificationStatus: "verified",
          verifiedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          // Refresh token to ensure Firestore security rules see a fresh request.auth
          try {
            await ensureFreshAuth();
            // small backoff to allow token propagation in Firestore rule evaluation
            await new Promise((r) => setTimeout(r, 500));
          } catch (e) {
            console.warn("[VerifyEmail] ensureFreshAuth warning", e);
          }
          // Diagnostic: log current auth state and token claims to help trace permission issues
          try {
            console.debug("[VerifyEmail] auth.currentUser", {
              uid: auth.currentUser?.uid,
              email: auth.currentUser?.email,
              emailVerified: auth.currentUser?.emailVerified,
            });
            if (typeof auth.currentUser.getIdTokenResult === "function") {
              const tk = await auth.currentUser.getIdTokenResult();
              console.debug("[VerifyEmail] idTokenResult", {
                expirationTime: tk.expirationTime,
                issuedAtTime: tk.issuedAtTime,
                authTime: tk.authTime,
                claims: tk.claims,
                // do not print full token; print length as a quick sanity check
                tokenLength: (tk.token || "").length,
              });
            }
            // Also log the firebase projectId that the client thinks it's using
            try {
              console.debug(
                "[VerifyEmail] client firebaseConfig.projectId",
                firebaseConfig?.projectId || null,
              );
            } catch (cfgErr) {
              console.warn(
                "[VerifyEmail] failed to read firebaseConfig",
                cfgErr,
              );
            }
          } catch (logErr) {
            console.warn("[VerifyEmail] failed to log token details", logErr);
          }

          // Diagnostic write: attempt a small 'debug_writes' doc to detect rule behavior
          try {
            await setDoc(
              doc(db, "debug_writes", uid),
              {
                createdBy: uid,
                ts: serverTimestamp(),
              },
              { merge: true },
            );
            console.debug("[VerifyEmail] debug write succeeded");
          } catch (dbgErr) {
            console.warn("[VerifyEmail] debug write failed", dbgErr);
            // If debug write fails with permission-denied, surface clearer instructions
            if (
              dbgErr &&
              (dbgErr.code === "permission-denied" ||
                String(dbgErr).toLowerCase().includes("permission"))
            ) {
              Alert.alert(
                "Permission error",
                "Unable to write to backend (debug write). This usually means your Firebase security rules block the request. Please sign out, sign in again, then try Verify. If the problem persists check your Firestore rules to allow authenticated users to create their own profile (request.auth.uid == userId).",
              );
            }
            // continue to attempt the real write below (for additional diagnostics)
          }
          await setDoc(doc(db, "users", uid), userDoc, { merge: true });
          // clear verify params
          if (typeof setVerifyParams === "function") setVerifyParams(null);
          Alert.alert("Verified", "Your email has been verified. Welcome!");
          // If the pending profile requested the 'agent' role, send them to the
          // agent onboarding / profile flow. Otherwise go to the app home.
          if ((profile && profile.role) === "agent") {
            router.replace("/app/Agent/agentauth");
          } else {
            router.replace("/app");
          }
        } catch (fireErr) {
          console.error("[VerifyEmail] writing user doc failed", fireErr);
          // Permission errors usually indicate Firestore rules rejecting the write.
          // Give a helpful message and suggest signing out/in to refresh credentials.
          if (
            fireErr &&
            (fireErr.code === "permission-denied" ||
              String(fireErr).toLowerCase().includes("permission"))
          ) {
            Alert.alert(
              "Permission error",
              "Unable to write your profile to the backend. Please sign out and sign in again, then press Verify. If the problem persists contact support.",
            );
          } else {
            Alert.alert(
              "Error",
              "Failed to finalize signup. Please try again.",
            );
          }
        }
      } else {
        Alert.alert(
          "Not Verified",
          "We could not confirm email verification yet. Check your inbox and try again.",
        );
      }
    } catch (err) {
      console.error("[VerifyEmail] check failed", err);
      Alert.alert(
        "Error",
        err?.message || "Could not check verification status.",
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (typeof setVerifyParams === "function") setVerifyParams(null);
      router.replace("/home");
    } catch (err) {
      console.error("[VerifyEmail] signOut failed", err);
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  if (pending === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>No pending signup found.</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emailToShow =
    (pending && pending.profile && pending.profile.email) ||
    (auth.currentUser && auth.currentUser.email) ||
    "";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.info}>We sent a verification link to:</Text>
      <Text style={styles.email}>{emailToShow}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleResend}
        disabled={isResending}
      >
        {isResending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Resend verification email</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={handleCheck}
        disabled={isChecking}
      >
        {isChecking ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>verify account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={handleSignOut}
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  info: { color: "#475569", marginBottom: 6 },
  email: { fontWeight: "700", marginBottom: 20 },
  message: { color: "#475569", marginBottom: 12 },
  button: {
    backgroundColor: "#1e3a8a",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: { color: "white", fontWeight: "700" },
  secondary: { backgroundColor: "#f1f5f9" },
  secondaryText: { color: "#0f172a" },
});
