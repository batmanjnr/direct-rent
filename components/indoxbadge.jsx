import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const InboxBadge = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Determine which field to watch based on user role
    const fieldToFilter =
      user.role === "tenant" ? "unreadCount_tenant" : "unreadCount_agent";
    const idField = user.role === "tenant" ? "tenantId" : "agentId";

    const q = query(
      collection(db, "conversations"),
      where(idField, "==", user.id),
      where(fieldToFilter, ">", 0),
    );

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // snapshot.size gives the count of documents matching the unread criteria
          setUnreadCount(snapshot.size);
        },
        (error) => {
          console.error("Inbox badge error:", error);
        },
      );
    } catch (e) {
      console.warn("Inbox badge subscription failed", e);
      setUnreadCount(0);
    }

    return () => unsubscribe && unsubscribe();
  }, [user]);

  // Hide badge if there are no unread conversations
  if (unreadCount === 0) return null;

  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeText}>
        {unreadCount > 9 ? "9+" : unreadCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    backgroundColor: "#0284c7", // primary-600[cite: 3]
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
  },
});

export default InboxBadge;
