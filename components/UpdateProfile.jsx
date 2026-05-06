import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const UpdateProfile = () => {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [city, setCity] = useState(user?.city || "");
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permissions required",
        "Permission to access photos is required.",
      );
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (res.canceled) return;
    const uri = res.assets[0].uri;

    try {
      setLoading(true);
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await updateProfile({ avatarUrl: url });
      Alert.alert("Success", "Profile photo updated");
    } catch (err) {
      console.warn("Upload failed", err);
      Alert.alert("Upload failed", "Could not upload avatar");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({ firstName, lastName, phoneNumber, city });
      Alert.alert("Success", "Profile updated");
    } catch (err) {
      console.warn(err);
      Alert.alert("Error", "Unable to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0b1220" : "#fff",
          borderColor: isDark ? "#1e293b" : "#f1f5f9",
          borderWidth: 1,
          borderRadius: 16,
          marginBottom: 16,
          padding: 16,
          minHeight: 120,
        },
      ]}
    >
      <TouchableOpacity style={styles.avatarRow} onPress={pickImage}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: isDark ? "#071026" : "#f1f5f9" },
            ]}
          >
            <Text style={{ color: isDark ? "#94a3b8" : "#0f172a" }}>
              {(user?.firstName || "U").charAt(0)}
            </Text>
          </View>
        )}
        <Text
          style={[styles.changeText, { color: isDark ? "#94a3b8" : "#0f172a" }]}
        >
          Change photo
        </Text>
      </TouchableOpacity>

      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder="Phone number"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
        keyboardType="phone-pad"
      />
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="City"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? "#071026" : "#f8fafc",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: "#10b981" }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginRight: 12 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  changeText: { fontWeight: "700" },
  input: { padding: 12, borderRadius: 12, marginBottom: 8 },
  saveBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveText: { color: "#fff", fontWeight: "700" },
});

export default UpdateProfile;
