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
import { BlurView } from 'expo-blur';

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
  <View style={styles.outerContainer}>
    {/* Real Native Frosted Glass Layer */}
    <BlurView 
      intensity={isDark ? 25 : 60} 
      tint={isDark ? "dark" : "light"} 
      style={StyleSheet.absoluteFill} 
    />
    
    <View style={styles.innerContent}>
      <TouchableOpacity style={styles.avatarRow} onPress={pickImage}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)" },
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
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.02)",
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
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.02)",
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
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.02)",
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
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.02)",
            color: isDark ? "#fff" : "#0f172a",
          },
        ]}
      />

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: isDark ? "#3b82f6" : "#2563eb" }]}
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
  </View>
);
const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 36, // Deep smooth capsule framing from your image
    marginBottom: 16,
    minHeight: 120,
    overflow: "hidden", // Crucial: clips the BlurView layout strictly within the card boundaries
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)", // Ultra-thin glass line reflection
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
  },
  innerContent: {
    padding: 24, // Keeps form layout spacious and elegant
  },
  avatarRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 20 
  },
  avatar: { 
    width: 68, 
    height: 68, 
    borderRadius: 34, 
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)", // White-glass neon rim glow highlight
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  changeText: { 
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  input: { 
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    borderRadius: 100, // Complete sleek pill inputs matching image buttons
    marginBottom: 12, 
    fontSize: 15,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  saveBtn: {
    paddingVertical: 18, // Perfectly matches profile menu buttons line height 
    paddingHorizontal: 20, 
    borderRadius: 100, // Consistent pill aesthetic
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: -0.2,
  },
});}
export default UpdateProfile;
