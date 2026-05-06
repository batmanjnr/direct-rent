import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { X, Eye, EyeOff } from "lucide-react-native";
import { auth } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      // Direct login logic from your Auth_2.tsx
      await signInWithEmailAndPassword(auth, email, password);
      // Navigate to dashboard after successful login
      router.replace("/app/dashboard");
    } catch (error) {
      // Handling common Firebase errors
      let errorMessage = "Incorrect Email/Password";
      if (error?.code === "auth/user-not-found")
        errorMessage = "No account found with this email.";
      if (error?.code === "auth/wrong-password")
        errorMessage = "Incorrect password.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback
      onPress={() => Keyboard.dismiss()}
      accessible={false}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../../assets/Direct.png")}
                  style={styles.logoImage}
                />
              </View>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to manage your properties
              </Text>
            </View>

            
            <View style={styles.form}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError("");
                }}
              />

              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError("");
                  }}
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

              
              <TouchableOpacity
                style={styles.forgotPass}
                onPress={() => router.push("/reset-password")}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              
              <TouchableOpacity
                style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Sign In</Text>
                )}
              </TouchableOpacity>

              
              <TouchableOpacity
                style={styles.signupLink}
                onPress={() => router.push("/auth/signup")}
              >
                <Text style={styles.signupText}>
                  Don't have an account? Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  content: { padding: 24, flex: 1 },
  logoImage: { width: 52, height: 52, borderRadius: 8, marginRight: 8 },
  errorText: { color: "#dc2626", marginBottom: 6, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  logoContainer: { flexDirection: "row", alignItems: "center", margin: "auto" },
  logoText: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  titleSection: { marginBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
  },
  form: { marginTop: 10 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  submitButton: {
    backgroundColor: "#1e3a8a",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    alignItems: "center",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: "white", fontWeight: "700", fontSize: 16 },
  forgotPass: { marginTop: 12, alignItems: "center" },
  forgotText: { color: "#1e3a8a", fontWeight: "700", fontSize: 13 },
  signupLink: { marginTop: 12, alignItems: "center" },
  signupText: { color: "#1e3a8a", fontWeight: "700", fontSize: 13 },
});
