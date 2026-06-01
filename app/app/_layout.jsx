import React, { useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

// Defensive import: support both ESM default and CommonJS module shapes
let BottomNav;
try {
  const _mod = require("../../components/bottomnav");
  BottomNav = _mod && _mod.default ? _mod.default : _mod;
} catch (e) {
  // fallback to import if require fails for any reason
  /* eslint-disable global-require */
  BottomNav = require("../../components/bottomnav");
}

export default function AppLayout() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("home");
  const NAV_HEIGHT = Platform.OS === "ios" ? 92 : 74; // match bottom nav visual height + safe inset

  const bgColor = theme === "light" ? "#FFFFFF" : "#070a10";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={[
          styles.content,
          { paddingBottom: NAV_HEIGHT, backgroundColor: bgColor },
        ]}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
  },
});
