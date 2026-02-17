import { Platform } from "react-native";

export const colors = {
  bg: "#F4F7FB",
  bgDeep: "#E9F0F8",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  text: "#0B1B2B",
  textMuted: "#48607A",
  stroke: "#C8D6E5",
  primary: "#0A7A5A",
  primaryDark: "#086447",
  primaryText: "#FFFFFF",
  info: "#1E5AA8",
  warning: "#A86500",
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
