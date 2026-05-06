import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import {
  Home,
  MessageCircleMore,
  UserCircle,
  Bookmark,
  PlusCircle,
  LayoutDashboard,
} from "lucide-react-native";
// Replaces motion.div for simple layouts; for complex spring physics, use react-native-reanimated
import * as Animatable from "react-native-animatable";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";

const BottomNav = ({ activeTab, setActiveTab, user }) => {
  const router = useRouter();
  const isAgent = user?.role === "agent";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Tab configurations based on user role
  const tabs = isAgent
    ? [
        { id: "home", icon: Home, label: "Home", route: "/app/dashboard" },
        {
          id: "chat",
          icon: MessageCircleMore,
          label: "Chat",
          route: "/app/chat",
        },
        {
          id: "create",
          icon: PlusCircle,
          label: "Post",
          route: "/app/creatlisting",
        },
        {
          id: "mylistings",
          icon: LayoutDashboard,
          label: "Dashboard",
          // route changed to agent dashboard so agents land in their management view
          route: "/app/Agent/agentdashboard",
        },
        {
          id: "profile",
          icon: UserCircle,
          label: "Profile",
          route: "/app/profile",
        },
      ]
    : [
        { id: "home", icon: Home, label: "Home", route: "/app/dashboard" },
        {
          id: "favorites",
          icon: Bookmark,
          label: "Saved",
          route: "/app/favourite",
        },
        {
          id: "chat",
          icon: MessageCircleMore,
          label: "Chat",
          route: "/app/chat",
        },
        {
          id: "profile",
          icon: UserCircle,
          label: "Profile",
          route: "/app/profile",
        },
      ];

  const bgColor = isDark ? "rgba(7,10,16,0.95)" : "rgba(255, 255, 255, 0.95)";
  const borderTop = isDark ? "#111827" : "#e2e8f0";
  const activeColor = "#2563eb";
  const inactiveColor = isDark ? "#94a3b8" : "#94a3b8";

  return (
    <View
      style={[
        styles.navContainer,
        { backgroundColor: bgColor, borderTopColor: borderTop },
      ]}
    >
      <View style={styles.tabWrapper}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.icon;

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id);
                // navigate to the configured route; use replace for primary tabs
                if (tab.route) {
                  if (tab.id === "home" || tab.id === "profile")
                    router.replace(tab.route);
                  else router.push(tab.route);
                }
              }}
              activeOpacity={0.7}
              style={styles.tabButton}
            >
              <View
                style={[
                  styles.iconContainer,
                  isActive && styles.activeIconWrapper,
                ]}
              >
                {tab.id === "create" && isAgent ? (
                  <View style={styles.createIconBg}>
                    <IconComponent
                      size={28}
                      color={isActive ? activeColor : "rgba(37, 99, 235, 0.6)"}
                    />
                  </View>
                ) : (
                  <IconComponent
                    size={24}
                    color={isActive ? activeColor : inactiveColor}
                  />
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActive
                    ? [styles.activeLabel, { color: activeColor }]
                    : [styles.inactiveLabel, { color: inactiveColor }],
                ]}
              >
                {tab.label}
              </Text>

              {isActive && tab.id !== "create" && (
                <View
                  animation="bounceIn"
                  duration={600}
                  style={styles.activeDot}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingBottom: 25, // Extra padding for home indicator on iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 20,
  },
  tabWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 2,
  },
  activeIconWrapper: {
    transform: [{ scale: 1.1 }, { translateY: -2 }],
  },
  createIconBg: {
    padding: 4,
    borderRadius: 50,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activeLabel: {
    fontWeight: "900",
  },
  inactiveLabel: {
    opacity: 0.6,
  },
  activeDot: {
    position: "absolute",
    bottom: -6,
    width: 4,
    height: 4,
    backgroundColor: "#2563eb",
    borderRadius: 2,
  },
});

export default BottomNav;
