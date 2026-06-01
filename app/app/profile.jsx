import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LogOut,
  Bell,
  HelpCircle,
  CircleUserRound,
  KeyRound,
  ChevronRight,
  Fingerprint,
  ShieldCheck,
  Sun,
  Moon,
  FileText,
  Trash2,
  UserCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { safeDeleteStorageFile } from "../../utils/storageCleanup";
import VerificationBadge from "../../components/verificationbadge";
import { calculateVerificationLevel } from "../../lib/verification";
import KYCVerification from "../../components/kycverification";
import TrustVerification from "../../components/TrustVerification";
import { BlurView } from "expo-blur";
import Skeleton from "../../components/ui/Skeleton";

// MODAL COMPONENT IMPORTS
import UpdateProfile from "../../components/UpdateProfileModal";
import ResetPassword from "../../components/ResetPasswordModal";

const { width } = Dimensions.get("window");
const SQUARE_CARD_SIZE = width * 0.58;

const Profile = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const isDark = theme === "dark";

  // Modal display states
  const [showUpdateProfileModal, setShowUpdateProfileModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(true);
  // local profile copy that follows Firestore document changes (keeps avatar in sync)
  const [profileUser, setProfileUser] = useState(user);

  useEffect(() => {
    setProfileUser(user);
    if (!user) return;
    const userRef = doc(db, "users", user.id);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfileUser((prev) => ({ ...prev, ...snap.data() }));
        }
      },
      (err) => {
        console.error("User snapshot error", err);
      },
    );
    return () => unsub();
  }, [user]);

  if (!user) return null;

  // show skeleton while profileUser is syncing from Firestore
  if (!profileUser) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: "#fff" }]}
        edges={["top"]}
      >
        <Skeleton type="profile" isDark={isDark} />
      </SafeAreaView>
    );
  }

  const handleToggleTheme = () => {
    toggleTheme();
  };

  const handleLogoutWithNavigation = async () => {
    try {
      await logout();
      router.replace("/home");
    } catch (error) {
      console.error("Logout navigation failed:", error);
      router.replace("/");
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    try {
      const userRef = doc(db, "users", user.id);
      if (user.avatarUrl && user.avatarUrl.includes("firebasestorage")) {
        await safeDeleteStorageFile(user.avatarUrl);
      }
      await deleteDoc(userRef);
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.delete();
      }
      await handleLogoutWithNavigation();
    } catch (error) {
      console.error("Failed to delete account:", error);
      Alert.alert(
        "Re-authentication Required",
        "For security reasons, sensitive actions like account deletion require a fresh login. Please log out, log back in, and try again immediately.",
      );
    } finally {
      setIsLoading(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  const currentLevel = calculateVerificationLevel(profileUser || user);

  // Matured Glassmorphic Design Tokens with premium light grey-blue frost accents
  const tokens = isDark
    ? {
        canvas: "#040814",
        cardBg: "rgba(51, 65, 85, 0.45)",
        textMain: "#ffffff",
        textSubtle: "#cbd5e1",
        border: "rgba(148, 163, 184, 0.22)",
        accent: "#818cf8",
        accentBg: "rgba(129, 140, 248, 0.18)",
        divider: "rgba(255, 255, 255, 0.08)",
        cardSolidBg: "#0f172a",
      }
    : {
        canvas: "#f1f5f9",
        cardBg: "rgba(255, 255, 255, 0.55)",
        textMain: "#0f172a",
        textSubtle: "#475569",
        border: "rgba(15, 23, 42, 0.06)",
        accent: "#4f46e5",
        accentBg: "rgba(79, 70, 229, 0.1)",
        divider: "rgba(15, 23, 42, 0.05)",
        cardSolidBg: "#ffffff",
      };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: tokens.canvas }]}
      edges={["top"]}
    >
      {/* Header View */}
      <View style={[styles.header, { borderColor: tokens.border }]}>
        <BlurView
          intensity={isDark ? 20 : 50}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.headerTitle, { color: tokens.textMain }]}>
          Profile
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/app/notification")}
          style={[
            styles.headerBtn,
            { borderColor: tokens.border, backgroundColor: tokens.cardBg },
          ]}
        >
          <Bell size={18} color={tokens.textMain} />
          {unread > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Full Width Top Profile Glass Card */}
        <View
          style={[
            styles.squareUserCard,
            { borderColor: tokens.border, backgroundColor: tokens.cardBg },
          ]}
        >
          <BlurView
            intensity={isDark ? 35 : 65}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.squareCardInner}>
            <View
              style={[styles.avatarGlassRing, { borderColor: tokens.border }]}
            >
              {profileUser?.avatarUrl ? (
                <Image
                  source={{ uri: profileUser.avatarUrl }}
                  style={styles.squareAvatarImage}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholderGlass,
                    { backgroundColor: tokens.accentBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarPlaceholderText,
                      { color: tokens.accent },
                    ]}
                  >
                    {profileUser?.firstName
                      ? profileUser.firstName.charAt(0)
                      : profileUser?.email?.charAt(0)}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[styles.squareUserName, { color: tokens.textMain }]}
              numberOfLines={1}
            >
              {profileUser?.firstName
                ? `${profileUser.firstName} ${profileUser.lastName || ""}`.trim()
                : "Guest User"}
            </Text>

            <View style={styles.badgeCenteredContainer}>
              <VerificationBadge
                level={currentLevel}
                role={user.role}
                showText={false}
              />
            </View>

            <Text
              style={[styles.squareUserEmail, { color: tokens.textSubtle }]}
              numberOfLines={1}
            >
              {profileUser?.email ||
                profileUser?.phoneNumber ||
                "No contact info"}
            </Text>

            <TouchableOpacity
              onPress={() => setShowUpdateProfileModal(true)}
              style={[
                styles.glassEditBtn,
                { backgroundColor: tokens.accentBg },
              ]}
            >
              <Text style={[styles.glassEditBtnText, { color: tokens.accent }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GENERAL SECTION */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionHeading, { color: tokens.textSubtle }]}>
            GENERAL
          </Text>

          {/* Edit Profile Card */}
          <TouchableOpacity
            onPress={() => setShowUpdateProfileModal(true)}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(59, 130, 246, 0.12)" },
              ]}
            >
              <CircleUserRound size={18} color="#3b82f6" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Edit Profile
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Update profile details, picture and location details
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>

          {/* KYC Agent Verification Card — Uniform Template styling */}
          {profileUser?.role === "agent" && (
            <KYCVerification
              customCardStyle={[
                styles.itemCardGlass,
                { borderColor: tokens.border, backgroundColor: tokens.cardBg },
              ]}
              tokens={tokens}
              isDark={isDark}
            />
          )}

          {/* Verify Identity Card */}
          {profileUser?.role === "tenant" && !profileUser?.phoneVerified && (
            <TouchableOpacity
              onPress={() => router.push("/app/verifyphone")}
              style={[
                styles.itemCardGlass,
                { borderColor: tokens.border, backgroundColor: tokens.cardBg },
              ]}
            >
              <BlurView
                intensity={isDark ? 20 : 45}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: "rgba(249, 115, 22, 0.12)" },
                ]}
              >
                <Fingerprint size={18} color="#f97316" />
              </View>
              <View style={styles.menuMeta}>
                <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                  Verify Identity
                </Text>
                <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                  Add phone number & national NIN credentials
                </Text>
              </View>
              <View style={styles.badgeRequired}>
                <Text style={styles.badgeRequiredText}>Required</Text>
              </View>
              <ChevronRight size={14} color={tokens.textSubtle} />
            </TouchableOpacity>
          )}

          {/* Trust Verification Card — Uniform Template styling */}
          <TrustVerification
            onVerifyPhone={() => router.push("/app/verifyphone")}
            customCardStyle={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
            tokens={tokens}
            isDark={isDark}
          />

          {/* Change Password Card */}
          <TouchableOpacity
            onPress={() => setShowResetPasswordModal(true)}
            style={[
              styles.itemCardGlass,
              {
                borderColor: tokens.border,
                backgroundColor: tokens.cardBg,
                marginTop: 15,
              },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(99, 102, 241, 0.12)" },
              ]}
            >
              <KeyRound size={18} color="#6366f1" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Change Password
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Update and strengthen account security
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>

          {/* Terms of Use Card */}
          <TouchableOpacity
            onPress={() => router.push("/app/termofuse")}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(6, 182, 212, 0.12)" },
              ]}
            >
              <FileText size={18} color="#06b6d4" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Terms of Use
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                DirectRent rules of engagement
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>

          {/* Vault Card */}
          <TouchableOpacity
            onPress={() => router.push("/app/vault")}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(245, 158, 11, 0.12)" },
              ]}
            >
              <ShieldCheck size={18} color="#f59e0b" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                DirectRent Vault
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Safe storage for contracts & rent receipts
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>
        </View>

        {/* PREFERENCES SECTION */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionHeading, { color: tokens.textSubtle }]}>
            PREFERENCES
          </Text>

          {/* Dark Mode Card */}
          <View
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                isDark
                  ? { backgroundColor: "rgba(245, 158, 11, 0.15)" }
                  : { backgroundColor: "rgba(148, 163, 184, 0.12)" },
              ]}
            >
              {isDark ? (
                <Sun size={18} color="#f59e0b" />
              ) : (
                <Moon size={18} color="#475569" />
              )}
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Dark Mode
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Switch between light and dark themes
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleToggleTheme}
              trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
              thumbColor={Platform.OS === "android" ? "#ffffff" : undefined}
            />
          </View>

          {/* Push Notifications Card */}
          <View
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(59, 130, 246, 0.12)" },
              ]}
            >
              <Bell size={18} color="#3b82f6" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Push Notifications
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Receive real-time chat updates
              </Text>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={setPushNotificationsEnabled}
              trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
              thumbColor={Platform.OS === "android" ? "#ffffff" : undefined}
            />
          </View>
        </View>

        {/* ACCOUNT MANAGEMENT SECTION */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionHeading, { color: tokens.textSubtle }]}>
            ACCOUNT MANAGEMENT
          </Text>

          {/* FAQ Card */}
          <TouchableOpacity
            onPress={() => router.push("/app/faq")}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(99, 102, 241, 0.12)" },
              ]}
            >
              <HelpCircle size={18} color="#6366f1" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                FAQ
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Find quick answers to common questions
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>

          {/* Log Out Card */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Log Out",
                "Are you sure you want to log out of your session?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Log Out",
                    style: "destructive",
                    onPress: handleLogoutWithNavigation,
                  },
                ],
              );
            }}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(148, 163, 184, 0.15)" },
              ]}
            >
              <LogOut size={18} color={isDark ? "#94a3b8" : "#475569"} />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: tokens.textMain }]}>
                Log Out
              </Text>
              <Text style={[styles.menuDesc, { color: tokens.textSubtle }]}>
                Securely end your active app session
              </Text>
            </View>
            <ChevronRight size={14} color={tokens.textSubtle} />
          </TouchableOpacity>

          {/* Delete Account Card */}
          <TouchableOpacity
            onPress={() => setShowDeleteAccountConfirm(true)}
            style={[
              styles.itemCardGlass,
              { borderColor: tokens.border, backgroundColor: tokens.cardBg },
            ]}
          >
            <BlurView
              intensity={isDark ? 20 : 45}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: "rgba(244, 63, 94, 0.12)" },
              ]}
            >
              <Trash2 size={18} color="#f43f5e" />
            </View>
            <View style={styles.menuMeta}>
              <Text style={[styles.menuLabel, { color: "#f43f5e" }]}>
                Delete Account
              </Text>
              <Text style={[styles.menuDesc, { color: "#fb7185" }]}>
                Permanently erase profile and data configurations
              </Text>
            </View>
            <ChevronRight size={14} color="#fb7185" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* UPDATE PROFILE INTEGRATION MODAL */}
      <UpdateProfile
        visible={showUpdateProfileModal}
        onClose={() => setShowUpdateProfileModal(false)}
      />

      {/* RESET PASSWORD INTEGRATION MODAL */}
      <ResetPassword
        visible={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
      />

      {/* Account Erasure Confirmation Overlay */}
      <Modal
        visible={showDeleteAccountConfirm}
        animationType="fade"
        transparent
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: tokens.cardSolidBg,
                borderColor: tokens.border,
              },
            ]}
          >
            <View style={styles.dangerModalHeader}>
              <View style={styles.dangerIconContainer}>
                <Trash2 size={22} color="#f43f5e" />
              </View>
              <Text
                style={[
                  styles.modalTitle,
                  { color: tokens.textMain, marginTop: 12 },
                ]}
              >
                Delete Account
              </Text>
            </View>

            <Text
              style={[styles.dangerModalBody, { color: tokens.textSubtle }]}
            >
              Are you absolutely sure? This will permanently delete your
              identity files, clearing out your custom preferences and settings.
              This action cannot be undone.
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setShowDeleteAccountConfirm(false)}
                style={[
                  styles.dangerRowBtn,
                  { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
                ]}
                disabled={isLoading}
              >
                <Text
                  style={[styles.dangerRowBtnText, { color: tokens.textMain }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteAccount}
                style={[styles.dangerRowBtn, { backgroundColor: "#f43f5e" }]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.dangerRowBtnText, { color: "#fff" }]}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  notifDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    backgroundColor: "#ef4444",
    borderRadius: 100,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Frosted Light Grey-Blue Top Profile Layout
  squareUserCard: {
    width: "100%",
    height: SQUARE_CARD_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 28, // Clear separation from headers
  },
  squareCardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  avatarGlassRing: {
    borderWidth: 1,
    padding: 3,
    borderRadius: 100,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  squareAvatarImage: {
    width: 62,
    height: 62,
    borderRadius: 100,
  },
  avatarPlaceholderGlass: {
    width: 62,
    height: 62,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: "900",
  },
  squareUserName: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  badgeCenteredContainer: {
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  squareUserEmail: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  glassEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  glassEditBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Section layout configurations
  sectionGroup: {
    marginBottom: 26, // Increased spacing between discrete component headings
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    paddingLeft: 6,
    marginBottom: 12, // More headroom for individual item cards
  },

  // Premium Isolated Frosted Glassmorphic Item Cards
  itemCardGlass: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16, // Noticeable item grid distribution spacing context
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  menuMeta: {
    flex: 1,
    marginLeft: 14,
    zIndex: 2,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  menuDesc: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  badgeRequired: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
    marginRight: 6,
    zIndex: 2,
  },
  badgeRequiredText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ef4444",
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  dangerModalHeader: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dangerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 100,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerModalBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  dangerRowBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerRowBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
