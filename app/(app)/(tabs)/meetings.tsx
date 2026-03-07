import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AxiosError } from "axios";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import client from "@/lib/client";
import AppPopup, { PopupAction, PopupTone } from "@/src/components/AppPopup";
import CreateMeetingModal, {
  type CreateMeetingFormValues,
} from "@/src/components/meetings/CreateMeetingModal";
import EditMeetingModal, {
  type EditMeetingFormValues,
} from "@/src/components/meetings/EditMeetingModal";
import { colors, type } from "@/src/theme/colors";

type MeetingStatus = "live" | "scheduled" | "completed";
type Filter = "all" | "live" | "scheduled";

type MeetingItem = {
  id: string;
  joinCode?: string;
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
  links?: {
    universal?: string;
    deepLink?: string;
  };
};

type RawMeetingItem = Partial<MeetingItem> & {
  id?: string;
  meetingId?: string;
  joinCode?: string;
};

type CreateMeetingRequest = {
  title: string;
  startsAt: string;
  timezone: string;
  password?: string;
  settings: {
    waitingRoom: boolean;
    muteOnJoin: boolean;
    allowScreenShare: boolean;
    allowRecording: boolean;
  };
};

type CreateMeetingResponse = {
  success: boolean;
  message?: string;
  data: RawMeetingItem;
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
    items: RawMeetingItem[];
    pagination: Pagination;
    serverTime?: string;
  };
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type SubscriptionEntitlements = {
  recording?: boolean;
  screenShare?: boolean;
};

type SubscriptionResponse = {
  success: boolean;
  data?: {
    entitlements?: SubscriptionEntitlements;
  };
};

const PAGE_LIMIT = 20;
const APP_LINK_BASE_URL = "https://onnon.app";
const DETECTED_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const getDefaultCreateForm = (timezone: string): CreateMeetingFormValues => ({
  title: "",
  startsNow: true,
  startsAt: new Date(),
  timezone,
  password: "",
  waitingRoom: true,
  muteOnJoin: true,
  allowScreenShare: true,
  allowRecording: false,
});
const getDefaultEditForm = (): EditMeetingFormValues => ({
  title: "",
  password: "",
  waitingRoom: false,
  muteOnJoin: true,
  allowScreenShare: true,
  allowRecording: false,
});

const normalizeMeeting = (raw: RawMeetingItem): MeetingItem => ({
  id: raw.id || raw.meetingId || "",
  joinCode: raw.joinCode,
  title: raw.title || "Untitled Meeting",
  hostName: raw.hostName || "Host",
  isHost: raw.isHost,
  startsAt: raw.startsAt || new Date().toISOString(),
  durationMinutes:
    typeof raw.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
      ? raw.durationMinutes
      : 30,
  participantCount:
    typeof raw.participantCount === "number" && Number.isFinite(raw.participantCount)
      ? raw.participantCount
      : 0,
  maxParticipants:
    typeof raw.maxParticipants === "number" && Number.isFinite(raw.maxParticipants)
      ? raw.maxParticipants
      : 25,
  passwordProtected: Boolean(raw.passwordProtected),
  status: (raw.status as MeetingStatus) || "scheduled",
  settings: raw.settings,
  links: raw.links,
});

