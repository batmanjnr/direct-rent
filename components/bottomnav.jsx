import React, { useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import {
  Home,
  MessageCircleMore,
  UserCircle,
  Bookmark,
  PlusCircle,
  LayoutDashboard,
} from "lucide-react-native";
import * as Animatable from "react-native-animatable";
import { useRouter, useSegments, usePathname } from "expo-router";
import { useTheme } from "../context/ThemeContext";

const BottomNav = React.memo(({ activeTab, setActiveTab, user }) => {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const isAgent = user?.role === "agent";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const tabs = useMemo(() => isAgent
    ? [
        { id: "home", icon: Home, label: "Home", route: "/app/dashboard" },
        { id: "chat", icon: MessageCircleMore, label: "Chat", route: "/app/chat" },
        { id: "create", icon: PlusCircle, label: "Post", route: "/app/creatlisting" },
        { id: "mylistings", icon: LayoutDashboard, label: "Dashboard", route: "/app/Agent/agentdashboard" },
        { id: "profile", icon: UserCircle, label: "Profile", route: "/app/profile" },
      ]
    : [
        { id: "home", icon: Home, label: "Home", route: "/app/dashboard" },
        { id: "favorites", icon: Bookmark, label: "Saved", route: "/app/favourite" },
        { id: "chat", icon: MessageCircleMore, label: "Chat", route: "/app/chat" },
        { id: "profile", icon: UserCircle, label: "Profile", route: "/app/profile" },
      ], [isAgent]);

  useEffect(() => {
    const currentPath = pathname || "";
    const matchingTab = tabs.find((tab) => tab.route && currentPath.toLowerCase().includes(tab.route.toLowerCase()));

    if (matchingTab && matchingTab.id !== activeTab) {
      setActiveTab(matchingTab.id);
    }
  }, [segments, pathname, tabs]);

  const handlePress = useCallback((tab) => {
    setActiveTab(tab.id);
    if (!tab.route) return;

    if (tab.id === "home" || tab.id === "profile") {
      router.replace(tab.route);
    } else {
      router.navigate(tab.route); 
    }
  }, [router, setActiveTab]);

  const bgColor = isDark ? "#070a10" : "#ffffff";
  const borderTopColor = isDark ? "#111827" : "#e2e8f0";
  const activeColor = "#2563eb";
  const inactiveColor = isDark ? "#94a3b8" : "#94a3b8";

  return (
    <View style={styles.outerContainerWrapper} pointerEvents="box-none">
      <View
        style={[
          styles.navContainer,
          { backgroundColor: bgColor, borderTopColor: borderTopColor },
        ]}
      >
        <View style={styles.tabWrapper}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => handlePress(tab)}
                activeOpacity={0.8} 
                style={styles.tabButton}
              >
                <View
                  style={[
                    styles.iconContainer,
                    isActive && [
                      styles.activeIconWrapper, 
                      { backgroundColor: isDark ? "#1e293b" : "#ffffff" } 
                    ],
                  ]}
                >
                  {tab.id === "create" && isAgent ? (
                    <View style={styles.createIconBg}>
                      <IconComponent
                        size={28}
                        color={isActive ? (isDark ? "#ffffff" : "#000000") : "rgba(37, 99, 235, 0.6)"}
                      />
                    </View>
                  ) : (
                    <IconComponent
                      size={24}
                      color={isActive ? (isDark ? "#ffffff" : "#000000") : inactiveColor}
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
                  <Animatable.View
                    animation="bounceIn"
                    duration={400}
                    style={styles.activeDot}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerContainerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  navContainer: {
    // Anchored clean to the phone base line edges
    position: "relative",
    width: "100%",
    borderTopWidth: 1,
    paddingTop: 12,
    // safe space cushion for iOS Home Indicator and modern Android gesture panels
    paddingBottom: Platform.OS === "ios" ? 28 : 14, 
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 20,
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
    height: 48, 
  },
  iconContainer: {
    marginBottom: 2,
    justifyContent: "center",
    alignItems: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  activeIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginTop: -26, // Kept the pop-up bubble but flush against the flat bar base line
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 6,
  },
  createIconBg: {
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
    marginTop: 1,
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