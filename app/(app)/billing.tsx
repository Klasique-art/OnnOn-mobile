import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AxiosError } from "axios";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ScreenNav from "@/src/components/ScreenNav";
import AppPopup, { PopupAction, PopupTone } from "@/src/components/AppPopup";
import client from "@/lib/client";
import { colors, type } from "@/src/theme/colors";

type PlanId = "free" | "basic" | "pro";
type SubscriptionState = "active" | "cancel_at_period_end" | "inactive";

type BillingPlan = {
  id: PlanId;
  name: PlanId;
  priceMonthlyCents: number;
  currency: "USD";
  interval: "month";
  priceLabel: string;
  accent: string;
  maxParticipants: number;
  maxDurationMinutes: number;
  maxDurationLabel: string;
  features: string[];
  isDefault: boolean;
  isActive: boolean;
  stripePriceId?: string | null;
};

type BillingSubscription = {
  planId: PlanId;
  subscriptionState: SubscriptionState;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cycleEndLabel: string | null;
  customerId: string | null;
  subscriptionId: string | null;
};

type PaymentRecord = {
  id: string;
  date: string;
  amountLabel: string;
  status: "paid" | "failed" | "pending" | "refunded";
  description: string;
  invoiceUrl?: string;
  receiptUrl?: string;
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
};

type PlansResponse = {
  success: boolean;
  message?: string;
  data: { plans: BillingPlan[] };
};

type SubscriptionResponse = {
  success: boolean;
  message?: string;
  data: BillingSubscription;
};

