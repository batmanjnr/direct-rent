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
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = width * 0.44;

const FavoritesScreen = () => {
  const { user, favorites, setActiveTab, setCurrentListing, toggleFavorite } =
    useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || !user.id) {
      setUnread(0);
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
      (snap) => setUnread(snap.size),
      (err) => {
        console.warn("[Favorites] notifications subscribe failed", err);
      },
    );
    return () => unsub();
  }, [user]);

  const [activeChatListingIds, setActiveChatListingIds] = useState([]);
  const [dbListings, setDbListings] = useState([]);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const listingsRef = collection(db, "listings");
      unsubscribe = onSnapshot(
        query(listingsRef),
        (snapshot) => {
          const fetched = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setDbListings(fetched);
        },
        (err) => {
          console.warn("Listings subscription failed", err);
          setDbListings([]);
        },
      );
    } catch (e) {
      console.warn("Failed to subscribe to listings", e);
      setDbListings([]);
    }
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubscribe = () => {};
    try {
      const conversationsRef = collection(db, "conversations");
      const fieldToFilter = user.role === "tenant" ? "tenantId" : "agentId";
      const q = query(conversationsRef, where(fieldToFilter, "==", user.id));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const listingIds = snapshot.docs.map((doc) => doc.data().listingId);
          setActiveChatListingIds([...new Set(listingIds)]);
        },
        (err) => {
          console.warn("Conversations subscription failed", err);
          setActiveChatListingIds([]);
        },
      );
    } catch (e) {
      console.warn("Failed to subscribe to conversations", e);
      setActiveChatListingIds([]);
    }
    return () => unsubscribe && unsubscribe();
  }, [user]);

  const savedListings = useMemo(() => {
    const allAvailable = [...dbListings, ...FEATURED_LISTINGS];
    const uniqueListings = Array.from(
      new Map(allAvailable.map((l) => [String(l.id), l])).values(),
    );
    return uniqueListings.filter((listing) => favorites.includes(listing.id));
  }, [favorites, dbListings]);

  // Premium Cosmic Tint Palette Configuration
  const tokens = isDark
    ? {
        canvas: "#0a0e1a",
        headerBg: "rgba(10, 14, 26, 0.85)",
        cardBg: "rgba(30, 41, 59, 0.35)",
        textMain: "#ffffff",
        textSubtle: "#94a3b8",
        border: "rgba(255, 255, 255, 0.08)",
        badgeBg: "rgba(11, 18, 32, 0.85)",
        accent: "#3b82f6",
      }
    : {
        canvas: "#f1f5f9",
        headerBg: "rgba(255, 255, 255, 0.85)",
        cardBg: "rgba(255, 255, 255, 0.4)",
        textMain: "#0f172a",
        textSubtle: "#475569",
        border: "rgba(15, 23, 42, 0.08)",
        badgeBg: "rgba(255, 255, 255, 0.85)",
        accent: "#2563eb",
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tokens.canvas }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header View Area */}
      <View style={[styles.header, { backgroundColor: tokens.headerBg, borderBottomColor: tokens.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          style={[styles.headerBtn, { borderColor: tokens.border }]}
        >
          <ChevronLeft size={22} color={tokens.textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: tokens.textMain }]}>
          Saved Properties
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/app/notification")}
          style={[styles.headerBtn, { borderColor: tokens.border }]}
        >
          <Bell size={18} color={tokens.textMain} />
          {unread > 0 && <View style={[styles.notifDot, { borderColor: tokens.canvas }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {savedListings.length > 0 ? (
          <View style={styles.grid}>
            {savedListings.map((listing) => (
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
                  style={[styles.card, { borderColor: tokens.border }]}
                >
                  {/* Outer Hardware Clipping Mask */}
                  <View style={styles.glassClippingMask}>
                    <BlurView
                      intensity={isDark ? 30 : 80}
                      tint={isDark ? "dark" : "light"}
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.cardInner}>
                      {/* Photo Framework Area — Sitting directly on translucent blur surface layer */}
                      <View style={styles.imageContainer}>
                        <Image
                          source={{ uri: listing.image }}
                          style={styles.image}
                          resizeMode="cover"
                        />

                        {/* Floated Pill Badges */}
                        <TouchableOpacity
                          onPress={() => toggleFavorite(listing.id)}
                          style={[styles.favBtn, { backgroundColor: tokens.badgeBg, borderColor: tokens.border }]}
                        >
                          <Bookmark
                            size={13}
                            color={tokens.accent}
                            fill={favorites.includes(listing.id) ? tokens.accent : "transparent"}
                          />
                        </TouchableOpacity>

                        {activeChatListingIds.includes(listing.id) && (
                          <View style={[styles.chatIndicator, { backgroundColor: tokens.accent, borderColor: tokens.badgeBg }]}>
                            <MessageCircle size={11} color="white" />
                          </View>
                        )}

                        <View style={[styles.priceBadge, { backgroundColor: tokens.badgeBg, borderColor: tokens.border }]}>
                          <Text style={[styles.priceText, { color: tokens.accent }]}>{listing.price}</Text>
                        </View>
                      </View>

                      {/* Text details content container — Styled with specific isolated color wash layer */}
                      <View style={[styles.cardInfo, { backgroundColor: tokens.cardBg }]}>
                        <Text
                          style={[styles.cardTitle, { color: tokens.textMain }]}
                          numberOfLines={1}
                        >
                          {listing.title}
                        </Text>
                        <View style={styles.locationRow}>
                          <MapPin size={10} color={tokens.accent} />
                          <Text
                            style={[styles.locationText, { color: tokens.textSubtle }]}
                            numberOfLines={1}
                          >
                            {listing.location}
                          </Text>
                        </View>

                        <View style={[styles.cardFooter, { borderTopColor: tokens.border }]}>
                          <Text style={[styles.footerLabel, { color: tokens.textSubtle }]}>
                            DETAILS
                          </Text>
                          <ArrowRight size={10} color={tokens.textSubtle} />
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          /* Premium Empty State Display */
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}>
              <Bookmark size={28} color={tokens.textSubtle} />
            </View>
            <Text style={[styles.emptyTitle, { color: tokens.textMain }]}>
              No saved properties
            </Text>
            <Text style={[styles.emptySubtitle, { color: tokens.textSubtle }]}>
              Bookmark the homes you love to keep them here for quick access
              later.
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab("dashboard")}
              style={[styles.exploreBtn, { backgroundColor: tokens.accent }]}
            >
              <Text style={styles.exploreBtnText}>Start Exploring</Text>
              <Search size={16} color="white" />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { 
    width: 42,
    height: 42,
    borderRadius: 100, 
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  notifDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    backgroundColor: "#ef4444",
    borderRadius: 100,
    borderWidth: 1.5,
  },
  scrollContent: { paddingBottom: 100 },
  grid: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    marginBottom: 16,
    borderRadius: 24, 
    borderWidth: 1,
    backgroundColor: "transparent", 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  glassClippingMask: {
    flex: 1,
    borderRadius: 23, 
    overflow: "hidden", 
  },
  cardInner: {
    flex: 1,
    backgroundColor: "transparent",
  },
  imageContainer: { aspectRatio: 1, position: "relative", padding: 8 },
  image: { width: "100%", height: "100%", borderRadius: 18 }, 
  favBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  chatIndicator: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 26,
    height: 26,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  priceBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100, 
    borderWidth: 1,
  },
  priceText: { fontSize: 11, fontWeight: "800" },
  cardInfo: { 
    paddingHorizontal: 14, 
    paddingBottom: 14, 
    paddingTop: 12,
    borderBottomLeftRadius: 23,
    borderBottomRightRadius: 23,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { fontSize: 11, marginLeft: 4, flex: 1, fontWeight: "500" },
  cardFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8, letterSpacing: -0.2 },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100, 
  },
  exploreBtnText: { color: "white", fontWeight: "700", marginRight: 8, fontSize: 15 },
});

export default FavoritesScreen;