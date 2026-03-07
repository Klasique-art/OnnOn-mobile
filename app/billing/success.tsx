import { Redirect, useLocalSearchParams } from "expo-router";

export default function BillingSuccessRedirect() {
  const params = useLocalSearchParams<{ sessionId?: string; session_id?: string }>();

  return (
    <Redirect
      href={{
        pathname: "/(app)/billing",
        params: {
          sessionId: params.sessionId || params.session_id || "",
          billingReturn: "success",
        },
      }}
    />
  );
}
