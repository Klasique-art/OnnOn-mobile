import { AxiosError } from "axios";
import type { ApiErrorResponse, ParticipantMediaUpdateResponse } from "@/src/types/callRoomTypes";

/** Returns true when the API error is a 409 "Meeting has ended" response. */
export const isMeetingEndedError = (error: AxiosError<ApiErrorResponse>): boolean =>
    error?.response?.status === 409 &&
    (error?.response?.data?.message || "").toLowerCase().includes("meeting has ended");

/** Formats elapsed seconds as HH:MM:SS. */
export const formatElapsed = (totalSeconds: number): string => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
};

/** Formats recording duration as MM:SS. */
export const formatRecording = (totalSeconds: number): string => {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
};

/** Builds 1–2 character initials from a display name. */
export const buildInitials = (name: string): string =>
    name
        .split(" ")
        .map((w) => w[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();

/** Formats an ISO date string as a short HH:MM time string. */
export const formatMessageTime = (sentAt: string): string =>
    new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Resolves the confirmed mic/cam booleans from a PATCH media response payload.
 * Falls back to the intended (requested) values when the server returns nothing.
 */
export const resolveMediaFromPayload = (
    payload: ParticipantMediaUpdateResponse["data"] | undefined,
    fallbackMic: boolean,
    fallbackCam: boolean
): { resolvedMic: boolean; resolvedCam: boolean } => {
    const resolvedMic = payload
        ? typeof payload.isMicOn === "boolean"
            ? payload.isMicOn
            : typeof payload.micOn === "boolean"
                ? payload.micOn
                : fallbackMic
        : fallbackMic;

    const resolvedCam = payload
        ? typeof payload.isCameraOn === "boolean"
            ? payload.isCameraOn
            : typeof payload.cameraOn === "boolean"
                ? payload.cameraOn
                : fallbackCam
        : fallbackCam;

    return { resolvedMic, resolvedCam };
};
