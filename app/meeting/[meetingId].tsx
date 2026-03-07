import { Redirect, useLocalSearchParams } from "expo-router";

export default function MeetingShareRoute() {
  const { meetingId, title } = useLocalSearchParams<{
    meetingId?: string | string[];
    title?: string | string[];
  }>();

  const resolvedMeetingId = Array.isArray(meetingId) ? meetingId[0] : meetingId;
  const resolvedTitle = Array.isArray(title) ? title[0] : title;

  if (!resolvedMeetingId) {
    return <Redirect href="/(app)/(tabs)/meetings" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/(app)/call-room",
        params: {
          meetingId: resolvedMeetingId,
          title: resolvedTitle || "",
          invite: "1",
        },
      }}
    />
  );
}
