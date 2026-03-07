import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { AxiosError } from "axios";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import client from "@/lib/client";
import AppPopup, { PopupAction, PopupTone } from "@/src/components/AppPopup";
import { colors, type } from "@/src/theme/colors";

type MeetingStatus = "live" | "scheduled" | "completed";
type Filter = "all" | "live" | "scheduled";

type MeetingItem = {
  id: string;
  title: string;
  hostName: string;
  isHost?: boolean;
  startsAt: string;
  durationMinutes: number;
  participantCount: number;
  maxParticipants: number;
  passwordProtected: boolean;
  status: MeetingStatus;
  settings?: {
    waitingRoom?: boolean;
    muteOnJoin?: boolean;
    allowScreenShare?: boolean;
    allowRecording?: boolean;
  };
};

type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type MeetingsResponse = {
  success: boolean;
  message?: string;
  data: {
    items: MeetingItem[];
    pagination: Pagination;
    serverTime?: string;
  };
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

const PAGE_LIMIT = 20;
const APP_LINK_BASE_URL = "https://onnon.app";

export default function MeetingsScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewerDisplayName, setViewerDisplayName] = useState<string>("");
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editWaitingRoom, setEditWaitingRoom] = useState(false);
  const [editMuteOnJoin, setEditMuteOnJoin] = useState(true);
  const [editAllowScreenShare, setEditAllowScreenShare] = useState(true);
  const [editAllowRecording, setEditAllowRecording] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTone, setPopupTone] = useState<PopupTone>("info");
  const [popupActions, setPopupActions] = useState<PopupAction[]>([
    { label: "OK", variant: "primary" },
  ]);
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  const fetchMeetings = useCallback(
    async (page: number, mode: "initial" | "refresh" | "loadMore") => {
      try {
        if (mode === "initial") setIsLoading(true);
        if (mode === "refresh") setIsRefreshing(true);
        if (mode === "loadMore") setIsLoadingMore(true);
        setScreenError(null);

        const params: Record<string, string | number> = {
          page,
          limit: PAGE_LIMIT,
        };
        if (filter !== "all") {
          params.status = filter;
        }

        const response = await client.get<MeetingsResponse>("/meetings", { params });
        const payload = response.data.data;
        const nextItems = payload?.items ?? [];

        setMeetings((prev) => (page === 1 ? nextItems : [...prev, ...nextItems]));
        setPagination(payload?.pagination ?? null);
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        console.error("[Meetings] Failed to fetch meetings", {
          message: apiError?.message || String(err),
          code: apiError?.code,
          status: apiError?.response?.status,
          responseData: apiError?.response?.data,
          filter,
          page,
        });
        setScreenError(
          apiError?.response?.data?.message || "Could not load meetings."
        );
      } finally {
        if (mode === "initial") setIsLoading(false);
        if (mode === "refresh") setIsRefreshing(false);
        if (mode === "loadMore") setIsLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    fetchMeetings(1, "initial");
  }, [fetchMeetings]);

  useEffect(() => {
    const loadViewerProfile = async () => {
      try {
        const response = await client.get<{ success: boolean; data: { displayName: string } }>(
          "/profile/me"
        );
        setViewerDisplayName(response.data?.data?.displayName || "");
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        console.error("[Meetings] Failed to resolve viewer profile", {
          message: apiError?.message || String(err),
          code: apiError?.code,
          status: apiError?.response?.status,
          responseData: apiError?.response?.data,
        });
      }
    };

    loadViewerProfile();
  }, []);

  const onRefresh = () => fetchMeetings(1, "refresh");

  const onEndReached = () => {
    if (isLoading || isRefreshing || isLoadingMore) return;
    if (!pagination?.hasNextPage) return;
    fetchMeetings(pagination.page + 1, "loadMore");
  };

  const stats = useMemo(() => {
    return {
      total: pagination?.totalItems ?? meetings.length,
      live: meetings.filter((meeting) => meeting.status === "live").length,
      scheduled: meetings.filter((meeting) => meeting.status === "scheduled").length,
    };
  }, [meetings, pagination?.totalItems]);

  const visibleMeetings = useMemo(() => {
    if (filter === "all") return meetings;
    return meetings.filter((meeting) => meeting.status === filter);
  }, [filter, meetings]);

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

  const isMeetingHost = (meeting: MeetingItem) => {
    if (typeof meeting.isHost === "boolean") return meeting.isHost;
    const host = meeting.hostName?.trim().toLowerCase();
    const viewer = viewerDisplayName.trim().toLowerCase();
    return Boolean(host && viewer && host === viewer);
  };

  const onJoinMeeting = (meeting: MeetingItem) => {
    router.push({
      pathname: "/(app)/call-room",
      params: { meetingId: meeting.id, title: meeting.title },
    });
  };

  const onShareScheduledMeeting = async (meeting: MeetingItem) => {
    const deepLink = Linking.createURL(`/meeting/${meeting.id}`, {
      queryParams: { title: meeting.title },
    });
    const universalLink = `${APP_LINK_BASE_URL}/meeting/${encodeURIComponent(
      meeting.id
    )}?title=${encodeURIComponent(meeting.title)}`;

    try {
      await Share.share({
        title: "Share Meeting",
        message: `Join my OnnOn meeting: ${meeting.title}\nMeeting ID: ${meeting.id}\nOpen: ${universalLink}\nApp link: ${deepLink}`,
        url: universalLink,
      });
    } catch (err) {
      const apiError = err as Error;
      console.error("[Meetings] Failed to share meeting link", {
        message: apiError?.message || String(err),
        meetingId: meeting.id,
        universalLink,
        deepLink,
      });
      showPopup({
        title: "Share Failed",
        message: "Could not open share sheet for this meeting.",
        tone: "danger",
      });
    }
  };

  const showPopup = ({
    title,
    message,
    tone = "info",
    actions = [{ label: "OK", variant: "primary" }],
  }: {
    title: string;
    message?: string;
    tone?: PopupTone;
    actions?: PopupAction[];
  }) => {
    setPopupTitle(title);
    setPopupMessage(message || "");
    setPopupTone(tone);
    setPopupActions(actions);
    setIsPopupVisible(true);
  };

  const closePopup = () => {
    setIsPopupVisible(false);
  };

  const onEndMeeting = (meeting: MeetingItem) => {
    showPopup({
      title: "End Meeting",
      message: `End "${meeting.title}" for all participants?`,
      tone: "danger",
      actions: [
        {
          label: "Cancel",
          variant: "secondary",
        },
        {
          label: "End",
          variant: "danger",
          onPress: () => {
            // Local UI update until dedicated end-meeting endpoint is connected.
            setMeetings((prev) => prev.filter((item) => item.id !== meeting.id));
          },
        },
      ],
    });
  };

  const openEditMeeting = (meeting: MeetingItem) => {
    setEditingMeeting(meeting);
    setEditTitle(meeting.title || "");
    setEditPassword(meeting.passwordProtected ? "" : "");
    setEditWaitingRoom(Boolean(meeting.settings?.waitingRoom));
    setEditMuteOnJoin(meeting.settings?.muteOnJoin ?? true);
    setEditAllowScreenShare(meeting.settings?.allowScreenShare ?? true);
    setEditAllowRecording(Boolean(meeting.settings?.allowRecording));
    setIsEditOpen(true);
  };

  const closeEditMeeting = () => {
    if (isSavingEdit) return;
    setIsEditOpen(false);
    setEditingMeeting(null);
    setEditTitle("");
    setEditPassword("");
  };

  const submitEditMeeting = async () => {
    if (!editingMeeting) return;
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      showPopup({
        title: "Validation",
        message: "Meeting title is required.",
        tone: "danger",
      });
      return;
    }

    try {
      setIsSavingEdit(true);
      await client.put(`/meetings/${editingMeeting.id}`, {
        title: trimmedTitle,
        password: editPassword,
        settings: {
          waitingRoom: editWaitingRoom,
          muteOnJoin: editMuteOnJoin,
          allowScreenShare: editAllowScreenShare,
          allowRecording: editAllowRecording,
        },
      });

      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === editingMeeting.id
            ? {
                ...meeting,
                title: trimmedTitle,
                passwordProtected: editPassword.trim().length > 0,
                settings: {
                  waitingRoom: editWaitingRoom,
                  muteOnJoin: editMuteOnJoin,
                  allowScreenShare: editAllowScreenShare,
                  allowRecording: editAllowRecording,
                },
              }
            : meeting
        )
      );
      closeEditMeeting();
      showPopup({
        title: "Meeting Updated",
        message: "Scheduled meeting settings were updated.",
        tone: "success",
      });
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      console.error("[Meetings] Failed to edit meeting", {
        message: apiError?.message || String(err),
        code: apiError?.code,
        status: apiError?.response?.status,
        responseData: apiError?.response?.data,
        meetingId: editingMeeting.id,
      });
      showPopup({
        title: "Update Failed",
        message: apiError?.response?.data?.message || "Could not update meeting.",
        tone: "danger",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Meetings</Text>
        <Text style={styles.title}>Plan, start, and manage sessions</Text>
        <Text style={styles.subtitle}>Synced with backend meetings API.</Text>
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

      {screenError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{screenError}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Loading meetings...</Text>
        </View>
      ) : (
        <FlatList
          data={visibleMeetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.3}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryDark}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No meetings found</Text>
              <Text style={styles.emptyText}>
                There are no meetings for this filter right now.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primaryDark} />
                <Text style={styles.footerLoaderText}>Loading more...</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isLive = item.status === "live";
            const isScheduled = item.status === "scheduled";
            const isCompleted = item.status === "completed";
            const isHost = isMeetingHost(item);

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
                  {isLive ? (
                    <Pressable
                      onPress={() => onJoinMeeting(item)}
                      style={styles.actionPrimary}
                    >
                      <Text style={styles.actionPrimaryText}>Join</Text>
                    </Pressable>
                  ) : null}

                  {isScheduled ? (
                    <Pressable
                      onPress={() => void onShareScheduledMeeting(item)}
                      style={styles.actionSecondary}
                    >
                      <Text style={styles.actionSecondaryText}>Share</Text>
                    </Pressable>
                  ) : null}

                  {isLive && isHost ? (
                    <Pressable
                      onPress={() => onEndMeeting(item)}
                      style={styles.actionSecondary}
                    >
                      <Text style={styles.actionSecondaryText}>End</Text>
                    </Pressable>
                  ) : null}

                  {isScheduled && isHost ? (
                    <Pressable
                      onPress={() => openEditMeeting(item)}
                      style={styles.actionSecondary}
                    >
                      <Text style={styles.actionSecondaryText}>Edit</Text>
                    </Pressable>
                  ) : null}

                  {isScheduled && !isHost ? (
                    <Pressable style={styles.actionDisabled} disabled>
                      <Text style={styles.actionDisabledText}>Scheduled</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={isEditOpen}
        animationType="slide"
        transparent
        onRequestClose={closeEditMeeting}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Scheduled Meeting</Text>
              <Text style={styles.modalHint}>
                Leave password empty to remove password protection.
              </Text>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Meeting title"
                placeholderTextColor={colors.textMuted}
                editable={!isSavingEdit}
              />

              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={editPassword}
                onChangeText={setEditPassword}
                placeholder="Set password or leave empty"
                placeholderTextColor={colors.textMuted}
                editable={!isSavingEdit}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Waiting Room</Text>
                <Switch
                  value={editWaitingRoom}
                  onValueChange={setEditWaitingRoom}
                  disabled={isSavingEdit}
                  trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                  thumbColor={editWaitingRoom ? colors.primary : "#EEF3F8"}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Mute On Join</Text>
                <Switch
                  value={editMuteOnJoin}
                  onValueChange={setEditMuteOnJoin}
                  disabled={isSavingEdit}
                  trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                  thumbColor={editMuteOnJoin ? colors.primary : "#EEF3F8"}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Allow Screen Share</Text>
                <Switch
                  value={editAllowScreenShare}
                  onValueChange={setEditAllowScreenShare}
                  disabled={isSavingEdit}
                  trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                  thumbColor={editAllowScreenShare ? colors.primary : "#EEF3F8"}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Allow Recording</Text>
                <Switch
                  value={editAllowRecording}
                  onValueChange={setEditAllowRecording}
                  disabled={isSavingEdit}
                  trackColor={{ false: "#B7C5D5", true: "#F6C063" }}
                  thumbColor={editAllowRecording ? colors.primary : "#EEF3F8"}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={closeEditMeeting}
                  disabled={isSavingEdit}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSaveBtn, isSavingEdit && styles.modalSaveBtnDisabled]}
                  onPress={submitEditMeeting}
                  disabled={isSavingEdit}
                >
                  <Text style={styles.modalSaveText}>
                    {isSavingEdit ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AppPopup
        visible={isPopupVisible}
        title={popupTitle}
        message={popupMessage}
        tone={popupTone}
        actions={popupActions}
        onClose={closePopup}
      />
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
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3A3A3",
    backgroundColor: "#FFE5E5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    color: colors.error,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
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
  actionDisabled: {
    backgroundColor: "#EEF3F8",
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    opacity: 0.9,
  },
  actionDisabledText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerLoaderText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
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
