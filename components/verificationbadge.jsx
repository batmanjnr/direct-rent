import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ShieldCheck, Shield } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

const VerificationBadge = ({ level = "none", showText = true, style = {} }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const getConfig = () => {
    switch (level) {
      case "verified":
        return {
          icon: (
            <ShieldCheck size={14} color={isDark ? "#34d399" : "#047857"} />
          ), // adjust for dark/light
          bg: isDark ? "#052e1f" : "#d1fae5",
          border: isDark ? "#064e3b" : "#a7f3d0",
          textColor: isDark ? "#34d399" : "#047857",
          text: "Verified Agent",
        };
      default:
        return {
          icon: <Shield size={14} color={isDark ? "#94a3b8" : "#64748b"} />, // slate
          bg: isDark ? "#0b1220" : "#f1f5f9",
          border: isDark ? "#111827" : "#e2e8f0",
          textColor: isDark ? "#94a3b8" : "#64748b",
          text: "Unverified",
        };
    }
  };

  const config = getConfig();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      {config.icon}
      {showText && (
        <Text style={[styles.text, { color: config.textColor }]}>
          {config.text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  verified: {
    backgroundColor: "#d1fae5", // emerald-100
    borderColor: "#a7f3d0", // emerald-200
  },
  unverified: {
    backgroundColor: "#f1f5f9", // slate-100
    borderColor: "#e2e8f0", // slate-200[cite: 6]
  },
  text: {
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
    letterSpacing: -0.2,
  },
});

export default VerificationBadge;
