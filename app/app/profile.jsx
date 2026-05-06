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
  KeyIcon
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { db, storage } from "../../lib/firebase";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import VerificationBadge from "../../components/verificationbadge";
import UpdateProfile from "../../components/UpdateProfile";
import ChangePassword from "../../components/ChangePassword";
import UpdateProfileModal from "../../components/UpdateProfileModal";
import ResetPasswordModal from "../../components/ResetPasswordModal";

const ProfileScreen = () => {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const colorScheme = useColorScheme();

  const [loading, setLoading] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "vault"), where("userId", "==", user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVaultCount(snapshot.size);
    });
    return () => unsubscribe();
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

  return (
    <SafeAreaView
      style={[
        styles.container,
        theme === "dark" ? styles.darkBg : styles.lightBg,
      ]}
    >
      
      <View
        style={[
          styles.header,
          theme === "dark" ? styles.headerDark : styles.headerLight,
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            theme === "dark" ? styles.textLight : styles.textDark,
          ]}
        >
          Profile
        </Text>
        <TouchableOpacity style={styles.headerButton}>
          <Bell
            size={20}
            color={colorScheme === "dark" ? "#cbd5e1" : "#475569"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        
        <View
          style={[
            styles.profileCard,
            theme === "dark" ? styles.cardDark : styles.cardLight,
          ]}
        >
          <TouchableOpacity
            onPress={handleImagePick}
            style={styles.avatarTouchable}
          >
            <View
              style={[
                styles.avatarWrapper,
                theme === "dark" ? styles.avatarDark : styles.avatarLight,
              ]}
            >
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={40} color="#10b981" />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={14} color="white" />
            </View>
          </TouchableOpacity>

          <Text
            style={[
              styles.nameText,
              theme === "dark" ? styles.textLight : styles.textDark,
            ]}
          >
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.emailText}>{user?.email}</Text>

          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>Verified Tenant</Text>
          </View>
        </View>

        
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setShowUpdateModal(true)}
            style={[
              styles.menuButton,
              theme === "dark" ? styles.cardDark : styles.cardLight,
            ]}
          >
            
            <Text
              style={[
                styles.menuTitle,
                theme === "dark" ? styles.textLight : styles.textDark,
              ]}
            >
              Update Profile
            </Text>
            <ChevronRight
              size={20}
              color={theme === "dark" ? "#94a3b8" : "#94a3b8"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowResetModal(true)}
            style={[
              styles.menuButton,
              theme === "dark" ? styles.cardDark : styles.cardLight,
              { marginTop: 8 },
            ]}
          >
            <KeyIcon size={20} color={'purple'} />
            <Text
              style={[
                styles.menuTitle,
                theme === "dark" ? styles.textLight : styles.textDark,
              ]}
            >
              
              Reset password
            </Text>
            <ChevronRight
              size={20}
              color={theme === "dark" ? "#94a3b8" : "#94a3b8"}
            />
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

        
        <View style={styles.actionsWrapper}>
          <MenuButton
            icon={<ShieldCheck size={22} color="#f59e0b" />}
            title="DirectRent Vault"
            subtitle={`${vaultCount} documents secured`}
            onPress={() => {}}
          />

          <MenuButton
            icon={<CreditCard size={22} color="#3b82f6" />}
            title="Payment Methods"
            subtitle="Manage rent payments"
            onPress={() => {}}
          />

          <View
            style={[
              styles.rowCard,
              theme === "dark" ? styles.cardDark : styles.cardLight,
            ]}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.iconBox,
                  theme === "dark" ? styles.iconBoxDark : styles.iconBoxLight,
                ]}
              >
                {theme === "dark" ? (
                  <Moon size={22} color="#fbbf24" />
                ) : (
                  <Sun size={22} color="#475569" />
                )}
              </View>
              <Text
                style={[
                  styles.rowTitle,
                  theme === "dark" ? styles.textLight : styles.textDark,
                ]}
              >
                Dark Mode
              </Text>
            </View>
            <Switch
              value={theme === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: "#e2e8f0", true: "#10b981" }}
            />
          </View>

          <TouchableOpacity onPress={confirmLogout} style={styles.logoutRow}>
            <LogOut size={22} color="#ef4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      )}
    </SafeAreaView>
  );
};

const MenuButton = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.menuButton}>
    <View style={styles.menuLeft}>
      <View style={styles.menuIcon}>{icon}</View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
    </View>
    <ChevronRight size={20} color="#94a3b8" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  lightBg: { backgroundColor: "#f8fafc" },
  darkBg: { backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6eef8",
  },
  headerLight: { backgroundColor: "#fff" },
  headerDark: { backgroundColor: "#0f172a", borderBottomColor: "#1f2937" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerButton: { padding: 8, borderRadius: 8, backgroundColor: "#f1f5f9" },
  textLight: { color: "#fff" },
  textDark: { color: "#0f172a" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
  profileCard: {
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 20,
  },
  cardLight: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6eef8",
  },
  cardDark: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  avatarTouchable: { position: "relative" },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLight: {
    backgroundColor: "#f1f5f9",
    borderWidth: 4,
    borderColor: "rgba(16,185,129,0.12)",
  },
  avatarDark: {
    backgroundColor: "#0b1220",
    borderWidth: 4,
    borderColor: "rgba(16,185,129,0.12)",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  cameraBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#10b981",
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameText: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  emailText: { color: "#64748b", marginTop: 4 },
  verifiedPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
  },
  verifiedText: { color: "#065f46", fontSize: 12, fontWeight: "700" },
  actionsWrapper: { marginTop: 8 },
  menuButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 25 ,
    paddingBottom:25,
    paddingLeft:30,
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e6eef8",
  },
  menuLeft: { flexDirection: "row", alignItems: "center" },
  menuIcon: {
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    marginRight: 12,
  },
  menuTextWrap: {},
  menuTitle: { fontWeight: "700" },
  menuSubtitle: { fontSize: 12, color: "#64748b" },
  rowCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: { padding: 8, borderRadius: 10, marginRight: 12 },
  iconBoxLight: { backgroundColor: "#f1f5f9" },
  iconBoxDark: { backgroundColor: "#0b1220" },
  rowTitle: { fontWeight: "700" },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginTop: 8,
  },
  logoutText: { marginLeft: 12, color: "#ef4444", fontWeight: "700" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});

export default ProfileScreen;
