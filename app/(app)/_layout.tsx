import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { headerTheme } from "@/src/theme/colors";

export default function AppLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Stack screenOptions={{ ...headerTheme, headerShown: false }} />;
}
