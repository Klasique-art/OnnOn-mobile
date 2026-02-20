import { Platform } from "react-native";

export const colors = {
  bg: "#FFFFFF",
  bgDeep: "#FFF8EC",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF8EE",
  text: "#0B1B2B",
  textMuted: "#48607A",
  stroke: "#E8D9BE",
  primary: "#F6A402",
  primaryDark: "#C97F00",
  primaryText: "#FFFFFF",
  accent: "#DC0000",
  info: "#1E5AA8",
  warning: "#DC0000",
  error: "#DC0000",
};

export const type = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }),
  body: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "sans-serif",
  }),
};

export const headerTheme = {
  headerShown: false,
};

