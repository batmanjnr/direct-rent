import React, { useState } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";
import { Home, User, Layout } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

const SafeImage = ({ src, alt, style, fallbackType = "house", ...props }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const bgTokens = isDark
    ? { surface: "#0b1220", overlay: "#0b1220" }
    : { surface: "#ffffff", overlay: "#f1f5f9" };

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  // Select fallback icon based on type
  const renderFallbackIcon = () => {
    const iconProps = { size: 32, color: "#cbd5e1", opacity: 0.3 };
    switch (fallbackType) {
      case "avatar":
        return <User {...iconProps} />;
      case "room":
        return <Layout {...iconProps} />;
      default:
        return <Home {...iconProps} />;
    }
  };

  if (error || !src) {
    return (
      <View
        style={[
          styles.fallbackContainer,
          style,
          { backgroundColor: bgTokens.overlay },
        ]}
      >
        {renderFallbackIcon()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: src }}
        style={[styles.image, style, loading && styles.hiddenImage]}
        onError={handleImageError}
        onLoad={handleImageLoad}
        {...props}
      />

      {loading && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loadingOverlay,
            { backgroundColor: bgTokens.overlay },
          ]}
        >
          <ActivityIndicator color="#0284c7" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  hiddenImage: {
    opacity: 0,
  },
  loadingOverlay: {
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SafeImage;
