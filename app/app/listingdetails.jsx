import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  Modal,
  Share,
  Linking,
  ActivityIndicator,
  PanResponder,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  BadgeCheck,
  Star,
  ShieldCheck,
  Share2,
  MessageCircleMore,
  Calendar,
  Flag,
  Bed,
  Bath,
  Maximize,
  Video,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import SafeImage from "../../components/safeimage";
import { useRouter } from "expo-router";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { storage } from "../../lib/firebase";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { Video as ExpoVideo } from "expo-av";
import ChatModal from "../../components/chatmodal";

const { width } = Dimensions.get("window");

const ListingDetailsMobile = ({ listing: listingProp, onBack }) => {
  const { user, favorites, toggleFavorite, currentListing, setCurrentListing } =
    useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [showChatModal, setShowChatModal] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const listing = listingProp || currentListing;
  const [activeMedia, setActiveMedia] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const isDark = theme === "dark";

  // Theme-aware color tokens
  const backgroundColor = isDark ? "#000" : "#fff";
  const textColor = isDark ? "#fff" : "#0f172a";
  const subTextColor = isDark ? "#9aa4b2" : "#64748b";
  const badgeBg = isDark ? "#042f1f" : "#ecfdf5";
  const badgeTextColor = isDark ? "#34d399" : "#047857";
  const cardBg = isDark ? "#071226" : "#fff";
  const borderColor = isDark ? "#0f172a" : "#f1f5f9";
  const footerBg = isDark ? "#071226" : "#fff";
  const tourBtnBg = isDark ? "#0b1220" : "#f1f5f9";
  const agentRowBg = isDark ? "#071226" : "#fff";
  const agentActionBg = isDark ? "#0b1220" : "#fff";
  const iconColor = isDark ? "#fff" : "#0f172a";
  const amenityTextColor = isDark ? "#d1d5db" : "#334155";

  const isVideoUri = (u) => {
    if (!u || typeof u !== "string") return false;
    const lower = u.toLowerCase();
    return (
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".webm") ||
      lower.includes("video")
    );
  };

  // Filter out any accidental video URIs from the carousel images
  const images = (
    listing.images && listing.images.length > 0
      ? listing.images
      : listing.image
        ? [listing.image]
        : []
  ).filter((i) => !isVideoUri(i));

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${listing.title} on DirectRent!`,
        url: "https://directrent.ng/listings/" + listing.id,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  const openMaps = () => {
    const destination = `${listing.location}, Nigeria`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    Linking.openURL(url);
  };

  // Open native maps app (Apple Maps on iOS, geo/Google Maps on Android).
  const openNativeMaps = () => {
    const label = listing.title || "Destination";
    // prefer coordinates if available
    const lat = listing?.lat || listing?.latitude || listing?.locationLat;
    const lng = listing?.lng || listing?.longitude || listing?.locationLng;

    if (lat && lng) {
      const latLng = `${lat},${lng}`;
      if (Platform.OS === "ios") {
        const url = `http://maps.apple.com/?q=${encodeURIComponent(label)}&ll=${latLng}`;
        Linking.openURL(url).catch((e) => {
          console.warn("Failed to open Apple Maps", e);
        });
      } else {
        const geoUrl = `geo:${latLng}?q=${latLng}(${encodeURIComponent(label)})`;
        Linking.openURL(geoUrl).catch(() => {
          // fallback to Google Maps web
          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latLng)}`;
          Linking.openURL(url).catch((e) =>
            console.warn("Failed to open maps", e),
          );
        });
      }
      return;
    }

    // Fallback to address query
    const destination =
      listing.location || listing.address || listing.title || "";
    const query = encodeURIComponent(destination + ", Nigeria");
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch((e) => console.warn("Failed to open maps", e));
  };

 const handleBack = () => {
  // 1. Reset state
  setCurrentListing(null);

  // 2. Priority: Custom onBack prop
  if (onBack) {
    onBack();
    return;
  }

  // 3. Navigation Logic
  if (router.canGoBack()) {
    router.back();
  } else {
    // Ensure this path matches your file structure inside the /app folder
    router.replace("/app/dashboard"); 
  }
};

  const openAgentProfile = () => {
    const agentId = listing?.agent?.id;
    if (!agentId) return;
    setCurrentListing(listing);
    router.push(`/app/agentprofile?agentId=${agentId}`);
  };

  // PanResponder to support edge-swipe back (left-edge swipe)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Do not capture on tap start so buttons remain tappable; capture only on move
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        const startX = evt?.nativeEvent?.pageX || 0;
        // Only start when gesture begins near the left edge and is a mostly-horizontal right swipe
        return startX < 30 && Math.abs(dx) > 20 && Math.abs(dy) < 25 && dx > 0;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        // If a quick right swipe from the edge, trigger back
        if (dx > 75 && vx > 0.08) {
          handleBack();
        }
      },
    }),
  ).current;

  if (!listing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor }]}
        {...panResponder.panHandlers}
      >
        <View style={{ padding: 20 }}>
          <Text style={{ fontWeight: "800", fontSize: 18, color: textColor }}>
            No listing selected
          </Text>
          <Text style={{ marginTop: 8, color: subTextColor }}>
            Select a property from the listings to view details.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }]}
      {...panResponder.panHandlers}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        
        <View style={styles.mediaContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveMedia(slide);
            }}
          >
            {images.map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={styles.bannerImage}
              />
            ))}
          </ScrollView>

          
          <View style={styles.headerOverlay}>
            <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
              <ArrowLeft color={iconColor} size={20} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
                <Share2 color={iconColor} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleFavorite(listing.id)}
                style={styles.iconButton}
              >
                <Flag
                  color={favorites.includes(listing.id) ? "#10b981" : iconColor}
                  size={18}
                />
              </TouchableOpacity>
            </View>
          </View>

          
          <View style={styles.pagination}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, activeMedia === i && styles.activeDot]}
              />
            ))}
          </View>
        </View>

        
        <View style={styles.content}>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>
              {listing.type}
            </Text>
          </View>

          <Text style={[styles.title, { color: textColor }]}>
            {listing.title}
          </Text>

          <TouchableOpacity onPress={openMaps} style={styles.locationContainer}>
            <MapPin size={16} color={"#10b981"} />
            <Text style={[styles.locationText, { color: subTextColor }]}>
              {listing.location}
            </Text>
          </TouchableOpacity>

          
          <TouchableOpacity
            onPress={openNativeMaps}
            style={[styles.directionButton, { backgroundColor: tourBtnBg }]}
          >
            <MapPin size={16} color={isDark ? "#fff" : "#0f172a"} />
            <Text
              style={[
                styles.directionText,
                { color: isDark ? "#fff" : "#0f172a" },
              ]}
            >
              Get Directions
            </Text>
          </TouchableOpacity>

          
          {listing.agent && (
            <View style={[styles.agentRow, { backgroundColor: agentRowBg }]}>
              <TouchableOpacity
                onPress={openAgentProfile}
                style={styles.agentTouch}
              >
                <View style={styles.agentLeft}>
                  <SafeImage
                    src={listing.agent.avatarUrl}
                    style={styles.agentAvatar}
                    fallbackType="avatar"
                  />
                  <View style={{ marginLeft: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={[styles.agentNameLarge, { color: textColor }]}
                      >
                        {listing.agent.name}
                      </Text>
                      {listing.agent.isVerified && (
                        <BadgeCheck size={14} color="#10b981" />
                      )}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
                      <Text
                        style={[styles.agentRating, { color: subTextColor }]}
                      >
                        {listing.agent.rating} RATING
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <View style={styles.agentActions}>
                <TouchableOpacity
                  style={[
                    styles.agentActionBtn,
                    { backgroundColor: agentActionBg },
                  ]}
                  onPress={() => {
                    // prepare and open chat modal
                    const convId =
                      user?.role === "tenant"
                        ? `${user.id}_${listing.agent?.id || "unknown"}_${listing.id}`
                        : `unknown_${user.id}_${listing.id}`;
                    setConversationId(convId);
                    setShowChatModal(true);
                  }}
                >
                  <MessageCircleMore size={16} color={iconColor} />
                  <Text style={[styles.agentActionText, { color: textColor }]}>
                    Message Agent
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.agentActionBtn,
                    styles.tourActionBtn,
                    { backgroundColor: tourBtnBg },
                  ]}
                  onPress={() => {
                    // quick tour request - replace with scheduling flow if needed
                    try {
                      setTimeout(() => {
                        // lightweight confirmation
                        (global?.alert || console.log)(
                          "Tour requested",
                          "We'll contact you to schedule the tour.",
                        );
                      }, 100);
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                >
                  <Calendar size={16} color={iconColor} />
                  <Text style={[styles.agentActionText, { color: textColor }]}>
                    Request Tour
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: textColor }]}>
              {listing.price}
            </Text>
            <Text style={[styles.priceSub, { color: subTextColor }]}>
              / year
            </Text>
          </View>

          
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <Bed size={20} color={subTextColor} />
              <Text style={[styles.featureLabel, { color: subTextColor }]}>
                {listing.beds} Beds
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Bath size={20} color={subTextColor} />
              <Text style={[styles.featureLabel, { color: subTextColor }]}>
                {listing.baths} Baths
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Maximize size={20} color={subTextColor} />
              <Text style={[styles.featureLabel, { color: subTextColor }]}>
                {listing.area}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: isDark ? "#15202b" : "#e2e8f0" },
            ]}
          />

          
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            About this space
          </Text>
          <Text style={[styles.description, { color: subTextColor }]}>
            {listing.description}
          </Text>

          
          <Text
            style={[styles.sectionTitle, { marginTop: 20, color: textColor }]}
          >
            Amenities
          </Text>
          <View style={styles.amenitiesGrid}>
            {listing.amenities.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.amenityBadge,
                  { backgroundColor: cardBg, borderColor },
                ]}
              >
                <BadgeCheck size={14} color="#10b981" />
                <Text style={[styles.amenityText, { color: amenityTextColor }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          
          {listing.video && (
            <View
              style={[
                styles.videoBox,
                { backgroundColor: isDark ? "#0b1220" : "#fff" },
              ]}
            >
              <Image
                source={{ uri: listing.image }}
                style={styles.videoThumbnail}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.videoPlayBtn}
                onPress={async () => {
                  setVideoLoading(true);
                  try {
                    // Try to fetch latest listing doc for canonical video field
                    const docRef = doc(db, "listings", listing.id.toString());
                    const snap = await getDoc(docRef);
                    let v = listing.video;
                    if (snap.exists()) {
                      const data = snap.data();
                      if (data.video) v = data.video;
                    }

                    // If the stored video is a storage path or does not look like an http url, try to resolve via storage
                    if (v && !v.startsWith("http")) {
                      try {
                        const sRef = storageRef(storage, v);
                        v = await getDownloadURL(sRef);
                      } catch (e) {
                        console.warn(
                          "failed to resolve storage download url",
                          e,
                        );
                      }
                    }

                    if (v) {
                      setVideoUrl(v);
                      setShowVideoModal(true);
                    } else {
                      console.warn(
                        "No playable video URL found for listing",
                        listing.id,
                      );
                    }
                  } catch (e) {
                    console.warn(e);
                  } finally {
                    setVideoLoading(false);
                  }
                }}
              >
                <Video color="#fff" size={28} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      
      <View
        style={[
          styles.footer,
          { backgroundColor: footerBg, borderTopColor: borderColor },
        ]}
      >
        <View style={{ flex: 1 }} />
      </View>

      
      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        listing={listing}
        currentUser={user}
        conversationId={conversationId}
      />

      
      <Modal
        visible={showVideoModal}
        animationType="slide"
        onRequestClose={() => setShowVideoModal(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: isDark ? "#000" : "#fff" }}
        >
          <View
            style={{
              padding: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity onPress={() => setShowVideoModal(false)}>
              <ArrowLeft color={isDark ? "#fff" : "#0f172a"} size={22} />
            </TouchableOpacity>
            <Text
              style={{ fontWeight: "800", color: isDark ? "#fff" : "#0f172a" }}
            >
              {listing.title}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            {videoLoading ? (
              <ActivityIndicator size="large" color="#10b981" />
            ) : videoUrl ? (
              <ExpoVideo
                source={{ uri: videoUrl }}
                style={{ width: "100%", height: 300 }}
                useNativeControls
                resizeMode="contain"
              />
            ) : (
              <View style={{ padding: 20 }}>
                <Text style={{ color: isDark ? "#fff" : "#0f172a" }}>
                  Unable to load video.
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  directionButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  directionText: { fontWeight: "800", fontSize: 14 },
  mediaContainer: { width: width, height: 300, position: "relative" },
  bannerImage: { width: width, height: 300, resizeMode: "cover" },
  headerOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 10,
    borderRadius: 25,
    backdropFilter: "blur(10px)", // Note: This doesn't work in standard RN, use BlurView
  },
  pagination: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    alignSelf: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  activeDot: { width: 18, backgroundColor: "#FFF" },
  content: { padding: 20 },
  badge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  badgeText: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  locationText: { color: "#64748b", fontWeight: "bold", fontSize: 14 },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 15,
  },
  price: { fontSize: 28, fontWeight: "900", color: "#08155cff" },
  priceSub: { color: "#94a3b8", marginLeft: 4, fontWeight: "bold" },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureLabel: { color: "#475569", fontWeight: "bold", fontSize: 13 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 25 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  description: { color: "#475569", lineHeight: 22, fontSize: 15 },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  amenityText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  footer: {
    padding: 20,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  tourButton: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tourButtonText: { fontWeight: "900", fontSize: 14, color: "#0f172a" },
  agentRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  agentTouch: { flexDirection: "row", alignItems: "center", flex: 1 },
  agentLeft: { flexDirection: "row", alignItems: "center" },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  agentNameLarge: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  agentRating: { fontSize: 12, fontWeight: "500", color: "#64748b" },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBox: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  videoThumbnail: { width: "100%", height: 200 },
  videoPlayBtn: { position: "absolute", top: "40%", left: "45%" },
  agentActions: { position: "relative", flex: 1, alignItems: "flex-end" },
  agentActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 8,
  },
  agentActionText: { marginLeft: 8, fontWeight: "800" },
  tourActionBtn: { backgroundColor: "#f3f4f6" },
});

export default ListingDetailsMobile;
