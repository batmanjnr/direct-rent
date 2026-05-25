import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
  Modal,
} from "react-native";
import {
  Building2,
  MapPin,
  Camera,
  Plus,
  X,
  Check,
  Info,
  Navigation,
  ArrowLeft,
  Video,
  Upload,
  AlertCircle,
} from "lucide-react-native";
import { db, storage } from "../../lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import * as ImagePicker from "expo-image-picker"; // Required for mobile media
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { createNotification } from "../../lib/notifications";

const SUGGESTED_TYPES = [
  "Self-Contain",
  "1 Bedroom Flat",
  "2 Bedroom Flat",
  "3 Bedroom Flat",
  "Duplex",
];
const AMENITIES_LIST = [
  "Running Water",
  "Security",
  "Prepaid Meter",
  "Parking",
  "Solar/Inverter",
];

export default function CreateListing() {
  const { user, setActiveTab, currentListing, setCurrentListing } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showPostedModal, setShowPostedModal] = useState(false);

  const isEditMode = !!currentListing && currentListing.agent?.id === user?.id;

  const [formData, setFormData] = useState({
    title: currentListing?.title || "",
    priceValue: currentListing?.priceValue?.toString() || "",
    location: currentListing?.location || "",
    address: currentListing?.address || "",
    type: currentListing?.type || "",
    landmark: currentListing?.landmark || "",
    description: currentListing?.description || "",
    images: currentListing?.images || [],
    video: currentListing?.video || "",
    amenities: currentListing?.amenities || [],
  });
  const [noFee] = useState(currentListing?.noFee || false);
  const [invalidFields, setInvalidFields] = useState({});

  // helper to clear the form so agent can post another listing
  const resetForm = () => {
    setFormData({
      title: "",
      priceValue: "",
      location: "",
      address: "",
      type: "",
      landmark: "",
      description: "",
      images: [],
      video: "",
      amenities: [],
    });
    setInvalidFields({});
    setError(null);
  };

  // Address autocomplete — simplified: no suggestions, plain input so user can freely type
  const AddressAutocomplete = ({ value, onChange }) => {
    return (
      <TextInput
        style={[
          styles.inputSimple,
          {
            backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
            color: isDark ? "#fff" : "#0f172a",
          },
          invalidFields.address && styles.inputError,
        ]}
        placeholder="House address or street"
        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
        value={value}
        onChangeText={(t) => {
          onChange && onChange(t);
        }}
        // keep keyboard active while typing and disable any platform autofill/suggestions
        autoCorrect={false}
        autoComplete="off"
        autoCompleteType="off"
        textContentType="none"
        spellCheck={false}
        importantForAutofill="no"
        keyboardType="default"
      />
    );
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      const processed = [];
      for (const asset of result.assets) {
        try {
          // compress & convert to JPEG, max width 1600
          const manip = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
          );
          // ensure file extension is .jpg
          const uri = manip.uri;
          processed.push(uri);
        } catch (e) {
          console.warn("image manipulation failed", e);
          processed.push(asset.uri);
        }
      }
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...processed].slice(0, 10),
      }));
    } catch (e) {
      console.warn("pickImage failed", e);
    }
  };

  const pickVideo = async () => {
    try {
      // 1) check current permission first
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      let status =
        current?.status ?? (current?.granted ? "granted" : "undetermined");
      // 2) if not granted or limited, request it (this will show the native prompt)
      if (status !== "granted" && status !== "limited") {
        const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = asked?.status ?? (asked?.granted ? "granted" : status);
      }

      // 3) If user explicitly denied, ask them to open settings. Otherwise proceed to launch picker.
      if (status === "denied") {
        Alert.alert(
          "Permission Required",
          "Allow DirectRent to access your videos to attach a property video. Open Settings to grant access.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" },
          ],
          { cancelable: true },
        );
        return;
      }

      // launch the picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
      });

      // Handle both modern (result.canceled) and older (result.cancelled / direct uri) shapes
      if (result == null) {
        console.warn("picker returned null/undefined result");
        return;
      }
      if (result.canceled === true || result.cancelled === true) return;

      // Try to find the uri robustly
      let uri = null;
      if (
        result.assets &&
        Array.isArray(result.assets) &&
        result.assets.length > 0
      ) {
        uri = result.assets[0].uri;
      } else if (result.uri) {
        uri = result.uri;
      }

      if (!uri) {
        console.warn("Unexpected picker result", result);
        Alert.alert(
          "Video selection failed",
          "No video was returned from the picker. If you previously denied permission, open Settings and allow access.",
        );
        return;
      }

      // Try to compress right after selection (best-effort)
      const compressed = await compressVideo(uri).catch((e) => {
        console.warn("compressVideo failed", e);
        return uri;
      });
      setFormData((prev) => ({ ...prev, video: compressed || uri }));
    } catch (e) {
      console.warn("pickVideo failed", e);
      Alert.alert("Video selection failed", e.message || String(e));
    }
  };

  // Best-effort video compression using expo-video-compressor if available.
  // Returns the input uri if compression is not possible.
  const compressVideo = async (uri) => {
    try {
      // dynamic require to avoid build-time errors when package is not installed
      const VideoCompressor = require("expo-video-compressor");
      if (VideoCompressor && VideoCompressor.compress) {
        // try compressing to target size; library may ignore maxSize
        const compressed = await VideoCompressor.compress(uri, {
          compressionMethod: "auto",
          maxSize: 800000,
        });
        if (compressed && compressed.uri) return compressed.uri;
      }
    } catch (e) {
      console.warn("video compressor not available or failed", e);
    }
    return uri;
  };

  // Helper to avoid hanging uploads — reject if promise takes longer than ms
  const runWithTimeout = (promise, ms = 30000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms),
      ),
    ]);
  };

  const toggleAmenity = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const validateFields = () => {
    const invalids = {};
    // required fields
    if (!formData.title || formData.title.trim() === "") invalids.title = true;
    if (!formData.priceValue || String(formData.priceValue).trim() === "")
      invalids.priceValue = true;
    // location removed — UI does not include a separate location field
    if (!formData.type || formData.type.trim() === "") invalids.type = true;
    // images: require at least 1 (allow posting with 1 image)
    if (!formData.images || formData.images.length < 1) invalids.images = true;
    // video is now required
    if (!formData.video || String(formData.video).trim() === "")
      invalids.video = true;
    // address and landmark required
    if (!formData.address || String(formData.address).trim() === "")
      invalids.address = true;
    if (!formData.landmark || String(formData.landmark).trim() === "")
      invalids.landmark = true;
    // at least one amenity
    if (!formData.amenities || formData.amenities.length === 0)
      invalids.amenities = true;
    // description required
    if (!formData.description || String(formData.description).trim() === "")
      invalids.description = true;

    setInvalidFields(invalids);
    console.debug("validateFields invalids:", invalids);
    return Object.keys(invalids).length === 0;
  };

  const handlePublish = async () => {
    // Basic validation
    setError(null);
    const ok = validateFields();
    if (!ok) {
      setError("Please fill the required fields highlighted in red.");
      return;
    }

    setIsSubmitting(true);
    try {
      const listingId = isEditMode
        ? currentListing.id
        : `listing_${Date.now()}`;

      // Upload images
      const uploadedImageUrls = [];
      for (const uri of formData.images) {
        if (uri.startsWith("http")) {
          uploadedImageUrls.push(uri);
        } else {
          try {
            // Ensure the file is a jpg; if not, convert using ImageManipulator (already done at pick time but double-check)
            let uploadUri = uri;
            if (
              !uploadUri.toLowerCase().endsWith(".jpg") &&
              !uploadUri.toLowerCase().endsWith(".jpeg")
            ) {
              try {
                const manip = await ImageManipulator.manipulateAsync(
                  uploadUri,
                  [],
                  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
                );
                uploadUri = manip.uri;
              } catch (e) {
                console.warn("second image manipulation failed", e);
              }
            }
            const fileInfo = await FileSystem.getInfoAsync(uploadUri, {
              size: true,
            });
            const response = await runWithTimeout(fetch(uploadUri), 30000);
            const blob = await runWithTimeout(response.blob(), 30000);
            const storageRef = ref(
              storage,
              `listings/${listingId}/${Date.now()}.jpg`,
            );
            await runWithTimeout(uploadBytes(storageRef, blob), 60000);
            const url = await runWithTimeout(getDownloadURL(storageRef), 30000);
            uploadedImageUrls.push(url);
          } catch (e) {
            console.warn("image upload failed", e);
            Alert.alert(
              "Upload Error",
              `Failed to upload an image: ${e.message || String(e)}`,
            );
            throw e; // stop publishing
          }
        }
      }

      // Upload video if provided
      let uploadedVideoUrl = formData.video;
      if (formData.video && !formData.video.startsWith("http")) {
        try {
          // best-effort compress before uploading (if not already compressed)
          let vUri = formData.video;
          try {
            vUri = await compressVideo(vUri);
          } catch (e) {
            console.warn("pre-upload compress failed", e);
          }
          // log size for debugging
          try {
            const info = await FileSystem.getInfoAsync(vUri, { size: true });
            console.debug("video size bytes:", info.size);
          } catch (e) {
            /* ignore */
          }
          const vResp = await runWithTimeout(fetch(vUri), 60000);
          const vBlob = await runWithTimeout(vResp.blob(), 60000);
          const vRef = ref(storage, `listings/${listingId}/${Date.now()}.mp4`);
          await runWithTimeout(uploadBytes(vRef, vBlob), 120000);
          uploadedVideoUrl = await runWithTimeout(getDownloadURL(vRef), 60000);
        } catch (e) {
          console.warn("Video upload failed", e);
          Alert.alert(
            "Upload Error",
            `Failed to upload video: ${e.message || String(e)}`,
          );
          throw e; // stop publishing
        }
      }

      // Normalize numeric price
      const priceValueNum =
        Number(String(formData.priceValue).replace(/,/g, "")) || 0;

      const listingData = {
        id: listingId,
        title: formData.title,
        price: `₦${priceValueNum.toLocaleString()}`,
        priceValue: priceValueNum,
        location: formData.location,
        address: formData.address || "",
        type: formData.type,
        image: uploadedImageUrls[0] || "",
        images: uploadedImageUrls,
        video: uploadedVideoUrl || null,
        verified: user?.verificationLevel === "verified",
        isApproved: false,
        noFee: noFee,
        beds: formData.beds || null,
        baths: formData.baths || null,
        area: formData.area || null,
        amenities: formData.amenities || [],
        landmark: formData.landmark || "",
        description: formData.description || "",
        isRecentlyAdded: true,
        slotsLeft: formData.slotsLeft || 1,
        agent: {
          id: user.id,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          rating: user.rating || 0,
          isVerified: user.verificationLevel === "verified",
          avatarUrl: user.avatarUrl || user.photoURL || "",
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, "listings", listingId);
      if (isEditMode) {
        await updateDoc(docRef, listingData);
        Alert.alert(
          "Listing updated",
          "Your listing was updated and will be reviewed by a moderator.",
          [
            {
              text: "OK",
              onPress: () => {
                setCurrentListing(null);
                setActiveTab("home");
              },
            },
          ],
        );
      } else {
        await setDoc(docRef, listingData);
        // create an in-app notification for the agent so they see the 'Listing posted' message
        try {
          createNotification(
            user?.id || "unknown",
            "Listing posted",
            `Your listing "${listingData.title}" was posted and is awaiting approval from a Moderator.`,
            "listing",
            null,
            listingId,
          );
        } catch (e) {
          console.warn("createNotification failed", e);
        }
        // show a confirmation modal; user will tap OK to dismiss
        setShowPostedModal(true);
      }
    } catch (err) {
      console.error("Publish Error:", err);
      if (String(err).toLowerCase().includes("permission")) {
        Alert.alert(
          "Permissions Error",
          "Unable to publish listing — insufficient permissions. Check Firestore rules and ensure your user has rights to create listings.",
        );
      } else {
        Alert.alert("Error", err.message || String(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#020617" : "#f8fafc" },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: isDark ? "#0b1220" : "white" },
        ]}
      >
        <TouchableOpacity onPress={() => setActiveTab("home")}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: isDark ? "#fff" : "#0f172a" }]}
        >
          {isEditMode ? "Edit" : "Post"} Listing
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            // ensure taps on suggestion items do not dismiss the keyboard
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
          >
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.label}>PROPERTY PHOTOS (MIN 3)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.mediaRow,
                invalidFields.images && styles.inputError,
              ]}
            >
              {formData.images.map((uri, idx) => (
                <View key={idx} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => {
                      setFormData((prev) => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== idx),
                      }));
                    }}
                  >
                    <X size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[
                  styles.addMediaBox,
                  invalidFields.images && styles.inputError,
                ]}
                onPress={pickImage}
              >
                <Plus size={24} color="#94a3b8" />
              </TouchableOpacity>
            </ScrollView>

            {/* Video picker - single video box similar to photos */}
            <Text style={[styles.label, { marginTop: 12 }]}>
              PROPERTY VIDEO (required)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {formData.video ? (
                <View style={styles.imageWrapper}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#000",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Video size={36} color="#fff" />
                    <Text
                      numberOfLines={1}
                      style={{
                        color: "#fff",
                        position: "absolute",
                        bottom: 6,
                        fontSize: 12,
                        paddingHorizontal: 6,
                      }}
                    >
                      {String(formData.video).split("/").pop()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() =>
                      setFormData((prev) => ({ ...prev, video: "" }))
                    }
                  >
                    <X size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.addMediaBox,
                  invalidFields.video && styles.inputError,
                ]}
                onPress={pickVideo}
              >
                <Plus size={24} color="#94a3b8" />
              </TouchableOpacity>
            </ScrollView>

            <Text style={styles.label}>LISTING TITLE</Text>
            <View style={styles.inputWrapper}>
              <Building2 size={18} color="#cbd5e1" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
                    color: isDark ? "#fff" : "#0f172a",
                  },
                  invalidFields.title && styles.inputError,
                ]}
                placeholder="e.g. Luxury Studio"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={formData.title}
                onChangeText={(t) => setFormData((p) => ({ ...p, title: t }))}
              />
            </View>

            <Text style={styles.label}>ANNUAL RENT (₦)</Text>
            {isEditMode ? (
              <View>
                <TextInput
                  style={[
                    styles.inputSimple,
                    { opacity: 0.6 },
                    invalidFields.priceValue && styles.inputError,
                  ]}
                  editable={false}
                  value={formData.priceValue}
                />
                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  Price cannot be changed after publishing.
                </Text>
              </View>
            ) : (
              <TextInput
                style={[
                  styles.inputSimple,
                  {
                    backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
                    color: isDark ? "#fff" : "#0f172a",
                  },
                  invalidFields.priceValue && styles.inputError,
                ]}
                keyboardType="numeric"
                placeholder="350,000"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={formData.priceValue}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, priceValue: t }))
                }
              />
            )}

            <Text style={[styles.label, { marginTop: 12 }]}>
              PROPERTY ADDRESS
            </Text>
            <TextInput
              style={[
                styles.inputSimple,
                {
                  backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
                  color: isDark ? "#fff" : "#0f172a",
                },
                invalidFields.address && styles.inputError,
              ]}
              placeholder="e.g. behind bakery"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={formData.address}
              onChangeText={(t) => setFormData((p) => ({ ...p, address: t }))}
              autoCorrect={false}
              autoComplete="off"
              autoCompleteType="off"
              textContentType="none"
              spellCheck={false}
              importantForAutofill="no"
            />

            <Text style={styles.label}>NEARBY LANDMARK</Text>
            <TextInput
              style={[
                styles.inputSimple,
                {
                  backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
                  color: isDark ? "#fff" : "#0f172a",
                },
                invalidFields.landmark && styles.inputError,
              ]}
              placeholder="e.g. Opposite First Bank, Next to XYZ"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={formData.landmark}
              onChangeText={(t) => setFormData((p) => ({ ...p, landmark: t }))}
            />

            <Text style={styles.label}>PROPERTY DESCRIPTION</Text>
            <TextInput
              style={[
                styles.inputSimple,
                {
                  backgroundColor: isDark ? "#0b1220" : "#f1f5f9",
                  color: isDark ? "#fff" : "#0f172a",
                  height: 120,
                  textAlignVertical: "top",
                },
                invalidFields.description && styles.inputError,
              ]}
              placeholder="Describe the property, highlights, rules, and anything prospective tenants should know"
              placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
              value={formData.description}
              multiline
              onChangeText={(t) =>
                setFormData((p) => ({ ...p, description: t }))
              }
            />

            <Text style={styles.label}>PROPERTY TYPE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {SUGGESTED_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFormData((p) => ({ ...p, type: t }))}
                  style={[
                    styles.amenityBtn,
                    formData.type === t && styles.amenitySelected,
                    { marginRight: 8 },
                    invalidFields.type && { borderColor: "#ef4444" },
                  ]}
                >
                  <Text
                    style={[
                      styles.amenityText,
                      formData.type === t && { color: "white" },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>AMENITIES</Text>
            <View
              style={[
                styles.amenityGrid,
                invalidFields.amenities && styles.inputError,
              ]}
            >
              {AMENITIES_LIST.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => toggleAmenity(item)}
                  style={[
                    styles.amenityBtn,
                    formData.amenities.includes(item) && styles.amenitySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.amenityText,
                      formData.amenities.includes(item) && { color: "white" },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handlePublish}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitText}>Publish Listing</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Posted confirmation modal */}
      <Modal visible={showPostedModal} transparent animationType="fade">
        <View
          style={[
            styles.postedModalOverlay,
            {
              backgroundColor: isDark ? "rgba(2,6,23,0.6)" : "rgba(0,0,0,0.4)",
            },
          ]}
        >
          <View
            style={[
              styles.postedModalCard,
              { backgroundColor: isDark ? "#0b1220" : "#fff" },
            ]}
          >
            <Text
              style={[
                styles.postedModalTitle,
                { color: isDark ? "#fff" : "#0f172a" },
              ]}
            >
              Posting successful
            </Text>
            <Text
              style={[
                styles.postedModalText,
                { color: isDark ? "#94a3b8" : "#374151" },
              ]}
            >
              Your listing was posted and is awaiting moderator verification in
              the next 5 minutes.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowPostedModal(false);
                resetForm();
              }}
              style={styles.postedModalBtn}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
    backgroundColor: "white",
  },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  scrollContent: { padding: 16 },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    marginBottom: 8,
    marginTop: 16,
  },
  mediaRow: { flexDirection: "row", marginBottom: 10 },
  imageWrapper: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 4,
    borderRadius: 10,
  },
  addMediaBox: {
    width: 100,
    height: 100,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 14 },
  inputSimple: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityBtn: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  amenitySelected: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  amenityText: { fontSize: 12, fontWeight: "bold", color: "#64748b" },
  submitBtn: {
    backgroundColor: "#0284c7",
    padding: 18,
    borderRadius: 15,
    marginTop: 30,
    alignItems: "center",
  },
  submitText: { color: "white", fontWeight: "bold" },
  errorText: { color: "#ef4444", fontWeight: "bold", textAlign: "center" },
  inputError: { borderColor: "#ef4444", borderWidth: 1.5 },
  postedModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  postedModalCard: {
    width: "90%",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    elevation: 6,
  },
  postedModalTitle: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  postedModalText: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  postedModalBtn: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
