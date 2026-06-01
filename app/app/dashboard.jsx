import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import {
  Search,
  Settings2,
  MapPin,
  FilterX,
  Home as HomeIcon,
  Bell,
  Map,
  LayoutGrid,
  Navigation,
  FileText,
  X,
} from "lucide-react-native";
import {
  collection,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import { db } from "../../lib/firebase";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import ListingCard from "../../components/listingcard";
import { BlurView } from "expo-blur"; // Native Glass Engine
import Skeleton from "../../components/ui/Skeleton";

const { width, height } = Dimensions.get("window");

const HomeScreen = () => {
  const [region, setRegion] = useState(null);
  const [nearbyListings, setNearbyListings] = useState([]);
  const [locationError, setLocationError] = useState(null);
  const [geocoded, setGeocoded] = useState({}); // { [listingId]: { latitude, longitude } }
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [maxBudget, setMaxBudget] = useState(1000000000);
  const [showFilters, setShowFilters] = useState(false);
  const [dbListings, setDbListings] = useState([]);
  const [isMapView, setIsMapView] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { user, setCurrentListing, _setCurrentListing, setActiveTab } =
    useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark" || theme === "dark";
  const isAgent = user?.role === "agent";
  const filters = ["All", "Self-Contain", "1 Bedroom Flat", "Shared"];

  // Premium Cosmic Tint Palette Configuration
  const tokens = isDark
    ? {
        background: "#0d1321",
        canvas: "#0a0e1a",
        headerBg: "rgba(10, 14, 26, 0.85)",
        card: "rgba(30, 41, 59, 0.25)",
        accent: "#010205ff",
        primaryText: "#FFFFFF",
        secondaryText: "#94a3b8",
        muted: "#64748b",
        border: "rgba(255, 255, 255, 0.08)",
        inputBg: "rgba(255, 255, 255, 0.03)",
      }
    : {
        background: "#f8fafc",
        canvas: "#f1f5f9",
        headerBg: "rgba(255, 255, 255, 0.85)",
        card: "rgba(255, 255, 255, 0.5)",
        accent: "#2563eb",
        primaryText: "#0f172a",
        secondaryText: "#475569",
        muted: "#94a3b8",
        border: "rgba(15, 23, 42, 0.06)",
        inputBg: "rgba(15, 23, 42, 0.02)",
      };

  const dynamicStyles = {
    container: { backgroundColor: tokens.canvas },
    header: {
      backgroundColor: tokens.headerBg,
      borderBottomColor: tokens.border,
    },
    input: { backgroundColor: tokens.inputBg, color: tokens.primaryText },
    text: { color: tokens.primaryText },
  };

  useEffect(() => {
    const listingsRef = collection(db, "listings");
    const unsubscribe = onSnapshot(query(listingsRef), (snapshot) => {
      const fetched = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      setDbListings(fetched);
    });
    return () => unsubscribe();
  }, []);

  // show skeleton flag (do NOT return early to keep hooks stable)
  const showSkeleton = dbListings.length === 0;

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
        console.warn("[Dashboard] notifications subscribe failed", err);
      },
    );
    return () => unsub();
  }, [user]);

  const filteredListings = useMemo(() => {
    let baseListings = [...dbListings];
    const seenIds = new Set();
    baseListings = baseListings.filter((l) => {
      if (seenIds.has(String(l.id))) return false;
      seenIds.add(String(l.id));
      return true;
    });

    if (isAgent && user) {
      baseListings = baseListings.filter(
        (l) =>
          l.agent?.id &&
          String(l.agent.id) === String(user.id) &&
          l.isApproved !== false,
      );
    } else {
      baseListings = baseListings.filter((l) => l.isApproved !== false);
    }

    return baseListings.filter((listing) => {
      const title = (listing.title || "").toString().toLowerCase();
      const location = (listing.location || "").toString().toLowerCase();
      const q = (searchQuery || "").toString().toLowerCase();
      const matchesSearch = title.includes(q) || location.includes(q);

      const listingTypeNorm = (listing.type || "")
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const activeFilterNorm = (activeFilter || "All")
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const matchesFilter =
        activeFilter === "All" ||
        (listingTypeNorm && listingTypeNorm === activeFilterNorm);

      const matchesBudget =
        (typeof listing.priceValue === "number"
          ? listing.priceValue
          : Number(listing.priceValue || 0)) <= Number(maxBudget || 0);
      return matchesSearch && matchesFilter && matchesBudget;
    });
  }, [searchQuery, activeFilter, maxBudget, isAgent, user?.id, dbListings]);

  const handleSaveSearch = async () => {
    if (!user) return;
    setIsSavingSearch(true);
    try {
      await addDoc(collection(db, "saved_searches"), {
        userId: user.id,
        query: searchQuery,
        type: activeFilter,
        maxPrice: maxBudget,
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        "Success",
        "Search alert saved! We will notify you of matches.",
      );
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingSearch(false);
    }
  };

  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    let mounted = true;
    const ensureLocationAndCompute = async () => {
      if (!isMapView) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location permission not granted");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (!mounted) return;
        const { latitude, longitude } = loc.coords;
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        const matched = dbListings.filter((l) => {
          const lat =
            l.locationLat ||
            l.coords?.lat ||
            l.lat ||
            (geocoded[l.id] && geocoded[l.id].latitude);
          const lon =
            l.locationLng ||
            l.coords?.lng ||
            l.lng ||
            (geocoded[l.id] && geocoded[l.id].longitude);
          if (!lat || !lon) return false;
          const d = distanceMeters(
            latitude,
            longitude,
            Number(lat),
            Number(lon),
          );
          return d <= 10;
        });
        setNearbyListings(matched);

        const toGeocode = dbListings.filter((l) => {
          const has = !!(
            l.locationLat ||
            l.locationLng ||
            l.coords ||
            l.lat ||
            l.lng ||
            (geocoded[l.id] && geocoded[l.id].latitude)
          );
          return !has && l.location && l.location.trim().length > 0;
        });

        if (toGeocode.length > 0) {
          for (const listing of toGeocode) {
            try {
              const results = await Location.geocodeAsync(listing.location);
              if (results && results.length > 0) {
                const r = results[0];
                setGeocoded((prev) => ({
                  ...prev,
                  [listing.id]: {
                    latitude: r.latitude,
                    longitude: r.longitude,
                  },
                }));
              }
            } catch (e) {
              console.warn(
                "[Geocode] failed for",
                listing.id,
                listing.location,
                e,
              );
            }
            await new Promise((res) => setTimeout(res, 200));
          }
        }
      } catch (e) {
        console.warn("Map location error", e);
        setLocationError(String(e));
      }
    };
    ensureLocationAndCompute();
    return () => {
      mounted = false;
    };
  }, [isMapView, dbListings, geocoded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!showTransactionsModal) return;
      if (!user || !user.id) return;
      setHistoryLoading(true);
      try {
        const tRef = collection(db, "transactions");
        const q = query(
          tRef,
          where("userId", "==", user.id),
          orderBy("createdAt", "desc"),
          limit(50),
        );
        const snaps = await getDocs(q);
        if (cancelled) return;
        const list = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTransactions(list);
      } catch (e) {
        console.warn("[Transactions] fetch failed", e);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showTransactionsModal, user?.id]);

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header Area */}
      <View style={[styles.header, dynamicStyles.header]}>
        <View style={styles.brandRow}>
          <Image
            source={require("../../assets/Direct.png")}
            style={styles.logoimg}
          />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsMapView(!isMapView)}
            style={[styles.iconBtn, { borderColor: tokens.border }]}
          >
            {isMapView ? (
              <LayoutGrid size={20} color={isDark ? "#ffffff" : "#0f172a"} />
            ) : (
              <Map size={20} color={isDark ? "#ffffff" : "#0f172a"} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/app/notification")}
            style={[styles.iconBtn, { borderColor: tokens.border }]}
          >
            <Bell size={20} color={isDark ? "#ffffff" : "#0f172a"} />
            {unread > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowTransactionsModal(true)}
            style={[styles.iconBtn, { borderColor: tokens.border }]}
          >
            <FileText size={20} color={isDark ? "#ffffff" : "#0f172a"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sticky Search & Dynamic Filtering Area */}
        <View
          style={[styles.searchSection, { backgroundColor: tokens.canvas }]}
        >
          <View style={styles.searchBarContainer}>
            <Search size={18} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              placeholder="Search area or landmark..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.inputBg,
                  color: tokens.primaryText,
                  borderColor: tokens.border,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={[styles.filterToggle, { backgroundColor: tokens.accent }]}
            >
              <Settings2 size={18} color="white" />
            </TouchableOpacity>
          </View>

          {showFilters && (
            <View
              style={[styles.filterPanelOuter, { borderColor: tokens.border }]}
            >
              <BlurView
                intensity={isDark ? 30 : 75}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[styles.filterPanel, { backgroundColor: tokens.card }]}
              >
                <View style={styles.filterHeader}>
                  <Text style={[styles.label, { color: tokens.secondaryText }]}>
                    PROPERTY TYPE
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setActiveFilter("All");
                      setMaxBudget(1000000000);
                    }}
                  >
                    <Text style={styles.resetText}>RESET</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                >
                  {filters.map((f) => (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setActiveFilter(f)}
                      style={[
                        styles.filterChip,
                        { borderColor: tokens.border },
                        activeFilter === f && {
                          backgroundColor: tokens.accent,
                          borderColor: tokens.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: tokens.secondaryText },
                          activeFilter === f && styles.activeChipText,
                        ]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Core Layout Conditional Display */}
        {showSkeleton ? (
          <View style={{ padding: 12 }}>
            <Skeleton type="dashboard" isDark={isDark} />
          </View>
        ) : isMapView ? (
          <View style={[styles.mapContainer, { borderColor: tokens.border }]}>
            {region ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={region}
                showsUserLocation
                followsUserLocation
              >
                {(nearbyListings.length > 0
                  ? nearbyListings
                  : dbListings.filter(
                      (l) =>
                        !!(l.locationLat || l.locationLng || l.coords || l.lat),
                    )
                ).map((listing) => {
                  const lat =
                    listing.locationLat ||
                    listing.coords?.lat ||
                    listing.lat ||
                    (geocoded[listing.id] && geocoded[listing.id].latitude);
                  const lon =
                    listing.locationLng ||
                    listing.coords?.lng ||
                    listing.lng ||
                    (geocoded[listing.id] && geocoded[listing.id].longitude);
                  if (!lat || !lon) return null;
                  return (
                    <Marker
                      key={listing.id}
                      coordinate={{
                        latitude: Number(lat),
                        longitude: Number(lon),
                      }}
                    >
                      <View style={{ alignItems: "center" }}>
                        <View
                          style={{
                            backgroundColor: "#1e3a8a",
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 100,
                            maxWidth: 140,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            {listing.title || "Listing"}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: tokens.accent,
                            borderRadius: 6,
                            marginTop: 6,
                            borderWidth: 2,
                            borderColor: "#fff",
                          }}
                        />
                      </View>
                      <Callout tooltip>
                        <View
                          style={{
                            padding: 12,
                            backgroundColor: tokens.canvas,
                            borderRadius: 16,
                            maxWidth: 220,
                            borderWidth: 1,
                            borderColor: tokens.border,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "800",
                              color: tokens.primaryText,
                            }}
                          >
                            {listing.title}
                          </Text>
                          <Text
                            style={{
                              color: tokens.secondaryText,
                              marginTop: 4,
                              fontSize: 12,
                            }}
                          >
                            {listing.location}
                          </Text>
                        </View>
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>
            ) : (
              <View
                style={[
                  styles.mapPlaceholder,
                  { backgroundColor: tokens.card },
                ]}
              >
                <ActivityIndicator
                  color={tokens.accent}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  style={{ color: tokens.secondaryText, fontWeight: "600" }}
                >
                  Locating you...
                </Text>
              </View>
            )}
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={{ padding: 20 }}>
            <View
              style={[
                styles.noListingsContainer,
                { borderColor: tokens.border, backgroundColor: tokens.card },
              ]}
            >
              <View style={styles.noListingsIcon}>
                <MapPin size={28} color={isDark ? "#fff" : "#0f172a"} />
              </View>
              <Text
                style={[styles.noListingsTitle, { color: tokens.primaryText }]}
              >
                No listings found
              </Text>
              <Text
                style={[
                  styles.noListingsSubtitle,
                  { color: tokens.secondaryText },
                ]}
              >
                Try widening your search, changing filters or switch to map view
                to explore nearby listings.
              </Text>

              <View style={styles.noListingsBtnRow}>
                <TouchableOpacity
                  onPress={() => setIsMapView(true)}
                  style={[
                    styles.noListingsBtn,
                    { backgroundColor: tokens.accent },
                  ]}
                >
                  <Text style={[styles.noListingsBtnText]}>Browse Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setActiveFilter("All");
                    setMaxBudget(1000000000);
                    setShowFilters(true);
                  }}
                  style={[
                    styles.noListingsBtn,
                    {
                      backgroundColor: isDark ? "#111827" : "#eef2ff",
                      borderWidth: 1,
                      borderColor: tokens.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.noListingsBtnText,
                      { color: isDark ? "#fff" : tokens.accent },
                    ]}
                  >
                    Reset Filters
                  </Text>
                </TouchableOpacity>

                {isAgent && (
                  <TouchableOpacity
                    onPress={() => {
                      router.push("/app/creatlisting");
                    }}
                    style={[
                      styles.noListingsBtn,
                      { backgroundColor: "#06b6d4" },
                    ]}
                  >
                    <Text style={[styles.noListingsBtnText]}>
                      Create Listing
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>
              {isAgent ? "Your Listings" : "Available Listings"}
            </Text>
            {filteredListings.map((listing) => (
              <View key={listing.id} style={styles.cardSpacing}>
                <ListingCard
                  listing={listing}
                  onViewDetails={() => {
                    setCurrentListing(listing);
                    try {
                      router.push("/app/listingdetails");
                    } catch (e) {
                      console.warn("Navigation to listing details failed", e);
                    }
                  }}
                  isAgentView={isAgent}
                  onEdit={() => {
                    setCurrentListing(listing);
                    router.push("/app/creatlisting");
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Glassmorphic Transactions View Modal */}
      <Modal
        visible={showTransactionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTransactionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContentOuter, { borderColor: tokens.border }]}
          >
            <BlurView
              intensity={isDark ? 35 : 75}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />

            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.25)"
                    : "rgba(255, 255, 255, 0.45)",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      fontSize: 20,
                      marginBottom: 0,
                      color: tokens.primaryText,
                    },
                  ]}
                >
                  Transactions
                </Text>
                <TouchableOpacity
                  onPress={() => setShowTransactionsModal(false)}
                  style={[
                    styles.closeButtonModal,
                    { backgroundColor: tokens.inputBg, borderRadius: 100 },
                  ]}
                  accessibilityLabel="Close transactions"
                >
                  <X size={18} color={tokens.primaryText} />
                </TouchableOpacity>
              </View>

              {historyLoading ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <ActivityIndicator color={tokens.accent} />
                </View>
              ) : transactions.length === 0 ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <Text
                    style={{ color: tokens.secondaryText, fontWeight: "600" }}
                  >
                    No transactions yet.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: height * 0.65 }}
                  showsVerticalScrollIndicator={false}
                >
                  {transactions.map((t) => (
                    <View
                      key={t.id}
                      style={[
                        styles.transactionRow,
                        { borderColor: tokens.border },
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text
                          style={{
                            fontWeight: "700",
                            color: tokens.primaryText,
                            fontSize: 15,
                          }}
                        >
                          {t.title || t.type || "Transaction"}
                        </Text>
                        <Text
                          style={{
                            color: tokens.secondaryText,
                            marginTop: 4,
                            fontSize: 13,
                          }}
                        >
                          {t.description || t.listingTitle || ""}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontWeight: "800",
                            color: tokens.accent,
                            fontSize: 16,
                          }}
                        >
                          {t.amount ? `₦${t.amount}` : ""}
                        </Text>
                        <Text
                          style={{
                            color: tokens.muted,
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          {t.createdAt?.toDate
                            ? new Date(
                                t.createdAt.toDate(),
                              ).toLocaleDateString()
                            : ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  noListingsContainer: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noListingsIcon: {
    width: 64,
    height: 64,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  noListingsTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  noListingsSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 420,
  },
  noListingsBtnRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  noListingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    marginVertical: 6,
  },
  noListingsBtnText: { fontWeight: "800", color: "#fff" },
  closeButtonModal: { padding: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  logoimg: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 100, // Capsule circular frames from inspiration
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
  },
  searchSection: { paddingHorizontal: 20, paddingVertical: 16 },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  searchIcon: { position: "absolute", left: 18, zIndex: 1 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 100, // Capsule search entry fields
    paddingLeft: 48,
    paddingRight: 64,
    fontSize: 15,
    fontWeight: "500",
    borderWidth: 1,
  },
  filterToggle: {
    position: "absolute",
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 100, // Completely circular filters indicator trigger button
    alignItems: "center",
    justifyContent: "center",
  },
  filterPanelOuter: {
    marginTop: 14,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  filterPanel: { padding: 18 },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    alignItems: "center",
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  resetText: { fontSize: 11, fontWeight: "800", color: "#f43f5e" },
  filterScroll: { flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100, // Matches capsule aesthetic perfectly
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    marginRight: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  activeChipText: { color: "white" },
  gridContainer: { paddingHorizontal: 20, paddingTop: 8 },
  cardSpacing: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
    letterSpacing: -0.4,
  },
  mapContainer: {
    height: height * 0.58,
    width: width - 40,
    alignSelf: "center",
    borderRadius: 36, // Large smooth geometric frames
    overflow: "hidden",
    marginTop: 10,
    borderWidth: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#0a0e1a",
  },
  notificationBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.65)", // Dark cinematic context shade overlay
    justifyContent: "flex-end",
  },
  modalContentOuter: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  modalContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
});

export default HomeScreen;
