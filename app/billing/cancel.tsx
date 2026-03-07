import { Redirect } from "expo-router";

export default function BillingCancelRedirect() {
  return (
    <Redirect
      href={{
        pathname: "/(app)/billing",
        params: { billingReturn: "cancel" },
      }}
    />
  );
}
