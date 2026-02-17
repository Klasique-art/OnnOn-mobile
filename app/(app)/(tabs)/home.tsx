import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type } from "@/src/theme/colors";
import { mockMeetings } from "@/src/data/mockMeetings";
import { mockConversations } from "@/src/data/mockChat";
import { mockProfile } from "@/src/data/mockProfile";

export default function HomeScreen() {
  const upcoming = mockMeetings.filter((meeting) => meeting.status !== "completed").slice(0, 3);
  const liveCount = mockMeetings.filter((meeting) => meeting.status === "live").length;
  const unreadDm = mockConversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.bgOrbTop} />
        <View style={styles.bgOrbBottom} />

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Dashboard</Text>
          <Text style={styles.title}>Welcome, {mockProfile.displayName}</Text>
          <Text style={styles.subtitle}>
            You are on the {mockProfile.planName.toUpperCase()} plan. Let&apos;s run today&apos;s calls smoothly.
          </Text>

          <View style={styles.heroStats}>
            <StatPill label="Live Calls" value={String(liveCount)} />
            <StatPill label="Unread DMs" value={String(unreadDm)} />
            <StatPill label="Upcoming" value={String(upcoming.length)} />
          </View>
        </View>

        <View style={styles.quickActions}>
          <Link href="/(app)/call-room" asChild>
            <Pressable style={styles.primaryAction}>
              <Ionicons name="videocam" size={16} color={colors.primaryText} />
              <Text style={styles.primaryActionText}>Open Call Room</Text>
            </Pressable>
          </Link>
          <Link href="/(app)/billing" asChild>
            <Pressable style={styles.secondaryAction}>
              <Ionicons name="card" size={16} color={colors.text} />
              <Text style={styles.secondaryActionText}>Open Billing</Text>
            </Pressable>
          </Link>
        </View>

        <SectionHeader title="Today at a Glance" />
        <View style={styles.gridRow}>
          <InfoCard
            icon="calendar-outline"
            title="Meetings"
            value={`${mockMeetings.length}`}
            caption="Scheduled + live"
          />
          <InfoCard
            icon="chatbubble-ellipses-outline"
            title="Conversations"
            value={`${mockConversations.length}`}
            caption="Active threads"
          />
        </View>

        <SectionHeader title="Upcoming Meetings" />
        <View style={styles.listCard}>
          {upcoming.map((meeting) => (
            <View key={meeting.id} style={styles.rowItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{meeting.title}</Text>
                <Text style={styles.rowMeta}>
                  {meeting.hostName} • {meeting.participantCount}/{meeting.maxParticipants}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  meeting.status === "live" ? styles.liveBadge : styles.scheduledBadge,
                ]}
              >
                <Text style={styles.badgeText}>{meeting.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionHeader title="Recent Chats" />
        <View style={styles.listCard}>
          {mockConversations.slice(0, 3).map((conversation) => (
            <View key={conversation.id} style={styles.rowItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{conversation.displayName}</Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {conversation.lastMessage}
                </Text>
              </View>
              {conversation.unreadCount > 0 ? (
                <View style={styles.unreadBubble}>
                  <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  value,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoCaption}>{caption}</Text>
    </View>
  );
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
    backgroundColor: "#D6ECE3",
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
  heroStats: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  statValue: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
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
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  infoTitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  infoValue: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 23,
    fontWeight: "800",
  },
  infoCaption: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  liveBadge: {
    backgroundColor: "#D5F3E8",
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
  unreadBubble: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
  },
});
