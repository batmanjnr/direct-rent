import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  RefreshControl,
  useColorScheme,
} from "react-native";
import { MessageSquare, Search, Home, Bell } from "lucide-react-native";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import VerificationBadge from "../../components/verificationbadge";
import ChatModal from "../../components/chatmodal";
import { useTheme } from "../../context/ThemeContext";
import { useRouter } from "expo-router";
import Skeleton from "../../components/ui/Skeleton";

// Custom hook for live participant info (Preserved)
const useParticipant = (userId) => {
  const [participant, setParticipant] = useState(null);

  useEffect(() => {
    if (!userId || userId === "unknown") return;

    return onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setParticipant({
          name:
            data.firstName || data.lastName
              ? `${data.firstName || ""} ${data.lastName || ""}`.trim()
              : data.name || "User",
          avatarUrl: data.avatarUrl,
          verificationLevel:
            data.verificationLevel === "verified" ? "verified" : "none",
        });
      }
    });
  }, [userId]);

  return participant;
};

// Avatar component with dynamic background fix
const ConversationAvatar = ({
  userId,
  initialImage,
  initialName,
  listingImage,
  tokens,
}) => {
  const participant = useParticipant(userId);
  const avatarUrl = participant?.avatarUrl || initialImage;

  return (
    <View style={styles.avatarContainer}>
      <View
        style={[
          styles.mainAvatar,
          {
            backgroundColor: avatarUrl ? "transparent" : tokens.badgeBg,
            borderColor: tokens.border,
          },
        ]}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.fullImage} />
        ) : (
          <Text style={[styles.avatarPlaceholder, { color: tokens.accent }]}>
            {(participant?.name || initialName || "?").charAt(0)}
          </Text>
        )}
      </View>
      <View
        style={[styles.listingOverlay, { borderColor: tokens.avatarStroke }]}
      >
        <Image source={{ uri: listingImage }} style={styles.fullImage} />
      </View>
    </View>
  );
};

