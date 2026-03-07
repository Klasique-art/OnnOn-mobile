import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { AxiosError } from "axios";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  Alert,
  AppState,
  type AppStateStatus,
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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView, type MediaStream } from "react-native-webrtc";
import ScreenNav from "@/src/components/ScreenNav";
import client from "@/lib/client";
import { colors, type } from "@/src/theme/colors";
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

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type CallParticipant = {
  id: string;
  name: string;
  isHost: boolean;
  isLocal: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
};

type CallChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
  mine: boolean;
};

type InvitePreviewResponse = {
  success: boolean;
  data: {
    meetingId: string;
    title: string;
    hostName: string;
    startsAt: string;
    status: "live" | "scheduled" | "completed";
    requiresPassword: boolean;
    settings?: {
      waitingRoom?: boolean;
      muteOnJoin?: boolean;
    };
  };
};

type JoinMeetingRequest = {
  displayName: string;
  password?: string;
  preJoin: {
    micOn: boolean;
    cameraOn: boolean;
  };
  device: {
    platform: string;
    appVersion: string;
  };
};

type JoinMeetingResponse = {
  success: boolean;
  message?: string;
  data?: MyMeetingSession;
};

type MyMeetingSession = {
  meetingId?: string;
  participantId?: string;
  role?: "host" | "attendee";
  status?: string;
  waitingRoom?: boolean;
  session?: {
    token?: string;
    expiresAt?: string;
  };
  effective?: {
    micOn?: boolean;
    cameraOn?: boolean;
  };
  capabilities?: {
    canUnmuteSelf?: boolean;
    canStartVideo?: boolean;
    canScreenShare?: boolean;
    canRecord?: boolean;
    maxParticipants?: number;
  };
};

type MySessionResponse = {
  success: boolean;
  data?: MyMeetingSession;
};

type MeetingStateResponse = {
  success: boolean;
  data?: {
    meetingId: string;
    title: string;
    status: "live" | "scheduled" | "completed";
    participants: {
      id: string;
      displayName: string;
      isHost: boolean;
      isMicOn: boolean;
      isCameraOn: boolean;
    }[];
    settings?: {
      waitingRoom?: boolean;
      muteOnJoin?: boolean;
      allowScreenShare?: boolean;
      allowRecording?: boolean;
    };
  };
};

type ParticipantMediaUpdateResponse = {
  success: boolean;
  data?: {
    participantId?: string;
    isMicOn?: boolean;
    isCameraOn?: boolean;
    micOn?: boolean;
    cameraOn?: boolean;
  };
};

type LeaveMeetingResponse = {
  success: boolean;
  message?: string;
};

type MeetingChatMessageResponse = {
  success: boolean;
  data?: {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    sentAt: string;
  };
};

type MeetingChatHistoryResponse = {
  success: boolean;
  data?: {
    items: {
      id: string;
      senderId: string;
      senderName: string;
      text: string;
      sentAt: string;
    }[];
  };
};

type ProfileResponse = {
  success: boolean;
  data?: {
    displayName?: string;
  };
};

type SubscriptionResponse = {
  success: boolean;
  data?: {
    entitlements?: {
      recording?: boolean;
    };
  };
};

const ROOM_STATE_POLL_INTERVAL_MS = 10000;

