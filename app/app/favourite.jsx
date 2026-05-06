import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Dimensions,
  StatusBar,
  StyleSheet,
} from "react-native";
import {
  ChevronLeft,
  Bookmark,
  MapPin,
  ArrowRight,
  MessageCircle,
  Bell,
  Search,
} from "lucide-react-native";
import { FEATURED_LISTINGS } from "./data";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
// import { FEATURED_LISTINGS } from '../data';

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = width * 0.44;

const FavoritesScreen = () => {
  const { user, favorites, setActiveTab, setCurrentListing, toggleFavorite } =
    useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeChatListingIds, setActiveChatListingIds] = useState([]);
  const [dbListings, setDbListings] = useState([]);

  useEffect(() => {
    const listingsRef = collection(db, "listings");
    const unsubscribe = onSnapshot(listingsRef, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDbListings(fetched);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const conversationsRef = collection(db, "conversations");
    const fieldToFilter = user.role === "tenant" ? "tenantId" : "agentId";
    const q = query(conversationsRef, where(fieldToFilter, "==", user.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listingIds = snapshot.docs.map((doc) => doc.data().listingId);
      setActiveChatListingIds([...new Set(listingIds)]);
    });
    return () => unsubscribe();
  }, [user]);

  const savedListings = useMemo(() => {
    const allAvailable = [...dbListings, ...FEATURED_LISTINGS];
    const uniqueListings = Array.from(
      new Map(allAvailable.map((l) => [String(l.id), l])).values(),
    );
    return uniqueListings.filter((listing) => favorites.includes(listing.id));
  }, [favorites, dbListings]);

  const dynamicStyles = {
    container: { backgroundColor: isDark ? "#020617" : "#ffffff" },
    header: {
      borderBottomColor: isDark ? "#1e293b" : "#f1f5f9",
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
    },
    textMain: { color: isDark ? "#ffffff" : "#0f172a" },
    card: {
      backgroundColor: isDark ? "#0b1220" : "#ffffff",
      borderColor: isDark ? "#1e293b" : "#f1f5f9",
    },
    emptyBg: { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
    // colors for smaller label/texts inside the card / empty state
    subtleText: { color: isDark ? "#94a3b8" : "#64748b" },
    mutedLabel: { color: isDark ? "#94a3b8" : "#94a3b8" },
    priceText: { color: "#10b981" },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.header, dynamicStyles.header]}>
        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          style={styles.headerBtn}
        >
          <ChevronLeft size={28} color={isDark ? "#ffffff" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, dynamicStyles.textMain]}>
          Saved Properties
        </Text>
        <TouchableOpacity
          onPress={() => setActiveTab("notifications")}
          style={styles.headerBtn}
        >
          <Bell size={22} color={isDark ? "#94a3b8" : "#64748b"} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {savedListings.length > 0 ? (
          <View style={styles.grid}>
            {savedListings.map((listing, index) => (
              <View key={listing.id} style={{ width: COLUMN_WIDTH }}>
                <TouchableOpacity
                  onPress={() => {
                    setCurrentListing(listing);
                    try {
                      router.push("/app/listingdetails");
                    } catch (e) {
                      console.warn("navigate error", e);
                    }
                  }}
                  activeOpacity={0.9}
                  style={[styles.card, dynamicStyles.card]}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: listing.image }}
                      style={styles.image}
                      resizeMode="cover"
                    />

                    <TouchableOpacity
                      onPress={() => toggleFavorite(listing.id)}
                      style={[
                        styles.favBtn,
                        {
                          backgroundColor: isDark
                            ? "rgba(15,23,42,0.8)"
                            : "rgba(255,255,255,0.8)",
                        },
                      ]}
                    >
                      <Bookmark
                        size={14}
                        color="#10b981"
                        fill={
                          favorites.includes(listing.id)
                            ? "#10b981"
                            : "transparent"
                        }
                      />
                    </TouchableOpacity>

                    {activeChatListingIds.includes(listing.id) && (
                      <View style={styles.chatIndicator}>
                        <MessageCircle size={12} color="white" />
                      </View>
                    )}

                    <View
                      style={[
                        styles.priceBadge,
                        {
                          backgroundColor: isDark
                            ? "rgba(2,6,23,0.9)"
                            : "rgba(255,255,255,0.9)",
                        },
                      ]}
                    >
                      <Text style={styles.priceText}>{listing.price}</Text>
                    </View>
                  </View>

                  <View style={styles.cardInfo}>
                    <Text
                      style={[styles.cardTitle, dynamicStyles.textMain]}
                      numberOfLines={2}
                    >
                      {listing.title}
                    </Text>
                    <View style={styles.locationRow}>
                      <MapPin size={10} color="#10b981" />
                      <Text
                        style={[styles.locationText, dynamicStyles.subtleText]}
                        numberOfLines={1}
                      >
                        {listing.location}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.cardFooter,
                        { borderTopColor: isDark ? "#1e293b" : "#f8fafc" },
                      ]}
                    >
                      <Text
                        style={[styles.footerLabel, dynamicStyles.mutedLabel]}
                      >
                        DETAILS
                      </Text>
                      <ArrowRight size={10} color="#94a3b8" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, dynamicStyles.emptyBg]}>
              <Bookmark size={32} color={isDark ? "#334155" : "#cbd5e1"} />
            </View>
            <Text style={[styles.emptyTitle, dynamicStyles.textMain]}>
              No saved properties
            </Text>
            <Text style={[styles.emptySubtitle, dynamicStyles.subtleText]}>
              Bookmark the homes you love to keep them here for quick access
              later.
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab("dashboard")}
              style={[
                styles.exploreBtn,
                { backgroundColor: isDark ? "#10b981" : "#0f172a" },
              ]}
            >
              <Text style={styles.exploreBtnText}>Start Exploring</Text>
              <Search size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: "#f43f5e",
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "white",
  },
  scrollContent: { paddingBottom: 100 },
  grid: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  imageContainer: { aspectRatio: 1, position: "relative" },
  image: { width: "100%", height: "100%" },
  favBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chatIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    backgroundColor: "#10b981",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  priceBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: { fontSize: 10, fontWeight: "800", color: "#10b981" },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 12, fontWeight: "700", marginBottom: 4, height: 32 },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { fontSize: 9, color: "#64748b", marginLeft: 4, flex: 1 },
  cardFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: { fontSize: 8, fontWeight: "800", color: "#94a3b8" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    px: 40,
    pt: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    marginTop: "20px",
    justify: "center",
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  exploreBtnText: { color: "white", fontWeight: "700", marginRight: 8 },
});

export default FavoritesScreen;
