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
  Alert,
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
  Home,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import SafeImage from "../../components/safeimage";
import { useRouter } from "expo-router";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { storage } from "../../lib/firebase";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { Video as ExpoVideo } from "expo-av";
import ChatModal from "../../components/chatmodal";
import * as Location from "expo-location";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { WebView } from "react-native-webview";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");

const ListingDetailsMobile = ({ listing: listingProp, onBack }) => {
  const { user, favorites, toggleFavorite, currentListing, setCurrentListing } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const listing = listingProp || currentListing;
  const [activeMedia, setActiveMedia] = useState(0);
  const [isFavoritedLocal, setIsFavoritedLocal] = useState(false);
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
  
  const GOOGLE_MAPS_API_KEY = ""; // <-- Set your API Key here if needed

  const isDark = theme === "dark";

  // Premium High-Contrast Glass Color System
  const tokens = isDark
    ? {
        canvas: "#0a0e1a", // Deep obsidian void base
        cardBg: "rgba(30, 41, 59, 0.25)", // Perfectly dark translucent plate
        textMain: "#ffffff",
        textSubtle: "#94a3b8",
        border: "rgba(255, 255, 255, 0.08)", // Crisp glass stringer rim
        badgeBg: "rgba(59, 130, 246, 0.15)", // Dynamic Blue backing
        accent: "#3b82f6", // DirectRent Identity Blue
        surfaceSolid: "#111827",
      }
    : {
        canvas: "#f1f5f9",
        cardBg: "rgba(255, 255, 255, 0.45)", // Lighter frosted crystal sheet
        textMain: "#0f172a",
        textSubtle: "#475569",
        border: "rgba(15, 23, 42, 0.06)",
        badgeBg: "rgba(37, 99, 235, 0.08)",
        accent: "#2563eb",
        surfaceSolid: "#ffffff",
      };

  useEffect(() => {
    let subscriber = null;
    let lastPos = null;

    const startWatch = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

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

            if (lastPos) {
              const heading = computeBearing(lastPos, coords);
              try {
                if (mapRef.current && mapRef.current.animateCamera) {
                  mapRef.current.animateCamera(
                    { center: coords, pitch: 60, heading, zoom: 16 },
                    { duration: 500 },
                  );
                }
              } catch (e) {}
            }
            lastPos = coords;
          },
        );
      } catch (e) {}
    };

    if (showRouteModal) startWatch();
    return () => {
      if (subscriber) subscriber.remove();
    };
  }, [showRouteModal]);

  const computeBearing = (from, to) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const lat1 = toRad(from.latitude);
    const lon1 = toRad(from.longitude);
    const lat2 = toRad(to.latitude);
    const lon2 = toRad(to.longitude);
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const isVideoUri = (u) => {
    if (!u || typeof u !== "string") return false;
    const lower = u.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm") || lower.includes("video");
  };

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
      await Share.share({ message, url });
    } catch (error) {
      Alert.alert("Share Failed", "Unable to share listing.");
    }
  };

  const openMaps = () => {
    const destination = `${listing.location}, Nigeria`;
    Linking.openURL(`http://maps.google.com/?q=${encodeURIComponent(destination)}`);
  };

  const openNativeMaps = async () => {
    setDestCoords(null);
    setOriginCoords(null);
    setShowRouteModal(true);
    setRouteLoading(true);

    const runWithTimeout = (promise, ms) => {
      return Promise.race([promise.catch(() => null), new Promise((res) => setTimeout(() => res(null), ms))]);
    };

    const address = (listing?.location || listing?.address || listing?.title || "") + ", Nigeria";
    const lat = listing?.lat || listing?.latitude || listing?.locationLat;
    const lng = listing?.lng || listing?.longitude || listing?.locationLng;

    const destPromise = lat && lng
      ? Promise.resolve({ latitude: Number(lat), longitude: Number(lng) })
      : runWithTimeout((async () => {
          const g = await Location.geocodeAsync(address);
          return g && g.length > 0 ? { latitude: g[0].latitude, longitude: g[0].longitude } : null;
        })(), 3000);

    const originPromise = runWithTimeout((async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return null;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 2500 });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      })(), 2500);

    try {
      const [dest, origin] = await Promise.all([destPromise, originPromise]);
      if (dest) setDestCoords(dest);
      if (origin) setOriginCoords(origin);

      if (dest && origin && mapRef.current) {
        mapRef.current.animateCamera({ center: origin, pitch: is3D ? 60 : 0, heading: 0, zoom: 15 }, { duration: 300 });
      }
    } catch (e) {
      Alert.alert("Directions Error", "Unable to show in-app directions right now.");
    } finally {
      setRouteLoading(false);
    }
  };

  const handleBack = () => {
    try {
      if (showRouteModal) setShowRouteModal(false);
      if (showVideoModal) setShowVideoModal(false);
      if (showStreetModal) setShowStreetModal(false);
      if (showChatModal) setShowChatModal(false);
    } catch (e) {}

    setCurrentListing(null);
    if (onBack) { onBack(); return; }
    if (router.canGoBack()) { router.back(); } else { router.replace("/app/dashboard"); }
  };

  const openAgentProfile = () => {
    const agentId = listing?.agent?.id;
    if (!agentId) return;
    setCurrentListing(listing);
    router.push(`/app/agentprofile?agentId=${agentId}`);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return (evt?.nativeEvent?.pageX || 0) < 30 && Math.abs(dx) > 20 && Math.abs(dy) < 25 && dx > 0;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 75 && gestureState.vx > 0.08) handleBack();
      },
    })
  ).current;

  useEffect(() => {
    setIsFavoritedLocal(!!(listing && favorites && favorites.includes(listing.id)));
  }, [listing, favorites]);

  const handleToggleFavorite = async () => {
    if (!listing) return;
    const prev = isFavoritedLocal;
    setIsFavoritedLocal(!prev);
    try {
      await toggleFavorite(listing.id);
    } catch (err) {
      setIsFavoritedLocal(prev);
      Alert.alert("Error", "Unable to update favorites.");
    }
  };

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: tokens.canvas }]} {...panResponder.panHandlers}>
        <View style={{ padding: 24 }}>
          <Text style={[styles.title, { color: tokens.textMain }]}>No listing selected</Text>
          <Text style={{ marginTop: 8, color: tokens.textSubtle }}>Select a property to view details.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tokens.canvas }]} {...panResponder.panHandlers}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Media Window Container */}
        <View style={styles.mediaContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              setActiveMedia(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
          >
            {images.map((img, index) => (
              <Image key={index} source={{ uri: img }} style={styles.bannerImage} />
            ))}
          </ScrollView>

          {/* Floating Glass Controls */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity onPress={handleBack} style={styles.glassIconButton}>
              <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
              <ArrowLeft color={tokens.textMain} size={20} />
            </TouchableOpacity>
            
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handleShare} style={styles.glassIconButton}>
                <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                <Share2 color={tokens.textMain} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToggleFavorite} style={styles.glassIconButton}>
                <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                <Flag color={isFavoritedLocal ? "#ef4444" : tokens.textMain} fill={isFavoritedLocal ? "#ef4444" : "transparent"} size={18} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Micro dots indicator */}
          <View style={styles.pagination}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, activeMedia === i && styles.activeDot, activeMedia === i && { backgroundColor: tokens.accent }]} />
            ))}
          </View>
        </View>

        {/* Dynamic Details Area */}
        <View style={styles.content}>
          <View style={[styles.badge, { backgroundColor: tokens.badgeBg, borderColor: tokens.border }]}>
            <Text style={[styles.badgeText, { color: tokens.accent }]}>{listing.type}</Text>
          </View>

          <Text style={[styles.title, { color: tokens.textMain }]}>{listing.title}</Text>

          <TouchableOpacity onPress={openMaps} style={styles.locationContainer}>
            <MapPin size={15} color={tokens.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.locationText, { color: tokens.textSubtle }]}>{listing.location}</Text>
          </TouchableOpacity>

          {/* Structural Action Tray */}
          <TouchableOpacity onPress={openNativeMaps} style={[styles.glassCard, styles.directionRow]}>
            <View style={[styles.directionIconBox, { backgroundColor: tokens.badgeBg }]}>
              <MapPin size={18} color={tokens.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: tokens.textMain }]}>Live Spatial Navigation</Text>
              <Text style={{ color: tokens.textSubtle, fontSize: 11, fontWeight: "500" }}>Get real-time directions inside map canvas</Text>
            </View>
          </TouchableOpacity>

          {/* Agent Plate Card */}
          {listing.agent && (
            <View style={styles.glassCard}>
              <TouchableOpacity onPress={openAgentProfile} style={styles.agentTouch}>
                <SafeImage src={listing.agent.avatarUrl} style={styles.agentAvatar} fallbackType="avatar" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.agentNameLarge, { color: tokens.textMain }]}>{listing.agent.name}</Text>
                    {listing.agent.isVerified && <BadgeCheck size={15} color={tokens.accent} />}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Star size={11} color="#f59e0b" fill="#f59e0b" />
                    <Text style={[styles.agentRating, { color: tokens.textSubtle }]}>{listing.agent.rating} VERIFIED AGENT</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.agentActionGrid}>
                <TouchableOpacity
                  style={[styles.actionGridButton, { borderColor: tokens.border }]}
                  onPress={() => {
                    const convId = user?.role === "tenant"
                      ? `${user.id}_${listing.agent?.id || "unknown"}_${listing.id}`
                      : `unknown_${user.id}_${listing.id}`;
                    setConversationId(convId);
                    setShowChatModal(true);
                  }}
                >
                  <MessageCircleMore size={16} color={tokens.accent} />
                  <Text style={[styles.actionGridButtonText, { color: tokens.textMain }]}>Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionGridButton, { borderColor: tokens.border }]}
                  onPress={() => {
                    try {
                      setTimeout(() => {
                        Alert.alert("Tour Requested", "We'll contact you to schedule the tour.");
                      }, 100);
                    } catch (e) {}
                  }}
                >
                  <Calendar size={16} color={tokens.textSubtle} />
                  <Text style={[styles.actionGridButtonText, { color: tokens.textMain }]}>Request Tour</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Financial Value Summary */}
          <View style={[styles.glassCard, styles.financialCard]}>
            <View>
              <Text style={[styles.price, { color: tokens.textMain }]}>{listing.price}</Text>
              <Text style={[styles.priceSub, { color: tokens.textSubtle }]}>Total Platform Cost / year</Text>
            </View>
            <View style={[styles.secureShield, { backgroundColor: tokens.badgeBg }]}>
              <ShieldCheck size={16} color={tokens.accent} />
              <Text style={[styles.secureText, { color: tokens.accent }]}>Secured</Text>
            </View>
          </View>

          {/* Micro Grid Spec Metrics */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}>
              <Bed size={18} color={tokens.accent} />
              <Text style={[styles.metricValue, { color: tokens.textMain }]}>{listing.beds} Beds</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}>
              <Bath size={18} color={tokens.accent} />
              <Text style={[styles.metricValue, { color: tokens.textMain }]}>{listing.baths} Baths</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}>
              <Maximize size={17} color={tokens.accent} />
              <Text style={[styles.metricValue, { color: tokens.textMain }]} numberOfLines={1}>{listing.area}</Text>
            </View>
          </View>

          {/* Typography Copy Blocks */}
          <Text style={[styles.sectionTitle, { color: tokens.textMain }]}>About this space</Text>
          <Text style={[styles.description, { color: tokens.textSubtle }]}>{listing.description}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 28, color: tokens.textMain }]}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {listing.amenities.map((item, i) => (
              <View key={i} style={[styles.amenityBadge, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}>
                <Home size={12} color={tokens.accent} />
                <Text style={[styles.amenityText, { color: tokens.textMain }]}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Rich Multimedia Component Box */}
          {listing.video && (
            <View style={[styles.videoBox, { borderColor: tokens.border }]}>
              <Image source={{ uri: listing.image }} style={styles.videoThumbnail} resizeMode="cover" />
              <BlurView intensity={isDark ? 20 : 40} tint="dark" style={styles.playOverlay}>
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: tokens.accent }]}
                  onPress={async () => {
                    setVideoLoading(true);
                    try {
                      const docRef = doc(db, "listings", listing.id.toString());
                      const snap = await getDoc(docRef);
                      let v = listing.video;
                      if (snap && snap.exists() && snap.data().video) v = snap.data().video;

                      if (v && !v.startsWith("http")) {
                        const sRef = storageRef(storage, v);
                        v = await getDownloadURL(sRef);
                      }

                      if (v) { setVideoUrl(v); setShowVideoModal(true); }
                    } catch (e) {
                      console.warn(e);
                    } finally { setVideoLoading(false); }
                  }}
                >
                  <Video color="#fff" size={24} />
                </TouchableOpacity>
              </BlurView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Persistent Chat Layout Controller */}
      <ChatModal isOpen={showChatModal} onClose={() => setShowChatModal(false)} listing={listing} currentUser={user} conversationId={conversationId} />

      {/* Video Overlay View Canvas */}
      <Modal visible={showVideoModal} animationType="slide" onRequestClose={() => setShowVideoModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.canvas }}>
          <View style={styles.modalHeaderTray}>
            <TouchableOpacity onPress={() => setShowVideoModal(false)} style={styles.modalBackBtn}>
              <ArrowLeft color={tokens.textMain} size={22} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: tokens.textMain }]} numberOfLines={1}>{listing.title}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.modalCenteredContent}>
            {videoLoading ? (
              <ActivityIndicator size="large" color={tokens.accent} />
            ) : videoUrl ? (
              <ExpoVideo source={{ uri: videoUrl }} style={styles.fullscreenVideoElement} useNativeControls resizeMode="contain" />
            ) : (
              <Text style={{ color: tokens.textSubtle }}>Unable to build video streaming track.</Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Spatial Maps Router Overlay */}
      <Modal visible={showRouteModal} animationType="slide" onRequestClose={() => setShowRouteModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.canvas }}>
          <View style={styles.modalHeaderTray}>
            <TouchableOpacity onPress={() => setShowRouteModal(false)} style={styles.modalBackBtn}>
              <ArrowLeft color={tokens.textMain} size={22} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: tokens.textMain }]} numberOfLines={1}>{listing.title || "Route View"}</Text>
            
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setIs3D(!is3D); setMapViewType(mapViewType === "standard" ? "satellite" : "standard"); }}
                style={[styles.mapToggleBtn, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}
              >
                <Text style={{ color: tokens.textMain, fontWeight: "700", fontSize: 12 }}>{is3D ? "3D" : "2D"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!destCoords) return;
                  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim().length > 0) {
                    setShowStreetModal(true);
                  } else {
                    Linking.openURL(`http://maps.google.com/?cbll=${destCoords.latitude},${destCoords.longitude}&cbp=12,20,0,0,-15&layer=c`);
                  }
                }}
                style={[styles.mapToggleBtn, { backgroundColor: tokens.cardBg, borderColor: tokens.border }]}
              >
                <Text style={{ color: tokens.textMain, fontWeight: "700", fontSize: 12 }}>Street</Text>
              </TouchableOpacity>
            </View>
          </View>

          {routeLoading ? (
            <View style={styles.modalCenteredContent}>
              <ActivityIndicator size="large" color={tokens.accent} />
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              mapType={mapViewType}
              pitchEnabled
              rotateEnabled
              showsBuildings
              initialRegion={destCoords ? { ...destCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 } : { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
            >
              {originCoords && <Marker coordinate={originCoords} title="Your Location" />}
              {destCoords && <Marker coordinate={destCoords} title={listing.title} />}
              {originCoords && destCoords && <Polyline coordinates={[originCoords, destCoords]} strokeColor={tokens.accent} strokeWidth={4} />}
            </MapView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Street View Track Window */}
      <Modal visible={showStreetModal} animationType="slide" onRequestClose={() => setShowStreetModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.canvas }}>
          <View style={styles.modalHeaderTray}>
            <TouchableOpacity onPress={() => setShowStreetModal(false)} style={styles.modalBackBtn}>
              <ArrowLeft color={tokens.textMain} size={22} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: tokens.textMain }]}>Street Panoramas</Text>
            <View style={{ width: 42 }} />
          </View>
          {destCoords && (
            <WebView
              originWhitelist={["*"]}
              source={{
                html: `<!doctype html><html><head><meta name="viewport" content="initial-scale=1.0, user-scalable=no" /><style>html,body,#panorama{height:100%;margin:0;padding:0;}</style></head><body><div id="panorama"></div><script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}"></script><script>function init(){new google.maps.StreetViewPanorama(document.getElementById('panorama'),{position:{lat:${destCoords.latitude},lng:${destCoords.longitude}},visible:true});}window.onload=init;</script></body></html>`,
              }}
              style={{ flex: 1 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mediaContainer: { width: width, height: 320, position: "relative" },
  bannerImage: { width: width, height: 320, resizeMode: "cover" },
  headerOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  glassIconButton: {
    width: 40,
    height: 40,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pagination: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    alignSelf: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  activeDot: { width: 16 },
  content: { padding: 20 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, lineHeight: 30 },
  locationContainer: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 16 },
  locationText: { fontSize: 13, fontWeight: "600" },
  
  // Glassmorphic universal card specifications
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.03)", // Ultra translucent fall-through layer
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    marginBottom: 14,
  },
  directionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  directionIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14, fontWeight: "700" },
  
  // Agent card adjustments
  agentTouch: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  agentAvatar: { width: 44, height: 44, borderRadius: 100, marginRight: 12 },
  agentNameLarge: { fontSize: 15, fontWeight: "700" },
  agentRating: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  agentActionGrid: { flexDirection: "row", gap: 10 },
  actionGridButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionGridButtonText: { fontSize: 13, fontWeight: "700" },

  // Financial row adjustments
  financialCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  priceSub: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  secureShield: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, gap: 4 },
  secureText: { fontSize: 11, fontWeight: "800" },

  // Metrics configurations
  metricsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 24 },
  metricCard: { flex: 1, height: 68, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  metricValue: { fontSize: 12, fontWeight: "700" },

  // Base typography blocks
  sectionTitle: { fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 22, fontWeight: "400" },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  amenityBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  amenityText: { fontSize: 12, fontWeight: "600" },

  // Multimedia containers
  videoBox: { marginTop: 20, borderRadius: 20, overflow: "hidden", borderWidth: 1, height: 200, position: "relative" },
  videoThumbnail: { width: "100%", height: "100%" },
  playOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  playButton: { width: 54, height: 54, borderRadius: 100, alignItems: "center", justifyContent: "center" },

  // Modals styling configurations
  modalHeaderTray: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  modalBackBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { fontSize: 16, fontWeight: "800", flex: 1, paddingHorizontal: 8 },
  modalCenteredContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  fullscreenVideoElement: { width: "100%", height: 280 },
  mapToggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
});

export default ListingDetailsMobile;