import { mediaDevices, MediaStream } from "react-native-webrtc";

export async function getLocalMediaStream({
  audio = true,
  video = true,
}: {
  audio?: boolean;
  video?: boolean;
} = {}) {
  return await mediaDevices.getUserMedia({
    audio,
    video: video
      ? {
          facingMode: "user",
          frameRate: 30,
        }
      : false,
  });
}

export async function getScreenShareStream() {
  const getDisplayMedia = (mediaDevices as typeof mediaDevices & {
    getDisplayMedia?: (constraints: {
      audio?: boolean;
      video: boolean | Record<string, unknown>;
    }) => Promise<MediaStream>;
  }).getDisplayMedia;

  if (!getDisplayMedia) {
    throw new Error("Screen sharing is not available on this device/build.");
  }

  return await getDisplayMedia({
    audio: false,
    video: true,
  });
}

export function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
