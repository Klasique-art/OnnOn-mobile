import { Stack } from "expo-router";
import { headerTheme } from "@/src/theme/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{ ...headerTheme }}
      initialRouteName="welcome"
    />
  );
}
