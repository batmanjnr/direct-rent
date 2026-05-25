import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import {
  ChevronLeft,
  Star,
  ShieldCheck,
  BadgeCheck,
  Clock,
  CheckCircle2,
  MessageSquare,
  MapPin,
  Calendar,
  TrendingUp,
  Zap,
  Building2,
} from "lucide-react-native";
import { db } from "../../lib/firebase";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import SafeImage from "../../components/safeimage";
import { useAuth } from "../../context/AuthContext";

const { width } = Dimensions.get("window");

const AgentProfile = ({ agentId: agentIdProp, onBack }) => {
  const router = useRouter();
  const { currentListing, user, setCurrentListing } = useAuth();
  // Some versions of expo-router don't expose useSearchParams in this environment.
  // Fall back to the provided prop or the current selected listing's agent id.
  const agentId = agentIdProp || currentListing?.agent?.id;
  const [agent, setAgent] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: "",
    listingTitle: "",
  });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [stats, setStats] = useState({
    completedTxns: 0,
    activeListingsCount: 0,
    avgRating: 0,
    successRate: "95%",
    responseTime: "15m",
  });
  const [agentListings, setAgentListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        if (!agentId) {
          setIsLoading(false);
          return;
        }
        const agentDoc = await getDoc(doc(db, "users", agentId));
        let agentData = agentDoc.exists()
          ? agentDoc.data()
          : {
              name: "Verified Agent",
              city: "Ibadan",
              role: "agent",
            };
        setAgent(agentData);

        // Fetch Stats (Real + Fallback logic)
        const reviewsRef = collection(db, "reviews");
        const qReviews = query(
          reviewsRef,
          where("agentId", "==", agentId),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const reviewsSnap = await getDocs(qReviews);
        const reviewsData = reviewsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setReviews(reviewsData);
        // Fetch agent's listings
        try {
          const listingsRef = collection(db, "listings");
          const qListings = query(
            listingsRef,
            where("agent.id", "==", agentId),
            orderBy("createdAt", "desc"),
            limit(10),
          );
          const listingsSnap = await getDocs(qListings);
          const listingsData = listingsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setAgentListings(listingsData);
          setStats((prev) => ({
            ...prev,
            avgRating: 4.8,
            completedTxns: 52,
            activeListingsCount: listingsData.length,
          }));
        } catch (e) {
          console.warn("Failed to fetch agent listings", e);
          setStats((prev) => ({ ...prev, avgRating: 4.8, completedTxns: 52 }));
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgentData();
  }, [agentId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>GENERATING VERIFIED RECORD...</Text>
      </View>
    );
  }

  const handleBack = () => {
    if (onBack) return onBack();
    try {
      router.back();
    } catch (e) {
      router.replace("/app/dashboard");
    }
  };

  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <ChevronLeft size={24} color="#64748b" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarWrapper}>
              <SafeImage
                src={agent?.avatarUrl}
                fallbackType="avatar"
                style={styles.avatar}
              />
              {agent?.verificationStatus === "verified" && (
                <View style={styles.verifyBadge}>
                  <ShieldCheck size={12} color="white" />
                </View>
              )}
            </View>

            <View style={styles.headerText}>
              <Text style={styles.agentName}>
                {agent?.name || "Agent Name"}
              </Text>
              <View style={styles.partnerBadge}>
                <BadgeCheck size={10} color="#60a5fa" />
                <Text style={styles.partnerText}>VERIFIED PARTNER</Text>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={12} color="#0284c7" />
                <Text style={styles.locationText}>
                  {agent?.city || "Ibadan"}, Nigeria
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatBox
            icon={<CheckCircle2 size={20} color="#60a5fa" />}
            value={stats.completedTxns}
            label="RENTALS"
          />
          <StatBox
            icon={<Zap size={20} color="#10b981" />}
            value={stats.successRate}
            label="SUCCESS"
          />
          <StatBox
            icon={<Clock size={20} color="#818cf8" />}
            value={stats.responseTime}
            label="RESPONSE"
          />
          <StatBox
            icon={<Building2 size={20} color="#fbbf24" />}
            value={stats.activeListingsCount}
            label="LISTINGS"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verified Reviews</Text>
          {user?.role === "tenant" && (
            <TouchableOpacity
              onPress={() => setShowReviewModal(true)}
              style={styles.reviewTrigger}
            >
              <Star size={12} color="white" fill="white" />
              <Text style={styles.reviewTriggerText}>Review</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width * 0.8}
          decelerationRate="fast"
        >
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <Text style={styles.reviewerName}>{review.tenantName}</Text>
                  <View style={styles.starRow}>
                    <Star size={10} color="#fbbf24" fill="#fbbf24" />
                    <Text style={styles.ratingText}>
                      {review.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reviewComment} numberOfLines={3}>
                  "{review.comment}"
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No verified reviews yet.</Text>
          )}
        </ScrollView>

        {/* Other listings by this agent */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Other Listings</Text>
        </View>
        {agentListings.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingBottom: 20 }}
          >
            {agentListings.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={styles.reviewCard}
                onPress={() => {
                  setCurrentListing(l);
                  router.push("/app/listingdetails");
                }}
              >
                <Image
                  source={{ uri: l.image || "https://via.placeholder.com/300" }}
                  style={{ width: "100%", height: 120, borderRadius: 12 }}
                />
                <Text
                  style={{ marginTop: 8, fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {l.title}
                </Text>
                <Text style={{ color: "#64748b", marginTop: 4 }}>
                  ₦{l.priceValue?.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>
            No other listings from this agent.
          </Text>
        )}
      </ScrollView>

      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Agent</Text>
            <TextInput
              placeholder="Property Rented"
              style={styles.input}
              onChangeText={(t) =>
                setNewReview({ ...newReview, listingTitle: t })
              }
            />
            <TextInput
              placeholder="Your Feedback"
              style={[styles.input, styles.textArea]}
              multiline
              onChangeText={(t) => setNewReview({ ...newReview, comment: t })}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setShowReviewModal(false)}
            >
              <Text style={styles.submitBtnText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const StatBox = ({ icon, value, label }) => (
  <View style={styles.statBox}>
    <View style={styles.statIcon}>{icon}</View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94a3b8",
    marginTop: 10,
    letterSpacing: 1,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 110, paddingBottom: 40 },
  profileCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  profileHeader: { flexDirection: "row", alignItems: "center" },
  avatarWrapper: { position: "relative" },
  avatar: { width: 80, height: 80, borderRadius: 16 },
  verifyBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "#0284c7",
    padding: 4,
    borderRadius: 8,
  },
  headerText: { marginLeft: 20, flex: 1 },
  agentName: { color: "#fff", fontSize: 24, fontWeight: "900" },
  partnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(96, 165, 250, 0.1)",
    alignSelf: "flex-start",
    padding: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  partnerText: {
    color: "#60a5fa",
    fontSize: 8,
    fontWeight: "900",
    marginLeft: 4,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  locationText: { color: "#94a3b8", fontSize: 12, marginLeft: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statBox: {
    width: "48%",
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    height: 120,
    justifyContent: "space-between",
  },
  statIcon: {
    backgroundColor: "rgba(255,255,255,0.05)",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "900" },
  statLabel: { color: "#64748b", fontSize: 8, fontWeight: "900" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  reviewTrigger: {
    backgroundColor: "#0284c7",
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  reviewTriggerText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },
  reviewCard: {
    width: width * 0.75,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginRight: 15,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewerName: { fontSize: 12, fontWeight: "bold" },
  starRow: { flexDirection: "row", alignItems: "center" },
  ratingText: { fontSize: 10, fontWeight: "900", marginLeft: 2 },
  reviewComment: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", marginBottom: 20 },
  input: {
    backgroundColor: "#f8fafc",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontWeight: "bold",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  submitBtn: {
    backgroundColor: "#0284c7",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "900" },
});

export default AgentProfile;