type HistoryResponse = {
  success: boolean;
  message?: string;
  data: {
    items: PaymentRecord[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
};

type CheckoutSessionResponse = {
  success: boolean;
  message?: string;
  data: { sessionId: string; checkoutUrl: string };
};

type CheckoutStatusResponse = {
  success: boolean;
  message?: string;
  data: {
    sessionId: string;
    paymentStatus: string;
    subscriptionStatus: string;
    planId: PlanId;
  };
};

type PortalSessionResponse = {
  success: boolean;
  message?: string;
  data: { portalUrl: string };
};

const getApiMessage = (err: unknown, fallback: string) => {
  const apiError = err as AxiosError<ApiErrorResponse>;
  return apiError?.response?.data?.message || fallback;
};

export default function BillingScreen() {
  const router = useRouter();
  const { billingReturn, sessionId } = useLocalSearchParams<{
    billingReturn?: string | string[];
    sessionId?: string | string[];
  }>();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasNextPage, setHistoryHasNextPage] = useState(false);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isPlanActionBusy, setIsPlanActionBusy] = useState(false);
  const [isPortalBusy, setIsPortalBusy] = useState(false);
  const [isSubscriptionBusy, setIsSubscriptionBusy] = useState(false);
  const [pendingCheckoutSessionId, setPendingCheckoutSessionId] = useState<string | null>(
    null
  );
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTone, setPopupTone] = useState<PopupTone>("info");
  const [popupActions, setPopupActions] = useState<PopupAction[]>([
    { label: "OK", variant: "primary" },
  ]);
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  const currentPlan = useMemo(() => {
    if (!subscription) return plans[0] || null;
    return plans.find((plan) => plan.id === subscription.planId) || plans[0] || null;
  }, [plans, subscription]);

  const showPopup = useCallback(
    ({
      title,
      message,
      tone = "info",
      actions = [{ label: "OK", variant: "primary" }],
    }: {
      title: string;
      message?: string;
      tone?: PopupTone;
      actions?: PopupAction[];
    }) => {
      setPopupTitle(title);
      setPopupMessage(message || "");
      setPopupTone(tone);
      setPopupActions(actions);
      setIsPopupVisible(true);
    },
    []
  );

  const closePopup = () => setIsPopupVisible(false);

  const fetchSubscription = useCallback(async () => {
    const response = await client.get<SubscriptionResponse>("/payments/subscription");
    setSubscription(response.data.data);
  }, []);

  const bootstrapBilling = useCallback(async () => {
    try {
      setIsBootstrapping(true);
      const [plansRes, subRes, historyRes] = await Promise.all([
        client.get<PlansResponse>("/payments/plans"),
        client.get<SubscriptionResponse>("/payments/subscription"),
        client.get<HistoryResponse>("/payments/history", {
          params: { page: 1, limit: 20 },
        }),
      ]);

      setPlans(plansRes.data.data?.plans || []);
      setSubscription(subRes.data.data || null);
      setHistory(historyRes.data.data?.items || []);
      setHistoryPage(historyRes.data.data?.pagination?.page || 1);
      setHistoryHasNextPage(Boolean(historyRes.data.data?.pagination?.hasNextPage));
    } catch (err) {
      showPopup({
        title: "Billing Load Failed",
        message: getApiMessage(err, "Could not load billing data."),
        tone: "danger",
      });
    } finally {
      setIsBootstrapping(false);
    }
  }, [showPopup]);

  const loadMoreHistory = useCallback(async () => {
    if (isHistoryLoadingMore || !historyHasNextPage) return;
    try {
      setIsHistoryLoadingMore(true);
      const nextPage = historyPage + 1;
      const response = await client.get<HistoryResponse>("/payments/history", {
        params: { page: nextPage, limit: 20 },
      });
      const nextItems = response.data.data?.items || [];
      const nextPagination = response.data.data?.pagination;
      setHistory((prev) => [...prev, ...nextItems]);
      setHistoryPage(nextPagination?.page || nextPage);
      setHistoryHasNextPage(Boolean(nextPagination?.hasNextPage));
    } catch (err) {
      showPopup({
        title: "History Load Failed",
        message: getApiMessage(err, "Could not load more payment history."),
        tone: "danger",
      });
    } finally {
      setIsHistoryLoadingMore(false);
    }
  }, [historyHasNextPage, historyPage, isHistoryLoadingMore, showPopup]);

  const pollCheckoutStatus = useCallback(
    async (sessionId: string) => {
      try {
        const response = await client.get<CheckoutStatusResponse>(
          "/payments/checkout-status",
          {
            params: { sessionId },
          }
        );
        const status = response.data.data;
        if (status.paymentStatus === "paid" || status.subscriptionStatus === "active") {
          await fetchSubscription();
          showPopup({
            title: "Payment Successful",
            message: "Your subscription has been updated.",
            tone: "success",
          });
        } else {
          showPopup({
            title: "Payment Pending",
            message:
              "Checkout returned, but payment is not fully confirmed yet. Please refresh shortly.",
            tone: "info",
          });
        }
      } catch (err) {
        showPopup({
          title: "Status Check Failed",
          message: getApiMessage(err, "Could not verify checkout status."),
          tone: "danger",
        });
      } finally {
        setPendingCheckoutSessionId(null);
      }
    },
    [fetchSubscription, showPopup]
  );

  const handleBillingReturnUrl = useCallback(
    async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = (parsed.path || "").replace(/^\/+/, "");
      const pathLower = path.toLowerCase();
      const querySessionId = String(
        (parsed.queryParams?.sessionId as string) ||
          (parsed.queryParams?.session_id as string) ||
          ""
      ).trim();
      const resolvedSessionId = querySessionId || pendingCheckoutSessionId || "";

      if (pathLower === "billing/success") {
        if (resolvedSessionId) {
          await pollCheckoutStatus(resolvedSessionId);
        } else {
          await fetchSubscription();
          showPopup({
            title: "Billing Updated",
            message: "Checkout returned successfully. Subscription refreshed.",
            tone: "success",
          });
        }
      }

      if (pathLower === "billing/cancel") {
        showPopup({
          title: "Checkout Cancelled",
          message: "No payment was made.",
          tone: "info",
        });
      }
    },
    [fetchSubscription, pendingCheckoutSessionId, pollCheckoutStatus, showPopup]
  );

  useEffect(() => {
    bootstrapBilling();
  }, [bootstrapBilling]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      void handleBillingReturnUrl(event.url);
    });

    void Linking.getInitialURL().then((url) => {
      void handleBillingReturnUrl(url);
    });

    return () => {
      sub.remove();
    };
  }, [handleBillingReturnUrl]);

  useEffect(() => {
    const returnFlag = Array.isArray(billingReturn) ? billingReturn[0] : billingReturn;
    const routeSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    if (!returnFlag) return;

    if (returnFlag === "success") {
      if (routeSessionId?.trim()) {
        void pollCheckoutStatus(routeSessionId.trim());
      } else if (pendingCheckoutSessionId) {
        void pollCheckoutStatus(pendingCheckoutSessionId);
      } else {
        void fetchSubscription();
      }
    }
    if (returnFlag === "cancel") {
      showPopup({
        title: "Checkout Cancelled",
        message: "No payment was made.",
        tone: "info",
      });
    }

    router.replace("/(app)/billing");
  }, [
    billingReturn,
    fetchSubscription,
    pendingCheckoutSessionId,
    pollCheckoutStatus,
    router,
    sessionId,
    showPopup,
  ]);

  const startCheckout = async (plan: BillingPlan) => {
    if (!subscription) return;
    if (plan.id === "free") {
      showPopup({
        title: "Free Plan",
        message: "You are already on the free plan. Use billing portal for paid changes.",
        tone: "info",
      });
      return;
    }

    try {
      setIsPlanActionBusy(true);
      const successUrl = Linking.createURL("/billing/success", {
        queryParams: { sessionId: "{CHECKOUT_SESSION_ID}" },
      });
      const cancelUrl = Linking.createURL("/billing/cancel");

      const response = await client.post<CheckoutSessionResponse>(
        "/payments/checkout-session",
        {
          planId: plan.id,
          successUrl,
          cancelUrl,
        }
      );

      const { checkoutUrl, sessionId } = response.data.data;
      setPendingCheckoutSessionId(sessionId);
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch (err) {
      showPopup({
        title: "Checkout Failed",
        message: getApiMessage(err, "Could not start checkout."),
        tone: "danger",
      });
    } finally {
      setIsPlanActionBusy(false);
    }
  };

  const openBillingPortal = async () => {
    if (!subscription) return;
    const hasBillingProfile = Boolean(
      subscription.customerId || subscription.subscriptionId
    );
    if (!hasBillingProfile) {
      showPopup({
        title: "Billing Portal Unavailable",
        message:
          "No active billing profile yet. Upgrade to a paid plan first, then reopen billing portal.",
        tone: "info",
      });
      return;
    }

    try {
      setIsPortalBusy(true);
      const returnUrl = Linking.createURL("/billing");
      const response = await client.post<PortalSessionResponse>(
        "/payments/portal-session",
        { returnUrl }
      );
      await WebBrowser.openBrowserAsync(response.data.data.portalUrl);
    } catch (err) {
      const apiMessage = getApiMessage(err, "Could not open billing portal.");
      showPopup({
        title: "Portal Failed",
        message:
          apiMessage === "No active billing profile"
            ? "No active billing profile yet. Upgrade to a paid plan first."
            : apiMessage,
        tone: "danger",
      });
    } finally {
      setIsPortalBusy(false);
    }
  };

  const cancelAtPeriodEnd = async () => {
    try {
      setIsSubscriptionBusy(true);
      const response = await client.post<SubscriptionResponse>(
        "/payments/subscription/cancel",
        { cancelAtPeriodEnd: true }
      );
      setSubscription(response.data.data);
      showPopup({
        title: "Cancellation Scheduled",
        message: response.data.message || "Subscription will cancel at period end.",
        tone: "success",
      });
    } catch (err) {
      showPopup({
        title: "Cancel Failed",
        message: getApiMessage(err, "Could not schedule cancellation."),
        tone: "danger",
      });
    } finally {
      setIsSubscriptionBusy(false);
    }
  };

  const reactivateSubscription = async () => {
    try {
      setIsSubscriptionBusy(true);
      const response = await client.post<SubscriptionResponse>(
        "/payments/subscription/reactivate",
        { cancelAtPeriodEnd: false }
      );
      setSubscription(response.data.data);
      showPopup({
        title: "Subscription Reactivated",
        message: response.data.message || "Your subscription is active again.",
        tone: "success",
      });
    } catch (err) {
      showPopup({
        title: "Reactivation Failed",
        message: getApiMessage(err, "Could not reactivate subscription."),
        tone: "danger",
      });
    } finally {
      setIsSubscriptionBusy(false);
    }
  };

  if (isBootstrapping || !currentPlan || !subscription) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text style={styles.stateText}>Loading billing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cycleEndLabel = subscription.cycleEndLabel || "N/A";
  const isPaidPlan = subscription.planId !== "free";
  const hasBillingProfile = Boolean(
    subscription.customerId || subscription.subscriptionId
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenNav title="Billing" fallbackHref="/(app)/(tabs)/home" />

        <View style={[styles.heroCard, { borderColor: currentPlan.accent || colors.stroke }]}>
          <Text style={styles.heroKicker}>Current Plan</Text>
          <Text style={styles.heroTitle}>{currentPlan.name.toUpperCase()}</Text>
          <Text style={styles.heroSub}>
            {currentPlan.priceLabel}/month - up to {currentPlan.maxParticipants} people
          </Text>
          <Text style={styles.heroMeta}>
            {subscription.subscriptionState === "active"
              ? `Active. Renews on ${cycleEndLabel}.`
              : subscription.subscriptionState === "cancel_at_period_end"
                ? `Cancellation scheduled for ${cycleEndLabel}.`
                : "Subscription inactive."}
          </Text>
          <View style={styles.heroActions}>
            {isPaidPlan && subscription.cancelAtPeriodEnd === false ? (
              <Pressable
                onPress={cancelAtPeriodEnd}
                style={styles.secondaryBtn}
                disabled={isSubscriptionBusy}
              >
                <Text style={styles.secondaryBtnText}>
                  {isSubscriptionBusy ? "Please wait..." : "Cancel at period end"}
                </Text>
              </Pressable>
            ) : null}
            {isPaidPlan && subscription.cancelAtPeriodEnd === true ? (
              <Pressable
                onPress={reactivateSubscription}
                style={styles.secondaryBtn}
                disabled={isSubscriptionBusy}
              >
                <Text style={styles.secondaryBtnText}>
                  {isSubscriptionBusy ? "Please wait..." : "Reactivate"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.primaryBtn}
              onPress={openBillingPortal}
              disabled={isPortalBusy || !hasBillingProfile}
            >
              <Text style={styles.primaryBtnText}>
                {isPortalBusy
                  ? "Opening..."
                  : hasBillingProfile
                    ? "Open billing portal"
                    : "Portal (upgrade first)"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Plans</Text>
          <Text style={styles.sectionSub}>Pick what fits your team stage</Text>
        </View>

        {plans.map((plan) => {
          const isCurrent = plan.id === subscription.planId;
          return (
            <View
              key={plan.id}
              style={[styles.planCard, { borderColor: `${plan.accent || colors.stroke}55` }]}
            >
              <View style={styles.planTop}>
                <View>
                  <Text style={[styles.planName, { color: plan.accent || colors.info }]}>
                    {plan.name.toUpperCase()}
                  </Text>
                  <Text style={styles.planPrice}>{plan.priceLabel}/mo</Text>
                  <Text style={styles.planMeta}>
                    {plan.maxParticipants} participants - {plan.maxDurationLabel}
                  </Text>
                </View>
                {isCurrent ? (
                  <View style={[styles.currentBadge, { backgroundColor: plan.accent }]}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.featureWrap}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureChip}>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.planActions}>
                {isCurrent ? (
                  <Pressable style={[styles.actionBtn, styles.disabledBtn]} disabled>
                    <Text style={styles.disabledBtnText}>Already active</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void startCheckout(plan)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: plan.accent, borderColor: plan.accent },
                    ]}
                    disabled={isPlanActionBusy}
                  >
                    <Text style={styles.actionBtnText}>
                      {isPlanActionBusy
                        ? "Please wait..."
                        : plan.priceMonthlyCents > currentPlan.priceMonthlyCents
                          ? "Upgrade"
                          : "Switch Plan"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <Text style={styles.sectionSub}>Most recent charges</Text>
        </View>

        <View style={styles.historyCard}>
          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.historyDate}>No payment history yet.</Text>
            </View>
          ) : (
            history.map((payment) => (
              <View key={payment.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{payment.description}</Text>
                  <Text style={styles.historyDate}>{payment.date}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>{payment.amountLabel}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      payment.status === "paid" ? styles.statusPaid : styles.statusFailed,
                    ]}
                  >
                    <Text style={styles.statusText}>{payment.status}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
          {history.length > 0 && historyHasNextPage ? (
            <View style={styles.historyFooter}>
              <Pressable
                style={[styles.secondaryBtn, isHistoryLoadingMore && styles.buttonDisabled]}
                onPress={() => void loadMoreHistory()}
                disabled={isHistoryLoadingMore}
              >
                <Text style={styles.secondaryBtnText}>
                  {isHistoryLoadingMore ? "Loading..." : "Load more"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AppPopup
        visible={isPopupVisible}
        title={popupTitle}
        message={popupMessage}
        tone={popupTone}
        actions={popupActions}
        onClose={closePopup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  bgOrbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FFE6BA",
    top: -90,
    right: -80,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D7E7FA",
    bottom: -120,
    left: -90,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  heroKicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 33,
    lineHeight: 38,
  },
  heroSub: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  heroMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  primaryBtn: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryBtn: {
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sectionHeader: {
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionSub: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 9,
  },
  planTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  planName: {
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  planPrice: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 28,
    lineHeight: 32,
  },
  planMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
  },
  currentBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: {
    color: "#fff",
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "800",
  },
  featureWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  featureChip: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  featureText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
  },
  planActions: {
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "800",
  },
  disabledBtn: {
    backgroundColor: "#E9EEF4",
    borderColor: "#D0D9E4",
  },
  disabledBtnText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyHistory: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  historyFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  historyTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  historyDate: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    marginTop: 2,
  },
  historyRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  historyAmount: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: {
    backgroundColor: "#FFEBC9",
  },
  statusFailed: {
    backgroundColor: "#FFD6D6",
  },
  statusText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
