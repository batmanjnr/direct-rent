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
            {avatarPreview ? (
              <Image
                source={{ uri: avatarPreview }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  marginBottom: 8,
                }}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: isDark ? "#071026" : "#f3f4f6",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: isDark ? "#fff" : "#0f172a" }}>
                  Photo
                </Text>
              </View>
            )}
            {avatarUploading ? (
              <ActivityIndicator />
            ) : (
              <Text
                style={{
                  color: isDark ? "#94a3b8" : "#0f172a",
                  marginBottom: 6,
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
                backgroundColor: isDark ? "#071026" : "#f8fafc",
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
                backgroundColor: isDark ? "#071026" : "#f8fafc",
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
              onPress={onClose}
              style={[
                styles.btn,
                { backgroundColor: isDark ? "#1e293b" : "#e2e8f0" },
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
                { backgroundColor: isDark ? "#2563eb" : "#3b82f6" },
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
