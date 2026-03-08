export const ROOM_STATE_POLL_INTERVAL_MS = 10_000;

export type ApiErrorResponse = {
    success?: boolean;
    message?: string;
    code?: string;
};

export type CallParticipant = {
    id: string;
    name: string;
    avatarUrl?: string | null;
    isHost: boolean;
    isLocal: boolean;
    isMicOn: boolean;
    isCameraOn: boolean;
    isScreenSharing?: boolean;
};

export type CallChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    sentAt: string;
    mine: boolean;
};

export type InvitePreviewResponse = {
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

export type JoinMeetingRequest = {
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

export type JoinMeetingResponse = {
    success: boolean;
    message?: string;
    data?: MyMeetingSession;
};

export type MyMeetingSession = {
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
    realtime?: {
        wsUrl?: string;
        roomId?: string;
        participantId?: string;
        iceServers?: {
            urls: string[];
            username?: string;
            credential?: string;
        }[];
        sfu?: {
            routerRtpCapabilities?: Record<string, unknown>;
        };
    };
};

export type MySessionResponse = {
    success: boolean;
    data?: MyMeetingSession;
};

export type MeetingStateResponse = {
    success: boolean;
    data?: {
        meetingId: string;
        title: string;
        status: "live" | "scheduled" | "completed";
        participants: {
            id: string;
            displayName: string;
            avatar?: string | null;
            isHost: boolean;
            isMicOn: boolean;
            isCameraOn: boolean;
            isScreenSharing?: boolean;
            joinedAt?: string;
            lastSeenAt?: string;
            media?: {
                micOn?: boolean;
                cameraOn?: boolean;
                screenSharing?: boolean;
            };
        }[];
        activeScreenShare?: {
            participantId?: string | null;
            startedAt?: string;
        } | null;
        endedAt?: string | null;
        lastActiveAt?: string;
        resumeWindowSeconds?: number;
        settings?: {
            waitingRoom?: boolean;
            muteOnJoin?: boolean;
            allowScreenShare?: boolean;
            allowRecording?: boolean;
        };
    };
};

export type ParticipantMediaUpdateResponse = {
    success: boolean;
    data?: {
        participantId?: string;
        isMicOn?: boolean;
        isCameraOn?: boolean;
        micOn?: boolean;
        cameraOn?: boolean;
    };
};

export type LeaveMeetingResponse = {
    success: boolean;
    message?: string;
};

export type MeetingChatMessageResponse = {
    success: boolean;
    data?: {
        id: string;
        senderId: string;
        senderName: string;
        text: string;
        sentAt: string;
    };
};

export type MeetingChatHistoryResponse = {
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

export type ProfileResponse = {
    success: boolean;
    data?: {
        displayName?: string;
        avatar?: string | null;
    };
};

export type SubscriptionResponse = {
    success: boolean;
    data?: {
        planId?: "free" | "basic" | "pro";
        maxDurationMinutes?: number;
        entitlements?: {
            recording?: boolean;
        };
    };
};

export type ScreenShareStartResponse = {
    success: boolean;
    message?: string;
};

export type ScreenShareStopResponse = {
    success: boolean;
    message?: string;
};

export type RecordingStatus = "idle" | "recording" | "processing" | "ready";

export type MeetingRecordingArtifact = {
    id?: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    createdAt?: string;
};

export type MeetingRecordingStatusResponse = {
    success: boolean;
    data?: {
        status?: RecordingStatus;
        artifacts?: MeetingRecordingArtifact[];
    };
    message?: string;
};
