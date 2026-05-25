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
import { FEATURED_LISTINGS } from "./data";
import ListingCard from "../../components/listingcard";

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

  const tokens = isDark
    ? {
        background: "#0A0B0D",
        canvas: "#071226",
        headerBg: "#0f172a",
        card: "#0e1520",
        accent: "#C5A46E",
        primaryText: "#FFFFFF",
        secondaryText: "#BFC3C8",
        muted: "#94a3b8",
        border: "#1e293b",
        inputBg: "#0b1220",
      }
    : {
        background: "#FFFFFF",
        canvas: "#F7F8FA",
        headerBg: "#FFFFFF",
        card: "#F1F5FF",
        accent: "#2B3467",
        primaryText: "#0F172A",
        secondaryText: "#475569",
        muted: "#94a3b8",
        border: "#f1f5f9",
        inputBg: "#f8fafc",
      };

  const dynamicStyles = {
    container: { backgroundColor: tokens.background },
    header: { backgroundColor: tokens.headerBg, borderBottomColor: tokens.border },
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
    let baseListings = [...dbListings, ...FEATURED_LISTINGS];
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

      // normalize types for comparison (remove spacing/punctuation and lowercase)
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

  // helper: compute distance (meters) between two lat/lng points (Haversine)
  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // meters
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

  // when map view enabled, request location and compute nearby listings within 10 meters
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

        // find listings that have coordinates and are within 10 meters
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
          return d <= 10; // within 10 meters
        });
        setNearbyListings(matched);

        // kick off geocoding for listings that lack coords
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
          // sequentially geocode to avoid hitting provider limits
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
            // small delay to be gentle
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

  // fetch transactions when modal opens
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

      <View style={[styles.header, dynamicStyles.header]}>
        <View style={styles.brandRow}>
          <View></View>
          <Image
            source={require("../../assets/Direct.png")}
            style={styles.logoimg}
          />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsMapView(!isMapView)}
            style={styles.iconBtn}
          >
            {isMapView ? (
              <LayoutGrid size={22} color={isDark ? "#94a3b8" : "#64748b"} />
            ) : (
              <Map size={22} color={isDark ? "#94a3b8" : "#64748b"} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/app/notification")}
            style={styles.iconBtn}
          >
            <Bell size={20} color={isDark ? "#ffffff" : "#1e293b"} />
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
            style={styles.iconBtn}
          >
            <FileText size={20} color={isDark ? "#ffffff" : "#1e293b"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchSection, dynamicStyles.container]}>
          <View style={styles.searchBarContainer}>
            <Search size={18} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              placeholder="Search area or landmark..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.input, dynamicStyles.input]}
            />
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={styles.filterToggle}
            >
              <Settings2 size={18} color="white" />
            </TouchableOpacity>
          </View>

          {showFilters && (
            <View style={[styles.filterPanel, dynamicStyles.header]}>
              <View style={styles.filterHeader}>
                <Text style={styles.label}>PROPERTY TYPE</Text>
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
                      activeFilter === f && styles.activeChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        activeFilter === f && styles.activeChipText,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {isMapView ? (
          // Placeholder when react-native-maps is not installed. Install it to enable map view.
          <View style={styles.mapContainer}>
            {isMapView ? (
              region ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={{ flex: 1 }}
                  initialRegion={region}
                  showsUserLocation
                  followsUserLocation
                >
                  {/* user location marker is provided by showsUserLocation; show listing markers */}
                  {(nearbyListings.length > 0
                    ? nearbyListings
                    : dbListings.filter(
                        (l) =>
                          !!(
                            l.locationLat ||
                            l.locationLng ||
                            l.coords ||
                            l.lat
                          ),
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
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12,
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
                              backgroundColor: "#10b981",
                              borderRadius: 6,
                              marginTop: 6,
                              borderWidth: 2,
                              borderColor: "#fff",
                            }}
                          />
                        </View>
                        <Callout tooltip>
                          <View style={{ padding: 8, maxWidth: 220 }}>
                            <Text style={{ fontWeight: "800" }}>
                              {listing.title}
                            </Text>
                            <Text style={{ color: "#64748b", marginTop: 4 }}>
                              {listing.location}
                            </Text>
                          </View>
                        </Callout>
                      </Marker>
                    );
                  })}
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                    Locating you...
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  Map is off — toggle the map button to view nearby listings.
                </Text>
              </View>
            )}
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
              No listings available.
            </Text>
            {isAgent && (
              <Text
                style={{ color: isDark ? "#94a3b8" : "#64748b", marginTop: 12 }}
              >
                Tap the History icon in the header to view transactions.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.gridContainer}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>
              {isAgent ? "Your Listings" : "Available Listings"}
            </Text>
            {filteredListings.map((listing, i) => (
              <View key={listing.id}>
                <ListingCard
                  listing={listing}
                  onViewDetails={() => {
                    setCurrentListing(listing);
                    // navigate to the listing details screen
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

      {/* Transaction modal (opened from header button) */}
      <Modal
        visible={showTransactionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTransactionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? "#0f172a" : "#ffffff" },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    fontSize: 18,
                    marginBottom: 0,
                    color: isDark ? "#fff" : "#0f172a",
                  },
                ]}
              >
                Transactions
              </Text>
              <TouchableOpacity
                onPress={() => setShowTransactionsModal(false)}
                style={styles.closeButtonModal}
                accessibilityLabel="Close transactions"
              >
                <X size={20} color={isDark ? "#fff" : "#0f172a"} />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator />
              </View>
            ) : transactions.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  No transactions yet.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: height * 0.7 }}>
                {transactions.map((t) => (
                  <View key={t.id} style={styles.transactionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700" }}>
                        {t.title || t.type || "Transaction"}
                      </Text>
                      <Text style={{ color: "#64748b", marginTop: 4 }}>
                        {t.description || t.listingTitle || ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "800" }}>
                        {t.amount ? `₦${t.amount}` : ""}
                      </Text>
                      <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                        {t.createdAt?.toDate
                          ? new Date(t.createdAt.toDate()).toLocaleString()
                          : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  closeButtonModal: { padding: 6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logoimg: {
    width: 50,
    height: 50,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: "#071844ff",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandText: { fontSize: 18, fontWeight: "800" },
  brandAccent: { color: "#0c0a55ff" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  searchSection: { padding: 20 },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  searchIcon: { position: "absolute", left: 15, zIndex: 1 },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    paddingLeft: 45,
    paddingRight: 60,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterToggle: {
    position: "absolute",
    right: 5,
    width: 40,
    height: 40,
    backgroundColor: "#071844ff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPanel: { marginTop: 15, padding: 15, borderRadius: 20, borderWidth: 1 },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  label: { fontSize: 10, fontWeight: "800", color: "#94a3b8" },
  resetText: { fontSize: 10, fontWeight: "800", color: "#f43f5e" },
  filterScroll: { flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  activeChip: { backgroundColor: "#10b981", borderColor: "#10b981" },
  chipText: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  activeChipText: { color: "white" },
  gridContainer: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  mapContainer: {
    height: height * 0.6,
    width: width - 40,
    alignSelf: "center",
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 10,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 30,
  },
  notificationBtn: {
    position: "relative",
    padding: 0,
    backgroundColor: "#f1f5f9",
  },
  notificationBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fff",
  },
  notificationBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
});

export default HomeScreen;
