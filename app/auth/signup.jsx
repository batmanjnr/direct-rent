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
import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [role, setRole] = useState("tenant");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const isFormComplete = Object.values(formData).every(
    (value) => value.trim() !== "",
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
      // Use centralized signUp helper that creates auth user and Firestore profile
      console.debug("[Signup] calling AuthContext.signUp");
      const profile = await signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: `+234${formData.phoneNumber}`,
        role,
        city: formData.city,
        nin: formData.nin,
      });

      console.debug(
        "[Signup] signUp returned profile:",
        profile && profile.id ? { id: profile.id } : profile,
      );

      // Wait for Firestore user document to appear (created by Cloud Function or client) so new users see same data
      const waitForUserDoc = async (uid, timeout = 6000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) return true;
          } catch (e) {
            console.warn(
              "[Signup] getDoc failed while waiting for user doc",
              e,
            );
          }
          // small delay
          await new Promise((r) => setTimeout(r, 500));
        }
        return false;
      };

      if (profile && profile.id) {
        const found = await waitForUserDoc(profile.id);
        if (!found)
          console.warn(
            "[Signup] user doc did not appear within timeout, proceeding anyway",
          );
      }

      // Navigate to dashboard; AuthProvider's onAuthStateChanged will load the profile
      router.replace("/dashboard");
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
                  isFormComplete ? styles.btnActive : styles.btnInactive,
                ]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Create Account</Text>
                )}
              </TouchableOpacity>
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
});
