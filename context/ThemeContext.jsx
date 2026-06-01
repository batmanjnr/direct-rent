import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ThemeContext = createContext(undefined);
const PREF_KEY = "themePref"; // values: 'system' | 'light' | 'dark'

export const ThemeProvider = ({ children }) => {
  // Start with an explicit light theme by default (do not follow OS)
  const [preference, setPreference] = useState("light");
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // derive the effective theme: always use explicit preference
  const theme = preference;

  // Load stored preference
  useEffect(() => {
    const loadPref = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREF_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          // If a stored value exists, use it. Otherwise default to light.
          setPreference(stored);
        } else {
          setPreference("light");
        }
      } catch (e) {
        console.error("Theme load failed:", e);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };
    loadPref();

    // Do NOT subscribe to Appearance changes — app will not follow OS theme

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Persist preference whenever it changes
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(PREF_KEY, preference);
      } catch (e) {
        console.error("Theme save failed:", e);
      }
    };
    if (!isLoading) save();
  }, [preference, isLoading]);

  // Public API: setTheme behaves as setting explicit preference to 'light' or 'dark' or 'system'
  const setTheme = (newTheme) => {
    if (newTheme === "light" || newTheme === "dark" || newTheme === "system") {
      setPreference(newTheme);
    } else {
      console.warn('setTheme expects "light" | "dark" | "system"');
    }
  };

  // toggleTheme: toggle between light and dark explicitly (ignore OS)
  const toggleTheme = () => {
    setPreference((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Whether the app is currently following the OS setting
  const isFollowingSystem = preference === "system";

  // Helper to enable/disable following system: we intentionally disallow automatic following
  const setFollowSystem = (follow) => {
    if (follow) {
      console.warn("Following system theme is disabled. Preference remains explicit.");
      return;
    }
    // if disabling follow, ensure an explicit theme is set
    setPreference((prev) => (prev === "dark" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isLoading,
        preference,
        isFollowingSystem,
        setFollowSystem,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};