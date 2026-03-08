import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import client from "@/lib/client";
import { colors, type } from "@/src/theme/colors";

type MeetingStatus = "live" | "scheduled" | "completed";

type HomeMeetingItem = {
  id?: string;
  meetingId?: string;
  title?: string;
  hostName?: string;
  participantCount?: number;
  maxParticipants?: number;
  startsAt?: string;
  status?: MeetingStatus;
};

type MeetingsResponse = {
  success: boolean;
  message?: string;
  data?: {
    items?: HomeMeetingItem[];
  };
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

const MEETING_PREVIEW_LIMIT = 3;
const MEETING_FETCH_LIMIT = 20;

const getMeetingStatusPriority = (status?: MeetingStatus) => {
  if (status === "live") return 0;
  if (status === "scheduled") return 1;
  return 2;
};

export default function HomeScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<HomeMeetingItem[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [isRefreshingMeetings, setIsRefreshingMeetings] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);

  const fetchMeetingPreview = useCallback(async (mode: "initial" | "refresh") => {
    try {
      if (mode === "initial") setIsLoadingMeetings(true);
      if (mode === "refresh") setIsRefreshingMeetings(true);
      setMeetingsError(null);

      const response = await client.get<MeetingsResponse>("/meetings", {
        params: {
          page: 1,
          limit: MEETING_FETCH_LIMIT,
        },
      });

      setMeetings(response.data?.data?.items ?? []);
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      setMeetingsError(
        apiError?.response?.data?.message || "Could not load upcoming meetings."
      );
    } finally {
      if (mode === "initial") setIsLoadingMeetings(false);
      if (mode === "refresh") setIsRefreshingMeetings(false);
    }
  }, []);

  useEffect(() => {
    void fetchMeetingPreview("initial");
  }, [fetchMeetingPreview]);

  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter((meeting) => meeting.status === "live" || meeting.status === "scheduled")
      .sort((left, right) => {
        const statusDelta =
          getMeetingStatusPriority(left.status) - getMeetingStatusPriority(right.status);
        if (statusDelta !== 0) return statusDelta;

        const leftStartsAt = left.startsAt
          ? new Date(left.startsAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightStartsAt = right.startsAt
          ? new Date(right.startsAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        return leftStartsAt - rightStartsAt;
      })
      .slice(0, MEETING_PREVIEW_LIMIT);
  }, [meetings]);

  const onPressLiveMeeting = (meeting: HomeMeetingItem) => {
    if (meeting.status !== "live") return;
    const roomCode = meeting.meetingId || meeting.id;
    if (!roomCode) return;
    router.push({
      pathname: "/(app)/call-room",
      params: {
        meetingId: roomCode,
        title: meeting.title || "Untitled Meeting",
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingMeetings}
            onRefresh={() => void fetchMeetingPreview("refresh")}
            tintColor={colors.primaryDark}
          />
        }
      >
        <View style={styles.bgOrbTop} />
        <View style={styles.bgOrbBottom} />

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Dashboard</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Pick up where you left off and manage today&apos;s calls.</Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.primaryAction}
            onPress={() =>
              router.push({
                pathname: "/(app)/(tabs)/meetings",
                params: { create: String(Date.now()) },
              })
            }
          >
            <Ionicons name="add-circle" size={16} color={colors.primaryText} />
            <Text style={styles.primaryActionText}>Create Meeting</Text>
          </Pressable>
          <Link href="/(app)/billing" asChild>
            <Pressable style={styles.secondaryAction}>
              <Ionicons name="card" size={16} color={colors.text} />
              <Text style={styles.secondaryActionText}>Open Billing</Text>
            </Pressable>
          </Link>
        </View>

        <SectionHeader title="Upcoming Meetings" />
        <View style={styles.listCard}>
          {isLoadingMeetings ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={colors.primaryDark} />
              <Text style={styles.stateText}>Loading meetings...</Text>
            </View>
          ) : meetingsError ? (
            <View style={styles.stateBlock}>
              <Text style={styles.stateText}>{meetingsError}</Text>
            </View>
          ) : upcomingMeetings.length === 0 ? (
            <View style={styles.emptyMeetingsCard}>
              <View style={styles.emptyMeetingsIconWrap}>
                <Ionicons name="calendar-clear-outline" size={30} color={colors.primaryDark} />
              </View>
              <Text style={styles.emptyMeetingsTitle}>No meetings yet</Text>
              <Text style={styles.emptyMeetingsText}>
                Create a meeting to get started. Live and scheduled meetings will appear here.
              </Text>
              <Pressable
                style={styles.emptyMeetingsAction}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/meetings",
                    params: { create: String(Date.now()) },
                  })
                }
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.primaryText} />
                <Text style={styles.emptyMeetingsActionText}>Create Meeting</Text>
              </Pressable>
            </View>
          ) : (
            upcomingMeetings.map((meeting, index) => (
              <Pressable
                key={meeting.id || meeting.meetingId || `${meeting.title || "meeting"}-${index}`}
                onPress={() => onPressLiveMeeting(meeting)}
                disabled={meeting.status !== "live"}
                style={[
                  styles.rowItem,
                  index === upcomingMeetings.length - 1 && styles.lastRowItem,
                  meeting.status === "live" && styles.rowItemPressable,
                ]}
                accessibilityRole={meeting.status === "live" ? "button" : undefined}
                accessibilityState={{ disabled: meeting.status !== "live" }}
              >
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{meeting.title || "Untitled Meeting"}</Text>
                  <Text style={styles.rowMeta}>
                    {meeting.hostName || "Host"} • {meeting.participantCount ?? 0}/
                    {meeting.maxParticipants ?? 25}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    meeting.status === "live" ? styles.liveBadge : styles.scheduledBadge,
                  ]}
                >
                  <Text style={styles.badgeText}>{meeting.status || "scheduled"}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 90,
    gap: 10,
  },
  bgOrbTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#FFE6BA",
    top: -120,
    right: -90,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D8E8FA",
    bottom: -130,
    left: -90,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  kicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryActionText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.stroke,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryActionText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 14,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  rowItemPressable: {
    opacity: 1,
  },
  lastRowItem: {
    borderBottomWidth: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  stateBlock: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    textAlign: "center",
  },
  emptyMeetingsCard: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyMeetingsIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  emptyMeetingsTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyMeetingsText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyMeetingsAction: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyMeetingsActionText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveBadge: {
    backgroundColor: "#FFEBC9",
  },
  scheduledBadge: {
    backgroundColor: "#E5EEF8",
  },
  badgeText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
