import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useTheme } from "../context/ThemeContext";

const ResetPasswordModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) return Alert.alert("Missing", "Please enter your email");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Sent", "Password reset email sent");
      onClose();
    } catch (err) {
      console.warn("Reset failed", err);
      Alert.alert("Error", "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? "#0b1220" : "#fff" },
          ]}
        >
          <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>
            Reset Password
          </Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#071026" : "#f8fafc",
                color: isDark ? "#fff" : "#0f172a",
              },
            ]}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#e5e7eb" }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: "#0f172a" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#10b981" }]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(2,6,23,0.5)",
  },
  container: { width: "90%", padding: 16, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: { padding: 12, borderRadius: 10, marginBottom: 8 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { padding: 12, borderRadius: 10, minWidth: 100, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});

export default ResetPasswordModal;
