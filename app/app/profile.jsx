import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from "react-native";
import {
  Settings,
  MapPin,
  LogOut,
  Bell,
  Shield,
  ChevronRight,
  ShieldCheck,
  Sun,
  Moon,
  Camera,
  FileText,
  User,
  CreditCard,
  KeyIcon,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { db, storage, auth } from "../../lib/firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { deleteUser } from "firebase/auth";
import VerificationBadge from "../../components/verificationbadge";
import UpdateProfile from "../../components/UpdateProfile";
import ChangePassword from "../../components/ChangePassword";
import UpdateProfileModal from "../../components/UpdateProfileModal";
import ResetPasswordModal from "../../components/ResetPasswordModal";
import KYCVerification from "../../components/kycverification";

const ProfileScreen = () => {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colorScheme = useColorScheme();

  const [loading, setLoading] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Theming: prefer system appearance but fall back to ThemeContext
  const isDark = colorScheme === "dark" || theme === "dark";
  const tokens = isDark
    ? {
        background: "#0A0B0D",
        canvas: "#071226",
        headerBg: "#0f172a",
        cardBg: "#0e1520",
        accent: "#C5A46E",
        primaryText: "#FFFFFF",
        secondaryText: "#BFC3C8",
        muted: "#94a3b8",
        border: "#1f2937",
        positive: "#34D399",
      }
    : {
        background: "#FFFFFF",
        canvas: "#F7F8FA",
        headerBg: "#FFFFFF",
        cardBg: "#F8FBFF",
        accent: "#2B3467",
        primaryText: "#0F172A",
        secondaryText: "#475569",
        muted: "#94a3b8",
        border: "#e6eef8",
        positive: "#10B981",
      };

  const styles = getProfileStyles(tokens);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "vault"), where("userId", "==", user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVaultCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  // subscribe to unread notifications count for badge
  useEffect(() => {
    if (!user || !user.id) {
      setUnreadCount(0);
      return;
    }
    const nRef = collection(db, "notifications");
    const q = query(
      nRef,
      where("userId", "==", user.id),
      where("read", "==", false),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUnreadCount(snap.size);
      },
      (err) => {
        console.warn("[Profile] unread notifications subscribe failed", err);
      },
    );
    return () => unsub();
  }, [user]);

  const handleImagePick = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "Allow DirectRent to access your photos to update your profile.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri) => {
    setLoading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `avatars/${user.id}`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", user.id), { avatarUrl: url });
      await updateProfile({ avatarUrl: url });
      Alert.alert("Success", "Profile photo updated!");
    } catch (error) {
      Alert.alert("Error", "Failed to upload image.");
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out of DirectRent?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/home");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all local profile data. This cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // attempt to delete Firestore user doc first
              try {
                await deleteDoc(doc(db, "users", user.id));
              } catch (e) {
                console.warn("[Profile] failed to delete user doc", e);
              }

              // attempt to delete auth user
              try {
                // Ensure the current user matches the profile uid
                if (auth.currentUser && auth.currentUser.uid === user.id) {
                  await deleteUser(auth.currentUser);
                } else if (auth.currentUser) {
                  // try deleting the signed-in user even if ids differ
                  await deleteUser(auth.currentUser);
                } else {
                  console.warn(
                    "[Profile] no auth.currentUser available to delete",
                  );
                }
              } catch (e) {
                console.warn("[Profile] deleteUser failed", e);
                // If requires-recent-login, sign the user out and ask them to sign in again to delete their account
                if (e?.code === "auth/requires-recent-login") {
                  Alert.alert(
                    "Re-authentication required",
                    "Please sign out and sign in again, then try deleting your account.",
                  );
                  await logout();
                  router.replace("/home");
                  return;
                } else {
                  Alert.alert(
                    "Error",
                    e?.message || "Failed to delete account",
                  );
                }
              }

              // final cleanup: ensure user is logged out locally
              try {
                await logout();
              } catch (e) {
                /* ignore */
              }
              Alert.alert("Account deleted", "Your account has been deleted.");
              router.replace("/home");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push("/app/notification")}
        >
          <Bell size={20} color={tokens.primaryText} />
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topCard}>
          <TouchableOpacity
            onPress={handleImagePick}
            style={styles.avatarTouchable}
          >
            <View style={styles.avatarWrapperLarge}>
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImageLarge}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={48} color={tokens.positive} />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 12 }}>
            <Text style={styles.nameLarge}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            <View style={styles.roleRow}>
              <ShieldCheck size={14} color={tokens.accent} />
              <Text style={{ marginLeft: 8, fontWeight: "700" }}>
                {user?.role?.toUpperCase() || "USER"}
              </Text>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipNumber}>{vaultCount}</Text>
              <Text style={styles.chipLabel}>Documents</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipNumber}>{unreadCount}</Text>
              <Text style={styles.chipLabel}>Unread</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuList}>
          {user?.role && String(user.role).toLowerCase() === "agent" && (
            <KYCVerification />
          )}

          <ProfileMenuButton
            icon={<User size={20} color={tokens.accent} />}
            title="Update Profile"
            subtitle="Edit personal details"
            onPress={() => setShowUpdateModal(true)}
          />
          <ProfileMenuButton
            icon={<KeyIcon size={20} color={tokens.accent} />}
            title="Reset Password"
            subtitle="Change your password"
            onPress={() => setShowResetModal(true)}
          />
          <ProfileMenuButton
            icon={<CreditCard size={20} color={tokens.accent} />}
            title="Payment Methods"
            subtitle="Manage rent payments"
            onPress={() => {}}
          />
          <ProfileMenuButton
            icon={<ShieldCheck size={20} color={tokens.accent} />}
            title="DirectRent Vault"
            subtitle={`${vaultCount} documents secured`}
            onPress={() => {}}
          />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.simpleRow}
          >
            <Text style={styles.simpleRowText}>Toggle Appearance</Text>
            <Switch value={theme === "dark"} onValueChange={toggleTheme} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={confirmLogout}
            style={[styles.simpleRow, { marginTop: 12 }]}
          >
            <LogOut size={18} color="#ef4444" />
            <Text
              style={{ marginLeft: 12, color: "#ef4444", fontWeight: "700" }}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={[styles.simpleRow, styles.deleteRow, { marginTop: 12 }]}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <UpdateProfileModal
          visible={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
        />
        <ResetPasswordModal
          visible={showResetModal}
          onClose={() => setShowResetModal(false)}
        />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={tokens.accent} />
        </View>
      )}
    </SafeAreaView>
  );
};

