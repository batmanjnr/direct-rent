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
  Image,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { BlurView } from 'expo-blur';
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// import { storage } from "../lib/firebase";

const UpdateProfileModal = ({ visible, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatarUrl ||
      (user?.avatarBase64 && user?.avatarMime
        ? `data:${user.avatarMime};base64,${user.avatarBase64}`
        : null),
  );
  // additional profile fields
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [loading, setLoading] = useState(false);

  const pickAndUpload = async () => {
    try {
      // Request permission and handle different SDK responses
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      const allowed =
        typeof permission.granted === "boolean"
          ? permission.granted
          : permission.status === "granted";
      if (!allowed) {
        Alert.alert(
          "Permission required",
          "Permission required to access photos",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      // Normalize results across SDK versions
      // Newer API: { canceled: boolean, assets: [{ uri, ... }] }
      // Older API: { cancelled: boolean, uri: string }
      if (res == null) return;
      if (res.canceled === true || res.cancelled === true) return;

      let uri = null;
      if (Array.isArray(res.assets) && res.assets.length > 0)
        uri = res.assets[0].uri;
      else if (typeof res.uri === "string") uri = res.uri;

      if (!uri) {
        // user likely cancelled or returned unknown shape
        return;
      }

      setAvatarUploading(true);
      // let blob = null;

      // Try fetch first (works for file:// and http(s) URIs)
      // try {
      //   const r = await fetch(uri);
      //   blob = await r.blob();
      // } catch (e) {
      //   console.warn(
      //     "[UpdateProfileModal] fetch(uri) failed, attempting FileSystem base64 fallback",
      //     e
      //   );
      //   // Fallback: read file as base64 and convert to blob via data URL
      //   try {
      //     const b64 = await FileSystem.readAsStringAsync(uri, {
      //       encoding: FileSystem.EncodingType.Base64,
      //     });
      //     const dataUrl = `data:image/jpeg;base64,${b64}`;
      //     const resp = await fetch(dataUrl);
      //     blob = await resp.blob();
      //   } catch (fsErr) {
      //     console.error("[UpdateProfileModal] base64 fallback failed", fsErr);
      //     throw fsErr;
      //   }
      // }

      // if (!blob) throw new Error("Could not obtain image data");

      // Determine mime type for upload metadata
      // let mimeType = blob.type || null;
      // try {
      //   if (!mimeType && typeof uri === "string") {
      //     if (uri.endsWith(".png")) mimeType = "image/png";
      //     else if (uri.endsWith(".webp")) mimeType = "image/webp";
      //     else mimeType = "image/jpeg";
      //   }
      // } catch (mErr) {
      //   mimeType = mimeType || "image/jpeg";
      // }

      // const storageRef = ref(storage, `avatars/${user.id}_${Date.now()}.jpg`);
      // console.debug(
      //   "[UpdateProfileModal] uploading avatar, mimeType=",
      //   mimeType,
      //   "uri=",
      //   uri
      // );
      // await uploadBytes(storageRef, blob, { contentType: mimeType });
      // const url = await getDownloadURL(storageRef);
      // await updateProfile({ avatarUrl: url });
      // reflect immediately

      // Use ImageManipulator to resize & compress and return base64
      try {
        // target max width to reduce size; quality 0.6 to keep under Firestore limits
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 512 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );

        if (!manipResult || !manipResult.base64) {
          throw new Error("Image processing failed");
        }

        const b64 = manipResult.base64; // no data: prefix
        const mimeType = "image/jpeg";

        // WARNING: Firestore has a 1 MiB document size limit. Keep avatars small (recommended under ~200KB).
        // Validate size before writing
        const estimateBytes = Math.ceil((b64.length * 3) / 4);
        console.debug(
          "[UpdateProfileModal] avatar base64 approx bytes=",
          estimateBytes,
        );
        if (estimateBytes > 800 * 1024) {
          Alert.alert(
            "Image Too Large",
            "Please choose a smaller image. Processed image exceeds 800KB limit.",
          );
          return;
        }

        // Persist into Firestore via the existing updateProfile helper
        // Update Firestore but keep modal open. Reflect preview locally immediately.
        const dataUrl = `data:${mimeType};base64,${b64}`;
        setAvatarPreview(dataUrl);
        await updateProfile({ avatarBase64: b64, avatarMime: mimeType });
        Alert.alert("Saved", "Profile photo updated.");
      } catch (procErr) {
        console.error("[UpdateProfileModal] image manipulate failed", procErr);
        throw procErr;
      }
    } catch (err) {
      console.warn("avatar upload failed", err);
      // If the user simply cancelled selection we already returned earlier; any error here is real
      Alert.alert("Failed to upload avatar", err?.message || String(err));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const patch = {
        firstName: firstName || "",
        lastName: lastName || "",
        phoneNumber: phoneNumber || "",
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
    styles.outerContainer, 
    { 
      borderColor: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(255, 255, 255, 0.6)",
      shadowOpacity: isDark ? 0.3 : 0.1 
    }
  ]}
>
  {/* Real Native Frosted Glass Surface Layer */}
  <BlurView 
    intensity={isDark ? 30 : 75} // Increased intensity on light mode to give that rich frosted texture
    tint={isDark ? "dark" : "light"} 
    style={StyleSheet.absoluteFill} 
  />
  
  {/* Base Tint Wash Container */}
  <View 
    style={[
      styles.container, 
      { 
        backgroundColor: isDark ? "rgba(30, 41, 59, 0.25)" : "rgba(255, 255, 255, 0.45)" 
      }
    ]}
  >
          <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>
            Edit Profile
          </Text>

          <TouchableOpacity
            onPress={pickAndUpload}
            style={{ marginBottom: 16, alignItems: "center" }}
          >
            {avatarPreview ? (
              <Image
                source={{ uri: avatarPreview }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  marginBottom: 8,
                  borderWidth: 1.5,
                  borderColor: "rgba(255, 255, 255, 0.4)", // White-glass glowing ring highlight
                }}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <Text style={{ color: isDark ? "#fff" : "#0f172a", fontWeight: "600" }}>
                  Photo
                </Text>
              </View>
            )}
            {avatarUploading ? (
              <ActivityIndicator size="small" color={isDark ? "#fff" : "#2563eb"} />
            ) : (
              <Text
                style={{
                  color: isDark ? "#94a3b8" : "#475569",
                  marginBottom: 6,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Tap to change photo
              </Text>
            )}
          </TouchableOpacity>

          <TextInput
            placeholder="First name"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={firstName}
            onChangeText={setFirstName}
            style={[
  styles.input,
  {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
    color: isDark ? "#fff" : "#0f172a",
  },
]}
          />

          <TextInput
            placeholder="Last name"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={lastName}
            onChangeText={setLastName}
            style={[
  styles.input,
  {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
    color: isDark ? "#fff" : "#0f172a",
  },
]}
          />

          <TextInput
            placeholder="Phone number"
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            style={[
  styles.input,
  {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
    color: isDark ? "#fff" : "#0f172a",
  },
]}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.btn,
                { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)" },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  { color: isDark ? "#cbd5e1" : "#0f172a" },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.btn,
                { backgroundColor: isDark ? "#3b82f6" : "#2563eb" },
              ]}
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
      </View>
    </KeyboardAvoidingView>
  </Modal>
);};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(3, 7, 18, 0.65)", // Dark cinematic overlay to make glass modal stand out
  },
outerContainer: {
  width: "90%",
  borderRadius: 36, 
  overflow: "hidden", 
  borderWidth: 1,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 24 },
  shadowRadius: 32,
  elevation: 8,
},
container: { 
  width: "100%", 
  padding: 24, 
},
// ... keep everything else identical below
  title: { 
    fontSize: 22, 
    fontWeight: "700", 
    marginBottom: 20,
    letterSpacing: -0.4,
    textAlign: "center"
  },
  input: { 
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    borderRadius: 100, // Uniform capsule layout fields matching main menu bar style
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  actionsRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", // Spreads actions out cleanly inside the bar frame
    gap: 12,
    marginTop: 14 
  },
  btn: { 
    flex: 1, // Ensures cancel and save take up equal balanced column splits
    paddingVertical: 18, // Matches the exact menu items button line height
    borderRadius: 100, // Perfectly aligned capsule layout buttons
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)"
  },
  btnText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: -0.2
  },
});

export default UpdateProfileModal;
