import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext"; // fixed relative path

export default function Index() {
  const { user, isLoading } = useAuth();

  // Wait for Firebase to check the login status
  if (isLoading) return null;
  return <Redirect href="/intro" />;

  // Redirect to explicit routes so Expo Go resolves them correctly

}
