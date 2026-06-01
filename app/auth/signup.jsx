import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronDown,
  X,
  Users,
  Handshake,
  Eye,
  EyeOff,
} from "lucide-react-native";
import { setVerifyParams } from "../../lib/verifyStore";
import { auth } from "../../lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseConfig } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

export default function Signup() {
  const router = useRouter();
  // keep auth context available for future use (avoid unused var warnings)
  const authContext = useAuth();
  const [role, setRole] = useState("tenant");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    nin: "",
    city: "",
    password: "",
    confirmPassword: "",
  });

  const oyoCities = [
    "Ogbomoso",
    "Ibadan",
    "Oyo",
    "Iseyin",
    "Shaki",
    "Eruwa",
    "Igboho",
    "Kisi",
  ];

  // ensure every field is a non-empty string
  const isFormComplete = Object.values(formData).every(
    (value) => typeof value === "string" && value.trim() !== "",
  );
  const isFieldInvalid = (value) => hasAttemptedSubmit && value.trim() === "";

  const handleSignup = async () => {
    console.debug("[Signup] starting signup flow");
    setHasAttemptedSubmit(true);
    if (!isFormComplete) {
      Alert.alert(
        "Required Fields",
        "Please fill in all details highlighted in red.",
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      // Normalize phone to E.164. If user types a leading 0 (e.g. 0801...), remove it and prepend country code 234.
      const rawPhone = String(formData.phoneNumber || "").trim();
      let digits = rawPhone.replace(/\D/g, "");
      if (digits.startsWith("0")) digits = digits.slice(1);
      // If user already included country code (e.g. 234...), keep it; otherwise add 234
      if (!digits.startsWith("234") && digits.length > 0)
        digits = `234${digits}`;
      const phoneE164 = digits ? `+${digits}` : "";

      // Basic validations: email, NIN (11 digits), phone length
      const emailOk = /^\S+@\S+\.\S+$/.test((formData.email || "").trim());
      if (!emailOk) {
        Alert.alert("Invalid Email", "Please provide a valid email address.");
        setIsLoading(false);
        return;
      }
      const ninDigits = String(formData.nin || "").replace(/\D/g, "");
      if (ninDigits.length !== 11) {
        Alert.alert("Invalid NIN", "NIN must be 11 digits.");
        setIsLoading(false);
        return;
      }
      if (!digits || digits.length < 10) {
        Alert.alert("Invalid Phone", "Please provide a valid phone number.");
        setIsLoading(false);
        return;
      }

      // Create Auth user now but do NOT create Firestore users/{uid} until email is verified.
      const pendingProfile = {
        // id will be set after we create the auth user post-verification
        name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role,
        city: formData.city,
        phoneNumber: phoneE164,
        nin: formData.nin,
        avatarUrl: null,
        verificationStatus: "pending",
        createdAt: new Date().toISOString(),
      };

      // Create Firebase Auth user and send verification email.
      try {
        const email = (formData.email || "").trim();
        const password = formData.password;
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const user = userCredential.user;
        // Send verification email
        await sendEmailVerification(user);

        // Store pending profile with uid so verify-email can complete onboarding after verification
        if (typeof setVerifyParams !== "function") {
          console.error("[Signup] verifyStore not available");
          Alert.alert(
            "Internal Error",
            "Unable to proceed to email verification.",
          );
          setIsLoading(false);
          return;
        }
        // include uid so verify-email can write users/{uid} after verification
        setVerifyParams({
          pending: { uid: user.uid, profile: pendingProfile },
        });
        // Also persist to AsyncStorage so pending params survive an app reload
        try {
          await AsyncStorage.setItem(
            "verify_pending",
            JSON.stringify({
              pending: {
                uid: user.uid,
                profile: pendingProfile,
                projectId: firebaseConfig?.projectId || null,
              },
            }),
          );
        } catch (storageErr) {
          console.warn(
            "[Signup] failed to persist verify_pending to AsyncStorage",
            storageErr,
          );
        }
        setIsLoading(false);
        console.debug("[Signup] created user, routing to verify-email", {
          role,
        });
        // Always route to the email verification flow which finalizes onboarding
        router.replace(`/auth/verify-email`);
        return;
      } catch (authError) {
        console.error("[Signup] createUser failed", authError);
        setIsLoading(false);
        // bubble Firebase auth errors to the user
        Alert.alert("Signup Failed", authError?.message || String(authError));
        return;
      }
    } catch (error) {
      console.error("[Signup] signup failed", error);
      setIsLoading(false);
      Alert.alert("Signup Failed", error?.message || String(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/Direct.png")}
                style={styles.logoImage}
              />
            </View>

            <Text style={styles.title}>Create account</Text>

            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, role === "tenant" && styles.roleActive]}
                onPress={() => setRole("tenant")}
              >
                <Users
                  color={role === "tenant" ? "#1e3a8a" : "#64748b"}
                  size={20}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "tenant" && styles.roleTextActive,
                  ]}
                >
                  Tenant
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === "agent" && styles.roleActive]}
                onPress={() => setRole("agent")}
              >
                <Handshake
                  color={role === "agent" ? "#1e3a8a" : "#64748b"}
                  size={20}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "agent" && styles.roleTextActive,
                  ]}
                >
                  Agent
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>FIRST NAME</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFieldInvalid(formData.firstName) && styles.inputError,
                    ]}
                    placeholder="Peace"
                    value={formData.firstName}
                    onChangeText={(v) =>
                      setFormData({ ...formData, firstName: v })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>LAST NAME</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isFieldInvalid(formData.lastName) && styles.inputError,
                    ]}
                    placeholder="Ajala"
                    value={formData.lastName}
                    onChangeText={(v) =>
                      setFormData({ ...formData, lastName: v })
                    }
                  />
                </View>
              </View>

              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={[
                  styles.input,
                  isFieldInvalid(formData.email) && styles.inputError,
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="example@mail.com"
                value={formData.email}
                onChangeText={(v) => setFormData({ ...formData, email: v })}
              />

              <Text style={styles.label}>PHONE NUMBER (+234)</Text>
              <TextInput
                style={[
                  styles.input,
                  isFieldInvalid(formData.phoneNumber) && styles.inputError,
                ]}
                keyboardType="phone-pad"
                placeholder="8012345678"
                value={formData.phoneNumber}
                onChangeText={(v) =>
                  setFormData({ ...formData, phoneNumber: v })
                }
              />

              <Text style={styles.label}>NIN (11 DIGITS)</Text>
              <TextInput
                style={[
                  styles.input,
                  isFieldInvalid(formData.nin) && styles.inputError,
                ]}
                keyboardType="number-pad"
                maxLength={11}
                placeholder="00000000000"
                value={formData.nin}
                onChangeText={(v) => setFormData({ ...formData, nin: v })}
              />

              <Text style={styles.label}>CITY (OYO STATE)</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.cityTrigger,
                  isFieldInvalid(formData.city) && styles.inputError,
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowCityModal(true);
                }}
              >
                <Text style={{ color: formData.city ? "#0f172a" : "#94a3b8" }}>
                  {formData.city || "Select City"}
                </Text>
                <ChevronDown size={18} color="#1e3a8a" />
              </TouchableOpacity>

              <Text style={styles.label}>PASSWORD</Text>
              <View
                style={[
                  styles.passContainer,
                  isFieldInvalid(formData.password) && styles.inputError,
                ]}
              >
                <TextInput
                  style={styles.passInput}
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(v) =>
                    setFormData({ ...formData, password: v })
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={[
                  styles.input,
                  isFieldInvalid(formData.confirmPassword) && styles.inputError,
                ]}
                secureTextEntry={!showPassword}
                value={formData.confirmPassword}
                onChangeText={(v) =>
                  setFormData({ ...formData, confirmPassword: v })
                }
              />

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  isFormComplete && agreedToTerms
                    ? styles.btnActive
                    : styles.btnInactive,
                ]}
                onPress={handleSignup}
                disabled={!isFormComplete || !agreedToTerms || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Consent radio placed below the submit button. User must agree before button becomes active */}
              <View style={styles.consentRow}>
                <TouchableOpacity
                  style={styles.consentCheckbox}
                  onPress={() => setAgreedToTerms((v) => !v)}
                >
                  <View
                    style={[
                      styles.checkboxInner,
                      agreedToTerms && styles.checkboxChecked,
                    ]}
                  >
                    {agreedToTerms && (
                      <Text style={styles.checkboxTick}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.consentText}>
                    I agree to the Terms of Use and Privacy Policy.
                    <Text
                      style={styles.learnMoreLink}
                      onPress={() => setShowConsentModal(true)}
                    >
                      Learn more
                    </Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.signupLink}
                onPress={() => router.push("/home")}
              >
                <Text style={styles.signupText}>Have an account? Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Modal visible={showCityModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a City</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <X size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={oyoCities}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => {
                    setFormData({ ...formData, city: item });
                    setShowCityModal(false);
                  }}
                >
                  <Text style={styles.cityItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Consent Modal */}
      <Modal
        visible={showConsentModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.consentModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy & Consent</Text>
              <TouchableOpacity onPress={() => setShowConsentModal(false)}>
                <X size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.consentHeading}>Chat Monitoring</Text>
              <Text style={styles.consentBody}>
                For safety and quality assurance, chats within the DirectRent
                app are monitored and stored. This helps protect both tenants
                and agents and allows us to investigate reports or disputes.
              </Text>

              <Text style={styles.consentHeading}>
                Transactions Outside the App
              </Text>
              <Text style={styles.consentBody}>
                Transactions arranged outside the DirectRent platform are not
                covered by our protection and are not monitored. We strongly
                advise finalizing payments through our app when available.
              </Text>

              <Text style={styles.consentHeading}>Data Security</Text>
              <Text style={styles.consentBody}>
                We store user information securely and handle personal data
                responsibly. Sensitive information is protected and only used
                for verification and trust-building purposes.
              </Text>
            </ScrollView>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                style={styles.paymentCancelBtn}
                onPress={() => setShowConsentModal(false)}
              >
                <Text style={styles.paymentCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  scrollContent: { padding: 24, paddingBottom: 60 },
  logoImage: { width: 52, height: 52, borderRadius: 8, marginRight: 8 },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 15,
  },
  logoText: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 20,
  },
  roleRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  roleActive: { borderColor: "#1e3a8a", backgroundColor: "#eff6ff" },
  roleText: { fontWeight: "600", color: "#64748b" },
  roleTextActive: { color: "#1e3a8a" },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 14,
  },
  row: { flexDirection: "row" },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    color: "#0f172a",
  },
  inputError: { borderColor: "#ef4444", borderWidth: 1.5 },
  cityTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  passInput: { flex: 1, paddingVertical: 12 },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 30,
    alignItems: "center",
  },
  btnActive: { backgroundColor: "#1e3a8a" },
  btnInactive: { backgroundColor: "#cbd5e1" },
  submitText: { color: "white", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "50%",
  },
  consentModalCard: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 14,
    margin: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  cityItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cityItemText: { fontSize: 16 },
  signupLink: { marginTop: 12, alignItems: "center" },
  signupText: { color: "#1e3a8a", fontWeight: "700", fontSize: 13 },
  consentRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  consentCheckbox: { marginRight: 10 },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxChecked: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  checkboxTick: { color: "#ffffff", fontWeight: "900" },
  consentText: { fontSize: 12, color: "#475569" },
  learnMoreLink: {
    color: "#1e3a8a",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  consentHeading: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 6,
  },
  consentBody: { fontSize: 13, color: "#475569", lineHeight: 18 },
});
