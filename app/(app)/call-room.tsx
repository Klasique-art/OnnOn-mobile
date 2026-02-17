import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenNav from "@/src/components/ScreenNav";
import { colors, type } from "@/src/theme/colors";
import {
  CallChatMessage,
  CallParticipant,
  callChatReplies,
  remoteParticipantPool,
} from "@/src/data/mockCall";

function makeRoomId() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const seg = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg()}-${seg()}-${seg()}`;
}

export default function CallRoomScreen() {
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState<"lobby" | "inCall">("lobby");

  const [callTitle, setCallTitle] = useState("Weekly Product Sync");
  const [displayName, setDisplayName] = useState("You");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [roomId, setRoomId] = useState("");

  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<CallChatMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState("");

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isShareRequested, setIsShareRequested] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activeRemotePool = useMemo(
    () =>
      remoteParticipantPool.filter(
        (person) => !participants.some((p) => p.name === person.name)
      ),
    [participants]
  );

  const tileColumns = useMemo(() => {
    const count = participants.length || 1;
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
  }, [participants.length]);

  const tileGap = 8;
  const tileWidth = useMemo(() => {
    const horizontalPadding = 20;
    const totalGap = tileGap * (tileColumns - 1);
    const usableWidth = width - horizontalPadding - totalGap;
    return Math.max(95, Math.floor(usableWidth / tileColumns));
  }, [tileColumns, width]);

  useEffect(() => {
    if (phase !== "inCall") return;
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "inCall" || participants.length <= 1) return;
    const remoteParticipants = participants.filter((p) => !p.isLocal);
    if (remoteParticipants.length === 0) return;

    const id = setInterval(() => {
      const random = remoteParticipants[Math.floor(Math.random() * remoteParticipants.length)];
      setSpeakerId(random?.id || null);
    }, 2200);

    return () => clearInterval(id);
  }, [participants, phase]);

  const formattedElapsed = useMemo(() => {
    const h = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(elapsedSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [elapsedSeconds]);

  const bootstrapParticipants = (activeRoomId: string) => {
    const local: CallParticipant = {
      id: "local-me",
      name: displayName.trim() || "You",
      isLocal: true,
      isHost: true,
      isMicOn,
      isCameraOn: isCamOn,
    };
    const remoteA: CallParticipant = {
      id: `remote-${Date.now()}-1`,
      ...remoteParticipantPool[0],
    };
    const remoteB: CallParticipant = {
      id: `remote-${Date.now()}-2`,
      ...remoteParticipantPool[1],
    };
    setRoomId(activeRoomId);
    setParticipants([local, remoteA, remoteB]);
    setSpeakerId(remoteA.id);
    setChatMessages([
      {
        id: "chat-hello",
        senderId: remoteA.id,
        senderName: remoteA.name,
        text: "Welcome everyone. Let's begin.",
        sentAt: new Date().toISOString(),
        mine: false,
      },
    ]);
    setElapsedSeconds(0);
    setPhase("inCall");
  };

  const createMeetingNow = () => {
    bootstrapParticipants(makeRoomId());
  };

  const joinMeeting = () => {
    if (!joinRoomId.trim()) return;
    bootstrapParticipants(joinRoomId.trim().toLowerCase());
  };

  const leaveCall = () => {
    setPhase("lobby");
    setParticipants([]);
    setChatMessages([]);
    setDraftMessage("");
    setJoinRoomId("");
    setRoomId("");
    setElapsedSeconds(0);
    setChatOpen(false);
    setParticipantsOpen(false);
  };

  const toggleLocalMic = () => {
    setIsMicOn((prev) => !prev);
    setParticipants((prev) =>
      prev.map((p) =>
        p.isLocal ? { ...p, isMicOn: !isMicOn } : p
      )
    );
  };

  const toggleLocalCam = () => {
    setIsCamOn((prev) => !prev);
    setParticipants((prev) =>
      prev.map((p) =>
        p.isLocal ? { ...p, isCameraOn: !isCamOn } : p
      )
    );
  };

  const addParticipant = () => {
    const next = activeRemotePool[0];
    if (!next) return;
    setParticipants((prev) => [
      ...prev,
      { id: `remote-${Date.now()}`, ...next },
    ]);
  };

  const removeLastRemote = () => {
    setParticipants((prev) => {
      const remotes = prev.filter((p) => !p.isLocal);
      if (remotes.length === 0) return prev;
      const removeId = remotes[remotes.length - 1].id;
      return prev.filter((p) => p.id !== removeId);
    });
  };

  const sendChat = () => {
    const text = draftMessage.trim();
    if (!text) return;

    const localName =
      participants.find((p) => p.isLocal)?.name || displayName || "You";

    const mine: CallChatMessage = {
      id: `chat-${Date.now()}`,
      senderId: "local-me",
      senderName: localName,
      text,
      sentAt: new Date().toISOString(),
      mine: true,
    };
    setChatMessages((prev) => [...prev, mine]);
    setDraftMessage("");

    const remoteParticipants = participants.filter((p) => !p.isLocal);
    if (remoteParticipants.length === 0) return;
    const randomRemote =
      remoteParticipants[Math.floor(Math.random() * remoteParticipants.length)];
    const randomReply =
      callChatReplies[Math.floor(Math.random() * callChatReplies.length)];

    setTimeout(() => {
      const reply: CallChatMessage = {
        id: `chat-${Date.now()}-r`,
        senderId: randomRemote.id,
        senderName: randomRemote.name,
        text: randomReply,
        sentAt: new Date().toISOString(),
        mine: false,
      };
      setChatMessages((prev) => [...prev, reply]);
    }, 900);
  };

  if (phase === "lobby") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.lobbyContent}>
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />
          <ScreenNav title="Call Room" fallbackHref="/(app)/(tabs)/home" />

          <View style={styles.heroCard}>
            <Text style={styles.kicker}>Zoom-like Room</Text>
            <Text style={styles.heroTitle}>Join or create a live call</Text>
            <Text style={styles.heroSub}>
              Simulation mode with adaptive tile layout, call controls, and meeting chat.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Your Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder="How participants see you"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.preToggleRow}>
              <Pressable
                onPress={toggleLocalMic}
                style={[styles.preToggle, !isMicOn && styles.preToggleMuted]}
              >
                <Ionicons
                  name={isMicOn ? "mic" : "mic-off"}
                  size={16}
                  color={isMicOn ? colors.primaryDark : "#8C2D1E"}
                />
                <Text style={styles.preToggleText}>{isMicOn ? "Mic On" : "Mic Off"}</Text>
              </Pressable>
              <Pressable
                onPress={toggleLocalCam}
                style={[styles.preToggle, !isCamOn && styles.preToggleMuted]}
              >
                <Ionicons
                  name={isCamOn ? "videocam" : "videocam-off"}
                  size={16}
                  color={isCamOn ? colors.primaryDark : "#8C2D1E"}
                />
                <Text style={styles.preToggleText}>
                  {isCamOn ? "Camera On" : "Camera Off"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Start New Meeting</Text>
            <TextInput
              value={callTitle}
              onChangeText={setCallTitle}
              style={styles.input}
              placeholder="Meeting title"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.primaryBtn} onPress={createMeetingNow}>
              <Text style={styles.primaryBtnText}>Create & Start Call</Text>
            </Pressable>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Join Existing Meeting</Text>
            <TextInput
              value={joinRoomId}
              onChangeText={setJoinRoomId}
              style={styles.input}
              placeholder="abc-def-ghi"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.primaryBtn, !joinRoomId.trim() && styles.disabledBtn]}
              disabled={!joinRoomId.trim()}
              onPress={joinMeeting}
            >
              <Text style={styles.primaryBtnText}>Join Meeting</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.inCallHeader}>
        <View>
          <Text style={styles.roomTitle}>{callTitle}</Text>
          <Text style={styles.roomMeta}>
            Room: {roomId} • {formattedElapsed}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerActionBtn}
            onPress={() => setParticipantsOpen((prev) => !prev)}
          >
            <Ionicons name="people" size={18} color={colors.text} />
            <Text style={styles.headerActionText}>{participants.length}</Text>
          </Pressable>
          <Pressable
            style={styles.headerActionBtn}
            onPress={() => setChatOpen((prev) => !prev)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={participants}
        key={`${tileColumns}`}
        numColumns={tileColumns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tilesWrap}
        columnWrapperStyle={tileColumns > 1 ? { gap: tileGap } : undefined}
        renderItem={({ item }) => {
          const isSpeaking = speakerId === item.id;
          return (
            <View
              style={[
                styles.tile,
                {
                  width: tileWidth,
                  borderColor: isSpeaking ? "#7BC9AE" : "#1A2D42",
                },
              ]}
            >
              {!item.isCameraOn ? (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={styles.fakeVideoSurface}>
                  <View style={styles.fakeVideoGradient} />
                </View>
              )}

              <View style={styles.tileFooter}>
                <Text style={styles.tileName}>
                  {item.name}
                  {item.isHost ? " (Host)" : ""}
                </Text>
                <View style={styles.tileIcons}>
                  <Ionicons
                    name={item.isMicOn ? "mic" : "mic-off"}
                    size={12}
                    color={item.isMicOn ? "#D8F4EA" : "#FFD5CE"}
                  />
                  <Ionicons
                    name={item.isCameraOn ? "videocam" : "videocam-off"}
                    size={12}
                    color={item.isCameraOn ? "#D8F4EA" : "#FFD5CE"}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.controlsBar}>
        <ControlButton
          icon={isMicOn ? "mic" : "mic-off"}
          label={isMicOn ? "Mute" : "Unmute"}
          danger={!isMicOn}
          onPress={toggleLocalMic}
        />
        <ControlButton
          icon={isCamOn ? "videocam" : "videocam-off"}
          label={isCamOn ? "Cam Off" : "Cam On"}
          danger={!isCamOn}
          onPress={toggleLocalCam}
        />
        <ControlButton
          icon="share-social"
          label={isShareRequested ? "Stop Share" : "Share"}
          onPress={() => setIsShareRequested((prev) => !prev)}
        />
        <ControlButton
          icon="chatbubble-ellipses"
          label="Chat"
          onPress={() => setChatOpen((prev) => !prev)}
        />
        <Pressable style={styles.leaveBtn} onPress={leaveCall}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.leaveText}>Leave</Text>
        </Pressable>
      </View>

      {participantsOpen ? (
        <View style={styles.panelOverlay}>
          <View style={styles.slidePanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Participants</Text>
              <Pressable onPress={() => setParticipantsOpen(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {participants.map((p) => (
                <View key={p.id} style={styles.participantRow}>
                  <Text style={styles.participantName}>{p.name}</Text>
                  <View style={styles.participantStatus}>
                    <Ionicons
                      name={p.isMicOn ? "mic" : "mic-off"}
                      size={14}
                      color={p.isMicOn ? colors.primaryDark : "#8C2D1E"}
                    />
                    <Ionicons
                      name={p.isCameraOn ? "videocam" : "videocam-off"}
                      size={14}
                      color={p.isCameraOn ? colors.primaryDark : "#8C2D1E"}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.simActions}>
              <Pressable onPress={addParticipant} style={styles.simBtn}>
                <Text style={styles.simBtnText}>Simulate Join</Text>
              </Pressable>
              <Pressable onPress={removeLastRemote} style={styles.simBtn}>
                <Text style={styles.simBtnText}>Simulate Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {chatOpen ? (
        <View style={styles.chatOverlay}>
          <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={84}>
            <View style={styles.chatPanel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Meeting Chat</Text>
                <Pressable onPress={() => setChatOpen(false)}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.chatBody}>
                {chatMessages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      msg.mine ? styles.chatBubbleMine : styles.chatBubbleRemote,
                    ]}
                  >
                    {!msg.mine ? <Text style={styles.chatSender}>{msg.senderName}</Text> : null}
                    <Text style={[styles.chatText, msg.mine && { color: "#fff" }]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.chatComposer}>
                <TextInput
                  value={draftMessage}
                  onChangeText={setDraftMessage}
                  style={styles.chatInput}
                  placeholder="Message everyone..."
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable
                  onPress={sendChat}
                  style={[styles.chatSendBtn, !draftMessage.trim() && styles.disabledBtn]}
                  disabled={!draftMessage.trim()}
                >
                  <Ionicons name="send" size={15} color="#fff" />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.controlBtn, danger && styles.controlBtnDanger]}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#081423",
  },
  bgOrbTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#D2E8DF",
    top: -120,
    right: -100,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D3E0F4",
    bottom: -120,
    left: -80,
  },
  lobbyContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
    backgroundColor: colors.bg,
    minHeight: "100%",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  kicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 32,
    lineHeight: 38,
  },
  heroSub: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  preToggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  preToggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  preToggleMuted: {
    backgroundColor: "#FCEBE8",
    borderColor: "#E8C1BB",
  },
  preToggleText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBtn: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.55,
  },
  inCallHeader: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0E2136",
    borderBottomWidth: 1,
    borderBottomColor: "#203B59",
  },
  roomTitle: {
    color: "#F7FCFF",
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
  },
  roomMeta: {
    color: "#95AEC8",
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1B3652",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#284869",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerActionText: {
    color: "#E3EEFB",
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  tilesWrap: {
    padding: 10,
    gap: 8,
    paddingBottom: 120,
  },
  tile: {
    height: 135,
    backgroundColor: "#10243A",
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  fakeVideoSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  fakeVideoGradient: {
    flex: 1,
    backgroundColor: "#18314C",
  },
  avatarFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    color: "#E6F0FF",
    fontFamily: type.body,
    fontSize: 26,
    fontWeight: "800",
  },
  tileFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: "rgba(6, 15, 25, 0.72)",
  },
  tileName: {
    color: "#F2F8FF",
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  tileIcons: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 6,
  },
  controlsBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 12,
    backgroundColor: "rgba(13, 28, 46, 0.94)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#294668",
    padding: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#203C5D",
    borderWidth: 1,
    borderColor: "#2D5279",
  },
  controlBtnDanger: {
    backgroundColor: "#7B2D25",
    borderColor: "#99463D",
  },
  controlText: {
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "700",
  },
  leaveBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 64,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#B63A2F",
    borderWidth: 1,
    borderColor: "#D15B50",
  },
  leaveText: {
    color: "#fff",
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
  },
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 10, 17, 0.38)",
    justifyContent: "flex-end",
  },
  slidePanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    gap: 8,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "800",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  participantName: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "600",
  },
  participantStatus: {
    flexDirection: "row",
    gap: 8,
  },
  simActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  simBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  simBtnText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(5, 12, 20, 0.4)",
  },
  chatPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    gap: 8,
    maxHeight: "58%",
  },
  chatBody: {
    maxHeight: 250,
  },
  chatBubble: {
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "90%",
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  chatBubbleRemote: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  chatSender: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  chatText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
  },
  chatComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: type.body,
    fontSize: 14,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
});
