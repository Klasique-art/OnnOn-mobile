# Frontend Billing Integration Guide (Stripe)

This guide is for mobile/frontend integration against the current backend billing API.

Base URL prefix for all endpoints below:

`/api/payments`

Auth:

- Send `Authorization: Bearer <JWT_TOKEN>` on all billing endpoints.

Content type:

- `Content-Type: application/json` for POST requests.

---

## 1. Screen Bootstrap Flow

Call these on billing screen open:

1. `GET /plans`
2. `GET /subscription`
3. `GET /history?page=1&limit=20` (optional for main billing screen, required for payment history tab)

Optional single-call alternative:

- `GET /summary`

---

## 2. Endpoint Contracts You Should Use

### Get Plans

- `GET /api/payments/plans`
- Response:

```json
{
  "success": true,
  "message": "Plans fetched",
  "data": {
    "plans": []
  }
}
```

Use `data.plans` for plan cards.

---

### Get Current Subscription

- `GET /api/payments/subscription`
- Response shape:

```json
{
  "success": true,
  "data": {
    "planId": "free",
    "subscriptionState": "active",
    "status": "active",
    "cancelAtPeriodEnd": false,
    "currentPeriodStart": null,
    "currentPeriodEnd": null,
    "cycleEndLabel": null,
    "customerId": null,
    "subscriptionId": null,
    "entitlements": {}
  }
}
```

Important fields:

- `planId`: `free | basic | pro`
- `subscriptionState`: use for badge text (`active`, `cancel_at_period_end`, `inactive`)
- `cycleEndLabel`: human-readable renewal/cancel date for UI

---

### Create Checkout Session (Upgrade)

- `POST /api/payments/checkout-session`
- Body:

```json
{
  "planId": "basic",
  "successUrl": "onnon://billing/success",
  "cancelUrl": "onnon://billing/cancel"
}
```

- Response:

```json
{
  "success": true,
  "message": "Checkout session created",
  "data": {
    "sessionId": "cs_...",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

Frontend action:

- Open `data.checkoutUrl` in browser/webview.
- Persist `data.sessionId` for post-return polling.

---

### Check Checkout Status (After Return)

- `GET /api/payments/checkout-status?sessionId=cs_...`
- Response:

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_...",
    "paymentStatus": "paid",
    "subscriptionStatus": "active",
    "planId": "basic"
  }
}
```

Frontend action:

1. Poll this endpoint after deep-link return.
2. If paid/active, refetch `GET /subscription`.

---

### Open Billing Portal

- `POST /api/payments/portal-session`
- Body:

```json
{
  "returnUrl": "onnon://billing"
}
```

- Response:

```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/..."
  }
}
```

Frontend action:

- Open `portalUrl`.

---

### Cancel At Period End

- `POST /api/payments/subscription/cancel`
- Body:

```json
{
  "cancelAtPeriodEnd": true
}
```

- Response:

```json
{
  "success": true,
  "message": "Subscription will cancel at period end",
  "data": {
    "planId": "basic",
    "subscriptionState": "cancel_at_period_end",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
    "cycleEndLabel": "April 1, 2026"
  }
}
```

Frontend action:

- Update subscription badge/state immediately from this response.

---

### Reactivate Subscription

- `POST /api/payments/subscription/reactivate`
- Body:

```json
{
  "cancelAtPeriodEnd": false
}
```

- Response:

```json
{
  "success": true,
  "message": "Subscription reactivated",
  "data": {
    "planId": "basic",
    "subscriptionState": "active",
    "cancelAtPeriodEnd": false,
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
    "cycleEndLabel": "April 1, 2026"
  }
}
```

---

### Payment History

- `GET /api/payments/history?page=1&limit=20`
- Response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 0,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

Render each item using:

- `amountLabel`, `date`, `status`, `description`

---

### Billing Summary (Optional Convenience)

- `GET /api/payments/summary`
- Response contains:

- `currentPlan`
- `plans`
- `recentPayments`

Use when you want one API call for billing home.

---

## 3. UI Behavior Checklist

1. Plan cards
- Highlight current `subscription.planId`.
- Disable current plan action.
- For `free`, do not call checkout.

2. Upgrade flow
- On paid plan tap (`basic`/`pro`), call `/checkout-session`.
- Open `checkoutUrl`.
- On deep-link success route, poll `/checkout-status`.
- Refetch `/subscription` + `/plans`.

3. Manage subscription flow
- Show `Cancel` only when paid plan is active and `cancelAtPeriodEnd=false`.
- Show `Reactivate` when `cancelAtPeriodEnd=true`.
- Show `cycleEndLabel` when available.

4. History tab
- Use `pagination.hasNextPage` for infinite scroll/load more.

---

## 4. Error Handling

Common backend error shape:

```json
{
  "success": false,
  "message": "Some error message"
}
```

Handle by status:

1. `401`: force relogin/session refresh
2. `400`: show backend `message` inline/toast (validation or business rule)
3. `403`: show forbidden message
4. `500/503`: show retry state and generic failure text

---

## 5. Recommended Frontend API Layer Types

Use these minimal TypeScript interfaces:

```ts
export type PlanId = "free" | "basic" | "pro";

export interface BillingPlan {
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
  entitlements: {
    hdVideo: boolean;
    screenShare: boolean;
    recording: boolean;
    breakoutRooms: boolean;
    prioritySupport: boolean;
    waitingRoom: boolean;
    cloudStorageGb: number;
  };
  isDefault: boolean;
  isActive: boolean;
  stripePriceId?: string | null;
}

export interface BillingSubscription {
  planId: PlanId;
  subscriptionState: "active" | "cancel_at_period_end" | "inactive";
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cycleEndLabel: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  entitlements: BillingPlan["entitlements"];
}
```

---

## 6. Quick Test Sequence

1. Login and obtain JWT.
2. `GET /plans` -> render plans.
3. `GET /subscription` -> verify current plan badge.
4. Start upgrade with `POST /checkout-session`.
5. Open returned `checkoutUrl`.
6. After deep-link return, call `GET /checkout-status`.
7. Refetch `GET /subscription`.
8. Cancel with `POST /subscription/cancel`.
9. Reactivate with `POST /subscription/reactivate`.
10. View `GET /history`.

