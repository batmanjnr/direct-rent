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
import { BlurView } from "expo-blur";
import { uriToBlob } from "../lib/uriToBlob";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  const [successToastVisible, setSuccessToastVisible] = useState(false);

  const showSuccessToast = (msg = "Profile picture uploaded successfully") => {
    setSuccessToastVisible(true);
    setTimeout(() => setSuccessToastVisible(false), 3000);
  };

  const pickAndUpload = async () => {
    try {
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

      if (!res) return;
      if (res.canceled === true || res.cancelled === true) return;

      let uri = null;
      if (Array.isArray(res.assets) && res.assets.length > 0)
        uri = res.assets[0].uri;
      else if (typeof res.uri === "string") uri = res.uri;
      if (!uri) return;

      setAvatarUploading(true);

      // Manipulate image to resize/compress and produce a local uri + base64
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );

      if (!manipResult) throw new Error("Image processing failed");

      const mimeType = "image/jpeg";
      let uploadedUrl = null;
      const remotePath = `avatars/${user.id}_${Date.now()}.jpg`;

      // Primary upload approach: fetch the manipulated uri and upload blob
      try {
        const fetchUri = manipResult.uri || uri;
        console.log(
          "[UpdateProfileModal] attempting fetch upload for",
          fetchUri,
          "->",
          remotePath,
        );
        const resp = await fetch(fetchUri);
        const blob = await resp.blob();
        const storageRef = ref(storage, remotePath);
        await uploadBytes(storageRef, blob, { contentType: mimeType });
        uploadedUrl = await getDownloadURL(storageRef);
        console.log("[UpdateProfileModal] upload success", {
          remotePath,
          uploadedUrl,
        });
      } catch (errFetch) {
        console.warn(
          "[UpdateProfileModal] fetch upload failed, falling back to uriToBlob",
          errFetch,
        );
        // Fallback to uriToBlob (handles dev client / special URI schemes)
        try {
          const blob = await uriToBlob(manipResult.uri || uri, mimeType);
          console.log(
            "[UpdateProfileModal] obtained blob via uriToBlob, uploading to",
            remotePath,
          );
          const storageRef = ref(storage, remotePath);
          await uploadBytes(storageRef, blob, { contentType: mimeType });
          uploadedUrl = await getDownloadURL(storageRef);
          console.log("[UpdateProfileModal] upload success (fallback)", {
            remotePath,
            uploadedUrl,
          });
        } catch (errFallback) {
          console.warn(
            "[UpdateProfileModal] storage upload failed (both fetch and uriToBlob)",
            errFetch,
            errFallback,
          );
          Alert.alert(
            "Upload failed",
            `Storage upload failed:\n${String(errFetch)}\n${String(errFallback)}`,
          );
        }
      }

      if (uploadedUrl) {
        setAvatarPreview(uploadedUrl);
        await updateProfile({ avatarUrl: uploadedUrl });
        // Show styled in-app success toast instead of system alert
        showSuccessToast();
        console.log("[UpdateProfileModal] upload succeeded", {
          remotePath,
          uploadedUrl,
        });
      } else {
        // Fallback: save base64 into profile (existing behavior)
        const b64 = manipResult.base64;
        const dataUrl = `data:${mimeType};base64,${b64}`;
        setAvatarPreview(dataUrl);
        await updateProfile({ avatarBase64: b64, avatarMime: mimeType });
        Alert.alert(
          "Saved (local)",
          "Profile photo saved to profile (fallback).",
        );
      }
    } catch (err) {
      console.warn("avatar upload failed", err);
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
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.09)"
                : "rgba(255, 255, 255, 0.6)",
              shadowOpacity: isDark ? 0.3 : 0.1,
            },
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
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.25)"
                  : "rgba(255, 255, 255, 0.45)",
              },
            ]}
          >
            <Text
              style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}
            >
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
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(15, 23, 42, 0.04)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Text
                    style={{
                      color: isDark ? "#fff" : "#0f172a",
                      fontWeight: "600",
                    }}
                  >
                    Photo
                  </Text>
                </View>
              )}
              {avatarUploading ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#fff" : "#2563eb"}
                />
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
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
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
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.03)", // Soft dark track overlay on light theme
                  color: isDark ? "#fff" : "#0f172a",
                },
              ]}
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.btn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(15, 23, 42, 0.05)",
                  },
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

            {/* Success toast for avatar upload */}
            {successToastVisible && (
              <View style={styles.toast}>
                <Text style={styles.toastText}>
                  Profile picture uploaded successfully
                </Text>
              </View>
            )}
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    letterSpacing: -0.4,
    textAlign: "center",
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
    marginTop: 14,
  },
  btn: {
    flex: 1, // Ensures cancel and save take up equal balanced column splits
    paddingVertical: 18, // Matches the exact menu items button line height
    borderRadius: 100, // Perfectly aligned capsule layout buttons
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  toast: {
    position: "absolute",
    bottom: 80,
    left: "50%",
    transform: [{ translateX: -50 }],
    backgroundColor: "rgba(75, 181, 67, 0.9)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
  },
  toastText: {
    color: "#fff",
    fontWeight: "500",
    textAlign: "center",
    fontSize: 14,
  },
});

export default UpdateProfileModal;
