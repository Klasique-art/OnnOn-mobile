import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { headerTheme } from "@/src/theme/colors";

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ ...headerTheme }} />
      <StatusBar style="dark" />
    </>
  );
}
