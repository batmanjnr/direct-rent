import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import {
  ChevronLeft,
  FileText,
  Shield,
  Gavel,
  Eye,
  Bell,
} from "lucide-react-native";
import { useAuth } from "../../context/AuthContext";

const TermsOfUse = () => {
  const { setActiveTab, theme } = useAuth();
  const isDark = theme === "dark";

  const sections = [
    {
      icon: <Shield size={20} color="#3b82f6" />,
      title: "User Conduct",
      content:
        "All users must provide accurate information. Fraudulent listings, identity theft, or harassment of other users will result in immediate permanent ban.",
    },
    {
      icon: <Gavel size={20} color="#10b981" />,
      title: "Listing Accuracy",
      content:
        "Property owners and agents are responsible for the accuracy of their listings. Misleading prices or images are strictly prohibited.",
    },
    {
      icon: <Eye size={20} color="#f59e0b" />,
      title: "Privacy & Data",
      content:
        "We protect your data. Phone numbers and NINs are used strictly for verification. We do not sell your personal information to third parties.",
    },
    {
      icon: <Bell size={20} color="#f43f5e" />,
      title: "Safety Disclaimer",
      content:
        "DirectRent is a platform connecting users. We strongly advise meeting in public places and never sending money before physical property inspection.",
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#020617" : "#f8fafc",
    },
    header: {
      height: 64,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#1e293b" : "#f1f5f9",
    },
    backButton: {
      padding: 8,
      borderRadius: 20,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: isDark ? "#ffffff" : "#0f172a",
      letterSpacing: -0.5,
    },
    main: {
      paddingHorizontal: 20,
      paddingVertical: 32,
    },
    heroIconContainer: {
      width: 64,
      height: 64,
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5",
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: 16,
    },
    heroText: {
      fontSize: 14,
      color: isDark ? "#94a3b8" : "#64748b",
      textAlign: "center",
      lineHeight: 20,
      fontWeight: "500",
      maxWidth: 280,
      alignSelf: "center",
      marginBottom: 32,
    },
    card: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      padding: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? "#1e293b" : "#f1f5f9",
      marginBottom: 16,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#f1f5f9",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: isDark ? "#ffffff" : "#0f172a",
    },
    cardContent: {
      fontSize: 14,
      color: isDark ? "#94a3b8" : "#475569",
      lineHeight: 22,
      fontWeight: "500",
    },
    helpCTA: {
      marginTop: 32,
      padding: 24,
      backgroundColor: "#10b981",
      borderRadius: 32,
      alignItems: "center",
    },
    helpTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: "#ffffff",
      marginBottom: 8,
    },
    helpSub: {
      fontSize: 12,
      color: "rgba(255, 255, 255, 0.8)",
      fontWeight: "600",
      marginBottom: 16,
    },
    supportButton: {
      backgroundColor: "#ffffff",
      width: "100%",
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    supportButtonText: {
      color: "#10b981",
      fontWeight: "700",
      fontSize: 14,
    },
    footer: {
      marginTop: 32,
      marginBottom: 64,
      textAlign: "center",
      fontSize: 10,
      color: isDark ? "#334155" : "#94a3b8",
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setActiveTab("profile")}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={isDark ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Use</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.main}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIconContainer}>
          <FileText size={32} color="#10b981" />
        </View>
        <Text style={styles.heroText}>
          Please read our guidelines carefully to ensure a safe experience for
          everyone.
        </Text>

        <View>
          {sections.map((section, idx) => (
            <View key={idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>{section.icon}</View>
                <Text style={styles.cardTitle}>{section.title}</Text>
              </View>
              <Text style={styles.cardContent}>{section.content}</Text>
            </View>
          ))}
        </View>

        <View style={styles.helpCTA}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpSub}>
            Our support team is available 24/7 for safety concerns.
          </Text>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Last Updated: April 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsOfUse;
