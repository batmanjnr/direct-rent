import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import {
  MapPin,
  Bookmark,
  ArrowUpRight,
  Star,
  BadgeCheck,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import ConfirmationModal from "./ui/ConfirmationModal";
import { useTheme } from "../context/ThemeContext";
import VerificationBadge from "./verificationbadge";

const { width } = Dimensions.get("window");

const ListingCard = ({
  listing,
  onViewDetails,
  onEdit,
  onDelete,
  hideHeart,
  hideAgent,
  isAgentView,
}) => {
  const { user, favorites = [], toggleFavorite } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Theme tokens used within this component to ensure consistent light/dark colors
  const tokens = isDark
    ? {
        cardBg: "#0b1220",
        border: "#1e293b",
        title: "#ffffff",
        subtitle: "#94a3b8",
        amenityBg: "#071026",
        amenityBorder: "#111827",
        detailsBtnBg: "#0b1220",
        favBtnBg: "rgba(15,23,42,0.3)",
        priceBadgeBg: "#0f172a",
        priceText: "#fff",
        avatarBg: "#0b1220",
      }
    : {
        cardBg: "#ffffff",
        border: "#f1f5f9",
        title: "#0f172a",
        subtitle: "#64748b",
        amenityBg: "#f8fafc",
        amenityBorder: "#f1f5f9",
        detailsBtnBg: "#f8fafc",
        favBtnBg: "rgba(255,255,255,0.3)",
        priceBadgeBg: "#eef2ff",
        priceText: "#4f46e5",
        avatarBg: "#f1f5f9",
      };

  const colors = {
    cardBg: tokens.cardBg,
    border: tokens.border,
    title: tokens.title,
    subtitle: tokens.subtitle,
    amenityBg: tokens.amenityBg,
    amenityBorder: tokens.amenityBorder,
    detailsBtnBg: tokens.detailsBtnBg,
    favBtnBg: tokens.favBtnBg,
    priceBadgeBg: tokens.priceBadgeBg,
    priceText: tokens.priceText,
  };

  // Restore isAgent flag used in rendering logic
  const isAgent = user?.role === "agent";

  // Favorite state
  const isFav = Array.isArray(favorites) && favorites.includes(listing.id);

  // Badge Logic[cite: 4]
  const renderBadges = () => {
    const isApproved =
      listing.isApproved === true || listing.isApproved === undefined;
    const isRecent =
      listing.isRecentlyAdded ||
      (listing.createdAt &&
        Date.now() - listing.createdAt.seconds * 1000 < 24 * 60 * 60 * 1000);

    return (
      <View style={styles.badgeContainer}>
        {isApproved && isRecent && (
          <View style={[styles.badge, { backgroundColor: "#10b981" }]}>
            <Text style={styles.badgeText}>JUST ADDED</Text>
          </View>
        )}

        {user?.id &&
          String(listing.agent?.id) === String(user.id) &&
          listing.isApproved === false && (
            <View style={[styles.badge, { backgroundColor: "#f59e0b" }]}>
              <Text style={styles.badgeText}>PENDING VERIFICATION</Text>
            </View>
          )}

        {listing.slotsLeft && (
          <View style={[styles.badge, { backgroundColor: "#f43f5e" }]}>
            <Text style={styles.badgeText}>ONLY {listing.slotsLeft} LEFT</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animatable.View
      animation="fadeInUp"
      duration={600}
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={onViewDetails}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.image }}
            style={styles.image}
            resizeMode="cover"
          />

          {renderBadges()}

          {!hideHeart && !isAgentView && !isAgent && (
            <TouchableOpacity
              onPress={() => toggleFavorite(listing.id)}
              style={[
                styles.favBtn,
                { backgroundColor: colors.favBtnBg },
                isFav && styles.favBtnActive,
              ]}
            >
              <Bookmark
                size={16}
                color={isFav ? "#4f46e5" : "#fff"}
                fill={isFav ? "#4f46e5" : "transparent"}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, { color: colors.title }]}
              numberOfLines={1}
            >
              {listing.title}
            </Text>
            <View style={styles.priceBadge}>
              <Text style={[styles.priceText, { color: colors.priceText }]}>
                {listing.price}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={14} color="#4f46e5" />
            <Text style={[styles.locationText, { color: colors.subtitle }]}>
              {listing.location}
            </Text>
          </View>

          {listing.landmark && (
            <Text style={[styles.landmarkText, { color: colors.subtitle }]}>
              {listing.landmark}
            </Text>
          )}

          <View style={styles.amenitiesRow}>
            {listing.amenities?.slice(0, 3).map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.amenityBadge,
                  {
                    backgroundColor: colors.amenityBg,
                    borderColor: colors.amenityBorder,
                  },
                ]}
              >
                <Text style={styles.amenityText}>{item}</Text>
              </View>
            ))}
          </View>

          {!hideAgent && !isAgentView && listing.agent && (
            <View style={styles.agentContainer}>
              <View style={styles.agentInfo}>
                <View
                  style={[styles.avatar, { backgroundColor: colors.avatarBg }]}
                >
                  {listing.agent.avatarUrl ? (
                    <Image
                      source={{ uri: listing.agent.avatarUrl }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text
                      style={[styles.avatarInitial, { color: colors.subtitle }]}
                    >
                      {listing.agent.name?.charAt(0)}
                    </Text>
                  )}
                </View>
                <View>
                  <View style={styles.agentNameRow}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          `/app/agentprofile?agentId=${listing.agent.id}`,
                        )
                      }
                    >
                      <Text style={[styles.agentName, { color: colors.title }]}>
                        {listing.agent.name}
                      </Text>
                    </TouchableOpacity>
                    {listing.agent.isVerified ? (
                      <VerificationBadge
                        level={"verified"}
                        showText={false}
                        style={{ marginLeft: 6 }}
                      />
                    ) : null}
                  </View>
                  <View style={styles.ratingRow}>
                    <Star size={10} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>
                      {listing.agent.rating} RATING
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            {listing.verified && !isAgentView && (
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: isDark ? "#052e1f" : "#ecfdf5" },
                ]}
              >
                <ShieldCheck size={14} color={isDark ? "#34d399" : "#059669"} />
                <Text
                  style={[
                    styles.verifiedText,
                    { color: isDark ? "#34d399" : "#059669" },
                  ]}
                >
                  VERIFIED
                </Text>
              </View>
            )}

            {isAgentView ? (
              <View style={styles.actionGroup}>
                <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => setShowDeleteModal(true)}
                >
                  <Text style={styles.deleteBtnText}>DELETE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.detailsBtn,
                  { backgroundColor: colors.detailsBtnBg },
                ]}
                onPress={onViewDetails}
              >
                <Text
                  style={[
                    styles.detailsBtnText,
                    { color: isDark ? "#4f46e5" : "#4f46e5" },
                  ]}
                >
                  VIEW DETAILS
                </Text>
                <ArrowUpRight size={14} color="#4f46e5" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete?.();
        }}
        title="Delete Listing"
        message="Are you sure you want to delete this property?"
      />
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  imageContainer: { height: 200, width: "100%", position: "relative" },
  image: { width: "100%", height: "100%" },
  badgeContainer: { position: "absolute", top: 12, left: 12, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  favBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 8,
    borderRadius: 20,
    backdropFilter: "blur(10px)",
  },
  favBtnActive: { backgroundColor: "#eef2ff" },
  content: { padding: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    flex: 1,
    textTransform: "uppercase",
  },
  priceBadge: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: { color: "#4f46e5", fontWeight: "bold", fontSize: 13 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  landmarkText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 18,
    marginBottom: 12,
  },
  amenitiesRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  amenityBadge: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  amenityText: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  agentContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
    paddingTop: 12,
    marginBottom: 16,
  },
  agentInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontWeight: "bold", color: "#64748b" },
  agentNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  agentName: { fontSize: 12, fontWeight: "bold", color: "#334155" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 8, color: "#f59e0b", fontWeight: "800" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
  },
  verifiedText: { color: "#059669", fontSize: 10, fontWeight: "800" },
  detailsBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#f8fafc",
    borderSize: 1,
    borderColor: "#eef2ff",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  detailsBtnText: { color: "#4f46e5", fontWeight: "bold", fontSize: 11 },
  actionGroup: { flex: 1, flexDirection: "row", gap: 8 },
  editBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontWeight: "bold", fontSize: 11 },
  deleteBtn: {
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffe4e6",
  },
  deleteBtnText: { color: "#e11d48", fontWeight: "bold", fontSize: 11 },
});

export default ListingCard;
