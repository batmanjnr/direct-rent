import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  SafeAreaView,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  LogOut,
  Search,
  Bell,
  Menu,
  MoreVertical,
  Calendar,
  MapPin,
  X,
  BadgeCheck,
  TrendingUp,
  Clock,
} from "lucide-react-native";
import {
  collection,
  query,
  getDocs,
  limit,
  orderBy,
  doc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [permissionError, setPermissionError] = useState(false);
  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  // Dynamic Styles
  const colors = {
    bg: isDark ? "#020617" : "#f8fafc",
    card: isDark ? "#0f172a" : "#ffffff",
    text: isDark ? "#f8fafc" : "#0f172a",
    subtext: isDark ? "#94a3b8" : "#64748b",
    border: isDark ? "#1e293b" : "#e2e8f0",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Query users & verifications as before (limited)
        const usersPromise = getDocs(query(collection(db, "users"), limit(10)));
        const verificationsPromise = getDocs(
          query(
            collection(db, "verifications"),
            orderBy("submittedAt", "desc"),
            limit(10),
          ),
        );

        // For listings, prefer querying only the current agent's listings so agents see their own posts.
        // If user isn't available yet, fallback to the global listing query.
        let listingsQuery;
        if (user && user.id) {
          listingsQuery = query(
            collection(db, "listings"),
            where("agent.id", "==", user.id),
            orderBy("createdAt", "desc"),
            limit(50),
          );
        } else {
          listingsQuery = query(
            collection(db, "listings"),
            orderBy("createdAt", "desc"),
            limit(10),
          );
        }

        const listingsPromise = getDocs(listingsQuery);

        const [usersSnap, verificationsSnap, listingsSnap] = await Promise.all([
          usersPromise,
          verificationsPromise,
          listingsPromise,
        ]);

        const listingsData = listingsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setListings(listingsData);
        setUsers(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setVerifications(
          verificationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );

        // Simple Activity Mapper
        const combined = listingsData
          .map((l) => ({
            id: l.id,
            user: l.agent?.name || "Agent",
            action: "published a new listing",
            timestamp: l.createdAt?.seconds
              ? l.createdAt.seconds * 1000
              : Date.now(),
          }))
          .slice(0, 5);

        setActivities(combined);
      } catch (err) {
        console.error("Fetch Error:", err);
        // Friendly handling for permission errors (common during rule deployment/debug)
        if (
          err?.code === "permission-denied" ||
          String(err).toLowerCase().includes("permission")
        ) {
          setPermissionError(true);
          // leave listings empty so UI can show 'No listings available'
          setListings([]);
          // show an alert once to help debugging
          Alert.alert(
            "Permissions Error",
            "The app does not have permission to read listings. Deploy the server-side user creation Cloud Function and ensure Firestore rules allow this read for your authenticated user or make listings public for testing.",
          );
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = (id) => {
    Alert.alert("Delete Listing", "Are you sure? This is permanent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "listings", id));
          setListings((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  const renderStatCard = (label, value, Icon, color = "#3b82f6") => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
        ]}
      >
        <Icon size={20} color={isDark ? "#fff" : "#000"} />
      </View>
      <Text style={[styles.statLabel, { color: colors.subtext }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.logoText, { color: colors.text }]}>
            DirectRent
          </Text>
          <Text style={styles.adminBadge}>ADMIN PORTAL</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/app/notification")}
          >
            <Bell size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollPadding}>
        <View style={styles.statsGrid}>
          {renderStatCard("LISTINGS", listings.length, FileText)}
          {renderStatCard("USERS", users.length, Users)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recent Activity
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {activities.map((item) => (
            <View key={item.id} style={styles.activityItem}>
              <View style={styles.activityIndicator} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  <Text style={{ fontWeight: "bold" }}>{item.user}</Text>{" "}
                  {item.action}
                </Text>
                <Text
                  style={{ color: colors.subtext, fontSize: 11, marginTop: 2 }}
                >
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text
          style={[styles.sectionTitle, { color: colors.text, marginTop: 25 }]}
        >
          Newest Listings
        </Text>
        {listings.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            {permissionError ? (
              <Text style={{ color: colors.subtext, textAlign: "center" }}>
                No listings available. The app may not have permission to read
                listings from Firestore.
              </Text>
            ) : (
              <Text style={{ color: colors.subtext }}>
                No listings available.
              </Text>
            )}
            <TouchableOpacity
              style={{
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: "#1e3a8a",
                borderRadius: 8,
              }}
              onPress={() => router.push("/app/creatlisting")}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                Create a listing
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          listings.slice(0, 50).map((listing) => (
            <TouchableOpacity
              key={listing.id}
              style={[
                styles.listingRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                setSelectedListing(listing);
                setIsReviewOpen(true);
              }}
            >
              <Image
                source={{
                  uri: listing.image || "https://via.placeholder.com/150",
                }}
                style={styles.rowImg}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[styles.rowTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {listing.title}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>
                  {listing.location}
                </Text>
              </View>
              <View style={styles.rowMeta}>
                <Text style={[styles.rowPrice, { color: colors.text }]}>
                  ₦{listing.priceValue?.toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(listing.id)}>
                  <MoreVertical size={18} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={isReviewOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Listing Review
              </Text>
              <TouchableOpacity onPress={() => setIsReviewOpen(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {selectedListing && (
              <ScrollView style={{ padding: 20 }}>
                <Image
                  source={{ uri: selectedListing.image }}
                  style={styles.modalImg}
                />
                <Text style={[styles.modalMainTitle, { color: colors.text }]}>
                  {selectedListing.title}
                </Text>
                <View style={styles.locationRow}>
                  <MapPin size={14} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, marginLeft: 4 }}>
                    {selectedListing.location}
                  </Text>
                </View>

                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => {
                    setIsReviewOpen(false);
                    handleDelete(selectedListing.id);
                  }}
                >
                  <Text style={styles.deleteBtnText}>DELETE PERMANENTLY</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  logoText: { fontSize: 18, fontWeight: "800" },
  adminBadge: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 1,
  },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  iconBtn: { marginRight: 15 },
  scrollPadding: { padding: 20, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    width: (width - 50) / 2,
    padding: 15,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 120,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 15 },
  card: { borderRadius: 4, borderWidth: 1, padding: 15 },
  activityItem: {
    flexDirection: "row",
    marginBottom: 15,
    alignItems: "center",
  },
  activityIndicator: {
    width: 4,
    height: 30,
    backgroundColor: "#10b981",
    borderRadius: 2,
    marginRight: 12,
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowImg: { width: 50, height: 50, borderRadius: 4 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  rowMeta: { alignItems: "flex-end", justifyContent: "center" },
  rowPrice: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalImg: { width: "100%", height: 220, borderRadius: 8, marginBottom: 20 },
  modalMainTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
  locationRow: { flexDirection: "row", alignItems: "center" },
  divider: { height: 1, marginVertical: 20 },
  deleteBtn: {
    backgroundColor: "#ef4444",
    padding: 16,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 20,
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 1,
  },
});

export default AdminDashboard;
