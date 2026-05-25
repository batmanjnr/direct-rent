import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useSearchParams } from "expo-router";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { firebaseConfig, auth } from "../../lib/firebase";
import {
  FirebaseRecaptchaVerifierModal,
  FirebaseRecaptchaBanner,
} from "expo-firebase-recaptcha";
import {
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  linkWithCredential,
} from "firebase/auth";
import { signInWithPhoneNumber as signInWithPhoneNumberExpo } from "firebase/auth";
import { getVerifyParams, setVerifyParams } from "../../lib/verifyStore";
import Constants from "expo-constants";

export default function VerifyPhone() {
  const router = useRouter();
  const isExpoGo = Constants.appOwnership === "expo";
  let params = {};
  try {
    params = useSearchParams() || {};
  } catch (e) {
    // some environments may not implement useSearchParams; fallback to in-memory store
    params = getVerifyParams() || {};
  }
  const { uid, phone } = params;
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const recaptchaVerifier = React.useRef(null);
  const [verificationId, setVerificationId] = useState(null);
  const [debugMessage, setDebugMessage] = useState("");

  useEffect(() => {
    // Log the recaptcha ref after a short delay so we can see if it mounts
    const t = setTimeout(() => {
      console.log(
        "[VerifyPhone] recaptchaVerifier.current (delayed) =",
        recaptchaVerifier.current,
      );
      if (isExpoGo) {
        setDebugMessage(
          "Running in Expo Go — reCAPTCHA may not work here. Use a custom dev client or standalone build.",
        );
      }
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const sendCode = async () => {
    if (!phone) return;
    // Debug: ensure firebaseConfig and recaptcha ref are present
    console.log("[VerifyPhone] firebaseConfig keys:", {
      apiKey: firebaseConfig?.apiKey ? "OK" : "MISSING",
      authDomain: firebaseConfig?.authDomain ? "OK" : "MISSING",
      projectId: firebaseConfig?.projectId ? "OK" : "MISSING",
    });
    console.log(
      "[VerifyPhone] recaptchaVerifier.current =",
      recaptchaVerifier.current,
    );

    if (
      !firebaseConfig ||
      !firebaseConfig.apiKey ||
      !firebaseConfig.authDomain ||
      !firebaseConfig.projectId
    ) {
      const msg =
        "Missing firebaseConfig keys (apiKey/authDomain/projectId). Check firebase-applet-config.json.";
      console.warn("[VerifyPhone]", msg);
      setDebugMessage(msg);
      return;
    }
    // If running inside Expo Go, use a dev OTP because reCAPTCHA/SMS often fail there
    if (isExpoGo) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      console.warn("[VerifyPhone] Expo Go dev OTP generated:", otp);
      setVerificationId(otp);
      setLastSentAt(new Date());
      setDebugMessage(`Dev OTP: ${otp} (Expo Go). Use this code to verify.`);
      Alert.alert("Dev OTP", `Use this code to verify: ${otp}`);
      return;
    }
    if (!recaptchaVerifier.current) {
      const msg =
        'reCAPTCHA verifier not mounted yet. Please wait a moment and tap "Send code".';
      console.warn("[VerifyPhone]", msg);
      setDebugMessage(msg);
      return;
    }
    setIsSending(true);
    try {
      const phoneNumber = phone.startsWith("+") ? phone : `+${phone}`;
      // Use PhoneAuthProvider.verifyPhoneNumber which integrates with the FirebaseRecaptchaVerifierModal
      console.log(
        "[VerifyPhone] initiating verifyPhoneNumber for",
        phoneNumber,
      );
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationIdResult = await phoneProvider.verifyPhoneNumber(
        phoneNumber,
        // pass the recaptcha verifier ref provided by expo-firebase-recaptcha
        recaptchaVerifier.current,
      );
      console.log(
        "[VerifyPhone] verifyPhoneNumber returned verificationId:",
        verificationIdResult,
      );
      setVerificationId(verificationIdResult);
      setLastSentAt(new Date());
      Alert.alert(
        "Verification SMS sent",
        `A verification SMS was sent to ${phoneNumber}`,
      );
      setDebugMessage("reCAPTCHA shown and SMS requested.");
    } catch (e) {
      console.warn("Failed to send verification SMS", e);
      console.warn("[VerifyPhone] recaptcha/phone failed", e);
      Alert.alert(
        "Error",
        "Unable to send SMS. Check reCAPTCHA and phone number.",
      );
      setDebugMessage((prev) => prev + "\n" + (e?.message || String(e)));
    } finally {
      setIsSending(false);
    }
  };

  // Don't auto-send on mount; require user to tap Send so we can ensure recaptcha modal is mounted
  useEffect(() => {
    // Clear debug when phone changes
    setDebugMessage("");
    setVerificationId(null);
  }, [uid, phone]);

  const handleVerify = async () => {
    if (!verificationId) {
      Alert.alert(
        "No verification session",
        "Please request a verification SMS first.",
      );
      return;
    }
    if (code.trim().length === 0) {
      Alert.alert("Enter code", "Please enter the 6-digit verification code.");
      return;
    }
    setIsVerifying(true);
    try {
      // If running in Expo Go and a dev OTP was issued, verify locally
      if (isExpoGo) {
        if (verificationId === code.trim()) {
          // proceed to create account using pending registration
          const pendingStore = (getVerifyParams && getVerifyParams()) || {};
          const pending = pendingStore.pending || pendingStore;
          if (pending && pending.email && pending.password && pending.profile) {
            const res = await createUserWithEmailAndPassword(
              auth,
              pending.email,
              pending.password,
            );
            const newUid = res.user.uid;
            const userDoc = {
              ...pending.profile,
              id: newUid,
              verificationStatus: "verified",
              phoneVerified: true,
              phoneVerifiedAt: serverTimestamp(),
            };
            await setDoc(doc(db, "users", newUid), userDoc);
            try {
              setVerifyParams({});
            } catch (e) {}
            Alert.alert(
              "Verified",
              "Account created and phone number verified. You may now login.",
            );
            router.replace("/dashboard");
          } else {
            // no pending, just sign in locally (not recommended)
            Alert.alert("Verified", "Phone verified (Expo dev).");
            router.replace("/dashboard");
          }
        } else {
          Alert.alert("Invalid code", "The code entered does not match.");
        }
        return;
      }

      // Real flow: Build credential from verificationId + code and sign in / link
      const credential = PhoneAuthProvider.credential(
        verificationId,
        code.trim(),
      );

      // Check if we have a pending registration saved from signup flow
      const pendingStore = (getVerifyParams && getVerifyParams()) || {};
      const pending = pendingStore.pending || pendingStore;

      if (pending && pending.email && pending.password && pending.profile) {
        // Create email/password account now that phone is verified, then link phone credential
        const res = await createUserWithEmailAndPassword(
          auth,
          pending.email,
          pending.password,
        );
        const newUid = res.user.uid;
        try {
          // Link the phone credential to the newly created account
          await linkWithCredential(res.user, credential);
        } catch (linkErr) {
          console.warn("[VerifyPhone] linkWithCredential failed", linkErr);
        }

        // Write the Firestore user document using the pending profile
        const userDoc = {
          ...pending.profile,
          id: newUid,
          verificationStatus: "verified",
          phoneVerified: true,
          phoneVerifiedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", newUid), userDoc);
        try {
          setVerifyParams({});
        } catch (e) {}
        Alert.alert(
          "Verified",
          "Account created and phone number verified. You may now login.",
        );
        router.replace("/dashboard");
      } else if (uid) {
        // Legacy flow: mark existing user doc as verified
        await signInWithCredential(auth, credential);
        await updateDoc(doc(db, "users", uid), {
          phoneVerified: true,
          verificationStatus: "verified",
          phoneVerifiedAt: serverTimestamp(),
        });
        Alert.alert("Verified", "Phone number verified — you may now proceed.");
        router.replace("/dashboard");
      } else {
        // No pending registration and no uid — fallback: sign in with credential
        await signInWithCredential(auth, credential);
        Alert.alert("Verified", "Phone number verified.");
        router.replace("/dashboard");
      }
    } catch (e) {
      console.warn("Verification failed", e);
      Alert.alert("Verification error", "Unable to verify code. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={false}
      />
      {/* Visible banner so user can see reCAPTCHA UI before sending */}
      {isExpoGo ? (
        <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
          <Text style={{ color: "#b91c1c" }}>
            Note: You are running inside Expo Go. The reCAPTCHA webview commonly
            fails in Expo Go — please run a custom dev client or standalone app
            to send SMS.
          </Text>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
        <FirebaseRecaptchaBanner firebaseConfig={firebaseConfig} />
      </View>
      {/* Button to explicitly open the reCAPTCHA modal (helps on some devices) */}
      <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
        <TouchableOpacity
          onPress={() => {
            try {
              if (recaptchaVerifier.current && recaptchaVerifier.current.open) {
                // some implementations expose open() to present the modal
                recaptchaVerifier.current.open();
                setDebugMessage("Opened reCAPTCHA modal.");
              } else {
                setDebugMessage(
                  "reCAPTCHA modal not directly openable; tap Send code to trigger it.",
                );
              }
            } catch (e) {
              console.warn("[VerifyPhone] open reCAPTCHA failed", e);
              setDebugMessage(
                "Failed to open reCAPTCHA modal: " + (e?.message || e),
              );
            }
          }}
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: "#1e3a8a", fontWeight: "700" }}>
            Open reCAPTCHA
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inner}>
        {/* Debug area: shows reCAPTCHA + config hints while debugging */}
        {debugMessage ? (
          <Text style={{ color: "#b91c1c", marginBottom: 8 }}>
            {debugMessage}
          </Text>
        ) : null}
        <Text style={styles.title}>Verify phone number</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {phone || "your phone number"}. Enter it
          below.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="123456"
          maxLength={6}
        />

        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.sendText}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity onPress={sendCode} disabled={isSending}>
            <Text style={styles.link}>
              {isSending
                ? "Sending..."
                : verificationId
                  ? "Resend code"
                  : "Send code"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/home")}>
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          {lastSentAt ? `Last sent: ${lastSentAt.toLocaleTimeString()}` : ""}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  inner: { padding: 24, marginTop: 60 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  subtitle: { color: "#64748b", marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sendBtn: {
    backgroundColor: "#1e3a8a",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  sendText: { color: "white", fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  link: { color: "#1e3a8a", fontWeight: "700" },
  note: { marginTop: 12, color: "#94a3b8" },
});
