import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const NotificationBadge = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Add a strict check for both user and user.id
    if (!user || !user.id) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id), // If user.id is undefined, this line crashes[cite: 2]
      where("read", "==", false),
    );

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setUnreadCount(snapshot.size);
        },
        (error) => {
          // This will catch the 'database not found' error gracefully
          console.warn("Firestore Notification Error:", error.message);
        },
      );
    } catch (e) {
      console.warn("Notification badge subscription failed", e);
      setUnreadCount(0);
    }

    return () => unsubscribe && unsubscribe();
  }, [user]);
  // Logic maintained: return null if there are no unread notifications
  if (unreadCount === 0) return null;

  return (
    <View
      style={[
        styles.badgeContainer,
        theme === "dark" ? styles.darkBadge : styles.lightBadge,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          theme === "dark" ? styles.darkText : styles.lightText,
        ]}
      >
        {unreadCount > 9 ? "9+" : unreadCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  lightBadge: {
    backgroundColor: "#4f46e5", // primary
    borderColor: "#fff",
  },
  darkBadge: {
    backgroundColor: "#10b981", // green in dark mode
    borderColor: "#0b1220",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "900", // Matching font-black[cite: 2]
    textAlign: "center",
  },
  lightText: { color: "#fff" },
  darkText: { color: "#02111a" },
});

export default NotificationBadge;
