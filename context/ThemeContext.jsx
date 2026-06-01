import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

const ThemeContext = createContext(undefined);
const PREF_KEY = "themePref"; // values: 'system' | 'light' | 'dark'

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState("system");
  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() || "light",
  );
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  // derive the effective theme: if pref is 'system' follow systemScheme else use pref
  const theme = preference === "system" ? systemScheme : preference;

  // Load stored preference
  useEffect(() => {
    const loadPref = async () => {
      try {
        const stored = await AsyncStorage.getItem(PREF_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreference(stored);
        } else {
          setPreference("system");
        }
      } catch (e) {
        console.error("Theme load failed:", e);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };
    loadPref();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const scheme = colorScheme || "light";
      setSystemScheme(scheme);
    });

    return () => {
      mountedRef.current = false;
      try {
        sub.remove();
      } catch (e) {}
    };
  }, []);

  // Persist preference whenever it changes (but avoid persisting system derived changes)
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

  // toggleTheme: if pref is 'system' toggle to opposite of current effective theme (becomes explicit)
  // otherwise toggle between light and dark, but keep explicit preference
  const toggleTheme = () => {
    const effective = preference === "system" ? systemScheme : preference;
    const next = effective === "dark" ? "light" : "dark";
    setPreference(next);
  };

  // Whether the app is currently following the OS setting
  const isFollowingSystem = preference === "system";

  // Helper to enable/disable following system: when enabling, set preference to 'system'
  // when disabling, set explicit preference to the current system scheme so the toggle reflects OS state
  const setFollowSystem = (follow) => {
    if (follow) {
      setPreference("system");
    } else {
      // set explicit to current system scheme so UI stays consistent
      setPreference(systemScheme === "dark" ? "dark" : "light");
    }
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
