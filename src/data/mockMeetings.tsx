export type MeetingStatus = "live" | "scheduled" | "completed";

export type MockMeeting = {
  id: string;
  title: string;
  hostName: string;
  startsAt: string;
  durationMinutes: number;
  participantCount: number;
  maxParticipants: number;
  passwordProtected: boolean;
  status: MeetingStatus;
};

const now = new Date();

const plusMinutes = (minutes: number) =>
  new Date(now.getTime() + minutes * 60 * 1000).toISOString();

const minusMinutes = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();

export const mockMeetings: MockMeeting[] = [
  {
    id: "mtg-001",
    title: "Daily Team Standup",
    hostName: "Klasique",
    startsAt: plusMinutes(10),
    durationMinutes: 30,
    participantCount: 3,
    maxParticipants: 25,
    passwordProtected: false,
    status: "scheduled",
  },
  {
    id: "mtg-002",
    title: "Client Product Demo",
    hostName: "Amina",
    startsAt: plusMinutes(90),
    durationMinutes: 45,
    participantCount: 8,
    maxParticipants: 25,
    passwordProtected: true,
    status: "scheduled",
  },
  {
    id: "mtg-003",
    title: "Design Crit Session",
    hostName: "You",
    startsAt: minusMinutes(5),
    durationMinutes: 60,
    participantCount: 6,
    maxParticipants: 25,
    passwordProtected: false,
    status: "live",
  },
  {
    id: "mtg-004",
    title: "Quarterly Review",
    hostName: "Maya",
    startsAt: minusMinutes(200),
    durationMinutes: 50,
    participantCount: 15,
    maxParticipants: 100,
    passwordProtected: true,
    status: "completed",
  },
];
