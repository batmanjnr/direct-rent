import React, { useState, useEffect } from "react";
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
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { firebaseConfig } from "../../lib/firebase";
WebBrowser.maybeCompleteAuthSession();

import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // FIXED: Removed the self-referencing circular dependency on clientConfig
  const clientConfig = {
    expoClientId:
      firebaseConfig?.expoClientId || firebaseConfig?.webClientId || "",
    iosClientId: firebaseConfig?.iosClientId || "",
    androidClientId: firebaseConfig?.androidClientId || "",
    webClientId: firebaseConfig?.webClientId || firebaseConfig?.apiKey || "",
  };

  // detect whether to use Expo proxy (Expo Go / dev-client) or native redirect
  const useProxy =
    Constants.appOwnership === "expo" || Constants.appOwnership === "guest";
  const redirectUri = AuthSession.makeRedirectUri({ useProxy });
  console.info("Google redirectUri:", redirectUri);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: clientConfig.expoClientId,
    iosClientId: clientConfig.iosClientId,
    androidClientId: clientConfig.androidClientId,
    webClientId: clientConfig.webClientId,
    redirectUri,
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        setGoogleLoading(true);
        try {
          // FIXED: Extracted the idToken correctly from response.authentication
          const idToken = response.authentication?.idToken;

          if (!idToken) {
            throw new Error(
              "No idToken received from authentication provider.",
            );
          }

          const credential = GoogleAuthProvider.credential(idToken);
          const res = await signInWithCredential(auth, credential);

          // after sign-in, check email verification
          const user = res.user || auth.currentUser;
          if (user) {
            await user.reload();
            if (user.email && user.emailVerified) {
              router.replace("/profile");
            } else {
              // send verification email and navigate to verify-email screen
              try {
                await user.sendEmailVerification();
              } catch (e) {
                console.warn("sendEmailVerification failed", e);
              }
              router.replace("/auth/verify-email");
            }
          } else {
            router.replace("/app/dashboard");
          }
        } catch (e) {
          console.warn("Google sign-in failed", e);
          setError("Google sign-in failed. Check configuration.");
        } finally {
          setGoogleLoading(false);
        }
      }
    };
    handleGoogleResponse();
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/app/dashboard");
    } catch (error) {
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
        {/* Geometric background shapes */}
        <View style={styles.shapeTopRight} pointerEvents="none" />
        <View style={styles.shapeBottomLeft} pointerEvents="none" />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            <View style={styles.logoCenter}>
              <Image
                source={require("../../assets/Direct.png")}
                style={styles.logoImage}
              />
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
                placeholderTextColor="#6b7280"
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
                  placeholderTextColor="#6b7280"
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
                    <EyeOff size={20} color="#374151" />
                  ) : (
                    <Eye size={20} color="#374151" />
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

              {/* OR separator */}
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                {/* <Text style={styles.orText}>OR</Text> */}
                <View style={styles.orLine} />
              </View>

              {/* <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: "#db4437", marginTop: 12 },
                ]}
                onPress={async () => {
                  setError("");
                  if (!request) {
                    Alert.alert(
                      "Google Sign-in not configured",
                      "Missing Google client IDs. Add them to firebase-applet-config.json (webClientId / expoClientId / iosClientId / androidClientId).",
                    );
                    return;
                  }
                  try {
                    setGoogleLoading(true);
                    await promptAsync({ useProxy });
                  } catch (e) {
                    console.warn("promptAsync failed", e);
                    setError("Google sign-in failed to start");
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Sign in with Google</Text>
                )}
              </TouchableOpacity> */}

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
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  logoCenter: { alignItems: "center", marginTop: 18, marginBottom: 8 },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 6,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e6e9ef",
    marginHorizontal: 12,
  },
  orText: { color: "#6b7280", fontWeight: "700" },
  shapeTopRight: {
    position: "absolute",
    top: -100,
    right: -80,
    width: 220,
    height: 220,
    backgroundColor: "#2B3467",
    borderRadius: 120,
    transform: [{ scaleX: 1.2 }],
    opacity: 0.95,
  },
  shapeBottomLeft: {
    position: "absolute",
    bottom: -120,
    left: -100,
    width: 260,
    height: 260,
    backgroundColor: "#2B3467",
    borderRadius: 160,
    transform: [{ scaleX: 1.1 }],
    opacity: 0.95,
  },
  centerCard: {
    margin: 20,
    marginTop: 40,
    marginBottom: 40,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 6,
    flex: 1,
  },
  content: { padding: 28, flex: 1 },
  logoImage: { width: 52, height: 52, borderRadius: 8, marginRight: 8 },
  errorText: { color: "#dc2626", marginBottom: 6, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  logoContainer: { flexDirection: "row", alignItems: "center" },
  logoText: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  titleSection: { marginBottom: 20, alignItems: "center" },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  form: { marginTop: 10, flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6e9ef",
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    color: "#0f172a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6e9ef",
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
    backgroundColor: "#2B3467",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 28,
    alignItems: "center",
    shadowColor: "#2B3467",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  submitText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  forgotPass: { marginTop: 12, alignItems: "center" },
  forgotText: { color: "#2B3467", fontWeight: "700", fontSize: 13 },
  signupLink: { marginTop: 12, alignItems: "center" },
  signupText: { color: "#2B3467", fontWeight: "700", fontSize: 13 },
});
