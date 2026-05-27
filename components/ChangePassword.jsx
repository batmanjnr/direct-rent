import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const ChangePassword = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });

  const triggerStatus = (text, type) => {
    setStatusMessage({ text, type });
  };

  const handleChange = async () => {
    setStatusMessage({ text: "", type: "" });

    if (!currentPwd || !newPwd) {
      return triggerStatus("Please fill both password fields.", "error");
    }
    
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPwd,
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPwd);
      
      triggerStatus("Password updated successfully!", "success");
      setCurrentPwd("");
      setNewPwd("");
    } catch (err) {
      console.warn("Pwd change failed", err);
      triggerStatus("Failed to change password. Check your current password.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { 
          // Layered opacity gives the container its glass canvas feel
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.65)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.6)",
        },
      ]}
    >
      {statusMessage.text ? (
        <View style={[
          styles.statusBanner,
          statusMessage.type === "success" ? styles.successBanner : styles.errorBanner,
          { borderColor: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)" }
        ]}>
          <Text style={statusMessage.type === "success" ? styles.successText : styles.errorText}>
            {statusMessage.text}
          </Text>
        </View>
      ) : null}

      <TextInput
        placeholder="Current password"
        placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(15, 23, 42, 0.4)"}
        secureTextEntry
        value={currentPwd}
        onChangeText={setCurrentPwd}
        style={[
          styles.input,
          {
            // Dark mode gets a deep inset slot look, light mode stays crystal clear
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.5)",
            color: isDark ? "#ffffff" : "#0f172a",
            borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)",
          },
        ]}
      />
      <TextInput
        placeholder="New password"
        placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(15, 23, 42, 0.4)"}
        secureTextEntry
        value={newPwd}
        onChangeText={setNewPwd}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.5)",
            color: isDark ? "#ffffff" : "#0f172a",
            borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)",
          },
        ]}
      />
      
      <TouchableOpacity
        style={[
          styles.btn, 
          { 
            // The button uses a bright, glowing glass tint approach
            backgroundColor: isDark ? "rgba(16, 185, 129, 0.85)" : "rgba(16, 185, 129, 0.9)",
            borderColor: "rgba(255, 255, 255, 0.25)",
            opacity: loading ? 0.6 : 1 
          }
        ]}
        onPress={handleChange}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Change Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    padding: 24, 
    borderRadius: 30, // Sweeter, softer circular corners matching modern UI designs
    borderWidth: 1,
    // Layered complex shadows to ground the floating glass plate
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  input: { 
    paddingVertical: 15, 
    paddingHorizontal: 18, 
    borderRadius: 16, 
    marginBottom: 16, 
    fontSize: 15,
    borderWidth: 1,
  },
  btn: { 
    paddingVertical: 15, 
    borderRadius: 16, 
    alignItems: "center", 
    justifyContent: "center",
    marginTop: 6, 
    borderWidth: 1,
    // Emerald color dynamic projection shadow glow
    shadowColor: "#10b981", 
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  statusBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  successBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  successText: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default ChangePassword;