const ProfileMenuButton = ({ icon, title, subtitle, onPress }) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const isDarkLocal = colorScheme === "dark" || theme === "dark";

  const tokensLocal = isDarkLocal
    ? {
        background: "#0A0B0D",
        canvas: "#071226",
        headerBg: "#0f172a",
        cardBg: "#0e1520",
        accent: "#C5A46E",
        primaryText: "#FFFFFF",
        secondaryText: "#BFC3C8",
        muted: "#94a3b8",
        border: "#1f2937",
        positive: "#34D399",
      }
    : {
        background: "#FFFFFF",
        canvas: "#F7F8FA",
        headerBg: "#FFFFFF",
        cardBg: "#F8FBFF",
        accent: "#2B3467",
        primaryText: "#0F172A",
        secondaryText: "#475569",
        muted: "#94a3b8",
        border: "#e6eef8",
        positive: "#10B981",
      };

  const stylesLocal = getProfileStyles(tokensLocal);
  const chevronColor = isDarkLocal ? "#94a3b8" : "#64748b";

  return (
    <TouchableOpacity onPress={onPress} style={stylesLocal.menuButton}>
      <View style={stylesLocal.menuLeft}>
        <View style={stylesLocal.menuIcon}>{icon}</View>
        <View style={stylesLocal.menuTextWrap}>
          <Text style={stylesLocal.menuTitle}>{title}</Text>
          <Text style={stylesLocal.menuSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <ChevronRight size={20} color={chevronColor} />
    </TouchableOpacity>
  );
};

function getProfileStyles(t) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.canvas },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.headerBg,
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: t.primaryText },
    headerButton: { padding: 8, borderRadius: 8 },
    headerBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: "#ef4444",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#fff",
    },
    headerBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
    topCard: {
      padding: 24,
      borderRadius: 18,
      alignItems: "center",
      marginBottom: 16,
      backgroundColor: t.cardBg,
      borderWidth: 1,
      borderColor: t.border,
    },
    avatarTouchable: { position: "relative" },
    avatarWrapperLarge: {
      width: 120,
      height: 120,
      borderRadius: 60,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.cardBg,
      borderWidth: 4,
      borderColor: "rgba(16,185,129,0.06)",
    },
    avatarImageLarge: { width: "100%", height: "100%" },
    avatarPlaceholder: { justifyContent: "center", alignItems: "center", flex: 1 },
    cameraBadge: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: t.accent,
      padding: 6,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: t.cardBg,
    },
    nameLarge: { fontSize: 22, fontWeight: "700", color: t.primaryText },
    emailText: { color: t.secondaryText, marginTop: 4 },
    roleRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    chipsRow: { flexDirection: "row", justifyContent: "center", marginTop: 12, width: "100%" },
    chip: { backgroundColor: t.cardBg, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginHorizontal: 4, alignItems: "center", borderWidth: 1, borderColor: t.border },
    chipNumber: { fontSize: 16, fontWeight: "700", color: t.primaryText },
    chipLabel: { fontSize: 12, color: t.secondaryText },
    menuList: { marginTop: 16, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 16 },
    menuButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 25, paddingBottom: 25, paddingLeft: 30, backgroundColor: t.cardBg, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: t.border },
    menuLeft: { flexDirection: "row", alignItems: "center" },
    menuIcon: { padding: 8, backgroundColor: t.canvas, borderRadius: 10, marginRight: 12 },
    menuTextWrap: {},
    menuTitle: { fontWeight: "700", color: t.primaryText },
    menuSubtitle: { fontSize: 12, color: t.secondaryText },
    simpleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.cardBg, marginBottom: 12, borderWidth: 1, borderColor: t.border, justifyContent: "space-between" },
    simpleRowText: { color: t.primaryText },
    deleteRow: { alignItems: "center", padding: 12, marginTop: 8, borderRadius: 12, backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "#fee2e2" },
    deleteText: { color: "#b91c1c", fontWeight: "700" },
    loadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  });
}

export default ProfileScreen;
