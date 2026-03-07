import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, type } from "@/src/theme/colors";

export type EditMeetingFormValues = {
  title: string;
  password: string;
  waitingRoom: boolean;
  muteOnJoin: boolean;
  allowScreenShare: boolean;
  allowRecording: boolean;
};

type Props = {
  visible: boolean;
  isSubmitting: boolean;
  values: EditMeetingFormValues;
  onChange: (patch: Partial<EditMeetingFormValues>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function EditMeetingModal({
  visible,
  isSubmitting,
  values,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Scheduled Meeting</Text>
            <Text style={styles.modalHint}>
              Leave password empty to remove password protection.
            </Text>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={values.title}
              onChangeText={(title) => onChange({ title })}
              placeholder="Meeting title"
              placeholderTextColor={colors.textMuted}
              editable={!isSubmitting}
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={values.password}
              onChangeText={(password) => onChange({ password })}
              placeholder="Set password or leave empty"
              placeholderTextColor={colors.textMuted}
              editable={!isSubmitting}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Waiting Room</Text>
              <Switch
                value={values.waitingRoom}
                onValueChange={(waitingRoom) => onChange({ waitingRoom })}
                disabled={isSubmitting}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.waitingRoom ? colors.primary : "#EEF3F8"}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Mute On Join</Text>
              <Switch
                value={values.muteOnJoin}
                onValueChange={(muteOnJoin) => onChange({ muteOnJoin })}
                disabled={isSubmitting}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.muteOnJoin ? colors.primary : "#EEF3F8"}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Allow Screen Share</Text>
              <Switch
                value={values.allowScreenShare}
                onValueChange={(allowScreenShare) => onChange({ allowScreenShare })}
                disabled={isSubmitting}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.allowScreenShare ? colors.primary : "#EEF3F8"}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Allow Recording</Text>
              <Switch
                value={values.allowRecording}
                onValueChange={(allowRecording) => onChange({ allowRecording })}
                disabled={isSubmitting}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.allowRecording ? colors.primary : "#EEF3F8"}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={onClose} disabled={isSubmitting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, isSubmitting && styles.modalSaveBtnDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSaveText}>{isSubmitting ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 27, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
  },
  modalContent: {
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 28,
    lineHeight: 34,
  },
  modalHint: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    marginBottom: 6,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleLabel: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
});
