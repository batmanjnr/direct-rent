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
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

const UpdateProfileModal = ({ visible, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [avatarUploading, setAvatarUploading] = useState(false);
  const pickAndUpload = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return alert("Permission required to access photos");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      setAvatarUploading(true);
      const r = await fetch(uri);
      const blob = await r.blob();
      const storageRef = ref(storage, `avatars/${user.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await updateProfile({ avatarUrl: url });
      // reflect immediately
      onClose();
    } catch (err) {
      console.warn("avatar upload failed", err);
      alert("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const patch = {
        firstName: firstName || "",
        gender: gender || "",
        age: age ? Number(age) : null,
      };
      await updateProfile(patch);
      onClose();
    } catch (err) {
      console.warn("Failed to update profile", err);
      Alert.alert("Error", "Failed to update profile");
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
            Edit Profile
          </Text>

          <TouchableOpacity
            onPress={pickAndUpload}
            style={{ marginBottom: 12, alignItems: "center" }}
          >
            <Text
              style={{ color: isDark ? "#94a3b8" : "#0f172a", marginBottom: 6 }}
            >
              {avatarUploading ? "Uploading..." : "Change photo"}
            </Text>
          </TouchableOpacity>

          <TextInput
            placeholder="First name"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={firstName}
            onChangeText={setFirstName}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#071026" : "#f8fafc",
                color: isDark ? "#fff" : "#0f172a",
              },
            ]}
          />
          <TextInput
            placeholder="Gender"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={gender}
            onChangeText={setGender}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#071026" : "#f8fafc",
                color: isDark ? "#fff" : "#0f172a",
              },
            ]}
          />
          <TextInput
            placeholder="Age"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
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
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Save</Text>
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

export default UpdateProfileModal;
