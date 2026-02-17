import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Href } from "expo-router";
import { colors, type } from "@/src/theme/colors";
import ScreenNav from "@/src/components/ScreenNav";
import { SafeAreaView } from "react-native-safe-area-context";

type PlaceholderScreenProps = {
  title: string;
  description?: string;
  footer?: ReactNode;
  badge?: string;
  style?: ViewStyle;
  showBack?: boolean;
  backFallbackHref?: Href;
};

export default function PlaceholderScreen({
  title,
  description = "Screen scaffolded. UI and logic will be added next.",
  footer,
  badge = "Prototype",
  style,
  showBack = true,
  backFallbackHref,
}: PlaceholderScreenProps) {
  const rise = useRef(new Animated.Value(24)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rise, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <SafeAreaView style={[styles.container, style]} edges={["top", "left", "right"]}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <View style={styles.navWrap}>
        {showBack ? (
          <ScreenNav title={title} fallbackHref={backFallbackHref} />
        ) : null}
      </View>
      <View style={styles.contentWrap}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ translateY: rise }],
            },
          ]}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </Animated.View>
        <Animated.View style={{ opacity: fade }}>{footer}</Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 22,
    overflow: "hidden",
  },
  navWrap: {
    minHeight: 54,
    justifyContent: "flex-start",
  },
  contentWrap: {
    flex: 1,
    justifyContent: "center",
  },
  orbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#CDEBDC",
    top: -90,
    right: -70,
  },
  orbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#CFE1F7",
    bottom: -100,
    left: -80,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    shadowColor: "#0A1724",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.4,
  },
  description: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 16,
    lineHeight: 23,
  },
});
