import { useMemo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, type } from "@/src/theme/colors";
import { MockMeeting, mockMeetings } from "@/src/data/mockMeetings";

type Filter = "all" | "live" | "scheduled";

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<MockMeeting[]>(mockMeetings);
  const [filter, setFilter] = useState<Filter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("You");
  const [scheduleMode, setScheduleMode] = useState<"instant" | "scheduled">(
    "instant"
  );
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [maxParticipants, setMaxParticipants] = useState(25);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [startsAt, setStartsAt] = useState(new Date(Date.now() + 30 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);

  const visibleMeetings = useMemo(() => {
    const base =
      filter === "all"
        ? meetings
        : meetings.filter((meeting) => meeting.status === filter);

    return [...base].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [meetings, filter]);

  const stats = useMemo(() => {
    return {
      total: meetings.length,
      live: meetings.filter((meeting) => meeting.status === "live").length,
      scheduled: meetings.filter((meeting) => meeting.status === "scheduled")
        .length,
    };
  }, [meetings]);

  const resetCreateState = () => {
    setTitle("");
    setHostName("You");
    setScheduleMode("instant");
    setDurationMinutes(30);
    setMaxParticipants(25);
    setPasswordProtected(false);
    setStartsAt(new Date(Date.now() + 30 * 60 * 1000));
  };

  const createMeeting = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const now = new Date();
    const isInstant = scheduleMode === "instant";
    const newMeeting: MockMeeting = {
      id: `mtg-${Date.now()}`,
      title: cleanTitle,
      hostName: hostName.trim() || "You",
      startsAt: isInstant ? now.toISOString() : startsAt.toISOString(),
      durationMinutes,
      participantCount: isInstant ? 1 : 0,
      maxParticipants,
      passwordProtected,
      status: isInstant ? "live" : "scheduled",
    };

    setMeetings((prev) => [newMeeting, ...prev]);
    setIsCreateOpen(false);
    resetCreateState();
  };

  const joinMeeting = (meetingId: string) => {
    setMeetings((prev) =>
      prev.map((meeting) => {
        if (meeting.id !== meetingId) return meeting;
        const nextCount = Math.min(
          meeting.participantCount + 1,
          meeting.maxParticipants
        );
        return { ...meeting, participantCount: nextCount };
      })
    );
  };

  const startMeeting = (meetingId: string) => {
    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              status: "live",
              startsAt: new Date().toISOString(),
              participantCount: Math.max(meeting.participantCount, 1),
            }
          : meeting
      )
    );
  };

  const endMeeting = (meetingId: string) => {
    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, status: "completed" } : meeting
      )
    );
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderFilter = (value: Filter, label: string) => (
    <Pressable
      key={value}
      onPress={() => setFilter(value)}
      style={[styles.filterChip, filter === value && styles.filterChipActive]}
    >
      <Text
        style={[
          styles.filterChipText,
          filter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Meetings</Text>
        <Text style={styles.title}>Plan, start, and manage sessions</Text>
        <Text style={styles.subtitle}>
          Local simulation mode: no backend calls yet.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.live}</Text>
          <Text style={styles.statLabel}>Live</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.scheduled}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {renderFilter("all", "All")}
        {renderFilter("live", "Live")}
        {renderFilter("scheduled", "Scheduled")}
      </View>

      <FlatList
        data={visibleMeetings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No meetings yet</Text>
            <Text style={styles.emptyText}>
              Create your first instant or scheduled meeting.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLive = item.status === "live";
          const isScheduled = item.status === "scheduled";
          const isCompleted = item.status === "completed";
          return (
            <View style={styles.meetingCard}>
              <View style={styles.meetingTopRow}>
                <Text style={styles.meetingTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isLive && styles.statusLive,
                    isScheduled && styles.statusScheduled,
                    isCompleted && styles.statusCompleted,
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.metaText}>Host: {item.hostName}</Text>
              <Text style={styles.metaText}>Starts: {formatTime(item.startsAt)}</Text>
              <Text style={styles.metaText}>
                {item.participantCount}/{item.maxParticipants} participants |{" "}
                {item.durationMinutes} mins
              </Text>
              <Text style={styles.metaText}>
                {item.passwordProtected ? "Password protected" : "No password"}
              </Text>

              <View style={styles.actionRow}>
                {!isCompleted ? (
                  <Pressable
                    onPress={() => joinMeeting(item.id)}
                    style={styles.actionPrimary}
                  >
                    <Text style={styles.actionPrimaryText}>Join</Text>
                  </Pressable>
                ) : null}

                {isScheduled ? (
                  <Pressable
                    onPress={() => startMeeting(item.id)}
                    style={styles.actionSecondary}
                  >
                    <Text style={styles.actionSecondaryText}>Start now</Text>
                  </Pressable>
                ) : null}

                {isLive ? (
                  <Pressable
                    onPress={() => endMeeting(item.id)}
                    style={styles.actionSecondary}
                  >
                    <Text style={styles.actionSecondaryText}>End</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => setIsCreateOpen(true)}>
        <Text style={styles.fabText}>+ New Meeting</Text>
      </Pressable>

      <Modal
        visible={isCreateOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCreateOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Meeting</Text>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter meeting title"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Host name</Text>
            <TextInput
              value={hostName}
              onChangeText={setHostName}
              placeholder="Enter host name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => setScheduleMode("instant")}
                style={[
                  styles.segment,
                  scheduleMode === "instant" && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    scheduleMode === "instant" && styles.segmentTextActive,
                  ]}
                >
                  Start now
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScheduleMode("scheduled")}
                style={[
                  styles.segment,
                  scheduleMode === "scheduled" && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    scheduleMode === "scheduled" && styles.segmentTextActive,
                  ]}
                >
                  Schedule
                </Text>
              </Pressable>
            </View>

            {scheduleMode === "scheduled" ? (
              <>
                <Text style={styles.fieldLabel}>Starts at</Text>
                <Pressable onPress={() => setShowPicker(true)} style={styles.input}>
                  <Text style={styles.inputText}>{formatTime(startsAt.toISOString())}</Text>
                </Pressable>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>Duration (minutes)</Text>
            <View style={styles.optionRow}>
              {[30, 45, 60].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setDurationMinutes(value)}
                  style={[
                    styles.optionChip,
                    durationMinutes === value && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      durationMinutes === value && styles.optionChipTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Max participants</Text>
            <View style={styles.optionRow}>
              {[5, 25, 100].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setMaxParticipants(value)}
                  style={[
                    styles.optionChip,
                    maxParticipants === value && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      maxParticipants === value && styles.optionChipTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Password protected</Text>
              <Switch
                value={passwordProtected}
                onValueChange={setPasswordProtected}
                trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                thumbColor={passwordProtected ? colors.primary : "#EEF3F8"}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setIsCreateOpen(false);
                  resetCreateState();
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createMeeting}
                style={[
                  styles.createButton,
                  !title.trim() && styles.createButtonDisabled,
                ]}
                disabled={!title.trim()}
              >
                <Text style={styles.createText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showPicker ? (
        <DateTimePicker
          mode="datetime"
          value={startsAt}
          minimumDate={new Date()}
          onChange={(_event, selectedDate) => {
            if (Platform.OS !== "ios") setShowPicker(false);
            if (selectedDate) setStartsAt(selectedDate);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  bgOrbTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#FFE6BA",
    top: -100,
    right: -90,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D8E8FA",
    bottom: -100,
    left: -80,
  },
  header: {
    marginBottom: 14,
  },
  kicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 30,
    lineHeight: 36,
    marginTop: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statValue: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  filterChipText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: colors.primaryText,
  },
  listContent: {
    paddingBottom: 120,
    gap: 10,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: type.body,
    fontSize: 14,
  },
  meetingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  meetingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  meetingTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#E5EEF8",
  },
  statusLive: {
    backgroundColor: "#FFEBC9",
  },
  statusScheduled: {
    backgroundColor: "#E5EEF8",
  },
  statusCompleted: {
    backgroundColor: "#E8EAF0",
  },
  statusText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  metaText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  actionPrimaryText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSecondary: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  actionSecondaryText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 86,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#0A1724",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  fabText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 17, 27, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    gap: 8,
    maxHeight: "90%",
  },
  modalTitle: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 4,
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
  },
  inputText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionChip: {
    minWidth: 54,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  optionChipText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontWeight: "700",
  },
  optionChipTextActive: {
    color: colors.primaryText,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 4,
  },
  switchLabel: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  createButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.55,
  },
  createText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
});

