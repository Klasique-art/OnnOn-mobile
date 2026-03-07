import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, type } from "@/src/theme/colors";

type FormLoaderProps = {
  visible: boolean;
  label?: string;
};

export default function FormLoader({
  visible,
  label = "Submitting...",
}: FormLoaderProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="small" color={colors.primaryDark} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
});
