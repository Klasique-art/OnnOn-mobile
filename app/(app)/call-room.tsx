import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AxiosError } from "axios";
import Constants from "expo-constants";
import * as ExpoLinking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  AppState,
  type AppStateStatus,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import AppPopup, { PopupAction, PopupTone } from "@/src/components/AppPopup";
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
} from "react-native-nitro-screen-recorder";
import {
  type ApiErrorResponse,
  type CallParticipant,
  type CallChatMessage,
  type InvitePreviewResponse,
  type JoinMeetingRequest,
  type JoinMeetingResponse,
  type MyMeetingSession,
  type MySessionResponse,
  type MeetingStateResponse,
  type ParticipantMediaUpdateResponse,
  type LeaveMeetingResponse,
  type MeetingChatMessageResponse,
  type MeetingChatHistoryResponse,
  type ProfileResponse,
  type SubscriptionResponse,
  type ScreenShareStartResponse,
  type ScreenShareStopResponse,
  type MeetingRecordingStatusResponse,
  type RecordingStatus,
  type MeetingRecordingArtifact,
  ROOM_STATE_POLL_INTERVAL_MS,
} from "@/src/types/callRoomTypes";
import {
  formatElapsed,
  buildInitials,
  formatMessageTime,
} from "@/src/utils/callRoomUtils";

