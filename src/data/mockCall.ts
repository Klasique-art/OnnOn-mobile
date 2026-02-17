export type CallParticipant = {
  id: string;
  name: string;
  isLocal?: boolean;
  isHost?: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
};

export type CallChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
  mine: boolean;
};

export const remoteParticipantPool: Omit<CallParticipant, "id">[] = [
  { name: "Aminah", isMicOn: true, isCameraOn: true },
  { name: "Kelvin", isMicOn: true, isCameraOn: false },
  { name: "Maya", isMicOn: false, isCameraOn: true },
  { name: "Dami", isMicOn: true, isCameraOn: true },
  { name: "Rita", isMicOn: true, isCameraOn: true },
  { name: "Femi", isMicOn: false, isCameraOn: false },
  { name: "Jules", isMicOn: true, isCameraOn: true },
  { name: "Tobi", isMicOn: true, isCameraOn: true },
];

export const callChatReplies = [
  "Looks great from my side.",
  "Can you repeat that last point?",
  "Audio is clear now.",
  "Let's lock this before demo.",
  "Sharing my thoughts in 2 mins.",
  "Nice, this flow feels smooth.",
];
