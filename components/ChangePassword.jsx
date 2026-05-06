import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
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

  const handleChange = async () => {
    if (!currentPwd || !newPwd)
      return Alert.alert("Missing", "Please fill both fields");
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPwd,
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPwd);
      Alert.alert("Success", "Password updated");
      setCurrentPwd("");
      setNewPwd("");
    } catch (err) {
      console.warn("Pwd change failed", err);
      Alert.alert(
        "Error",
        "Failed to change password. Check your current password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0b1220" : "#fff" },
      ]}
    >
      <TextInput
        placeholder="Current password"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        secureTextEntry
        value={currentPwd}
        onChangeText={setCurrentPwd}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />
      <TextInput
        placeholder="New password"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        secureTextEntry
        value={newPwd}
        onChangeText={setNewPwd}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#10b981" }]}
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
  container: { padding: 16, borderRadius: 12 },
  input: { padding: 12, borderRadius: 12, marginBottom: 8 },
  btn: { padding: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});

export default ChangePassword;
