import { Stack } from "expo-router";
import { headerTheme } from "@/src/theme/colors";

export default function AppLayout() {
  return <Stack screenOptions={{ ...headerTheme, headerShown: false }} />;
}
