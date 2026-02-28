import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import { headerTheme } from "@/src/theme/colors";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ ...headerTheme }} />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
