import { useState } from "react";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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

export type CreateMeetingFormValues = {
  title: string;
  startsNow: boolean;
  startsAt: Date;
  timezone: string;
  password: string;
  waitingRoom: boolean;
  muteOnJoin: boolean;
  allowScreenShare: boolean;
  allowRecording: boolean;
};

type Props = {
  visible: boolean;
  isSubmitting: boolean;
  values: CreateMeetingFormValues;
  canUseRecording: boolean;
  canUseScreenShare: boolean;
  onChange: (patch: Partial<CreateMeetingFormValues>) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateMeetingModal({
  visible,
  isSubmitting,
  values,
  canUseRecording,
  canUseScreenShare,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type !== "set" || !selectedDate) return;

    const next = new Date(values.startsAt);
    next.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );
    onChange({ startsAt: next, startsNow: false });
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (event.type !== "set" || !selectedTime) return;

    const next = new Date(values.startsAt);
    next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    onChange({ startsAt: next, startsNow: false });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior="padding">
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Meeting</Text>
            <Text style={styles.modalHint}>
              Start now, or choose a future time to schedule it.
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

            <Text style={styles.fieldLabel}>Starts At</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Start now</Text>
              <Switch
                value={values.startsNow}
                onValueChange={(startsNow) => {
                  if (startsNow) {
                    onChange({ startsNow: true, startsAt: new Date() });
                  } else {
                    const next = new Date();
                    next.setMinutes(next.getMinutes() + 30);
                    next.setSeconds(0, 0);
                    onChange({ startsNow: false, startsAt: next });
                  }
                }}
                disabled={isSubmitting}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.startsNow ? colors.primary : "#EEF3F8"}
              />
            </View>
            <View style={styles.dateTimeRow}>
              <Pressable
                style={styles.dateTimeBtn}
                onPress={() => setShowDatePicker(true)}
                disabled={isSubmitting || values.startsNow}
              >
                <Text style={styles.dateTimeBtnLabel}>Date</Text>
                <Text style={styles.dateTimeBtnValue}>
                  {values.startsAt.toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </Pressable>
              <Pressable
                style={styles.dateTimeBtn}
                onPress={() => setShowTimePicker(true)}
                disabled={isSubmitting || values.startsNow}
              >
                <Text style={styles.dateTimeBtnLabel}>Time</Text>
                <Text style={styles.dateTimeBtnValue}>
                  {values.startsAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Pressable>
            </View>
            {showDatePicker && !values.startsNow ? (
              <DateTimePicker
                value={values.startsAt}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            ) : null}
            {showTimePicker && !values.startsNow ? (
              <DateTimePicker
                value={values.startsAt}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            ) : null}

            <Text style={styles.fieldLabel}>Timezone</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{values.timezone}</Text>
            </View>

            <Text style={styles.fieldLabel}>Password (optional)</Text>
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
            <Text style={styles.toggleHelp}>
              Participants wait for host approval before entering.
            </Text>
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
                disabled={isSubmitting || !canUseScreenShare}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.allowScreenShare ? colors.primary : "#EEF3F8"}
              />
            </View>
            {!canUseScreenShare ? (
              <Text style={styles.toggleHelp}>
                Screen sharing is not available on your current plan.
              </Text>
            ) : null}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Allow Recording</Text>
              <Switch
                value={values.allowRecording}
                onValueChange={(allowRecording) => onChange({ allowRecording })}
                disabled={isSubmitting || !canUseRecording}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={values.allowRecording ? colors.primary : "#EEF3F8"}
              />
            </View>
            {!canUseRecording ? (
              <Text style={styles.toggleHelp}>
                Recording is not available on your current plan.
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={onClose} disabled={isSubmitting}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, isSubmitting && styles.modalSaveBtnDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSaveText}>
                  {isSubmitting
                    ? values.startsNow
                      ? "Creating..."
                      : "Scheduling..."
                    : values.startsNow
                    ? "Create"
                    : "Schedule"}
                </Text>
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
  readonlyField: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#EEF3F8",
  },
  readonlyValue: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateTimeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.surfaceSoft,
    gap: 2,
  },
  dateTimeBtnLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateTimeBtnValue: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
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
  toggleHelp: {
    marginTop: -2,
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
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
