import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

// Simple phone verification screen (development-friendly):
// - Sends a 6-digit OTP and stores it in Firestore under `phone_verifications/{uid}` (expires in 5 minutes)
// - Verifies the OTP and updates users/{uid}.phoneNumber and phoneVerified
// NOTE: This implementation is intended for development/demo. For production you MUST send the OTP via an SMS provider (Twilio, MessageBird, Firebase Phone Auth on native) and avoid storing plaintext codes in Firestore.

export default function VerifyPhone() {
  const { user } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState(user?.phoneNumber || "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("enter"); // enter | verify
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/home");
    }
  }, [user]);

  if (!user) return null;

  if (user.role && user.role !== "tenant") {
    // If user is not a tenant, redirect back — this screen is meant for tenants per request
    useEffect(() => {
      Alert.alert(
        "Not allowed",
        "Phone verification is currently intended for tenants.",
      );
      router.back();
    }, []);
    return null;
  }

  const sendOtp = async () => {
    if (!phone || !/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      Alert.alert(
        "Invalid phone",
        "Please enter a valid phone number with country code (e.g. +15551234567).",
      );
      return;
    }
    setLoading(true);
    try {
      // Generate a 6-digit OTP (development only). Replace this with a server-side SMS send for production.
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000),
      );
      await setDoc(doc(db, "phone_verifications", user.id), {
        phone: phone.trim(),
        code: otp,
        createdAt: serverTimestamp(),
        expiresAt,
      });

      // For development convenience show the OTP on-device. Remove in production.
      Alert.alert(
        "OTP Sent (dev)",
        `Code: ${otp}\nThis is for development only. In production the code will be delivered by SMS.`,
      );

      setStep("verify");
    } catch (err) {
      console.error("sendOtp error", err);
      Alert.alert("Error", "Failed to send verification code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!code || code.trim().length < 4) {
      Alert.alert(
        "Invalid code",
        "Please enter the 6-digit verification code.",
      );
      return;
    }
    setLoading(true);
    try {
      const ref = doc(db, "phone_verifications", user.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert(
          "No code found",
          "No verification request found. Please request a fresh code.",
        );
        setStep("enter");
        return;
      }
      const data = snap.data();
      const now = Timestamp.fromDate(new Date());
      if (
        data.expiresAt &&
        data.expiresAt.toMillis &&
        data.expiresAt.toMillis() < Date.now()
      ) {
        Alert.alert(
          "Expired",
          "The verification code has expired. Request a new code.",
        );
        await deleteDoc(ref);
        setStep("enter");
        return;
      }
      if (data.code !== code.trim()) {
        Alert.alert(
          "Incorrect code",
          "The code you entered is incorrect. Please try again.",
        );
        return;
      }

      // Success — mark user phone as verified
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        phoneNumber: data.phone || phone.trim(),
        phoneVerified: true,
        phoneVerifiedAt: serverTimestamp(),
      });

      // cleanup
      await deleteDoc(ref);

      Alert.alert("Verified", "Your phone number has been verified.");
      router.back();
    } catch (err) {
      console.error("verifyOtp error", err);
      Alert.alert("Error", "Failed to verify code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          Add your phone number to secure your account and enable tenant
          verification.
        </Text>

        {step === "enter" ? (
          <>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+15551234567"
              keyboardType="phone-pad"
              style={styles.input}
              autoCompleteType="tel"
              textContentType="telephoneNumber"
            />

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={sendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.helper}>
              Enter the 6-digit code sent to {phone}
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="numeric"
              style={styles.input}
              maxLength={6}
            />

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={verifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep("enter")}
            >
              <Text style={styles.secondaryText}>Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#374151", marginBottom: 12 },
  helper: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  primaryBtn: {
    height: 46,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { alignItems: "center", paddingVertical: 8 },
  secondaryText: { color: "#374151" },
});
