import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function GlobalHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

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
      (snap) => {
        setUnread(snap.size);
      },
      (err) => {
        console.warn("[GlobalHeader] notifications subscribe failed", err);
      },
    );
    return () => unsub();
  }, [user]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.inner}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/app/notification")}
        >
          <Bell size={20} color="#475569" />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unread > 99 ? "99+" : unread}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "ios" ? 44 : 12,
    paddingHorizontal: 16,
    // keep header in normal layout flow so screens are pushed down
    // gives enough height for status bar + header row
    height: Platform.OS === "ios" ? 88 : 64,
  },
  inner: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  button: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
