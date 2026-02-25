import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState, useEffect } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView, type MediaStream } from "react-native-webrtc";
import ScreenNav from "@/src/components/ScreenNav";
import { colors, type } from "@/src/theme/colors";
import { hasRealtimeConfig, runtimeConfig } from "@/src/config/runtime";
import {
  CallChatMessage,
  CallParticipant,
  callChatReplies,
  remoteParticipantPool,
} from "@/src/data/mockCall";
import { socketManager } from "@/src/realtime/socket";
import { getRouterCapabilities } from "@/src/realtime/mediasoup.socket";
import {
  joinRoom,
  leaveRoom,
  onRoomMessage,
  sendRoomMessage,
} from "@/src/realtime/room.socket";
import {
  getLocalMediaStream,
  getScreenShareStream,
  stopStream,
} from "@/src/calls/webrtc";
import {
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  startInAppRecording,
  stopInAppRecording,
  startGlobalRecording,
  stopGlobalRecording,
  useGlobalRecording,
} from "react-native-nitro-screen-recorder";

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
  const [authToken, setAuthToken] = useState("");
  const [enableRealtime, setEnableRealtime] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");
  const [realtimeInfo, setRealtimeInfo] = useState("Simulation mode active");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [mediaInfo, setMediaInfo] = useState("Camera and mic not started yet.");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { isRecording } = useGlobalRecording({
    settledTimeMs: 1000,
  });
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);

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
    return () => {
      stopStream(localStream);
      stopStream(screenShareStream);
      socketManager.disconnect();
    };
  }, [localStream, screenShareStream]);

  useEffect(() => {
    if (phase !== "inCall") return;
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "inCall" || !isRecording) return;
    const id = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isRecording]);

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
  const formattedRecording = useMemo(() => {
    const m = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
    const s = String(recordingSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [recordingSeconds]);
  const isSharingScreen = isShareRequested && !!screenShareStream;

  const setLocalParticipantState = (nextMicOn: boolean, nextCamOn: boolean) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.isLocal ? { ...p, isMicOn: nextMicOn, isCameraOn: nextCamOn } : p
      )
    );
  };

  const hasTrack = (kind: "audio" | "video") =>
    Boolean(localStream?.getTracks().find((track) => track.kind === kind));

  const setTrackEnabled = (kind: "audio" | "video", enabled: boolean) => {
    localStream
      ?.getTracks()
      .filter((track) => track.kind === kind)
      .forEach((track) => {
        track.enabled = enabled;
      });
  };

  const startOrRefreshLocalMedia = async ({
    audio,
    video,
  }: {
    audio: boolean;
    video: boolean;
  }) => {
    if (!audio && !video) {
      stopStream(localStream);
      setLocalStream(null);
      setMediaInfo("Camera and mic are off.");
      return;
    }

    try {
      stopStream(localStream);
      const stream = await getLocalMediaStream({ audio, video });
      setLocalStream(stream);
      setMediaInfo("Camera and mic connected.");
    } catch {
      setLocalStream(null);
      setMediaInfo("Could not access camera/mic. Check device permissions.");
      setIsMicOn(false);
      setIsCamOn(false);
      setLocalParticipantState(false, false);
    }
  };

  const stopScreenShare = () => {
    stopStream(screenShareStream);
    setScreenShareStream(null);
    setIsShareRequested(false);
  };

  const toggleScreenShare = async () => {
    if (isShareRequested) {
      stopScreenShare();
      setMediaInfo("Screen sharing stopped.");
      return;
    }

    try {
      const stream = await getScreenShareStream();
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
          setMediaInfo("Screen sharing ended.");
        };
      }
      setScreenShareStream(stream);
      setIsShareRequested(true);
      setMediaInfo("Screen sharing active.");
    } catch {
      setMediaInfo("Unable to start screen sharing on this device/build.");
    }
  };

  const saveRecordingToLibrary = async (path: string) => {
    const normalizedPath = path.startsWith("file://") ? path : `file://${path}`;
    let isStable = false;
    for (let i = 0; i < 6; i += 1) {
      const info = await FileSystem.getInfoAsync(normalizedPath, { size: true });
      if (info.exists && typeof info.size === "number" && info.size > 16_000) {
        isStable = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (!isStable) {
      throw new Error("Recording file is not finalized yet.");
    }

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      return { saved: false as const, path: normalizedPath };
    }
    await MediaLibrary.saveToLibraryAsync(normalizedPath);
    return { saved: true as const, path: normalizedPath };
  };

  const startRecording = async () => {
    setRecordingSeconds(0);
    let enableMic = isMicOn;

    if (enableMic && getMicrophonePermissionStatus() !== "granted") {
      try {
        const permission = await requestMicrophonePermission();
        if (permission.status !== "granted") {
          enableMic = false;
          Alert.alert(
            "Microphone Permission Not Granted",
            "Screen recording will continue without microphone audio."
          );
        }
      } catch {
        enableMic = false;
        Alert.alert(
          "Microphone Permission Not Granted",
          "Screen recording will continue without microphone audio."
        );
      }
    }

    try {
      if (Platform.OS === "ios") {
        await startInAppRecording({
          options: {
            enableMic,
            enableCamera: false,
          },
          onRecordingFinished: (file) => {
            if (file?.path) setLastRecordingPath(file.path);
          },
        });
      } else {
        startGlobalRecording({
          options: { enableMic },
          onRecordingError: (error) => {
            setMediaInfo(`Recording error: ${error.message}`);
            Alert.alert("Recording Error", error.message);
          },
        });
      }
      setMediaInfo(
        enableMic
          ? "Meeting recording started with microphone."
          : "Meeting recording started without microphone."
      );
    } catch {
      setMediaInfo("Unable to start screen recording on this build.");
      Alert.alert(
        "Recording Unavailable",
        "Could not start recording. Rebuild this dev client after native changes."
      );
    }
  };

  const stopRecording = async () => {
    try {
      const file =
        Platform.OS === "ios"
          ? await stopInAppRecording()
          : await stopGlobalRecording({ settledTimeMs: 4500 });
      if (file?.path) {
        setLastRecordingPath(file.path);
        const result = await saveRecordingToLibrary(file.path);
        setMediaInfo("Recording stopped and saved.");
        if (result.saved) {
          Alert.alert(
            "Recording Saved",
            Platform.OS === "ios"
              ? "Saved to Photos."
              : "Saved to Gallery/Photos."
          );
        } else {
          Alert.alert(
            "Recording Saved",
            `Saved in app storage:\n${result.path}\n\nGrant Photos/Media permission to auto-save to gallery.`
          );
        }
      } else {
        setMediaInfo("Recording stopped, but no file was returned.");
        Alert.alert(
          "Recording Stopped",
          "Recording ended, but the file path was not returned."
        );
      }
    } catch {
      setMediaInfo("Unable to stop recording cleanly.");
      Alert.alert("Stop Failed", "Could not stop recording. Please try again.");
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
    setIsMoreMenuOpen(false);
  };

  const bootstrapParticipants = async (activeRoomId: string) => {
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
    await startOrRefreshLocalMedia({ audio: isMicOn, video: isCamOn });

    if (enableRealtime && authToken.trim() && hasRealtimeConfig) {
      setRealtimeStatus("connecting");
      setRealtimeInfo("Connecting to signaling...");
      try {
        const socket = socketManager.connect(authToken.trim());
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Socket timeout")), 12000);
          socket.on("connect", () => {
            clearTimeout(timeout);
            resolve();
          });
          socket.on("connect_error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        joinRoom(activeRoomId);
        const capabilities = await getRouterCapabilities(activeRoomId);
        if (capabilities.error) {
          setRealtimeInfo(`Connected, mediasoup error: ${capabilities.error}`);
        } else {
          setRealtimeInfo("Connected to backend signaling + mediasoup router.");
        }
        setRealtimeStatus("connected");
      } catch {
        setRealtimeStatus("failed");
        setRealtimeInfo("Realtime connect failed. Using simulation fallback.");
      }
    } else {
      setRealtimeStatus("idle");
      setRealtimeInfo("Simulation mode active");
    }
  };

  const createMeetingNow = async () => {
    await bootstrapParticipants(makeRoomId());
  };

  const joinMeeting = async () => {
    if (!joinRoomId.trim()) return;
    await bootstrapParticipants(joinRoomId.trim().toLowerCase());
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
    setIsMoreMenuOpen(false);
    stopStream(localStream);
    setLocalStream(null);
    stopScreenShare();
    if (isRecording) {
      void stopRecording();
    }
    setRecordingSeconds(0);
    setMediaInfo("Camera and mic not started yet.");
    if (socketManager.isConnected()) {
      leaveRoom(roomId);
      socketManager.disconnect();
    }
    setRealtimeStatus("idle");
    setRealtimeInfo("Simulation mode active");
  };

  const toggleLocalMic = () => {
    const nextMic = !isMicOn;
    setIsMicOn(nextMic);
    setLocalParticipantState(nextMic, isCamOn);
    setTrackEnabled("audio", nextMic);
    if (phase === "inCall" && nextMic && !hasTrack("audio")) {
      void startOrRefreshLocalMedia({ audio: nextMic, video: isCamOn });
    }
  };

  const toggleLocalCam = () => {
    const nextCam = !isCamOn;
    setIsCamOn(nextCam);
    setLocalParticipantState(isMicOn, nextCam);
    setTrackEnabled("video", nextCam);
    if (phase === "inCall" && nextCam && !hasTrack("video")) {
      void startOrRefreshLocalMedia({ audio: isMicOn, video: nextCam });
    }
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

    if (socketManager.isConnected()) {
      sendRoomMessage({ roomId, text });
    }

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

  useEffect(() => {
    if (!socketManager.isConnected()) return;
    const unsubscribe = onRoomMessage((payload) => {
      if (payload.userId === "local-me") return;
      const incoming: CallChatMessage = {
        id: `chat-${Date.now()}-socket`,
        senderId: payload.userId,
        senderName: payload.displayName || "Participant",
        text: payload.text,
        sentAt: payload.sentAt || new Date().toISOString(),
        mine: false,
      };
      setChatMessages((prev) => [...prev, incoming]);
    });
    return unsubscribe;
  }, [phase]);

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
                  color={isMicOn ? colors.primaryDark : "#DC0000"}
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
                  color={isCamOn ? colors.primaryDark : "#DC0000"}
                />
                <Text style={styles.preToggleText}>
                  {isCamOn ? "Camera On" : "Camera Off"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Realtime Integration (Optional)</Text>
            <Text style={styles.integrationHelp}>
              Backend: {runtimeConfig.socketUrl}
            </Text>
            <TextInput
              value={authToken}
              onChangeText={setAuthToken}
              style={styles.input}
              placeholder="JWT token (for real socket + mediasoup)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setEnableRealtime((prev) => !prev)}
              style={[
                styles.preToggle,
                !enableRealtime && styles.preToggleMuted,
              ]}
            >
              <Text style={styles.preToggleText}>
                {enableRealtime ? "Realtime: Enabled" : "Realtime: Disabled"}
              </Text>
            </Pressable>
            <Text style={styles.integrationStatus}>
              Status: {realtimeStatus.toUpperCase()} - {realtimeInfo}
            </Text>
            <Text style={styles.integrationStatus}>Media: {mediaInfo}</Text>
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
          <Text style={styles.roomMeta}>
            {realtimeStatus === "connected"
              ? "Realtime connected"
              : "Simulation mode"}
          </Text>
          {isRecording ? (
            <View
              style={styles.recordingBadge}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Recording in progress. Elapsed ${formattedRecording}`}
            >
              <View style={styles.recordingDot} />
              <Text style={styles.recordingBadgeText}>Recording {formattedRecording}</Text>
            </View>
          ) : null}
          {isSharingScreen ? (
            <View style={styles.sharingBadge}>
              <Ionicons name="desktop" size={12} color="#fff" />
              <Text style={styles.sharingBadgeText}>You are sharing your screen</Text>
            </View>
          ) : null}
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
        ListHeaderComponent={
          isSharingScreen && screenShareStream ? (
            <View style={styles.shareStageWrap}>
              <Text style={styles.shareStageLabel}>Shared Screen</Text>
              <View style={styles.shareStage}>
                <RTCView
                  streamURL={screenShareStream.toURL()}
                  style={styles.shareStageVideo}
                  objectFit="cover"
                  zOrder={0}
                />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSpeaking = speakerId === item.id;
          return (
            <View
              style={[
                styles.tile,
                isSharingScreen && styles.tileCompact,
                {
                  width: tileWidth,
                  borderColor: isSpeaking ? "#E8A339" : "#1A2D42",
                },
              ]}
            >
              {!item.isCameraOn ? (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              ) : item.isLocal && isSharingScreen ? (
                <View style={styles.shareSelfPlaceholder}>
                  <Ionicons name="desktop" size={18} color="#EAF3FF" />
                  <Text style={styles.shareSelfPlaceholderText}>Sharing Screen</Text>
                </View>
              ) : item.isLocal && localStream ? (
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.localVideo}
                  objectFit="cover"
                  mirror
                />
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
                    color={item.isMicOn ? "#FFEFD2" : "#FFB8B8"}
                  />
                  <Ionicons
                    name={item.isCameraOn ? "videocam" : "videocam-off"}
                    size={12}
                    color={item.isCameraOn ? "#FFEFD2" : "#FFB8B8"}
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
          label="Mic"
          danger={!isMicOn}
          onPress={toggleLocalMic}
          active={isMicOn}
          accessibilityLabel={isMicOn ? "Mute microphone" : "Unmute microphone"}
        />
        <ControlButton
          icon={isCamOn ? "videocam" : "videocam-off"}
          label="Camera"
          danger={!isCamOn}
          onPress={toggleLocalCam}
          active={isCamOn}
          accessibilityLabel={isCamOn ? "Turn camera off" : "Turn camera on"}
        />
        <ControlButton
          icon="share-social"
          label="Share"
          onPress={() => void toggleScreenShare()}
          active={isShareRequested}
          accessibilityLabel={isShareRequested ? "Stop screen sharing" : "Start screen sharing"}
        />
        <ControlButton
          icon="ellipsis-horizontal"
          label="More"
          onPress={() => setIsMoreMenuOpen((prev) => !prev)}
          active={isMoreMenuOpen}
          accessibilityLabel={isMoreMenuOpen ? "Close more options" : "Open more options"}
        />
        <ControlButton
          icon="call"
          label="Leave"
          danger
          onPress={leaveCall}
          accessibilityLabel="Leave call"
        />
      </View>

      {isMoreMenuOpen ? (
        <View style={styles.moreMenuOverlay}>
          <Pressable
            style={styles.moreMenuBackdrop}
            onPress={() => setIsMoreMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close options menu"
          />
          <View
            style={styles.moreMenuCard}
            accessible
            accessibilityRole="menu"
            accessibilityLabel="Call options"
          >
            <Pressable
              style={styles.moreMenuItem}
              onPress={() => {
                setChatOpen(true);
                setIsMoreMenuOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Open meeting chat"
            >
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
              <Text style={styles.moreMenuText}>Chat</Text>
            </Pressable>
            <Pressable
              style={styles.moreMenuItem}
              onPress={() => {
                setParticipantsOpen(true);
                setIsMoreMenuOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Open participants list"
            >
              <Ionicons name="people" size={16} color={colors.text} />
              <Text style={styles.moreMenuText}>Participants</Text>
            </Pressable>
            <Pressable
              style={[styles.moreMenuItem, isRecording && styles.moreMenuItemDanger]}
              onPress={() => void toggleRecording()}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
            >
              <Ionicons
                name={isRecording ? "stop-circle" : "radio-button-on"}
                size={16}
                color={isRecording ? "#fff" : "#DC0000"}
              />
              <Text style={[styles.moreMenuText, isRecording && styles.moreMenuTextDanger]}>
                {isRecording ? "Stop Recording" : "Record Meeting"}
              </Text>
            </Pressable>
            {lastRecordingPath ? (
              <View style={styles.lastSavedWrap}>
                <Text style={styles.lastSavedLabel}>Last saved recording</Text>
                <Text numberOfLines={2} style={styles.lastSavedPath}>
                  {lastRecordingPath}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

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
                      color={p.isMicOn ? colors.primaryDark : "#DC0000"}
                    />
                    <Ionicons
                      name={p.isCameraOn ? "videocam" : "videocam-off"}
                      size={14}
                      color={p.isCameraOn ? colors.primaryDark : "#DC0000"}
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
  active,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.controlBtn, active && styles.controlBtnActive, danger && styles.controlBtnDanger]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: !!active }}
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
    backgroundColor: "#FFE5B7",
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
  integrationHelp: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: -4,
  },
  integrationStatus: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
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
    backgroundColor: "#FFE5E5",
    borderColor: "#F3A3A3",
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
  recordingBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(220, 0, 0, 0.15)",
    borderWidth: 1,
    borderColor: "#DC0000",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#DC0000",
  },
  recordingBadgeText: {
    color: "#FFE6E6",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
  },
  sharingBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC0000",
    borderWidth: 1,
    borderColor: "#F04A4A",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sharingBadgeText: {
    color: "#fff",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
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
  shareStageWrap: {
    marginBottom: 10,
  },
  shareStageLabel: {
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  shareStage: {
    height: 240,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E8A339",
    backgroundColor: "#0C1D2F",
  },
  shareStageVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  tile: {
    height: 135,
    backgroundColor: "#10243A",
    borderRadius: 14,
    borderWidth: 2,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  tileCompact: {
    height: 102,
  },
  fakeVideoSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  localVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  shareSelfPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  shareSelfPlaceholderText: {
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    height: 54,
    paddingHorizontal: 2,
    borderRadius: 10,
    backgroundColor: "#203C5D",
    borderWidth: 1,
    borderColor: "#2D5279",
  },
  controlBtnActive: {
    borderColor: "#E8A339",
    backgroundColor: "#274969",
  },
  controlBtnDanger: {
    backgroundColor: "#B30000",
    borderColor: "#D03434",
  },
  controlText: {
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "700",
  },
  moreMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  moreMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  moreMenuCard: {
    position: "absolute",
    right: 12,
    bottom: 82,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    padding: 6,
    gap: 4,
  },
  moreMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  moreMenuItemDanger: {
    backgroundColor: "#DC0000",
    borderColor: "#B30000",
  },
  moreMenuText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  moreMenuTextDanger: {
    color: "#fff",
  },
  lastSavedWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lastSavedLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  lastSavedPath: {
    marginTop: 2,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "600",
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

