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

export function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
