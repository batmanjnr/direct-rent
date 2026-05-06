import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  CheckCheck,
  Inbox,
} from "lucide-react-native";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const NotificationsScreen = () => {
  const { user, setActiveTab } = useAuth();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!user || !user.id) return;

    const nRef = collection(db, "notifications");
    const q = query(
      nRef,
      where("userId", "==", user.id),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotifications(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Notifications error:", err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
  };

  const getIcon = (type) => {
    const props = { size: 20, strokeWidth: 2.5 };
    switch (type) {
      case "message":
        return <MessageSquare {...props} color="#6366f1" />;
      case "verification":
        return <CheckCircle2 {...props} color="#10b981" />;
      case "listing":
        return <Clock {...props} color="#f59e0b" />;
      case "system":
        return <AlertCircle {...props} color="#64748b" />;
      default:
        return <Bell {...props} color="#10b981" />;
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.warn("Mark all read failed", e);
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.read) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }

    if (n.type === "message") setActiveTab("chat");
    else if (n.type === "verification") setActiveTab("profile");
    else setActiveTab("home");
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: isDark ? "#020617" : "#f8fafc" },
        ]}
      >
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      onPress={() => handleNotificationClick(item)}
      style={[
        styles.card,
        { backgroundColor: isDark ? "#0f172a" : "#ffffff" },
        !item.read && { borderColor: "#10b981", borderWidth: 1 },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
        ]}
      >
        {getIcon(item.type)}
      </View>

      <View style={styles.textContainer}>
        <View style={styles.row}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: isDark ? "#f8fafc" : "#0f172a" }]}
          >
            {item.title}
          </Text>
          <Text style={styles.time}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.message, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {item.message}
        </Text>
      </View>

      <ChevronRight size={18} color={isDark ? "#334155" : "#e2e8f0"} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#020617" : "#f8fafc" },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? "#1e293b" : "#e2e8f0" },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <Text
            style={[
              styles.headerText,
              { color: isDark ? "#ffffff" : "#0f172a" },
            ]}
          >
            Notifications
          </Text>
          {notifications.filter((n) => !n.read).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notifications.filter((n) => !n.read).length}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markReadBtn}>
          <CheckCheck size={16} color="#10b981" />
          <Text style={styles.markReadText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Inbox size={60} color={isDark ? "#1e293b" : "#e2e8f0"} />
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              All caught up!
            </Text>
            <Text style={styles.emptySub}>
              We'll notify you here about messages and listing updates.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  headerText: { fontSize: 24, fontWeight: "900" },
  badge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "900" },
  markReadBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  markReadText: { fontSize: 12, fontWeight: "800", color: "#10b981" },
  listContent: { padding: 15, paddingBottom: 100 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  textContainer: { flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: "800", maxWidth: "70%" },
  time: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  message: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", marginTop: 20 },
  emptySub: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
});

export default NotificationsScreen;
