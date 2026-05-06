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
  Image
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
} from "lucide-react-native";
import {
  collection,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import { db } from "../../lib/firebase";
import { FEATURED_LISTINGS } from "./data";
import ListingCard from "../../components/listingcard";

const { width, height } = Dimensions.get("window");

const HomeScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [maxBudget, setMaxBudget] = useState(1000000000);
  const [showFilters, setShowFilters] = useState(false);
  const [dbListings, setDbListings] = useState([]);
  const [isMapView, setIsMapView] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  const { user, setCurrentListing, setActiveTab } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme === "dark";
  const isAgent = user?.role === "agent";
  const filters = ["All", "Self-Contain", "1 Bedroom Flat", "Shared"];

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

  const dynamicStyles = {
    container: { backgroundColor: isDark ? "#020617" : "#ffffff" },
    header: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      borderBottomColor: isDark ? "#1e293b" : "#f1f5f9",
    },
    input: {
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      color: isDark ? "#ffffff" : "#0f172a",
    },
    text: { color: isDark ? "#ffffff" : "#0f172a" },
  };

  return (
    <SafeAreaView style={[styles.safeArea, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      
      <View style={[styles.header, dynamicStyles.header]}>
        <View style={styles.brandRow}>
          <View >
          </View>
          <Image source={require("../../assets/Direct.png")} style={styles.logoimg} />
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
            onPress={() => setActiveTab("notifications")}
            style={styles.iconBtn}
          >
            <Bell size={22} color={isDark ? "#94a3b8" : "#64748b"} />
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
            <View style={styles.mapPlaceholder}>
              <Text
                style={{
                  textAlign: "center",
                  color: isDark ? "#fff" : "#0f172a",
                }}
              >
                Map view requires the optional 'react-native-maps' native
                module.
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  color: isDark ? "#94a3b8" : "#64748b",
                }}
              >
                Run 'expo install react-native-maps' and rebuild the app to
                enable maps, or switch to list view.
              </Text>
            </View>
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
                />
              </View>
            ))}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logoimg:{
    width:50,
    height:50,
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
  headerActions: { flexDirection: "row" },
  iconBtn: { marginLeft: 12 },
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
});

export default HomeScreen;
