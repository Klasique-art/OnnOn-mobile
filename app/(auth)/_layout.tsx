import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { headerTheme } from "@/src/theme/colors";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{ ...headerTheme }}
      initialRouteName="welcome"
    />
  );
}
