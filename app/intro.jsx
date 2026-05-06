import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

const { width, height } = Dimensions.get("window");

export default function Intro() {
  const router = useRouter();

  // calculate track and end widths so animated width doesn't reach screen edge
  const TRACK_WIDTH = width * 0.8;
  const END_WIDTH = TRACK_WIDTH * 0.9; // leave 10% gap inside track

  // Animations using built-in Animated.Value
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(10)).current;
  const progress = useRef(new Animated.Value(0)).current;

  // clamp progress so it never exceeds END_WIDTH
  const progressClamped = progress.interpolate({
    inputRange: [0, END_WIDTH],
    outputRange: [0, END_WIDTH],
    extrapolate: "clamp",
  });

  const { user, isLoading } = useAuth(); // Check user status here
  const [animationDone, setAnimationDone] = useState(false);

  useEffect(() => {
    // Parallel animations for the Logo and Text
    Animated.parallel([
      // Logo Scale and Fade
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      // Text Fade and Slide (with 400ms delay)
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslate, {
        toValue: 0,
        duration: 800,
        delay: 400,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      // Loading Bar (no native driver for width) - animate to END_WIDTH so it doesn't touch the screen edge
      Animated.timing(progress, {
        toValue: END_WIDTH,
        duration: 2200,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // mark animations finished; navigation will occur once auth state is ready
      setAnimationDone(true);
    });

    // no timer-based navigation anymore
    return undefined;
  }, []);

  // When animations finish and auth check is completed, route appropriately
  useEffect(() => {
    if (!animationDone) return; // wait for intro animations
    if (isLoading) return; // wait for auth to finish determining state

    // route based on signed-in state
    if (user) {
      router.replace("/app/dashboard");
    } else {
      router.replace("/auth/home");
    }
  }, [animationDone, isLoading, user]);

  const handleGetStarted = () => {
    // Immediate manual override if user taps Get Started — follow same routing logic
    if (user && !isLoading) {
      router.replace("/app/dashboard");
    } else if (!isLoading) {
      router.replace("/auth/home");
    } else {
      // if auth still loading, set animationDone so the effect will navigate once ready
      setAnimationDone(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Image
          source={require("../assets/Direct.png")} //[cite: 6]
          style={[
            styles.logo,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        />

      </View>

      <View
        style={[
          styles.loadingTrack,
          {
            width: TRACK_WIDTH,
            paddingRight: TRACK_WIDTH * 0.1,
            alignItems: "flex-start",
          },
        ]}
      >
        <Animated.View
          style={[
            styles.loadingBar,
            { width: progressClamped, alignSelf: "flex-start" },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white", //[cite: 6]
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    alignItems: "center",
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  title: {
    color: "black",
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 1,
  },
  loadingTrack: {
    position: "absolute",
    bottom: height * 0.1, // shift up 10% of screen height
    height: 3,
    backgroundColor: "rgba(0,0,0,0.12)",
    overflow: "hidden",
    borderRadius: 2,
  },
  loadingBar: {
    height: "100%",
    backgroundColor: "#4dacffff",
  },
});
