import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenNav from "@/src/components/ScreenNav";
import { colors, type } from "@/src/theme/colors";
import {
  BillingPlan,
  billingPlans,
  mockPaymentHistory,
} from "@/src/data/mockBilling";

type SubscriptionState = "active" | "cancel_at_period_end";

export default function BillingScreen() {
  const [currentPlanId, setCurrentPlanId] = useState<"free" | "basic" | "pro">(
    "basic"
  );
  const [subscriptionState, setSubscriptionState] =
    useState<SubscriptionState>("active");

  const currentPlan = useMemo(
    () => billingPlans.find((plan) => plan.id === currentPlanId) ?? billingPlans[0],
    [currentPlanId]
  );

  const cycleEndLabel = "March 1, 2026";

  const applyPlan = (plan: BillingPlan) => {
    setCurrentPlanId(plan.id);
    setSubscriptionState("active");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenNav title="Billing" fallbackHref="/(app)/(tabs)/home" />

        <View style={[styles.heroCard, { borderColor: currentPlan.accent }]}>
          <Text style={styles.heroKicker}>Current Plan</Text>
          <Text style={styles.heroTitle}>{currentPlan.name.toUpperCase()}</Text>
          <Text style={styles.heroSub}>
            {currentPlan.priceLabel}/month • up to {currentPlan.maxParticipants} people
          </Text>
          <Text style={styles.heroMeta}>
            {subscriptionState === "active"
              ? `Active. Renews on ${cycleEndLabel}.`
              : `Cancellation scheduled for ${cycleEndLabel}.`}
          </Text>
          <View style={styles.heroActions}>
            {subscriptionState === "active" ? (
              <Pressable
                onPress={() => setSubscriptionState("cancel_at_period_end")}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Cancel at period end</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSubscriptionState("active")}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Reactivate</Text>
              </Pressable>
            )}
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Open billing portal</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Plans</Text>
          <Text style={styles.sectionSub}>Pick what fits your team stage</Text>
        </View>

        {billingPlans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <View
              key={plan.id}
              style={[styles.planCard, { borderColor: plan.accent + "55" }]}
            >
              <View style={styles.planTop}>
                <View>
                  <Text style={[styles.planName, { color: plan.accent }]}>
                    {plan.name.toUpperCase()}
                  </Text>
                  <Text style={styles.planPrice}>{plan.priceLabel}/mo</Text>
                  <Text style={styles.planMeta}>
                    {plan.maxParticipants} participants • {plan.maxDurationLabel}
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
                    onPress={() => applyPlan(plan)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: plan.accent, borderColor: plan.accent },
                    ]}
                  >
                    <Text style={styles.actionBtnText}>
                      {plan.priceMonthlyCents > currentPlan.priceMonthlyCents
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
          {mockPaymentHistory.map((payment) => (
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
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
    backgroundColor: "#D6ECE3",
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
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
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
    backgroundColor: "#D5F3E8",
  },
  statusFailed: {
    backgroundColor: "#F6D8D3",
  },
  statusText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
});