export default function CallRoomScreen() {
  const { meetingId, title, invite, created } = useLocalSearchParams<{
    meetingId?: string | string[];
    title?: string | string[];
    invite?: string | string[];
    created?: string | string[];
  }>();
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState<"lobby" | "inCall">("lobby");

  const [callTitle, setCallTitle] = useState("Weekly Product Sync");
  const [displayName, setDisplayName] = useState("Participant");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [inviteRequiresPassword, setInviteRequiresPassword] = useState(false);
  const [isResolvingInvite, setIsResolvingInvite] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [isLeavingMeeting, setIsLeavingMeeting] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);
  const [localRole, setLocalRole] = useState<"host" | "attendee">("host");

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [mediaInfo, setMediaInfo] = useState("Camera and mic not started yet.");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [canUseRecording, setCanUseRecording] = useState(false);
  const [canUnmuteSelf, setCanUnmuteSelf] = useState(true);
  const [canStartVideo, setCanStartVideo] = useState(true);
  const [canScreenShare, setCanScreenShare] = useState(true);
  const { isRecording } = useGlobalRecording({
    settledTimeMs: 1000,
  });
  const [lastRecordingPath, setLastRecordingPath] = useState<string | null>(null);
  const roomIdRef = useRef("");
  const phaseRef = useRef<"lobby" | "inCall">("lobby");
  const isPollingStateRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const meetingEndedRef = useRef(false);
  const joinInFlightRef = useRef(false);

  const sharedMeetingId = useMemo(
    () => (Array.isArray(meetingId) ? meetingId[0] : meetingId),
    [meetingId]
  );
  const sharedTitle = useMemo(
    () => (Array.isArray(title) ? title[0] : title),
    [title]
  );
  const sharedInvite = useMemo(
    () => (Array.isArray(invite) ? invite[0] : invite),
    [invite]
  );
  const sharedCreated = useMemo(
    () => (Array.isArray(created) ? created[0] : created),
    [created]
  );
  const isInviteFlow = sharedInvite === "1";
  const isCreatedFlow = sharedCreated === "1";
  const isSingleParticipantView = participants.length <= 1;
  const isMicPreJoinLocked = !isMicOn && !canUnmuteSelf;
  const isCamPreJoinLocked = !isCamOn && !canStartVideo;

  const tileColumns = useMemo(() => {
    const count = participants.length || 1;
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
  }, [participants.length]);

  const tileGap = 8;
  const tileWidth = useMemo(() => {
    if (isSingleParticipantView) {
      return Math.min(width - 28, 420);
    }
    const horizontalPadding = 20;
    const totalGap = tileGap * (tileColumns - 1);
    const usableWidth = width - horizontalPadding - totalGap;
    return Math.max(104, Math.floor(usableWidth / tileColumns));
  }, [isSingleParticipantView, tileColumns, width]);
  const tileHeight = useMemo(() => {
    if (isSharingScreen) return Math.max(110, Math.floor(tileWidth * 0.62));
    if (isSingleParticipantView) return Math.max(260, Math.floor(tileWidth * 1.06));
    if (tileColumns === 2) return Math.max(170, Math.floor(tileWidth * 0.82));
    if (tileColumns === 3) return Math.max(132, Math.floor(tileWidth * 0.8));
    return Math.max(108, Math.floor(tileWidth * 0.76));
  }, [isSharingScreen, isSingleParticipantView, tileColumns, tileWidth]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenShareStreamRef.current = screenShareStream;
  }, [screenShareStream]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      const activeRoomId = roomIdRef.current;
      const activePhase = phaseRef.current;
      if (activePhase === "inCall" && activeRoomId && !meetingEndedRef.current) {
        void client
          .post<LeaveMeetingResponse>(
            `/meetings/${encodeURIComponent(activeRoomId)}/me/leave`
          )
          .catch(() => {
            // Ignore teardown errors when screen unmounts.
          });
      }
      stopStream(localStreamRef.current);
      stopStream(screenShareStreamRef.current);
    };
  }, []);

  useEffect(() => {
    if (sharedMeetingId?.trim()) {
      setJoinRoomId(sharedMeetingId.trim().toLowerCase());
    }
    if (sharedTitle?.trim()) {
      setCallTitle(sharedTitle.trim());
    }
  }, [sharedMeetingId, sharedTitle]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await client.get<ProfileResponse>("/profile/me");
        const resolvedName = response.data?.data?.displayName?.trim();
        if (!cancelled && resolvedName) {
          setDisplayName(resolvedName);
        }
      } catch {
        // Keep default display name if profile cannot be loaded.
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEntitlements = async () => {
      try {
        const response = await client.get<SubscriptionResponse>("/payments/subscription");
        const canRecord = Boolean(response.data?.data?.entitlements?.recording);
        if (!cancelled) {
          setCanUseRecording(canRecord);
        }
      } catch {
        if (!cancelled) {
          setCanUseRecording(false);
        }
      }
    };

    void loadEntitlements();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isInviteFlow || !sharedMeetingId?.trim()) return;

    let cancelled = false;
    const resolveInvitePreview = async () => {
      setIsResolvingInvite(true);
      try {
        const encodedCode = encodeURIComponent(sharedMeetingId.trim());
        const response = await client.get<InvitePreviewResponse>(
          `/meetings/invite/${encodedCode}`
        );
        const data = response.data?.data;
        if (cancelled || !data) return;
        if (data.title?.trim()) {
          setCallTitle(data.title.trim());
        }
        setInviteRequiresPassword(Boolean(data.requiresPassword));
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        if (!cancelled) {
          Alert.alert(
            "Invite Error",
            apiError?.response?.data?.message || "Unable to resolve invite link."
          );
        }
      } finally {
        if (!cancelled) {
          setIsResolvingInvite(false);
        }
      }
    };

    void resolveInvitePreview();
    return () => {
      cancelled = true;
    };
  }, [isInviteFlow, sharedMeetingId]);

  useEffect(() => {
    if (phase !== "lobby") return;
    if (!(sharedMeetingId || isInviteFlow || isCreatedFlow)) return;
    const roomCode = (joinRoomId || sharedMeetingId || "").trim().toLowerCase();
    if (!roomCode) return;

    let cancelled = false;
    const syncSessionForPreJoin = async () => {
      try {
        const data = await getMySession(roomCode);
        if (!cancelled && data) {
          applySessionData(data, roomCode, { applyEffectiveMedia: false });
        }
      } catch (err) {
        const apiError = err as AxiosError<ApiErrorResponse>;
        const isSessionMissing = apiError?.response?.status === 404;
        const isAlreadyJoinedConflict =
          apiError?.response?.status === 409 &&
          (apiError?.response?.data?.message || "")
            .toLowerCase()
            .includes("participant already joined");
        if (!cancelled && !isSessionMissing && !isAlreadyJoinedConflict) {
          console.error("[Meetings] Failed to prefetch my session", {
            message: apiError?.message || String(err),
            status: apiError?.response?.status,
            responseData: apiError?.response?.data,
            roomCode,
          });
        }
      }
    };

    void syncSessionForPreJoin();
    return () => {
      cancelled = true;
    };
  }, [
    applySessionData,
    getMySession,
    isCreatedFlow,
    isInviteFlow,
    joinRoomId,
    phase,
    sharedMeetingId,
  ]);

  useEffect(() => {
    if (phase !== "inCall") return;
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "inCall" || !roomId.trim()) return;

    const refreshState = async () => {
      if (appStateRef.current !== "active") return;
      if (isPollingStateRef.current) return;
      isPollingStateRef.current = true;
      try {
        await fetchMeetingState(roomId);
      } catch {
      } finally {
        isPollingStateRef.current = false;
      }
    };

    void refreshState();
    const id = setInterval(() => {
      void refreshState();
    }, ROOM_STATE_POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [fetchMeetingState, phase, roomId]);

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
    if (!isShareRequested && !canScreenShare) {
      Alert.alert(
        "Screen Share Disabled",
        "Screen sharing is not available for your current session."
      );
      return;
    }
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
    if (!isRecording && !canUseRecording) {
      Alert.alert(
        "Recording Not Available",
        "Recording is not available on your current plan."
      );
      return;
    }
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
    setIsMoreMenuOpen(false);
  };

  const applySessionData = useCallback(
    (
      session: MyMeetingSession | undefined,
      fallbackRoomId: string,
      options?: { applyEffectiveMedia?: boolean }
    ) => {
      if (!session) return;
      const shouldApplyEffectiveMedia = options?.applyEffectiveMedia ?? true;
      const effectiveMic = session.effective?.micOn ?? isMicOn;
      const effectiveCam = session.effective?.cameraOn ?? isCamOn;
      setLocalParticipantId(session.participantId || null);
      setLocalRole(session.role === "host" ? "host" : "attendee");
      if (shouldApplyEffectiveMedia) {
        setIsMicOn(Boolean(effectiveMic));
        setIsCamOn(Boolean(effectiveCam));
      }
      setRoomId(session.meetingId || fallbackRoomId);

      const canUnmute = session.capabilities?.canUnmuteSelf;
      const canVideo = session.capabilities?.canStartVideo;
      const canShare = session.capabilities?.canScreenShare;
      const canRecord = session.capabilities?.canRecord;
      if (typeof canUnmute === "boolean") setCanUnmuteSelf(canUnmute);
      if (typeof canVideo === "boolean") setCanStartVideo(canVideo);
      if (typeof canShare === "boolean") setCanScreenShare(canShare);
      if (typeof canRecord === "boolean") setCanUseRecording(canRecord);
    },
    [isCamOn, isMicOn]
  );

  const getMySession = useCallback(async (activeRoomId: string) => {
    const response = await client.get<MySessionResponse>(
      `/meetings/${encodeURIComponent(activeRoomId)}/me/session`
    );
    return response.data?.data;
  }, []);

  const isMeetingEndedError = (error: AxiosError<ApiErrorResponse>) =>
    error?.response?.status === 409 &&
    (error?.response?.data?.message || "").toLowerCase().includes("meeting has ended");

  const clearMeetingLocally = useCallback((reason?: string) => {
    setPhase("lobby");
    setParticipants([]);
    setChatMessages([]);
    setDraftMessage("");
    setJoinRoomId("");
    setJoinPassword("");
    setRoomId("");
    setLocalParticipantId(null);
    setLocalRole("host");
    setElapsedSeconds(0);
    setChatOpen(false);
    setParticipantsOpen(false);
    setIsMoreMenuOpen(false);
    setCanUnmuteSelf(true);
    setCanStartVideo(true);
    setCanScreenShare(true);
    stopStream(localStreamRef.current);
    setLocalStream(null);
    stopStream(screenShareStreamRef.current);
    setScreenShareStream(null);
    setIsShareRequested(false);
    if (isRecordingRef.current) {
      if (Platform.OS === "ios") {
        void stopInAppRecording().catch(() => {});
      } else {
        void stopGlobalRecording({ settledTimeMs: 4500 }).catch(() => {});
      }
    }
    setRecordingSeconds(0);
    setMediaInfo("Camera and mic not started yet.");
    if (reason) {
      Alert.alert("Meeting Ended", reason);
    }
  }, []);

  const buildJoinPayload = useCallback(
    (nextMicOn: boolean, nextCamOn: boolean): JoinMeetingRequest => ({
      displayName: displayName.trim() || "You",
      password: joinPassword.trim(),
      preJoin: {
        micOn: nextMicOn,
        cameraOn: nextCamOn,
      },
      device: {
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || "dev",
      },
    }),
    [displayName, joinPassword]
  );

  const restoreMySession = useCallback(
    async (activeRoomId: string, nextMicOn: boolean, nextCamOn: boolean) => {
      try {
        const existing = await getMySession(activeRoomId);
        if (existing) {
          applySessionData(existing, activeRoomId);
          return true;
        }
      } catch (err) {
        const sessionError = err as AxiosError<ApiErrorResponse>;
        if (sessionError?.response?.status !== 404) {
          throw err;
        }
      }

      const payload = buildJoinPayload(nextMicOn, nextCamOn);
      const joinResponse = await client.post<JoinMeetingResponse>(
        `/meetings/${encodeURIComponent(activeRoomId)}/me/join`,
        payload
      );
      const joined = joinResponse.data?.data;
      if (!joined) return false;
      applySessionData(joined, activeRoomId);
      return true;
    },
    [applySessionData, buildJoinPayload, getMySession]
  );

  const fetchMeetingState = useCallback(async (activeRoomId: string) => {
    let response;
    try {
      response = await client.get<MeetingStateResponse>(
        `/meetings/${encodeURIComponent(activeRoomId)}/state`
      );
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        meetingEndedRef.current = true;
        setMediaInfo("Meeting has ended on the server.");
        return;
      }
      throw err;
    }
    const state = response.data?.data;
    if (!state) return;

    const knownLocalId = localParticipantId;
    const fallbackName = (displayName.trim() || "You").toLowerCase();
    const rawParticipants: CallParticipant[] = state.participants.map((person) => {
      const isLocal =
        (knownLocalId && person.id === knownLocalId) ||
        person.displayName?.trim().toLowerCase() === fallbackName;
      return {
        id: person.id,
        name: person.displayName || "Participant",
        isHost: Boolean(person.isHost),
        isLocal: Boolean(isLocal),
        isMicOn: Boolean(person.isMicOn),
        isCameraOn: Boolean(person.isCameraOn),
      };
    });
    const dedupedById = Array.from(
      new Map(rawParticipants.map((person) => [person.id, person])).values()
    );
    const localNameKey = fallbackName;
    const localSelf = dedupedById.find((person) => person.isLocal);
    const nextParticipants =
      localSelf && localNameKey
        ? [
            ...dedupedById.filter((person) => person.id === localSelf.id),
            ...dedupedById.filter(
              (person) =>
                person.id !== localSelf.id &&
                person.name.trim().toLowerCase() !== localNameKey
            ),
          ]
        : dedupedById;

    if (state.title?.trim()) {
      setCallTitle(state.title.trim());
    }
    if (nextParticipants.length > 0) {
      setParticipants(nextParticipants);
      const local = nextParticipants.find((person) => person.isLocal);
      if (local) {
        setIsMicOn(local.isMicOn);
        setIsCamOn(local.isCameraOn);
        setLocalRole(local.isHost ? "host" : "attendee");
        if (!localParticipantId) {
          setLocalParticipantId(local.id);
        }
      }
    }
  }, [displayName, localParticipantId]);

  const fetchChatHistory = useCallback(async (activeRoomId: string) => {
    const response = await client.get<MeetingChatHistoryResponse>(
      `/meetings/${encodeURIComponent(activeRoomId)}/chat/messages`
    );
    const items = response.data?.data?.items || [];
    if (items.length === 0) return;
    setChatMessages(
      items.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName || "Participant",
        text: msg.text,
        sentAt: msg.sentAt || new Date().toISOString(),
        mine: Boolean(localParticipantId && msg.senderId === localParticipantId),
      }))
    );
  }, [localParticipantId]);

  const updateParticipantMedia = async (
    activeRoomId: string,
    nextMicOn: boolean,
    nextCamOn: boolean
  ) => {
    const applyMediaResponse = (payload?: ParticipantMediaUpdateResponse["data"]) => {
      if (!payload) return;
      const resolvedMic =
        typeof payload.isMicOn === "boolean"
          ? payload.isMicOn
          : typeof payload.micOn === "boolean"
          ? payload.micOn
          : nextMicOn;
      const resolvedCam =
        typeof payload.isCameraOn === "boolean"
          ? payload.isCameraOn
          : typeof payload.cameraOn === "boolean"
          ? payload.cameraOn
          : nextCamOn;

      setIsMicOn(resolvedMic);
      setIsCamOn(resolvedCam);
      setLocalParticipantState(resolvedMic, resolvedCam);
      if (nextMicOn && !resolvedMic) {
        setMediaInfo("Microphone remains muted by meeting policy/host controls.");
      }
      if (nextCamOn && !resolvedCam) {
        setMediaInfo("Camera remains off by meeting policy/host controls.");
      }
    };

    const sendMediaPatch = async () =>
      client.patch<ParticipantMediaUpdateResponse>(
        `/meetings/${encodeURIComponent(activeRoomId)}/me/media`,
        {
          isMicOn: nextMicOn,
          isCameraOn: nextCamOn,
        }
      );

    try {
      const response = await sendMediaPatch();
      applyMediaResponse(response.data?.data);
      return;
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        meetingEndedRef.current = true;
        setMediaInfo("Could not sync microphone/camera. Retrying room state...");
        return;
      }
      const isMissingSession =
        apiError?.response?.status === 404 &&
        (apiError?.response?.data?.message || "")
          .toLowerCase()
          .includes("participant session not found");
      if (!isMissingSession) throw err;
    }

    const restored = await restoreMySession(activeRoomId, nextMicOn, nextCamOn);
    if (!restored) {
      throw new Error("Failed to restore meeting session.");
    }

    try {
      const retry = await sendMediaPatch();
      applyMediaResponse(retry.data?.data);
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        meetingEndedRef.current = true;
        setMediaInfo("Could not sync microphone/camera. Retrying room state...");
        return;
      }
      throw err;
    }
  };

  const leaveMeetingOnServer = async (activeRoomId: string) => {
    await client.post<LeaveMeetingResponse>(
      `/meetings/${encodeURIComponent(activeRoomId)}/me/leave`
    );
  };

  const endMeetingOnServer = async (activeRoomId: string) => {
    await client.post<LeaveMeetingResponse>(
      `/meetings/${encodeURIComponent(activeRoomId)}/end`,
      { reason: "host_ended" }
    );
  };

  const bootstrapParticipants = async (
    activeRoomId: string,
    options?: {
      micOn?: boolean;
      cameraOn?: boolean;
      isHost?: boolean;
      participantId?: string;
    }
  ) => {
    const micOn = options?.micOn ?? isMicOn;
    const cameraOn = options?.cameraOn ?? isCamOn;
    const isHost = options?.isHost ?? true;
    const participantId = options?.participantId || null;
    const localVisualId = participantId || `local-${Date.now()}`;
    setIsMicOn(micOn);
    setIsCamOn(cameraOn);
    setLocalRole(isHost ? "host" : "attendee");
    setLocalParticipantId(participantId);

    const local: CallParticipant = {
      id: localVisualId,
      name: displayName.trim() || "You",
      isLocal: true,
      isHost,
      isMicOn: micOn,
      isCameraOn: cameraOn,
    };
    setRoomId(activeRoomId);
    setParticipants([local]);
    setSpeakerId(null);
    setChatMessages([]);
    setElapsedSeconds(0);
    setPhase("inCall");
    await startOrRefreshLocalMedia({ audio: micOn, video: cameraOn });
    try {
      await fetchMeetingState(activeRoomId);
      await fetchChatHistory(activeRoomId);
    } catch {
      // Keep local participant when room-state endpoints are temporarily unavailable.
    }
  };

  const joinMeeting = async () => {
    if (!joinRoomId.trim()) return;
    if (joinInFlightRef.current || phase === "inCall") return;
    const roomCode = joinRoomId.trim().toLowerCase();
    const payload = buildJoinPayload(isMicOn, isCamOn);

    try {
      joinInFlightRef.current = true;
      setIsJoiningMeeting(true);
      meetingEndedRef.current = false;
      setCanUnmuteSelf(true);
      setCanStartVideo(true);
      setCanScreenShare(true);
      const response = await client.post<JoinMeetingResponse>(
        `/meetings/${encodeURIComponent(roomCode)}/me/join`,
        payload
      );
      const data = response.data?.data;

      const desiredMic = payload.preJoin.micOn;
      const desiredCam = payload.preJoin.cameraOn;
      const resolvedRoomId = data?.meetingId || roomCode;
      const resolvedIsHost = data?.role === "host";
      applySessionData(data, resolvedRoomId, { applyEffectiveMedia: false });

      await bootstrapParticipants(resolvedRoomId, {
        micOn: desiredMic,
        cameraOn: desiredCam,
        isHost: resolvedIsHost,
        participantId: data?.participantId || undefined,
      });

      const serverMic = data?.effective?.micOn;
      const serverCam = data?.effective?.cameraOn;
      if (
        typeof serverMic === "boolean" &&
        typeof serverCam === "boolean" &&
        (serverMic !== desiredMic || serverCam !== desiredCam)
      ) {
        void updateParticipantMedia(resolvedRoomId, desiredMic, desiredCam).catch(() => {
          void fetchMeetingState(resolvedRoomId);
        });
      }
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        clearMeetingLocally(apiError?.response?.data?.message || "This meeting has ended.");
        return;
      }
      Alert.alert(
        "Join Failed",
        apiError?.response?.data?.message || "Unable to join this meeting."
      );
    } finally {
      setIsJoiningMeeting(false);
      joinInFlightRef.current = false;
    }
  };

  const leaveCall = async () => {
    const activeRoomId = roomId;
    if (activeRoomId && !meetingEndedRef.current) {
      try {
        setIsLeavingMeeting(true);
        await leaveMeetingOnServer(activeRoomId);
      } catch {
        // Continue local cleanup even if server leave call fails.
      } finally {
        setIsLeavingMeeting(false);
      }
    }
    clearMeetingLocally();
    meetingEndedRef.current = false;
  };

  const endMeeting = async () => {
    if (!roomId.trim()) return;
    try {
      await endMeetingOnServer(roomId);
    } catch {
      Alert.alert("End Failed", "Could not end this meeting right now.");
      return;
    }
    await leaveCall();
  };

  const toggleLocalMic = () => {
    if (!isMicOn && !canUnmuteSelf) {
      Alert.alert(
        "Cannot Unmute",
        "Unmute is currently disabled for your participant role."
      );
      return;
    }
    const nextMic = !isMicOn;
    if (nextMic && getMicrophonePermissionStatus() !== "granted") {
      const promptMicSettings = () =>
        Alert.alert(
          "Microphone Permission Needed",
          "Allow microphone permission in your device settings to unmute.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );

      void requestMicrophonePermission()
        .then((permission) => {
          if (permission.status !== "granted") {
            promptMicSettings();
          }
        })
        .catch(() => {
          promptMicSettings();
        });
      return;
    }
    setIsMicOn(nextMic);
    setLocalParticipantState(nextMic, isCamOn);
    setTrackEnabled("audio", nextMic);
    if (phase === "inCall" && nextMic && !hasTrack("audio")) {
      void startOrRefreshLocalMedia({ audio: nextMic, video: isCamOn });
    }
    if (phase === "inCall" && roomId) {
      void updateParticipantMedia(roomId, nextMic, isCamOn).catch(() => {
        void fetchMeetingState(roomId);
      });
    }
  };

  const toggleLocalCam = () => {
    if (!isCamOn && !canStartVideo) {
      Alert.alert(
        "Cannot Start Video",
        "Camera is currently disabled for your participant role."
      );
      return;
    }
    const nextCam = !isCamOn;
    setIsCamOn(nextCam);
    setLocalParticipantState(isMicOn, nextCam);
    setTrackEnabled("video", nextCam);
    if (phase === "inCall" && nextCam && !hasTrack("video")) {
      void startOrRefreshLocalMedia({ audio: isMicOn, video: nextCam });
    }
    if (phase === "inCall" && roomId) {
      void updateParticipantMedia(roomId, isMicOn, nextCam).catch(() => {
        void fetchMeetingState(roomId);
      });
    }
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

    if (roomId && localParticipantId) {
      void client
        .post<MeetingChatMessageResponse>(
          `/meetings/${encodeURIComponent(roomId)}/chat/messages`,
          {
            participantId: localParticipantId,
            text,
          }
        )
        .then((response) => {
          const saved = response.data?.data;
          if (!saved) return;
          setChatMessages((prev) =>
            prev.map((item) =>
              item.id === mine.id
                ? {
                    ...item,
                    id: saved.id,
                    sentAt: saved.sentAt || item.sentAt,
                  }
                : item
            )
          );
        })
        .catch(() => {
          // Keep optimistic local message if backend chat save fails.
        });
    }
  };

  if (phase === "lobby") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.lobbyContent}>
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />
          <ScreenNav title="Call Room" fallbackHref="/(app)/(tabs)/home" />

          <View style={styles.heroCard}>
            <Text style={styles.kicker}>Meeting Room</Text>
            <Text style={styles.heroTitle}>Ready to join your meeting</Text>
            <Text style={styles.heroSub}>
              Configure your mic and camera before you enter.
            </Text>
            {sharedMeetingId ? (
              <Text style={styles.deepLinkHint}>
                Meeting code: {sharedMeetingId}
              </Text>
            ) : null}
            {isInviteFlow ? (
              <Text style={styles.integrationStatus}>
                {isResolvingInvite
                  ? "Validating invite link..."
                  : inviteRequiresPassword
                  ? "This invite requires a meeting password."
                  : "Invite ready. Configure mic/camera and join."}
              </Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Display Name</Text>
            <TextInput
              value={displayName}
              editable={false}
              style={styles.input}
              placeholder="Your profile display name"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.preToggleRow}>
              <Pressable
                onPress={toggleLocalMic}
                disabled={isMicPreJoinLocked}
                style={[
                  styles.preToggle,
                  !isMicOn && styles.preToggleMuted,
                  isMicPreJoinLocked && styles.disabledBtn,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isMicPreJoinLocked
                    ? "Microphone unmute unavailable before join"
                    : isMicOn
                    ? "Mute microphone before join"
                    : "Unmute microphone before join"
                }
                accessibilityState={{ disabled: isMicPreJoinLocked }}
              >
                <Ionicons
                  name={isMicOn ? "mic" : "mic-off"}
                  size={16}
                  color={
                    isMicPreJoinLocked
                      ? colors.textMuted
                      : isMicOn
                      ? colors.primaryDark
                      : "#DC0000"
                  }
                />
                <Text style={styles.preToggleText}>{isMicOn ? "Mic On" : "Mic Off"}</Text>
              </Pressable>
              <Pressable
                onPress={toggleLocalCam}
                disabled={isCamPreJoinLocked}
                style={[
                  styles.preToggle,
                  !isCamOn && styles.preToggleMuted,
                  isCamPreJoinLocked && styles.disabledBtn,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isCamPreJoinLocked
                    ? "Camera start unavailable before join"
                    : isCamOn
                    ? "Turn camera off before join"
                    : "Turn camera on before join"
                }
                accessibilityState={{ disabled: isCamPreJoinLocked }}
              >
                <Ionicons
                  name={isCamOn ? "videocam" : "videocam-off"}
                  size={16}
                  color={
                    isCamPreJoinLocked
                      ? colors.textMuted
                      : isCamOn
                      ? colors.primaryDark
                      : "#DC0000"
                  }
                />
                <Text style={styles.preToggleText}>
                  {isCamOn ? "Camera On" : "Camera Off"}
                </Text>
              </Pressable>
            </View>
            {isMicPreJoinLocked ? (
              <Text style={styles.integrationStatus}>
                Microphone is locked for this session until host allows unmute.
              </Text>
            ) : null}
            {isCamPreJoinLocked ? (
              <Text style={styles.integrationStatus}>
                Camera is locked for this session until video is allowed.
              </Text>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Media Status</Text>
            <Text style={styles.integrationStatus}>Media: {mediaInfo}</Text>
          </View>

          {!isCreatedFlow ? (
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
              <TextInput
                value={joinPassword}
                onChangeText={setJoinPassword}
                style={styles.input}
                placeholder={
                  inviteRequiresPassword
                    ? "Meeting password (required)"
                    : "Meeting password (optional)"
                }
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[
                  styles.primaryBtn,
                  (!joinRoomId.trim() || isJoiningMeeting || isResolvingInvite) &&
                    styles.disabledBtn,
                ]}
                disabled={!joinRoomId.trim() || isJoiningMeeting || isResolvingInvite}
                onPress={joinMeeting}
              >
                <Text style={styles.primaryBtnText}>
                  {isJoiningMeeting ? "Joining..." : "Join Meeting"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {isCreatedFlow && joinRoomId.trim() ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Meeting Ready</Text>
              <Text style={styles.integrationStatus}>Code: {joinRoomId}</Text>
              <Pressable
                style={[
                  styles.primaryBtn,
                  (isJoiningMeeting || isResolvingInvite) && styles.disabledBtn,
                ]}
                disabled={isJoiningMeeting || isResolvingInvite}
                onPress={joinMeeting}
              >
                <Text style={styles.primaryBtnText}>
                  {isJoiningMeeting ? "Opening..." : "Start Meeting"}
                </Text>
              </Pressable>
            </View>
          ) : null}
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
            Room: {roomId} | {formattedElapsed}
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
            <Ionicons name="people" size={18} color="#FFFFFF" />
            <Text style={styles.headerActionText}>{participants.length}</Text>
          </Pressable>
          <Pressable
            style={styles.headerActionBtn}
            onPress={() => setChatOpen((prev) => !prev)}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={participants}
        key={`${tileColumns}`}
        numColumns={tileColumns}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.tilesWrap,
          isSingleParticipantView && styles.tilesWrapSingle,
        ]}
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
                {
                  width: tileWidth,
                  height: tileHeight,
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
          disabled={!isMicOn && !canUnmuteSelf}
          accessibilityLabel={
            !isMicOn && !canUnmuteSelf
              ? "Unmute unavailable"
              : isMicOn
              ? "Mute microphone"
              : "Unmute microphone"
          }
        />
        <ControlButton
          icon={isCamOn ? "videocam" : "videocam-off"}
          label="Camera"
          danger={!isCamOn}
          onPress={toggleLocalCam}
          active={isCamOn}
          disabled={!isCamOn && !canStartVideo}
          accessibilityLabel={
            !isCamOn && !canStartVideo
              ? "Camera start unavailable"
              : isCamOn
              ? "Turn camera off"
              : "Turn camera on"
          }
        />
        <ControlButton
          icon="share-social"
          label="Share"
          onPress={() => void toggleScreenShare()}
          active={isShareRequested}
          disabled={!isShareRequested && !canScreenShare}
          accessibilityLabel={
            !isShareRequested && !canScreenShare
              ? "Screen share unavailable"
              : isShareRequested
              ? "Stop screen sharing"
              : "Start screen sharing"
          }
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
          label={localRole === "host" ? "End" : "Leave"}
          danger
          onPress={() => void (localRole === "host" ? endMeeting() : leaveCall())}
          disabled={isLeavingMeeting}
          accessibilityLabel={localRole === "host" ? "End call for all" : "Leave call"}
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
              style={[
                styles.moreMenuItem,
                isRecording && styles.moreMenuItemDanger,
                !canUseRecording && !isRecording && styles.disabledBtn,
              ]}
              onPress={() => void toggleRecording()}
              disabled={!canUseRecording && !isRecording}
              accessibilityRole="button"
              accessibilityLabel={
                !canUseRecording && !isRecording
                  ? "Recording not available on your plan"
                  : isRecording
                  ? "Stop recording"
                  : "Start recording"
              }
              accessibilityState={{ disabled: !canUseRecording && !isRecording }}
            >
              <Ionicons
                name={isRecording ? "stop-circle" : "radio-button-on"}
                size={16}
                color={
                  !canUseRecording && !isRecording
                    ? colors.textMuted
                    : isRecording
                    ? "#fff"
                    : "#DC0000"
                }
              />
              <Text
                style={[
                  styles.moreMenuText,
                  isRecording && styles.moreMenuTextDanger,
                  !canUseRecording && !isRecording && { color: colors.textMuted },
                ]}
              >
                {!canUseRecording && !isRecording
                  ? "Recording Locked (Current Plan)"
                  : isRecording
                  ? "Stop Recording"
                  : "Record Meeting"}
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
  disabled,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.controlBtn,
        active && styles.controlBtnActive,
        danger && styles.controlBtnDanger,
        disabled && styles.disabledBtn,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
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
  deepLinkHint: {
    marginTop: 4,
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
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
    color: "#FFFFFF",
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  tilesWrap: {
    padding: 10,
    gap: 8,
    paddingBottom: 120,
  },
  tilesWrapSingle: {
    alignItems: "center",
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

