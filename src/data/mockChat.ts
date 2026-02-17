export type ChatMessage = {
  id: string;
  sender: "me" | "them";
  text: string;
  sentAt: string;
};

export type ChatConversation = {
  id: string;
  userId: string;
  displayName: string;
  isOnline: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
};

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

export const mockConversations: ChatConversation[] = [
  {
    id: "conv-1",
    userId: "user-aminah",
    displayName: "Aminah",
    isOnline: true,
    unreadCount: 2,
    lastMessage: "Can we move the demo to 3:30?",
    lastMessageAt: minutesAgo(3),
  },
  {
    id: "conv-2",
    userId: "user-kelvin",
    displayName: "Kelvin",
    isOnline: false,
    unreadCount: 0,
    lastMessage: "Shared the file in room chat.",
    lastMessageAt: minutesAgo(22),
  },
  {
    id: "conv-3",
    userId: "user-maya",
    displayName: "Maya",
    isOnline: true,
    unreadCount: 1,
    lastMessage: "Let's prep 10 mins earlier.",
    lastMessageAt: minutesAgo(58),
  },
];

export const mockMessagesByConversation: Record<string, ChatMessage[]> = {
  "conv-1": [
    { id: "m-1", sender: "them", text: "Hey, quick one.", sentAt: minutesAgo(11) },
    {
      id: "m-2",
      sender: "them",
      text: "Can we move the demo to 3:30?",
      sentAt: minutesAgo(3),
    },
  ],
  "conv-2": [
    {
      id: "m-3",
      sender: "me",
      text: "Please send the latest slide export.",
      sentAt: minutesAgo(42),
    },
    {
      id: "m-4",
      sender: "them",
      text: "Shared the file in room chat.",
      sentAt: minutesAgo(22),
    },
  ],
  "conv-3": [
    {
      id: "m-5",
      sender: "them",
      text: "Let's prep 10 mins earlier.",
      sentAt: minutesAgo(58),
    },
  ],
};

export const simulatedReplies = [
  "Got it. That works for me.",
  "Perfect, thanks for the update.",
  "Let's handle it in the meeting room.",
  "I can join in 5 minutes.",
  "Sounds good. See you there.",
];