const APP_LINK_BASE_URL = "https://onnon.app";

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [canUseRecording, setCanUseRecording] = useState(false);
  const [canUnmuteSelf, setCanUnmuteSelf] = useState(true);
  const [canStartVideo, setCanStartVideo] = useState(true);
  const [canScreenShare, setCanScreenShare] = useState(true);
  const [activeScreenShareParticipantId, setActiveScreenShareParticipantId] = useState<string | null>(null);
  const [meetingRecordingStatus, setMeetingRecordingStatus] = useState<RecordingStatus>("idle");
  const [meetingRecordingArtifacts, setMeetingRecordingArtifacts] = useState<MeetingRecordingArtifact[]>([]);
  const [isUpdatingMeetingRecording, setIsUpdatingMeetingRecording] = useState(false);
  const [isRecordingArtifactsOpen, setIsRecordingArtifactsOpen] = useState(false);
  const roomIdRef = useRef("");
  const phaseRef = useRef<"lobby" | "inCall">("lobby");
  const isPollingStateRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const meetingEndedRef = useRef(false);
  const [meetingEndedReason, setMeetingEndedReason] = useState<string | null>(null);
  const joinInFlightRef = useRef(false);
  // Tracks whether a mic/cam PATCH is in-flight so polling doesn't overwrite optimistic state.
  const pendingMediaUpdateRef = useRef(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTone, setPopupTone] = useState<PopupTone>("info");
  const [popupActions, setPopupActions] = useState<PopupAction[]>([
    { label: "OK", variant: "primary" },
  ]);

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
  const isSharingScreen = isShareRequested && !!screenShareStream;
  const hasActiveScreenShare = Boolean(activeScreenShareParticipantId);
  const activeScreenShareName = useMemo(() => {
    if (!activeScreenShareParticipantId) return "";
    return (
      participants.find((person) => person.id === activeScreenShareParticipantId)?.name || "Participant"
    );
  }, [activeScreenShareParticipantId, participants]);
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

  const fetchMeetingRecordingStatus = useCallback(async (activeRoomId: string) => {
    const response = await client.get<MeetingRecordingStatusResponse>(
      `/meetings/${encodeURIComponent(activeRoomId)}/recording/status`
    );
    const status = response.data?.data?.status || "idle";
    const artifacts = response.data?.data?.artifacts || [];
    setMeetingRecordingStatus(status);
    setMeetingRecordingArtifacts(artifacts);
  }, []);

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
        const isMeetingEnded =
          apiError?.response?.status === 409 &&
          (apiError?.response?.data?.message || "")
            .toLowerCase()
            .includes("meeting has ended");
        if (!cancelled && !isSessionMissing && !isAlreadyJoinedConflict && !isMeetingEnded) {
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
        setMeetingEndedReason("This meeting has been ended by the host.");
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
        isScreenSharing: Boolean(person.isScreenSharing),
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
    setActiveScreenShareParticipantId(state.activeScreenShare?.participantId || null);
    if (nextParticipants.length > 0) {
      setParticipants(nextParticipants);
      const local = nextParticipants.find((person) => person.isLocal);
      if (local) {
        // Only sync mic/cam from polling when no PATCH update is currently in-flight.
        // Without this guard, the poll response overwrites the optimistic toggle
        // before the PATCH has a chance to confirm the new state.
        if (!pendingMediaUpdateRef.current) {
          setIsMicOn(local.isMicOn);
          setIsCamOn(local.isCameraOn);
        } else {
        }
        setLocalRole(local.isHost ? "host" : "attendee");
        if (!localParticipantId) {
          setLocalParticipantId(local.id);
        }
      }
    }
  }, [displayName, localParticipantId]);

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
    if (phase !== "inCall" || !roomId.trim()) return;
    let isFetching = false;

    const refreshRecordingStatus = async () => {
      if (appStateRef.current !== "active") return;
      if (isFetching) return;
      isFetching = true;
      try {
        await fetchMeetingRecordingStatus(roomId);
      } catch {
        // Keep current recording badge state if status endpoint is temporarily unavailable.
      } finally {
        isFetching = false;
      }
    };

    void refreshRecordingStatus();
    const id = setInterval(() => {
      void refreshRecordingStatus();
    }, 15_000);

    return () => clearInterval(id);
  }, [fetchMeetingRecordingStatus, phase, roomId]);

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

  const formattedElapsed = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds]);



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
      if (roomId.trim()) {
        try {
          await client.post<ScreenShareStopResponse>(
            `/meetings/${encodeURIComponent(roomId)}/me/screen-share/stop`
          );
        } catch {
          // Fall back to local stream stop even if backend stop fails.
        }
      }
      stopScreenShare();
      setMediaInfo("Screen sharing stopped.");
      return;
    }

    try {
      if (roomId.trim()) {
        await client.post<ScreenShareStartResponse>(
          `/meetings/${encodeURIComponent(roomId)}/me/screen-share/start`
        );
      }
      const stream = await getScreenShareStream();
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        (videoTrack as any).onended = () => {
          void (async () => {
            if (roomId.trim()) {
              try {
                await client.post<ScreenShareStopResponse>(
                  `/meetings/${encodeURIComponent(roomId)}/me/screen-share/stop`
                );
              } catch {
                // Ignore backend stop errors on track end.
              }
            }
            stopScreenShare();
            setMediaInfo("Screen sharing ended.");
          })();
        };
      }
      setScreenShareStream(stream);
      setIsShareRequested(true);
      setMediaInfo("Screen sharing active.");
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      setMediaInfo(
        apiError?.response?.data?.message ||
          "Unable to start screen sharing on this device/build."
      );
    }
  };

  const toggleMeetingRecording = async () => {
    if (!roomId.trim()) return;
    if (localRole !== "host") {
      Alert.alert("Host Only", "Only the host can control meeting recording.");
      return;
    }
    if (!canUseRecording) {
      Alert.alert(
        "Recording Not Available",
        "Recording is not available on your current plan."
      );
      return;
    }
    if (isUpdatingMeetingRecording) return;

    setIsUpdatingMeetingRecording(true);
    try {
      if (meetingRecordingStatus === "recording") {
        await client.post<ScreenShareStopResponse>(
          `/meetings/${encodeURIComponent(roomId)}/recording/stop`
        );
      } else {
        await client.post<ScreenShareStartResponse>(
          `/meetings/${encodeURIComponent(roomId)}/recording/start`
        );
      }
      await fetchMeetingRecordingStatus(roomId);
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      Alert.alert(
        "Recording Error",
        apiError?.response?.data?.message || "Could not change meeting recording state."
      );
    } finally {
      setIsUpdatingMeetingRecording(false);
      setIsMoreMenuOpen(false);
    }
  };



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
    setActiveScreenShareParticipantId(null);
    setMeetingRecordingStatus("idle");
    setMeetingRecordingArtifacts([]);
    setIsUpdatingMeetingRecording(false);
    stopStream(localStreamRef.current);
    setLocalStream(null);
    stopStream(screenShareStreamRef.current);
    setScreenShareStream(null);
    setIsShareRequested(false);
    setMediaInfo("Camera and mic not started yet.");
    if (reason) {
      Alert.alert("Meeting Ended", reason);
    }
  }, []);

  // When any API call returns a 409 "Meeting has ended", exit the call and alert the user.
  useEffect(() => {
    if (!meetingEndedReason) return;
    setMeetingEndedReason(null);
    clearMeetingLocally(meetingEndedReason);
  }, [meetingEndedReason, clearMeetingLocally]);

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
    // Resolve the confirmed mic/cam values from the PATCH response.
    // If the backend returns no `data` field, trust the intended (nextMicOn/nextCamOn) values.
    const applyMediaResponse = (payload?: ParticipantMediaUpdateResponse["data"]) => {
      const resolvedMic = payload
        ? typeof payload.isMicOn === "boolean"
          ? payload.isMicOn
          : typeof payload.micOn === "boolean"
            ? payload.micOn
            : nextMicOn
        : nextMicOn;
      const resolvedCam = payload
        ? typeof payload.isCameraOn === "boolean"
          ? payload.isCameraOn
          : typeof payload.cameraOn === "boolean"
            ? payload.cameraOn
            : nextCamOn
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

    pendingMediaUpdateRef.current = true;
    try {
      const response = await sendMediaPatch();
      applyMediaResponse(response.data?.data);
      return;
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        setMediaInfo("Could not sync microphone/camera right now.");
        return;
      }
      const isMissingSession =
        apiError?.response?.status === 404 &&
        (apiError?.response?.data?.message || "")
          .toLowerCase()
          .includes("participant session not found");
      if (!isMissingSession) throw err;
    } finally {
      pendingMediaUpdateRef.current = false;
    }

    const restored = await restoreMySession(activeRoomId, nextMicOn, nextCamOn);
    if (!restored) {
      throw new Error("Failed to restore meeting session.");
    }

    pendingMediaUpdateRef.current = true;
    try {
      const retry = await sendMediaPatch();
      applyMediaResponse(retry.data?.data);
    } catch (err) {
      const apiError = err as AxiosError<ApiErrorResponse>;
      if (isMeetingEndedError(apiError)) {
        setMediaInfo("Could not sync microphone/camera right now.");
        return;
      }
      throw err;
    } finally {
      pendingMediaUpdateRef.current = false;
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
      await fetchMeetingRecordingStatus(activeRoomId);
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

  const router = useRouter();

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
    router.replace("/");
  };

  const endMeeting = async () => {
    if (!roomId.trim()) return;
    try {
      await endMeetingOnServer(roomId);
    } catch {
      setPopupTitle("End Failed");
      setPopupMessage("Could not end this meeting right now.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
      return;
    }
    clearMeetingLocally();
    meetingEndedRef.current = false;
    setPopupTitle("Meeting Ended");
    setPopupMessage("You have ended the meeting for all participants.");
    setPopupTone("success");
    setPopupActions([
      {
        label: "Go Home",
        variant: "primary",
        onPress: () => router.replace("/"),
      },
    ]);
    setIsPopupVisible(true);
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
    const micPermStatus = getMicrophonePermissionStatus();
    if (nextMic && micPermStatus !== "granted") {
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
    const audioTrackPresent = hasTrack("audio");
    if (phase === "inCall" && nextMic && !audioTrackPresent) {
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

  const shareMeetingInvite = async () => {
    const activeRoomId = roomId.trim() || joinRoomId.trim() || sharedMeetingId?.trim() || "";
    if (!activeRoomId) {
      setPopupTitle("Invite Unavailable");
      setPopupMessage("Meeting code is not available yet.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
      return;
    }

    const deepLink = ExpoLinking.createURL(`/meeting/${activeRoomId}`, {
      queryParams: { title: callTitle },
    });
    const universalLink = `${APP_LINK_BASE_URL}/meeting/${encodeURIComponent(
      activeRoomId
    )}?title=${encodeURIComponent(callTitle)}`;

    try {
      await Share.share({
        title: "Invite to Meeting",
        message: `Join my OnnOn meeting: ${callTitle}\nMeeting code: ${activeRoomId}\nOpen: ${universalLink}\nApp link: ${deepLink}`,
        url: universalLink,
      });
    } catch {
      setPopupTitle("Share Failed");
      setPopupMessage("Could not open share sheet for this meeting.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
    }
  };

  const openRecordingArtifact = async (url?: string) => {
    if (!url) {
      setPopupTitle("File Unavailable");
      setPopupMessage("Recording file URL is not available.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error("Cannot open URL");
      }
      await Linking.openURL(url);
    } catch {
      setPopupTitle("Open Failed");
      setPopupMessage("Could not open this recording file.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
    }
  };

  const shareRecordingArtifact = async (url?: string) => {
    if (!url) {
      setPopupTitle("Link Unavailable");
      setPopupMessage("Recording link is not available.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
      return;
    }
    try {
      await Share.share({
        title: "Meeting Recording",
        message: `Recording link: ${url}`,
        url,
      });
    } catch {
      setPopupTitle("Share Failed");
      setPopupMessage("Could not open share sheet for this recording.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
    }
  };

  const copyRecordingArtifactLink = async (url?: string) => {
    if (!url) {
      setPopupTitle("Link Unavailable");
      setPopupMessage("Recording link is not available.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
      return;
    }
    try {
      await Clipboard.setStringAsync(url);
      setPopupTitle("Link Copied");
      setPopupMessage("Recording link copied to clipboard.");
      setPopupTone("success");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
    } catch {
      setPopupTitle("Copy Failed");
      setPopupMessage("Could not copy this recording link.");
      setPopupTone("danger");
      setPopupActions([{ label: "OK", variant: "primary" }]);
      setIsPopupVisible(true);
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
          <AppPopup
            visible={isPopupVisible}
            title={popupTitle}
            message={popupMessage}
            tone={popupTone}
            actions={popupActions}
            onClose={() => setIsPopupVisible(false)}
          />
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
          {meetingRecordingStatus === "recording" ? (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingBadgeText}>Meeting Recording Live</Text>
            </View>
          ) : null}
          {meetingRecordingStatus === "processing" ? (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingBadgeText}>Recording Processing…</Text>
            </View>
          ) : null}
          {isSharingScreen ? (
            <View style={styles.sharingBadge}>
              <Ionicons name="desktop" size={12} color="#fff" />
              <Text style={styles.sharingBadgeText}>You are sharing your screen</Text>
            </View>
          ) : null}
          {!isSharingScreen && hasActiveScreenShare ? (
            <View style={styles.sharingBadge}>
              <Ionicons name="desktop" size={12} color="#fff" />
              <Text style={styles.sharingBadgeText}>{activeScreenShareName} is sharing screen</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerActionBtn}
            onPress={() => void shareMeetingInvite()}
          >
            <Ionicons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.headerActionText}>Invite</Text>
          </Pressable>
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
                  {item.isScreenSharing ? (
                    <Ionicons name="desktop" size={12} color="#BFD8FF" />
                  ) : null}
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
          icon="desktop-outline"
          label="Share Screen"
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
                meetingRecordingStatus === "recording" && styles.moreMenuItemDanger,
                (!canUseRecording || localRole !== "host" || isUpdatingMeetingRecording) &&
                  styles.disabledBtn,
              ]}
              onPress={() => void toggleMeetingRecording()}
              disabled={!canUseRecording || localRole !== "host" || isUpdatingMeetingRecording}
              accessibilityRole="button"
              accessibilityLabel={
                !canUseRecording
                  ? "Meeting recording not available on your plan"
                  : localRole !== "host"
                    ? "Only host can control meeting recording"
                    : meetingRecordingStatus === "recording"
                      ? "Stop meeting recording"
                      : "Start meeting recording"
              }
              accessibilityState={{
                disabled:
                  !canUseRecording || localRole !== "host" || isUpdatingMeetingRecording,
              }}
            >
              <Ionicons
                name={meetingRecordingStatus === "recording" ? "stop-circle" : "radio-button-on"}
                size={16}
                color={
                  !canUseRecording || localRole !== "host"
                    ? colors.textMuted
                    : meetingRecordingStatus === "recording"
                      ? "#fff"
                      : "#DC0000"
                }
              />
              <Text
                style={[
                  styles.moreMenuText,
                  meetingRecordingStatus === "recording" && styles.moreMenuTextDanger,
                  (!canUseRecording || localRole !== "host") && { color: colors.textMuted },
                ]}
              >
                {!canUseRecording
                  ? "Recording Locked (Plan)"
                  : localRole !== "host"
                    ? "Host Can Record Meeting"
                    : meetingRecordingStatus === "recording"
                      ? "Stop Meeting Recording"
                      : meetingRecordingStatus === "processing"
                        ? "Recording Processing…"
                        : "Record Meeting (Cloud)"}
              </Text>
            </Pressable>
            {meetingRecordingStatus === "ready" && meetingRecordingArtifacts.length > 0 ? (
              <View style={styles.lastSavedWrap}>
                <Text style={styles.lastSavedLabel}>Meeting Recording Ready</Text>
                <Text numberOfLines={2} style={styles.lastSavedPath}>
                  {meetingRecordingArtifacts[0].fileName ||
                    meetingRecordingArtifacts[0].url ||
                    "Recording artifact available"}
                </Text>
                <Pressable
                  style={styles.viewFilesBtn}
                  onPress={() => setIsRecordingArtifactsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View meeting recording files"
                >
                  <Ionicons name="folder-open-outline" size={14} color={colors.text} />
                  <Text style={styles.viewFilesText}>View Files</Text>
                </Pressable>
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
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <View style={styles.chatPanel}>
              {/* ── Header ── */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.chatHeaderDot} />
                  <Text style={styles.chatHeaderTitle}>Meeting Chat</Text>
                  {chatMessages.length > 0 && (
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeText}>{chatMessages.length}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => setChatOpen(false)}
                  style={styles.chatCloseBtn}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={18} color="#A8C8F0" />
                </Pressable>
              </View>

              {/* ── Divider ── */}
              <View style={styles.chatDivider} />

              {/* ── Messages ── */}
              {chatMessages.length === 0 ? (
                <View style={styles.chatEmptyState}>
                  <View style={styles.chatEmptyIcon}>
                    <Ionicons name="chatbubbles-outline" size={34} color="#3A6A9E" />
                  </View>
                  <Text style={styles.chatEmptyTitle}>No messages yet</Text>
                  <Text style={styles.chatEmptySubtitle}>Say something to the group 👋</Text>
                </View>
              ) : (
                <FlatList
                  data={[...chatMessages].reverse()}
                  keyExtractor={(item) => item.id}
                  inverted
                  style={styles.chatList}
                  contentContainerStyle={styles.chatListContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item: msg }) => {
                    const initials = buildInitials(msg.senderName);
                    const timeStr = formatMessageTime(msg.sentAt);
                    if (msg.mine) {
                      return (
                        <View style={styles.chatRowMine}>
                          <View style={styles.chatBubbleMineWrap}>
                            <Text style={styles.chatBubbleMineText}>{msg.text}</Text>
                            <Text style={styles.chatTimeMine}>{timeStr}</Text>
                          </View>
                        </View>
                      );
                    }
                    return (
                      <View style={styles.chatRowRemote}>
                        <View style={styles.chatAvatar}>
                          <Text style={styles.chatAvatarText}>{initials}</Text>
                        </View>
                        <View style={styles.chatBubbleRemoteWrap}>
                          <Text style={styles.chatSenderName}>{msg.senderName}</Text>
                          <Text style={styles.chatBubbleRemoteText}>{msg.text}</Text>
                          <Text style={styles.chatTimeRemote}>{timeStr}</Text>
                        </View>
                      </View>
                    );
                  }}
                />
              )}

              {/* ── Composer ── */}
              <View style={styles.chatComposer}>
                <TextInput
                  value={draftMessage}
                  onChangeText={setDraftMessage}
                  onSubmitEditing={sendChat}
                  style={styles.chatInput}
                  placeholder="Message everyone…"
                  placeholderTextColor="#3A6A9E"
                  multiline
                  maxLength={500}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <Pressable
                  onPress={sendChat}
                  disabled={!draftMessage.trim()}
                  style={[
                    styles.chatSendBtn,
                    !draftMessage.trim() && styles.chatSendBtnDisabled,
                  ]}
                >
                  <Ionicons
                    name="send"
                    size={16}
                    color={draftMessage.trim() ? "#fff" : "#2A4A6E"}
                  />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      {isRecordingArtifactsOpen ? (
        <View style={styles.panelOverlay}>
          <View style={styles.slidePanel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Recording Files</Text>
              <Pressable onPress={() => setIsRecordingArtifactsOpen(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              {meetingRecordingArtifacts.map((artifact, index) => (
                <View key={`${artifact.id || artifact.url || "artifact"}-${index}`} style={styles.artifactCard}>
                  <Text style={styles.artifactTitle}>
                    {artifact.fileName || `Recording ${index + 1}`}
                  </Text>
                  {artifact.url ? (
                    <Text numberOfLines={2} style={styles.artifactUrl}>
                      {artifact.url}
                    </Text>
                  ) : null}
                  <View style={styles.artifactActions}>
                    <Pressable
                      style={styles.artifactActionBtn}
                      onPress={() => void openRecordingArtifact(artifact.url)}
                      accessibilityRole="button"
                      accessibilityLabel="Open recording file"
                    >
                      <Ionicons name="open-outline" size={14} color={colors.text} />
                      <Text style={styles.artifactActionText}>Open</Text>
                    </Pressable>
                    <Pressable
                      style={styles.artifactActionBtn}
                      onPress={() => void copyRecordingArtifactLink(artifact.url)}
                      accessibilityRole="button"
                      accessibilityLabel="Copy recording link"
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.text} />
                      <Text style={styles.artifactActionText}>Copy Link</Text>
                    </Pressable>
                    <Pressable
                      style={styles.artifactActionBtn}
                      onPress={() => void shareRecordingArtifact(artifact.url)}
                      accessibilityRole="button"
                      accessibilityLabel="Share recording link"
                    >
                      <Ionicons name="share-social-outline" size={14} color={colors.text} />
                      <Text style={styles.artifactActionText}>Share Link</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
      <AppPopup
        visible={isPopupVisible}
        title={popupTitle}
        message={popupMessage}
        tone={popupTone}
        actions={popupActions}
        onClose={() => setIsPopupVisible(false)}
      />
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
      <Text style={styles.controlText} numberOfLines={2}>
        {label}
      </Text>
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
    textAlign: "center",
    width: "100%",
    lineHeight: 12,
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
  viewFilesBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
  viewFilesText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
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
  artifactCard: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  artifactTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  artifactUrl: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  artifactActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  artifactActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  artifactActionText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4, 10, 18, 0.55)",
    zIndex: 30,
  },
  chatPanel: {
    backgroundColor: "#0D1F35",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#1E3D60",
    maxHeight: "70%",
    paddingBottom: 8,
    overflow: "hidden",
  },
  // ── Header ──
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  chatHeaderTitle: {
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chatBadge: {
    backgroundColor: "#1E4A7E",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chatBadgeText: {
    color: "#A8D4FF",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
  },
  chatCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#152945",
    borderWidth: 1,
    borderColor: "#1E3D60",
    alignItems: "center",
    justifyContent: "center",
  },
  chatDivider: {
    height: 1,
    backgroundColor: "#1A355A",
    marginHorizontal: 0,
  },
  // ── Empty state ──
  chatEmptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 10,
  },
  chatEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#112135",
    borderWidth: 1,
    borderColor: "#1E3D60",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  chatEmptyTitle: {
    color: "#CBD8E8",
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
  },
  chatEmptySubtitle: {
    color: "#4A7AAC",
    fontFamily: type.body,
    fontSize: 13,
    textAlign: "center",
  },
  // ── Messages list ──
  chatList: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  chatListContent: {
    paddingBottom: 6,
    paddingTop: 4,
    gap: 10,
  },
  // ── My bubble ──
  chatRowMine: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  chatBubbleMineWrap: {
    backgroundColor: "#1A5AA8",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "78%",
    borderWidth: 1,
    borderColor: "#2674CC",
  },
  chatBubbleMineText: {
    color: "#EAF4FF",
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chatTimeMine: {
    color: "#7AADDA",
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "right",
  },
  // ── Remote bubble ──
  chatRowRemote: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1E3D60",
    borderWidth: 1,
    borderColor: "#2A5580",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chatAvatarText: {
    color: "#A8D4FF",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
  },
  chatBubbleRemoteWrap: {
    backgroundColor: "#112135",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "78%",
    borderWidth: 1,
    borderColor: "#1E3D60",
  },
  chatSenderName: {
    color: "#5BA3E0",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 3,
    textTransform: "capitalize",
  },
  chatBubbleRemoteText: {
    color: "#CBD8E8",
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chatTimeRemote: {
    color: "#3A6A9E",
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  // ── Composer ──
  chatComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#1A355A",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#0A1929",
    borderWidth: 1,
    borderColor: "#1E3D60",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: "#EAF3FF",
    fontFamily: type.body,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 42,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1A5AA8",
    borderWidth: 1,
    borderColor: "#2674CC",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chatSendBtnDisabled: {
    backgroundColor: "#0D1F35",
    borderColor: "#1A355A",
  },
});