export default function MeetingsScreen() {
  const router = useRouter();
  const { create } = useLocalSearchParams<{ create?: string | string[] }>();
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null);
  const [detectedTimezone, setDetectedTimezone] = useState(DETECTED_TIMEZONE);
  const [canUseRecording, setCanUseRecording] = useState(false);
  const [canUseScreenShare, setCanUseScreenShare] = useState(true);
  const [createForm, setCreateForm] = useState<CreateMeetingFormValues>(
    () => getDefaultCreateForm(DETECTED_TIMEZONE)
  );
  const [editForm, setEditForm] = useState<EditMeetingFormValues>(getDefaultEditForm);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTone, setPopupTone] = useState<PopupTone>("info");
  const [popupActions, setPopupActions] = useState<PopupAction[]>([
    { label: "OK", variant: "primary" },
  ]);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const shouldAutoOpenCreate = useMemo(() => {
    const value = Array.isArray(create) ? create[0] : create;
    return Boolean(value && value !== "0" && value !== "false");
  }, [create]);

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
        const nextItems = (payload?.items ?? []).map(normalizeMeeting);

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
    if (!shouldAutoOpenCreate) return;
    setCreateForm({
      ...getDefaultCreateForm(detectedTimezone),
      allowRecording: canUseRecording,
      allowScreenShare: canUseScreenShare,
    });
    setIsCreateOpen(true);
    router.setParams({ create: undefined });
  }, [canUseRecording, canUseScreenShare, detectedTimezone, router, shouldAutoOpenCreate]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setDetectedTimezone(timezone);
  }, []);

  useEffect(() => {
    const loadMeetingEntitlements = async () => {
      try {
        const response = await client.get<SubscriptionResponse>("/payments/subscription");
        const entitlements = response.data?.data?.entitlements;
        const recording = Boolean(entitlements?.recording);
        const screenShare =
          typeof entitlements?.screenShare === "boolean"
            ? entitlements.screenShare
            : true;

        setCanUseRecording(recording);
        setCanUseScreenShare(screenShare);
        setCreateForm((prev) => ({
          ...prev,
          allowRecording: recording ? prev.allowRecording : false,
          allowScreenShare: screenShare ? prev.allowScreenShare : false,
        }));
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        console.error("[Meetings] Failed to load meeting entitlements", {
          message: apiError?.message || String(err),
          code: apiError?.code,
          status: apiError?.response?.status,
          responseData: apiError?.response?.data,
        });
        setCanUseRecording(false);
      }
    };

    void loadMeetingEntitlements();
  }, []);

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
    const roomCode = meeting.joinCode || meeting.id;
    router.push({
      pathname: "/(app)/call-room",
      params: { meetingId: roomCode, title: meeting.title },
    });
  };

  const onShareScheduledMeeting = async (meeting: MeetingItem) => {
    const roomCode = meeting.joinCode || meeting.id;
    const deepLink = meeting.links?.deepLink || Linking.createURL(`/meeting/${roomCode}`, {
      queryParams: { title: meeting.title },
    });
    const universalLink =
      meeting.links?.universal ||
      `${APP_LINK_BASE_URL}/meeting/${encodeURIComponent(
        roomCode
      )}?title=${encodeURIComponent(meeting.title)}`;

    try {
      await Share.share({
        title: "Share Meeting",
        message: `Join my OnnOn meeting: ${meeting.title}\nMeeting code: ${roomCode}\nOpen: ${universalLink}\nApp link: ${deepLink}`,
        url: universalLink,
      });
    } catch (err) {
      const apiError = err as Error;
      console.error("[Meetings] Failed to share meeting link", {
        message: apiError?.message || String(err),
        meetingId: roomCode,
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

  const openCreateMeeting = () => {
    setCreateForm({
      ...getDefaultCreateForm(detectedTimezone),
      allowRecording: canUseRecording,
      allowScreenShare: canUseScreenShare,
    });
    setIsCreateOpen(true);
  };

  const closeCreateMeeting = () => {
    if (isCreatingMeeting) return;
    setIsCreateOpen(false);
    setCreateForm({
      ...getDefaultCreateForm(detectedTimezone),
      allowRecording: canUseRecording,
      allowScreenShare: canUseScreenShare,
    });
  };

  const patchCreateForm = (patch: Partial<CreateMeetingFormValues>) => {
    setCreateForm((prev) => ({
      ...prev,
      ...patch,
      allowRecording:
        canUseRecording && typeof patch.allowRecording === "boolean"
          ? patch.allowRecording
          : patch.allowRecording === undefined
          ? prev.allowRecording
          : false,
      allowScreenShare:
        canUseScreenShare && typeof patch.allowScreenShare === "boolean"
          ? patch.allowScreenShare
          : patch.allowScreenShare === undefined
          ? prev.allowScreenShare
          : false,
    }));
  };

  const patchEditForm = (patch: Partial<EditMeetingFormValues>) => {
    setEditForm((prev) => ({ ...prev, ...patch }));
  };

  const submitCreateMeeting = async () => {
    const trimmedTitle = createForm.title.trim();
    const trimmedTimezone = createForm.timezone.trim();
    const startsAtDate = createForm.startsNow ? new Date() : createForm.startsAt;

    if (!trimmedTitle) {
      showPopup({
        title: "Validation",
        message: "Meeting title is required.",
        tone: "danger",
      });
      return;
    }

    if (Number.isNaN(startsAtDate.getTime())) {
      showPopup({
        title: "Validation",
        message: "Please select a valid start date and time.",
        tone: "danger",
      });
      return;
    }

    if (!trimmedTimezone) {
      showPopup({
        title: "Validation",
        message: "Timezone is required.",
        tone: "danger",
      });
      return;
    }

    const payload: CreateMeetingRequest = {
      title: trimmedTitle,
      startsAt: startsAtDate.toISOString(),
      timezone: trimmedTimezone,
      password: createForm.password.trim(),
      settings: {
        waitingRoom: createForm.waitingRoom,
        muteOnJoin: createForm.muteOnJoin,
        allowScreenShare: canUseScreenShare ? createForm.allowScreenShare : false,
        allowRecording: canUseRecording ? createForm.allowRecording : false,
      },
    };

    try {
      setIsCreatingMeeting(true);
      let response: { data: CreateMeetingResponse };
      try {
        response = await client.post<CreateMeetingResponse>("/meetings/create", payload);
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        const isRouteMismatch =
          apiError?.response?.status === 404 &&
          apiError?.response?.data?.message?.toLowerCase?.().includes("route not found");
        if (!isRouteMismatch) throw err;
        response = await client.post<CreateMeetingResponse>("/meetings", payload);
      }
      const created = normalizeMeeting(response.data.data);
      setMeetings((prev) => [created, ...prev]);
      setPagination((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalItems: prev.totalItems + 1,
        };
      });
      closeCreateMeeting();
      if (createForm.startsNow) {
        const roomCode = created.joinCode || created.id;
        router.push({
          pathname: "/(app)/call-room",
          params: { meetingId: roomCode, title: created.title, created: "1" },
        });
      } else {
        showPopup({
          title: "Meeting Scheduled",
          message: "Your meeting has been scheduled.",
          tone: "success",
        });
      }
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      console.error("[Meetings] Failed to create meeting", {
        message: apiError?.message || String(err),
        code: apiError?.code,
        status: apiError?.response?.status,
        responseData: apiError?.response?.data,
      });
      showPopup({
        title: "Create Failed",
        message: apiError?.response?.data?.message || "Could not schedule meeting.",
        tone: "danger",
      });
    } finally {
      setIsCreatingMeeting(false);
    }
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
          onPress: async () => {
            try {
              await client.post(`/meetings/${meeting.id}/end`, {
                reason: "host_ended",
              });
              setMeetings((prev) => prev.filter((item) => item.id !== meeting.id));
            } catch (err) {
              const apiError = err as AxiosError<ApiErrorResponse>;
              showPopup({
                title: "End Failed",
                message:
                  apiError?.response?.data?.message ||
                  "Could not end this meeting right now.",
                tone: "danger",
              });
            }
          },
        },
      ],
    });
  };

  const openEditMeeting = (meeting: MeetingItem) => {
    setEditingMeeting(meeting);
    setEditForm({
      title: meeting.title || "",
      password: "",
      waitingRoom: Boolean(meeting.settings?.waitingRoom),
      muteOnJoin: meeting.settings?.muteOnJoin ?? true,
      allowScreenShare: meeting.settings?.allowScreenShare ?? true,
      allowRecording: Boolean(meeting.settings?.allowRecording),
    });
    setIsEditOpen(true);
  };

  const closeEditMeeting = () => {
    if (isSavingEdit) return;
    setIsEditOpen(false);
    setEditingMeeting(null);
    setEditForm(getDefaultEditForm());
  };

  const submitEditMeeting = async () => {
    if (!editingMeeting) return;
    const trimmedTitle = editForm.title.trim();
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
        password: editForm.password,
        settings: {
          waitingRoom: editForm.waitingRoom,
          muteOnJoin: editForm.muteOnJoin,
          allowScreenShare: editForm.allowScreenShare,
          allowRecording: editForm.allowRecording,
        },
      });

      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === editingMeeting.id
            ? {
                ...meeting,
                title: trimmedTitle,
                passwordProtected: editForm.password.trim().length > 0,
                settings: {
                  waitingRoom: editForm.waitingRoom,
                  muteOnJoin: editForm.muteOnJoin,
                  allowScreenShare: editForm.allowScreenShare,
                  allowRecording: editForm.allowRecording,
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
      <StatusBar style="light" />
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.kicker}>Meetings</Text>
            <Text style={styles.title}>Plan, start, and manage sessions</Text>
            <Text style={styles.subtitle}>Synced with backend meetings API.</Text>
          </View>
          <Pressable style={styles.headerCta} onPress={openCreateMeeting}>
            <Text style={styles.headerCtaText}>Create</Text>
          </Pressable>
        </View>
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

      <CreateMeetingModal
        visible={isCreateOpen}
        isSubmitting={isCreatingMeeting}
        values={createForm}
        canUseRecording={canUseRecording}
        canUseScreenShare={canUseScreenShare}
        onChange={patchCreateForm}
        onClose={closeCreateMeeting}
        onSubmit={submitCreateMeeting}
      />

      <EditMeetingModal
        visible={isEditOpen}
        isSubmitting={isSavingEdit}
        values={editForm}
        onChange={patchEditForm}
        onClose={closeEditMeeting}
        onSubmit={submitEditMeeting}
      />

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
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
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
  headerCta: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  headerCtaText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
});
