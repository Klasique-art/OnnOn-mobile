export type BillingPlan = {
  id: "free" | "basic" | "pro";
  name: "free" | "basic" | "pro";
  priceLabel: string;
  priceMonthlyCents: number;
  maxParticipants: number;
  maxDurationLabel: string;
  accent: string;
  features: string[];
};

export type PaymentRecord = {
  id: string;
  date: string;
  amountLabel: string;
  status: "paid" | "failed";
  description: string;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "free",
    priceLabel: "$0",
    priceMonthlyCents: 0,
    maxParticipants: 5,
    maxDurationLabel: "40 mins",
    accent: "#4E6F8E",
    features: ["Basic calls", "5 participants", "40-minute limit"],
  },
  {
    id: "basic",
    name: "basic",
    priceLabel: "$9.99",
    priceMonthlyCents: 999,
    maxParticipants: 25,
    maxDurationLabel: "24 hours",
    accent: "#F6A402",
    features: ["HD calls", "25 participants", "Long meetings", "Screen share"],
  },
  {
    id: "pro",
    name: "pro",
    priceLabel: "$29.99",
    priceMonthlyCents: 2999,
    maxParticipants: 100,
    maxDurationLabel: "24 hours",
    accent: "#DC0000",
    features: ["100 participants", "Recording", "Breakout rooms", "Priority support"],
  },
];

export const mockPaymentHistory: PaymentRecord[] = [
  {
    id: "pay-001",
    date: "2026-02-01",
    amountLabel: "$9.99",
    status: "paid",
    description: "Basic Plan Monthly",
  },
  {
    id: "pay-002",
    date: "2026-01-01",
    amountLabel: "$9.99",
    status: "paid",
    description: "Basic Plan Monthly",
  },
  {
    id: "pay-003",
    date: "2025-12-01",
    amountLabel: "$9.99",
    status: "failed",
    description: "Basic Plan Monthly",
  },
];

