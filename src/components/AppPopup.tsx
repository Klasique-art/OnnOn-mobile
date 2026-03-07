import { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, type } from "@/src/theme/colors";

export type PopupTone = "info" | "success" | "danger";
export type PopupActionVariant = "primary" | "secondary" | "danger";

export type PopupAction = {
  label: string;
  onPress?: () => void;
  variant?: PopupActionVariant;
  disabled?: boolean;
  closeOnPress?: boolean;
};

type AppPopupProps = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: PopupTone;
  actions?: PopupAction[];
  onClose: () => void;
  icon?: ReactNode;
};

const toneToIcon = (tone: PopupTone) => {
  if (tone === "success") return "checkmark-circle-outline";
  if (tone === "danger") return "alert-circle-outline";
  return "information-circle-outline";
};

const toneToColor = (tone: PopupTone) => {
  if (tone === "success") return "#0F8F5F";
  if (tone === "danger") return colors.error;
  return colors.info;
};

export default function AppPopup({
  visible,
  title,
  message,
  tone = "info",
  actions = [{ label: "OK", variant: "primary" }],
  onClose,
  icon,
}: AppPopupProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close popup"
        />
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconShell,
                { backgroundColor: `${toneToColor(tone)}15`, borderColor: `${toneToColor(tone)}55` },
              ]}
            >
              {icon || (
                <Ionicons name={toneToIcon(tone)} size={20} color={toneToColor(tone)} />
              )}
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          {message ? (
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}

          <View style={styles.actionsRow}>
            {actions.map((action) => {
              const variant = action.variant || "secondary";
              const closeOnPress = action.closeOnPress ?? true;
              return (
                <Pressable
                  key={action.label}
                  style={[
                    styles.actionBtn,
                    variant === "primary" && styles.actionPrimary,
                    variant === "secondary" && styles.actionSecondary,
                    variant === "danger" && styles.actionDanger,
                    action.disabled && styles.actionDisabled,
                  ]}
                  disabled={action.disabled}
                  onPress={() => {
                    if (closeOnPress) onClose();
                    action.onPress?.();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  accessibilityState={{ disabled: !!action.disabled }}
                >
                  <Text
                    style={[
                      styles.actionText,
                      variant === "primary" && styles.actionPrimaryText,
                      variant === "secondary" && styles.actionSecondaryText,
                      variant === "danger" && styles.actionDangerText,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 27, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: "#0A1724",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 18,
    fontWeight: "800",
  },
  message: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
    marginTop: 2,
  },
  actionBtn: {
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  actionSecondary: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
  },
  actionDanger: {
    backgroundColor: "#FFE5E5",
    borderColor: "#F3A3A3",
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  actionPrimaryText: {
    color: colors.primaryText,
  },
  actionSecondaryText: {
    color: colors.text,
  },
  actionDangerText: {
    color: colors.error,
  },
});