const ConversationRow = ({
  conv,
  user,
  onClick,
  getTimeAgo,
  getStatusConfig,
  tokens,
}) => {
  const participantId = user?.role === "tenant" ? conv.agentId : conv.tenantId;
  const participant = useParticipant(participantId);

  const displayName =
    participant?.name ||
    (user?.role === "tenant" ? conv.agentName : conv.tenantName);
  const unreadCount =
    user?.role === "tenant" ? conv.unreadCount_tenant : conv.unreadCount_agent;

  return (
    <TouchableOpacity
      onPress={onClick}
      activeOpacity={0.85}
      style={[
        styles.row,
        { backgroundColor: tokens.cardBg, borderColor: tokens.border },
      ]}
    >
      <ConversationAvatar
        userId={participantId}
        initialImage={
          user?.role === "tenant" ? conv.agentImage : conv.tenantImage
        }
        initialName={displayName}
        listingImage={conv.listingImage}
        tokens={tokens}
      />

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.nameSection}>
            <Text
              style={[styles.displayName, { color: tokens.textMain }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {participant?.verificationLevel === "verified" && (
              <VerificationBadge
                level="verified"
                showText={false}
                style={styles.vBadge}
              />
            )}
          </View>
          <Text style={[styles.timeText, { color: tokens.textSubtle }]}>
            {getTimeAgo(conv.updatedAt)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusTag,
              { backgroundColor: tokens.badgeBg, borderColor: tokens.border },
            ]}
          >
            <Text style={[styles.statusText, { color: tokens.accent }]}>
              {conv.status ? conv.status.replace("_", " ") : "Inquiry"}
            </Text>
          </View>
        </View>

        <View style={styles.listingRow}>
          <Home size={10} color={tokens.accent} />
          <Text
            style={[styles.listingTitle, { color: tokens.textSubtle }]}
            numberOfLines={1}
          >
            {conv.listingTitle}
          </Text>
        </View>

        <Text
          style={[styles.lastMessage, { color: tokens.textSubtle }]}
          numberOfLines={1}
        >
          {conv.lastMessage}
        </Text>
      </View>

      {unreadCount > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: tokens.accent }]}>
          <Text style={styles.unreadText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const Inbox = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme === "dark" || theme === "dark";

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const router = useRouter();

  // Unified color palette matching DirectRent colors (No blurry white layers)
  const tokens = isDark
    ? {
        canvas: "#0a0e1a",
        headerBg: "#0a0e1a",
        cardBg: "#111827", // Pure clean dark surface
        textMain: "#ffffff",
        textSubtle: "#94a3b8",
        border: "rgba(255, 255, 255, 0.08)",
        badgeBg: "#1f2937",
        accent: "#3b82f6", // Primary Accent Blue
        avatarStroke: "#0a0e1a",
      }
    : {
        canvas: "#f1f5f9",
        headerBg: "#ffffff",
        cardBg: "#ffffff", // Pure clean light surface
        textMain: "#0f172a",
        textSubtle: "#475569",
        border: "rgba(15, 23, 42, 0.06)",
        badgeBg: "#f8fafc",
        accent: "#2563eb", // Primary Accent Blue
        avatarStroke: "#f1f5f9",
      };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "conversations"),
      where(user.role === "tenant" ? "tenantId" : "agentId", "==", user.id),
      orderBy("updatedAt", "desc"),
    );

    return onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

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
        console.warn("[Chat] notifications subscribe failed", err);
      },
    );
    return () => unsub();
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const q = query(
        collection(db, "conversations"),
        where(user.role === "tenant" ? "tenantId" : "agentId", "==", user.id),
        orderBy("updatedAt", "desc"),
      );
      const snap = await getDocs(q);
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const filtered = conversations.filter(
    (c) =>
      c.listingTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading)
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: tokens.canvas }]}
      >
        <Skeleton type="inbox" isDark={isDark} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tokens.canvas }]}>
      {/* Navigation Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: tokens.headerBg,
            borderBottomColor: tokens.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: tokens.textMain }]}>
          Messages
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/app/notification")}
          style={[styles.headerBtn, { borderColor: tokens.border }]}
        >
          <Bell size={18} color={tokens.textMain} />
          {unread > 0 && (
            <View style={[styles.notifDot, { borderColor: tokens.canvas }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Modern Search Field */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: tokens.cardBg, borderColor: tokens.border },
          ]}
        >
          <Search
            size={16}
            color={tokens.textSubtle}
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search conversations..."
            placeholderTextColor={tokens.textSubtle}
            style={[styles.searchInput, { color: tokens.textMain }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Main Inbox Conversation List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ConversationRow
            conv={item}
            user={user}
            onClick={() => setSelectedConv(item)}
            getTimeAgo={getTimeAgo}
            tokens={tokens}
          />
        )}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: tokens.cardBg, borderColor: tokens.border },
              ]}
            >
              <MessageSquare size={28} color={tokens.textSubtle} />
            </View>
            <Text style={[styles.emptyTitle, { color: tokens.textMain }]}>
              Your inbox is clear
            </Text>
          </View>
        }
      />

      {selectedConv && (
        <ChatModal
          isOpen={!!selectedConv}
          onClose={() => setSelectedConv(null)}
          conversationId={selectedConv.id}
          currentUser={user}
          listing={{
            id: selectedConv.listingId || selectedConv.listingId?.toString(),
            title: selectedConv.listingTitle,
            image: selectedConv.listingImage,
            agent: { id: selectedConv.agentId, name: selectedConv.agentName },
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
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
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchContainer: {
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
    fontWeight: "500",
  },
  list: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  row: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: { position: "relative", marginRight: 14 },
  mainAvatar: {
    width: 52,
    height: 52,
    borderRadius: 100,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  avatarPlaceholder: { fontSize: 18, fontWeight: "700" },
  listingOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    overflow: "hidden",
  },
  fullImage: { width: "100%", height: "100%" },
  rowContent: { flex: 1, marginRight: 8 },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nameSection: { flexDirection: "row", alignItems: "center", flex: 1 },
  displayName: {
    fontSize: 15,
    fontWeight: "700",
    marginRight: 6,
    letterSpacing: -0.2,
  },
  vBadge: { marginTop: 1 },
  timeText: { fontSize: 11, fontWeight: "600" },
  statusRow: { marginBottom: 6 },
  statusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  listingRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  listingTitle: {
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  lastMessage: { fontSize: 13, fontWeight: "400" },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});

export default Inbox;
