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
import * as Location from "expo-location";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { WebView } from "react-native-webview";

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
  const [isFavoritedLocal, setIsFavoritedLocal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapRef = useRef(null);
  const [is3D, setIs3D] = useState(false);
  const [mapViewType, setMapViewType] = useState("standard");
  const [showStreetModal, setShowStreetModal] = useState(false);
  // Provide your Google Maps JavaScript API key here or via environment/config.
  // To enable embedded interactive Street View set GOOGLE_MAPS_API_KEY to a valid key with Street View / Maps JS enabled.
  const GOOGLE_MAPS_API_KEY = ""; // <-- set your API key

  // We'll watch the user's location when the route modal is open and update originCoords in real-time.
  // Also animate the map camera with a 3D pitch and heading reflecting movement.
  useEffect(() => {
    let subscriber = null;
    let lastPos = null;

    const startWatch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted for live routing");
          return;
        }

        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (pos) => {
            const coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setOriginCoords(coords);

            // compute heading from last position if available
            if (lastPos) {
              const heading = computeBearing(lastPos, coords);
              // animate camera to follow user with pitch for 3D effect
              try {
                if (mapRef.current && mapRef.current.animateCamera) {
                  mapRef.current.animateCamera(
                    { center: coords, pitch: 60, heading, zoom: 16 },
                    { duration: 500 },
                  );
                } else if (mapRef.current && mapRef.current.animateToRegion) {
                  mapRef.current.animateToRegion(
                    { ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 },
                    500,
                  );
                }
              } catch (e) {
                // ignore
              }
            } else {
              // first update: set camera with pitch
              try {
                if (mapRef.current && mapRef.current.animateCamera) {
                  mapRef.current.animateCamera(
                    { center: coords, pitch: 60, heading: 0, zoom: 16 },
                    { duration: 500 },
                  );
                }
              } catch (e) {}
            }

            lastPos = coords;
          },
        );
      } catch (e) {
        console.warn("Failed to start location watch", e);
      }
    };

    if (showRouteModal) {
      startWatch();
    }

    return () => {
      if (subscriber) subscriber.remove();
      subscriber = null;
      lastPos = null;
    };
  }, [showRouteModal]);

  // Helper to compute bearing between two coords (in degrees)
  const computeBearing = (from, to) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const lat1 = toRad(from.latitude);
    const lon1 = toRad(from.longitude);
    const lat2 = toRad(to.latitude);
    const lon2 = toRad(to.longitude);

    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360;
  };

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
    listing && listing.images && listing.images.length > 0
      ? listing.images
      : listing && listing.image
        ? [listing.image]
        : []
  ).filter((i) => !isVideoUri(i));

  const handleShare = async () => {
    try {
      const url = `https://directrent.ng/listings/${listing.id}`;
      const message = `${listing.title}\n${listing.location || ""}\n${url}`;
      const result = await Share.share({ message, url });
      // Optionally show feedback
      if (result?.action === Share.sharedAction) {
        // shared
      }
    } catch (error) {
      console.error("Share failed", error);
      Alert.alert("Share Failed", "Unable to share listing.");
    }
  };

  const openMaps = () => {
    const destination = `${listing.location}, Nigeria`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    Linking.openURL(url);
  };

  // Open in-app DirectRent map and show a route from current location to listing destination
  const openNativeMaps = async () => {
    console.debug("[ListingDetails] openNativeMaps (fast-path)");

    // Reset coords and show the modal immediately so the UI feels responsive
    setDestCoords(null);
    setOriginCoords(null);
    setShowRouteModal(true);
    setRouteLoading(true);

    // Helper: run promise but resolve to null on timeout or errors
    const runWithTimeout = (promise, ms) => {
      return Promise.race([
        promise.catch(() => null),
        new Promise((res) => setTimeout(() => res(null), ms)),
      ]);
    };

    const address =
      (listing?.location || listing?.address || listing?.title || "") +
      ", Nigeria";
    const lat = listing?.lat || listing?.latitude || listing?.locationLat;
    const lng = listing?.lng || listing?.longitude || listing?.locationLng;

    // Destination: prefer listing coords, else try a short geocode, and fall back to a background geocode if that times out
    const destPromise =
      lat && lng
        ? Promise.resolve({ latitude: Number(lat), longitude: Number(lng) })
        : runWithTimeout(
            (async () => {
              try {
                const g = await Location.geocodeAsync(address);
                return g && g.length > 0
                  ? { latitude: g[0].latitude, longitude: g[0].longitude }
                  : null;
              } catch (e) {
                return null;
              }
            })(),
            3000,
          );

    // Origin: try a fast last-known / low-accuracy location first
    const originPromise = runWithTimeout(
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") return null;
          // low accuracy + short timeout to get a quick position
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            maximumAge: 10000,
            timeout: 2500,
          });
          return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        } catch (e) {
          return null;
        }
      })(),
      2500,
    );

    try {
      const [dest, origin] = await Promise.all([destPromise, originPromise]);

      if (dest) setDestCoords(dest);
      if (origin) setOriginCoords(origin);

      // If we don't have a destination yet, continue geocoding in background and update the map when available
      if (!dest && !(lat && lng)) {
        (async () => {
          try {
            const g = await Location.geocodeAsync(address);
            if (g && g.length > 0) {
              const resolved = {
                latitude: g[0].latitude,
                longitude: g[0].longitude,
              };
              setDestCoords(resolved);
              // ensure map recenters to destination when we get a more accurate dest
              try {
                if (mapRef.current && mapRef.current.animateToRegion) {
                  mapRef.current.animateToRegion(
                    { ...resolved, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                    500,
                  );
                }
              } catch (e) {}
            }
          } catch (e) {
            console.warn("background geocode failed", e);
          }
        })();
      }

      // If we have both points, animate the camera to the origin so users see immediate context
      if (dest && origin) {
        try {
          if (mapRef.current && mapRef.current.animateCamera) {
            mapRef.current.animateCamera(
              { center: origin, pitch: is3D ? 60 : 0, heading: 0, zoom: 16 },
              { duration: 300 },
            );
          } else if (mapRef.current && mapRef.current.animateToRegion) {
            mapRef.current.animateToRegion(
              { ...origin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
              500,
            );
          }
        } catch (e) {}
      } else if (!dest) {
        // Inform the user we'll update the destination when found but don't block the UI
        Alert.alert(
          "Location Unavailable",
          "Showing map; destination coordinates are not yet available. We will update when found.",
        );
      }
    } catch (e) {
      console.warn("openNativeMaps (fast-path) failed", e);
      Alert.alert(
        "Directions Error",
        "Unable to show in-app directions right now.",
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const handleBack = () => {
    // Close any open modals first
    try {
      if (showRouteModal) setShowRouteModal(false);
      if (showVideoModal) setShowVideoModal(false);
      if (showStreetModal) setShowStreetModal(false);
      if (showChatModal) setShowChatModal(false);
    } catch (e) {}

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

  useEffect(() => {
    try {
      setIsFavoritedLocal(
        !!(listing && favorites && favorites.includes(listing.id)),
      );
    } catch (e) {
      setIsFavoritedLocal(false);
    }
  }, [listing, favorites]);

  const handleToggleFavorite = async () => {
    if (!listing) return;
    const prev = isFavoritedLocal;
    setIsFavoritedLocal(!prev);
    try {
      await toggleFavorite(listing.id);
    } catch (err) {
      console.warn("toggleFavorite failed", err);
      setIsFavoritedLocal(prev); // revert
      Alert.alert("Error", "Unable to update favorites.");
    }
  };

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
                onPress={handleToggleFavorite}
                style={[
                  styles.iconButton,
                  isFavoritedLocal && {
                    backgroundColor: "rgba(16,185,129,0.12)",
                  },
                ]}
              >
                <Flag
                  color={isFavoritedLocal ? "#10b981" : iconColor}
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
              paddingTop: Platform.OS === "ios" ? 44 : 20,
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

      {/* In-app Route Modal */}
      <Modal
        visible={showRouteModal}
        animationType="slide"
        onRequestClose={() => setShowRouteModal(false)}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                paddingTop: 28,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowRouteModal(false)}
                style={{ padding: 8 }}
              >
                <ArrowLeft color={iconColor} size={22} />
              </TouchableOpacity>
              <Text style={{ fontWeight: "800", color: textColor }}>
                {listing.title || "Route"}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <TouchableOpacity
                  onPress={() => {
                    // toggle between standard and satellite for clearer 3D feel
                    setIs3D((v) => !v);
                    setMapViewType((t) =>
                      t === "standard" ? "satellite" : "standard",
                    );
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: is3D ? "#0f172a" : "#f1f5f9",
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color: is3D ? "#fff" : "#0f172a",
                      fontWeight: "700",
                    }}
                  >
                    {is3D ? "3D" : "2D"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    // open street view (embedded if API key provided, else open external Maps)
                    if (!destCoords) {
                      Alert.alert(
                        "No Destination",
                        "Unable to show Street View because listing coordinates are not available.",
                      );
                      return;
                    }
                    if (
                      GOOGLE_MAPS_API_KEY &&
                      GOOGLE_MAPS_API_KEY.trim().length > 0
                    ) {
                      setShowStreetModal(true);
                    } else {
                      const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${destCoords.latitude},${destCoords.longitude}`;
                      Linking.openURL(url).catch((e) =>
                        console.warn("Failed to open external Street View", e),
                      );
                    }
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: "#f1f5f9",
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#0f172a", fontWeight: "700" }}>
                    Street
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {routeLoading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#10b981" />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <MapView
                  ref={mapRef}
                  style={{ flex: 1 }}
                  provider={PROVIDER_GOOGLE}
                  mapType={mapViewType}
                  pitchEnabled={true}
                  rotateEnabled={true}
                  showsBuildings={true}
                  initialRegion={
                    destCoords
                      ? {
                          latitude: destCoords.latitude,
                          longitude: destCoords.longitude,
                          latitudeDelta: 0.05,
                          longitudeDelta: 0.05,
                        }
                      : originCoords
                        ? {
                            latitude: originCoords.latitude,
                            longitude: originCoords.longitude,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                          }
                        : {
                            latitude: 6.5244,
                            longitude: 3.3792,
                            latitudeDelta: 0.5,
                            longitudeDelta: 0.5,
                          }
                  }
                >
                  {originCoords && (
                    <Marker coordinate={originCoords} title="You" />
                  )}
                  {destCoords && (
                    <Marker
                      coordinate={destCoords}
                      title={listing.title || "Destination"}
                    />
                  )}
                  {originCoords && destCoords && (
                    <Polyline
                      coordinates={[originCoords, destCoords]}
                      strokeColor="#10b981"
                      strokeWidth={4}
                    />
                  )}
                </MapView>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Street View Modal (embedded) */}
      <Modal
        visible={showStreetModal}
        animationType="slide"
        onRequestClose={() => setShowStreetModal(false)}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowStreetModal(false)}
              style={{ padding: 8 }}
            >
              <ArrowLeft color={iconColor} size={22} />
            </TouchableOpacity>
            <Text style={{ fontWeight: "800", color: textColor }}>
              Street View
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {destCoords ? (
            GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim().length > 0 ? (
              <WebView
                originWhitelist={["*"]}
                source={{
                  html: `<!doctype html><html><head><meta name="viewport" content="initial-scale=1.0, user-scalable=no" /><style>html,body,#panorama{height:100%;margin:0;padding:0;}</style></head><body><div id="panorama"></div><script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}"></script><script>function init(){var pano = new google.maps.StreetViewPanorama(document.getElementById('panorama'),{position:{lat:${destCoords.latitude},lng:${destCoords.longitude}},pov:{heading:270, pitch:0},visible:true});}window.onload=init;</script></body></html>`,
                }}
                style={{ flex: 1 }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 20,
                }}
              >
                <Text style={{ marginBottom: 12, color: textColor }}>
                  No Google Maps API key configured for embedded Street View.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${destCoords.latitude},${destCoords.longitude}`;
                    Linking.openURL(url).catch((e) =>
                      console.warn("Failed to open external Street View", e),
                    );
                  }}
                  style={{
                    backgroundColor: "#1e3a8a",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>
                    Open in Google Maps
                  </Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: textColor }}>
                Destination coordinates unavailable.
              </Text>
            </View>
          )}
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
