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
    isActive && [
      styles.activeIconWrapper, 
      // Gives the active popped-up circle a clean white background
      { backgroundColor: "#ffffff" } 
    ],
  ]}
>
  {tab.id === "create" && isAgent ? (
    <View style={styles.createIconBg}>
      <IconComponent
        size={28}
        // Forces black when active, otherwise uses your default blue tint
        color={isActive ? "#000000" : "rgba(37, 99, 235, 0.6)"}
      />
    </View>
  ) : (
    <IconComponent
      size={24}
      // Forces black when active, otherwise uses your standard inactive gray
      color={isActive ? "#000000" : inactiveColor}
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
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 24, 
    paddingVertical: 14,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
  },
  tabWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", 
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 50, 
  },
  iconContainer: {
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  activeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -30, 
    // Pronounced dark shadow so the white bubble pops off the navigation background
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 8,
  },
  createIconBg: {
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
    marginTop: 2,
  },
  activeLabel: {
    fontWeight: "600",
  },
  inactiveLabel: {},
  activeDot: {
    display: "none", 
  },
});

export default BottomNav;
