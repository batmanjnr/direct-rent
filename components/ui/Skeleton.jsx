import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export default function Skeleton({ type = "default", isDark = false }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const bg = isDark ? "#111827" : "#f3f4f6";
  const highlight = isDark ? "#1f2937" : "#e5e7eb";

  const AnimatedView = Animated.createAnimatedComponent(View);

  if (type === "profile") {
    return (
      <View style={styles.container}>
        <AnimatedView
          style={[styles.card, { backgroundColor: bg, opacity: pulse }]}
        >
          <View style={[styles.avatarRow]}>
            <View
              style={[styles.avatarPlaceholder, { backgroundColor: highlight }]}
            />
            <View style={styles.userMeta}>
              <View
                style={[styles.lineShort, { backgroundColor: highlight }]}
              />
              <View
                style={[
                  styles.lineLong,
                  { backgroundColor: highlight, marginTop: 8 },
                ]}
              />
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <View style={[styles.lineFull, { backgroundColor: highlight }]} />
            <View
              style={[
                styles.lineFull,
                { backgroundColor: highlight, marginTop: 10 },
              ]}
            />
            <View
              style={[
                styles.lineHalf,
                { backgroundColor: highlight, marginTop: 10 },
              ]}
            />
          </View>

          <View style={{ marginTop: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View
                key={i}
                style={[styles.itemRow, { backgroundColor: "transparent" }]}
              >
                <View
                  style={[styles.iconBox, { backgroundColor: highlight }]}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View
                    style={[styles.lineLong, { backgroundColor: highlight }]}
                  />
                  <View
                    style={[
                      styles.lineShort,
                      { backgroundColor: highlight, marginTop: 6 },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </AnimatedView>
      </View>
    );
  }

  if (type === "inbox") {
    // Render multiple row placeholders for conversation list
    return (
      <View style={styles.container}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <AnimatedView
            key={idx}
            style={[
              styles.rowSkeleton,
              { backgroundColor: bg, opacity: pulse },
            ]}
          >
            <View style={styles.skelAvatar} />
            <View style={styles.skelMeta}>
              <View style={[styles.lineLong, { backgroundColor: highlight }]} />
              <View
                style={[
                  styles.lineShort,
                  { backgroundColor: highlight, marginTop: 8 },
                ]}
              />
            </View>
            <View style={styles.skelRight}>
              <View
                style={[
                  styles.lineShort,
                  { width: 40, backgroundColor: highlight },
                ]}
              />
            </View>
          </AnimatedView>
        ))}
      </View>
    );
  }

  if (type === "dashboard") {
    return (
      <View style={styles.container}>
        <AnimatedView
          style={[styles.searchSkel, { backgroundColor: bg, opacity: pulse }]}
        >
          <View
            style={[styles.searchBarSkel, { backgroundColor: highlight }]}
          />
          <View style={styles.filterChipsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View
                key={i}
                style={[styles.chipSkel, { backgroundColor: highlight }]}
              />
            ))}
          </View>
        </AnimatedView>

        <AnimatedView
          style={[styles.mapSkel, { backgroundColor: bg, opacity: pulse }]}
        >
          <View style={[styles.mapBox, { backgroundColor: highlight }]} />
        </AnimatedView>

        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <AnimatedView
              key={idx}
              style={[
                styles.listingSkelRow,
                { backgroundColor: bg, opacity: pulse },
              ]}
            >
              <View
                style={[
                  styles.listingImageSkel,
                  { backgroundColor: highlight },
                ]}
              />
              <View style={styles.listingMetaSkel}>
                <View
                  style={[styles.lineLong, { backgroundColor: highlight }]}
                />
                <View
                  style={[
                    styles.lineShort,
                    { backgroundColor: highlight, marginTop: 8 },
                  ]}
                />
              </View>
            </AnimatedView>
          ))}
        </View>
      </View>
    );
  }

  // Default generic skeleton
  return (
    <View style={styles.container}>
      <AnimatedView
        style={[styles.card, { backgroundColor: bg, opacity: pulse }]}
      >
        <View style={[styles.lineFull, { backgroundColor: highlight }]} />
        <View
          style={[
            styles.lineFull,
            { backgroundColor: highlight, marginTop: 10 },
          ]}
        />
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 64 },
  userMeta: { marginLeft: 12, flex: 1 },
  lineShort: { width: width * 0.28, height: 12, borderRadius: 6 },
  lineLong: { width: width * 0.5, height: 14, borderRadius: 6 },
  lineFull: { width: "100%", height: 12, borderRadius: 6 },
  lineHalf: { width: "50%", height: 12, borderRadius: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10 },

  // inbox skeleton styles
  rowSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  skelAvatar: {
    width: 52,
    height: 52,
    borderRadius: 52,
    backgroundColor: "#e5e7eb",
  },
  skelMeta: { flex: 1, marginLeft: 12 },
  skelRight: { width: 48, alignItems: "flex-end" },

  // dashboard skeleton styles
  searchSkel: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  searchBarSkel: {
    height: 40,
    borderRadius: 20,
    marginBottom: 12,
  },
  filterChipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  chipSkel: {
    height: 32,
    borderRadius: 16,
    width: width * 0.2,
  },
  mapSkel: {
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  mapBox: {
    flex: 1,
    borderRadius: 12,
  },
  listingSkelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  listingImageSkel: {
    width: width * 0.3,
    height: 100,
    borderRadius: 12,
  },
  listingMetaSkel: {
    flex: 1,
    marginLeft: 12,
  },
});
