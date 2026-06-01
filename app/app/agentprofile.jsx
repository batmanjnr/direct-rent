import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  useColorScheme,
} from "react-native";
import {
  ChevronLeft,
  Star,
  ShieldCheck,
  BadgeCheck,
  Clock,
  CheckCircle2,
  MapPin,
  Building2,
  Zap,
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
} from "firebase/firestore";
import SafeImage from "../../components/safeimage";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");

const GlassSkeleton = ({ style, tokens, isDark }) => (
  <View
    style={[
      styles.skeletonBase,
      style,
      { borderColor: tokens.border, backgroundColor: tokens.cardBg },
    ]}
  >
    <BlurView
      intensity={isDark ? 15 : 45}
      tint={isDark ? "dark" : "light"}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

const AgentProfile = ({ agentId: agentIdProp, onBack }) => {
  const router = useRouter();
  const { currentListing, user, setCurrentListing } = useAuth();
  const { theme } = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme === "dark" || theme === "dark";

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

  const tokens = isDark
    ? {
        canvas: "#0a0e1a",
        cardBg: "rgba(30, 41, 59, 0.22)",
        textMain: "#ffffff",
        textSubtle: "#94a3b8",
        border: "rgba(255, 255, 255, 0.08)",
        badgeBg: "rgba(59, 130, 246, 0.15)",
        accent: "#3b82f6",
        surfaceSolid: "#111827",
      }
    : {
        canvas: "#f1f5f9",
        cardBg: "rgba(255, 255, 255, 0.45)",
        textMain: "#0f172a",
        textSubtle: "#475569",
        border: "rgba(15, 23, 42, 0.06)",
        badgeBg: "rgba(37, 99, 235, 0.08)",
        accent: "#2563eb",
        surfaceSolid: "#ffffff",
      };

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

        const reviewsRef = collection(db, "reviews");
        // Fetch reviews for this agent without using orderBy on the server (avoids composite index requirement)
        const qReviews = query(reviewsRef, where("agentId", "==", agentId));
        const reviewsSnap = await getDocs(qReviews);
        let reviewsData = reviewsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort client-side by createdAt (desc) and limit to 10
        reviewsData.sort((a, b) => {
          const toMillis = (ts) => {
            if (!ts) return 0;
            if (typeof ts.toMillis === "function") return ts.toMillis();
            if (ts.seconds) return ts.seconds * 1000;
            return new Date(ts).getTime() || 0;
          };
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        });
        reviewsData = reviewsData.slice(0, 10);

        setReviews(reviewsData);

        try {
          const listingsRef = collection(db, "listings");
          // Fetch listings for this agent without server-side ordering (avoid index requirement) and sort client-side
          const qListings = query(
            listingsRef,
            where("agent.id", "==", agentId),
          );
          const listingsSnap = await getDocs(qListings);
          let listingsData = listingsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          listingsData.sort((a, b) => {
            const toMillis = (ts) => {
              if (!ts) return 0;
              if (typeof ts.toMillis === "function") return ts.toMillis();
              if (ts.seconds) return ts.seconds * 1000;
              return new Date(ts).getTime() || 0;
            };
            return toMillis(b.createdAt) - toMillis(a.createdAt);
          });
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

  const handleBack = () => {
    if (onBack) return onBack();
    try {
      router.back();
    } catch (e) {
      router.replace("/app/dashboard");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.canvas }]}>
        <View style={styles.scrollContent}>
          {/* Compact Profile Card Skeleton */}
          <View
            style={[
              styles.glassCard,
              { height: 90, borderColor: tokens.border },
            ]}
          >
            <View
              style={[
                styles.cardInner,
                {
                  backgroundColor: tokens.cardBg,
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                },
              ]}
            >
              <GlassSkeleton
                style={{ width: 56, height: 56, borderRadius: 14 }}
                tokens={tokens}
                isDark={isDark}
              />
              <View style={{ marginLeft: 14, flex: 1, gap: 6 }}>
                <GlassSkeleton
                  style={{ width: "60%", height: 16, borderRadius: 4 }}
                  tokens={tokens}
                  isDark={isDark}
                />
                <GlassSkeleton
                  style={{ width: "40%", height: 12, borderRadius: 4 }}
                  tokens={tokens}
                  isDark={isDark}
                />
              </View>
            </View>
          </View>

          {/* Grid Metric Cards Skeleton */}
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.glassCard,
                  styles.statBoxSize,
                  { borderColor: tokens.border },
                ]}
              >
                <View
                  style={[
                    styles.cardInner,
                    styles.statBoxInner,
                    { backgroundColor: tokens.cardBg },
                  ]}
                >
                  <GlassSkeleton
                    style={{ width: 28, height: 28, borderRadius: 8 }}
                    tokens={tokens}
                    isDark={isDark}
                  />
                  <GlassSkeleton
                    style={{ width: "50%", height: 16, borderRadius: 4 }}
                    tokens={tokens}
                    isDark={isDark}
                  />
                  <GlassSkeleton
                    style={{ width: "40%", height: 8, borderRadius: 2 }}
                    tokens={tokens}
                    isDark={isDark}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tokens.canvas }]}>
      {/* Floating Header Back Navigation */}
      <TouchableOpacity
        onPress={handleBack}
        style={[styles.backButton, { borderColor: tokens.border }]}
      >
        <BlurView
          intensity={isDark ? 30 : 60}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <ChevronLeft size={20} color={tokens.textMain} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Streamlined Compact Profile Card */}
        <View style={[styles.glassCard, { borderColor: tokens.border }]}>
          <BlurView
            intensity={isDark ? 20 : 50}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.cardInner,
              { backgroundColor: tokens.cardBg, padding: 14 },
            ]}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarWrapper}>
                <SafeImage
                  src={agent?.avatarUrl}
                  fallbackType="avatar"
                  style={styles.avatar}
                />
                {agent?.verificationStatus === "verified" && (
                  <View
                    style={[
                      styles.verifyBadge,
                      {
                        backgroundColor: tokens.accent,
                        borderColor: tokens.canvas,
                      },
                    ]}
                  >
                    <ShieldCheck size={10} color="white" />
                  </View>
                )}
              </View>

              <View style={styles.headerText}>
                <View style={styles.nameBadgeRow}>
                  <Text
                    style={[styles.agentName, { color: tokens.textMain }]}
                    numberOfLines={1}
                  >
                    {agent?.name || "Agent Name"}
                  </Text>
                  <View
                    style={[
                      styles.partnerBadge,
                      { backgroundColor: tokens.badgeBg },
                    ]}
                  >
                    <BadgeCheck size={9} color={tokens.accent} />
                    <Text
                      style={[styles.partnerText, { color: tokens.accent }]}
                    >
                      PARTNER
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <MapPin size={11} color={tokens.accent} />
                  <Text
                    style={[styles.locationText, { color: tokens.textSubtle }]}
                    numberOfLines={1}
                  >
                    {agent?.city || "Ibadan"}, Nigeria
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Dense 2x2 Metrics Grid */}
        <View style={styles.statsGrid}>
          <StatBox
            icon={<CheckCircle2 size={16} color={tokens.accent} />}
            value={stats.completedTxns}
            label="RENTALS"
            tokens={tokens}
            isDark={isDark}
          />
          <StatBox
            icon={<Zap size={16} color="#10b981" />}
            value={stats.successRate}
            label="SUCCESS"
            tokens={tokens}
            isDark={isDark}
          />
          <StatBox
            icon={<Clock size={16} color="#818cf8" />}
            value={stats.responseTime}
            label="RESPONSE"
            tokens={tokens}
            isDark={isDark}
          />
          <StatBox
            icon={<Building2 size={16} color="#fbbf24" />}
            value={stats.activeListingsCount}
            label="LISTINGS"
            tokens={tokens}
            isDark={isDark}
          />
        </View>

        {/* Section Tracks Header: Reviews */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tokens.textMain }]}>
            Verified Reviews
          </Text>
          {user?.role === "tenant" && (
            <TouchableOpacity
              onPress={() => setShowReviewModal(true)}
              style={[styles.reviewTrigger, { backgroundColor: tokens.accent }]}
            >
              <Star size={10} color="white" fill="white" />
              <Text style={styles.reviewTriggerText}>Review</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reviews Horizontal Row Track */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width * 0.72 + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <View
                key={review.id}
                style={[
                  styles.glassCard,
                  styles.reviewCardWidth,
                  { borderColor: tokens.border },
                ]}
              >
                <BlurView
                  intensity={isDark ? 20 : 50}
                  tint={isDark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.cardInner,
                    { backgroundColor: tokens.cardBg, padding: 12 },
                  ]}
                >
                  <View style={styles.reviewCardHeader}>
                    <Text
                      style={[styles.reviewerName, { color: tokens.textMain }]}
                      numberOfLines={1}
                    >
                      {review.tenantName}
                    </Text>
                    <View style={styles.starRow}>
                      <Star size={10} color="#fbbf24" fill="#fbbf24" />
                      <Text
                        style={[styles.ratingText, { color: tokens.textMain }]}
                      >
                        {review.rating.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.reviewComment, { color: tokens.textSubtle }]}
                    numberOfLines={2}
                  >
                    "{review.comment}"
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: tokens.textSubtle }]}>
              No verified reviews yet.
            </Text>
          )}
        </ScrollView>

        {/* Section Tracks Header: Alternate Properties */}
        <View style={[styles.sectionHeader, { marginTop: 22 }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textMain }]}>
            Other Listings
          </Text>
        </View>

        {agentListings.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20, paddingBottom: 10 }}
          >
            {agentListings.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={[
                  styles.glassCard,
                  styles.reviewCardWidth,
                  { borderColor: tokens.border },
                ]}
                onPress={() => {
                  setCurrentListing(l);
                  router.push("/app/listingdetails");
                }}
              >
                <BlurView
                  intensity={isDark ? 20 : 50}
                  tint={isDark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.cardInner,
                    { backgroundColor: tokens.cardBg, padding: 10 },
                  ]}
                >
                  <Image
                    source={{
                      uri: l.image || "https://via.placeholder.com/300",
                    }}
                    style={styles.listingThumbnailImage}
                  />
                  <Text
                    style={[
                      styles.listingTitleText,
                      { color: tokens.textMain },
                    ]}
                    numberOfLines={1}
                  >
                    {l.title}
                  </Text>
                  <Text
                    style={[styles.listingPriceText, { color: tokens.accent }]}
                  >
                    ₦{l.priceValue?.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: tokens.textSubtle }]}>
            No other listings from this agent.
          </Text>
        )}
      </ScrollView>

      {/* Glassmorphic Sheet Modal Layer */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={isDark ? 30 : 65}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: tokens.surfaceSolid,
                borderTopColor: tokens.border,
              },
            ]}
          >
            <View style={styles.modalIndicatorLine} />
            <Text style={[styles.modalTitle, { color: tokens.textMain }]}>
              Rate Agent
            </Text>

            <View style={styles.ratingStarsSelectionRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setNewReview({ ...newReview, rating: star })}
                  activeOpacity={0.7}
                >
                  <Star
                    size={26}
                    color="#fbbf24"
                    fill={star <= newReview.rating ? "#fbbf24" : "transparent"}
                    style={{ marginRight: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="Property Rented"
              placeholderTextColor={tokens.textSubtle}
              style={[
                styles.input,
                {
                  backgroundColor: tokens.cardBg,
                  borderColor: tokens.border,
                  color: tokens.textMain,
                },
              ]}
              value={newReview.listingTitle}
              onChangeText={(t) =>
                setNewReview({ ...newReview, listingTitle: t })
              }
            />

            <TextInput
              placeholder="Your Feedback"
              placeholderTextColor={tokens.textSubtle}
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: tokens.cardBg,
                  borderColor: tokens.border,
                  color: tokens.textMain,
                },
              ]}
              multiline
              value={newReview.comment}
              onChangeText={(t) => setNewReview({ ...newReview, comment: t })}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: tokens.border }]}
                onPress={() => setShowReviewModal(false)}
              >
                <Text
                  style={[styles.cancelBtnText, { color: tokens.textSubtle }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: tokens.accent }]}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.submitBtnText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const StatBox = ({ icon, value, label, tokens, isDark }) => (
  <View
    style={[
      styles.glassCard,
      styles.statBoxSize,
      { borderColor: tokens.border },
    ]}
  >
    <BlurView
      intensity={isDark ? 20 : 50}
      tint={isDark ? "dark" : "light"}
      style={StyleSheet.absoluteFill}
    />
    <View
      style={[
        styles.cardInner,
        styles.statBoxInner,
        { backgroundColor: tokens.cardBg },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: tokens.badgeBg }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: tokens.textMain }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: tokens.textSubtle }]}>
        {label}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  skeletonBase: { overflow: "hidden", borderWidth: 1 },
  backButton: {
    position: "absolute",
    top: 45,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 95, paddingBottom: 24 },

  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
    marginBottom: 12,
  },
  cardInner: { padding: 14, width: "100%" },

  profileHeader: { flexDirection: "row", alignItems: "center" },
  avatarWrapper: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 14 },
  verifyBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    padding: 3,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  headerText: { marginLeft: 12, flex: 1, justifyContent: "center" },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  agentName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4, flex: 1 },
  partnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partnerText: {
    fontSize: 7,
    fontWeight: "900",
    marginLeft: 2,
    letterSpacing: 0.2,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  locationText: { fontSize: 11, fontWeight: "600", marginLeft: 3 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statBoxSize: { width: "48%", height: 96, marginBottom: 12 },
  statBoxInner: {
    padding: 10,
    justifyContent: "space-between",
    height: "100%",
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  statLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reviewTrigger: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  reviewTriggerText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 3,
  },
  reviewCardWidth: { width: width * 0.72, marginRight: 12, marginBottom: 0 },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewerName: { fontSize: 12, fontWeight: "700" },
  starRow: { flexDirection: "row", alignItems: "center" },
  ratingText: { fontSize: 10, fontWeight: "800", marginLeft: 2 },
  reviewComment: { fontSize: 12, lineHeight: 16, fontStyle: "italic" },

  listingThumbnailImage: {
    width: "100%",
    height: 96,
    borderRadius: 12,
    resizeMode: "cover",
  },
  listingTitleText: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  listingPriceText: { marginTop: 1, fontSize: 12, fontWeight: "800" },
  emptyText: { fontSize: 12, fontWeight: "500", paddingVertical: 6 },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderWidth: 1,
  },
  modalIndicatorLine: {
    width: 36,
    height: 4,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.3)",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  ratingStarsSelectionRow: { flexDirection: "row", marginBottom: 14 },
  input: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
  },
  textArea: { height: 90, textAlignVertical: "top" },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

export default AgentProfile;
