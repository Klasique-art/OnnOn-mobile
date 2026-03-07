# Billing API Contract (OnnOn Mobile)


Scope: Full billing/subscription lifecycle for mobile app  
Auth: `Authorization: Bearer <JWT_TOKEN>` for all endpoints except webhook

## Core Rules

1. Every new user starts on `free` plan by default.
2. Backend is source of truth for plan, limits, and entitlement checks.
3. Plan IDs must be exactly: `free`, `basic`, `pro`.
4. Response shape should be consistent: `{ success, message?, data }`.
5. `GET /payments/plans` must include full perks for each plan (see Plan Matrix).

---

## Plan Matrix (Required Backend Truth)

Use this exact entitlement model in DB/service logic and responses.

```json
{
  "plans": [
    {
      "id": "free",
      "name": "free",
      "priceMonthlyCents": 0,
      "currency": "USD",
      "interval": "month",
      "priceLabel": "$0",
      "accent": "#4E6F8E",
      "maxParticipants": 5,
      "maxDurationMinutes": 40,
      "maxDurationLabel": "40 mins",
      "features": [
        "Basic calls",
        "Up to 5 participants",
        "40-minute meeting limit",
        "Basic chat"
      ],
      "entitlements": {
        "hdVideo": false,
        "screenShare": true,
        "recording": false,
        "breakoutRooms": false,
        "prioritySupport": false,
        "waitingRoom": false,
        "cloudStorageGb": 0
      },
      "isDefault": true,
      "isActive": true
    },
    {
      "id": "basic",
      "name": "basic",
      "priceMonthlyCents": 999,
      "currency": "USD",
      "interval": "month",
      "priceLabel": "$9.99",
      "accent": "#F6A402",
      "maxParticipants": 25,
      "maxDurationMinutes": 1440,
      "maxDurationLabel": "24 hours",
      "features": [
        "HD calls",
        "Up to 25 participants",
        "Long meetings (24h)",
        "Screen share"
      ],
      "entitlements": {
        "hdVideo": true,
        "screenShare": true,
        "recording": false,
        "breakoutRooms": false,
        "prioritySupport": false,
        "waitingRoom": true,
        "cloudStorageGb": 0
      },
      "stripePriceId": "price_basic_monthly",
      "isDefault": false,
      "isActive": true
    },
    {
      "id": "pro",
      "name": "pro",
      "priceMonthlyCents": 2999,
      "currency": "USD",
      "interval": "month",
      "priceLabel": "$29.99",
      "accent": "#DC0000",
      "maxParticipants": 100,
      "maxDurationMinutes": 1440,
      "maxDurationLabel": "24 hours",
      "features": [
        "Up to 100 participants",
        "Cloud recording",
        "Breakout rooms",
        "Priority support"
      ],
      "entitlements": {
        "hdVideo": true,
        "screenShare": true,
        "recording": true,
        "breakoutRooms": true,
        "prioritySupport": true,
        "waitingRoom": true,
        "cloudStorageGb": 100
      },
      "stripePriceId": "price_pro_monthly",
      "isDefault": false,
      "isActive": true
    }
  ]
}
```

---

## Endpoint 1: Get Plans

**GET** `/payments/plans`  
**Auth:** Required

### Success (`200`)
```json
{
  "success": true,
  "message": "Plans fetched",
  "data": {
    "plans": []
  }
}
```

---

## Endpoint 2: Get My Subscription (Current Plan + Billing State)

**GET** `/payments/subscription`  
**Auth:** Required

### Success (`200`)
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
    "entitlements": {
      "hdVideo": false,
      "screenShare": true,
      "recording": false,
      "breakoutRooms": false,
      "prioritySupport": false,
      "waitingRoom": false,
      "cloudStorageGb": 0
    }
  }
}
```

Notes:
- New users must return `planId: "free"`.
- For paid users, return Stripe IDs and billing cycle dates.

---

## Endpoint 3: Create Checkout Session (Upgrade/Switch)

**POST** `/payments/checkout-session`  
**Auth:** Required

### Request Body
```json
{
  "planId": "basic",
  "successUrl": "onnon://billing/success",
  "cancelUrl": "onnon://billing/cancel"
}
```

### Success (`200`)
```json
{
  "success": true,
  "message": "Checkout session created",
  "data": {
    "sessionId": "cs_test_xxx",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_xxx"
  }
}
```

Validation:
- `planId` cannot be `free` for checkout flow.
- return `400` for invalid plan or inactive plan.

---

## Endpoint 4: Checkout Status (Post-Return Poll)

**GET** `/payments/checkout-status?sessionId=cs_test_xxx`  
**Auth:** Required

### Success (`200`)
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx",
    "paymentStatus": "paid",
    "subscriptionStatus": "active",
    "planId": "pro"
  }
}
```

---

## Endpoint 5: Open Billing Portal

**POST** `/payments/portal-session`  
**Auth:** Required

### Request Body
```json
{
  "returnUrl": "onnon://billing"
}
```

### Success (`200`)
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/..."
  }
}
```

---

## Endpoint 6: Cancel At Period End

**POST** `/payments/subscription/cancel`  
**Auth:** Required

### Request Body
```json
{
  "cancelAtPeriodEnd": true
}
```

### Success (`200`)
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

---

## Endpoint 7: Reactivate Subscription

**POST** `/payments/subscription/reactivate`  
**Auth:** Required

### Request Body
```json
{
  "cancelAtPeriodEnd": false
}
```

### Success (`200`)
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

## Endpoint 8: Change Plan Without Checkout (Optional Admin/Internal Flow)

Use only if you support direct server-side swaps.  
If not used, rely on checkout + webhook sync.

**POST** `/payments/subscription/change-plan`  
**Auth:** Required

### Request Body
```json
{
  "planId": "pro",
  "prorationBehavior": "create_prorations"
}
```

### Success (`200`)
```json
{
  "success": true,
  "message": "Plan changed",
  "data": {
    "planId": "pro",
    "subscriptionState": "active"
  }
}
```

---

## Endpoint 9: Payment History (Invoices/Charges)

**GET** `/payments/history?page=1&limit=20`  
**Auth:** Required

### Success (`200`)
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "pay_001",
        "date": "2026-02-01",
        "amountLabel": "$9.99",
        "amountCents": 999,
        "currency": "USD",
        "status": "paid",
        "description": "Basic Plan Monthly",
        "invoiceUrl": "https://invoice.stripe.com/i/...",
        "receiptUrl": "https://pay.stripe.com/receipts/..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 12,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

Status enum:
- `paid`
- `failed`
- `pending`
- `refunded`

---

## Endpoint 10: Get Billing Summary (Optional Convenience)

Useful for one-call screen bootstrap.

**GET** `/payments/summary`  
**Auth:** Required

### Success (`200`)
```json
{
  "success": true,
  "data": {
    "currentPlan": {
      "planId": "basic",
      "subscriptionState": "active",
      "cycleEndLabel": "April 1, 2026"
    },
    "plans": [],
    "recentPayments": []
  }
}
```

---

## Endpoint 11: Stripe Webhook (Backend Only)

**POST** `/payments/webhook`  
**Auth:** Stripe signature verification only

Required events to handle:
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Behavior:
1. Update local subscription record and plan entitlements.
2. Ensure user drops to `free` when subscription fully ends.
3. Keep payment history rows in sync.

---

## Endpoint 12: Force Sync From Stripe (Optional Admin/Recovery)

**POST** `/payments/sync`  
**Auth:** Required (admin or internal service)

### Request Body
```json
{
  "userId": "USER_ID"
}
```

### Success (`200`)
```json
{
  "success": true,
  "message": "Billing state synced",
  "data": {
    "planId": "basic",
    "subscriptionState": "active"
  }
}
```

---

## Common Error Shapes

### Unauthorized (`401`)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Forbidden (`403`)
```json
{
  "success": false,
  "message": "Forbidden"
}
```

### Validation Error (`400`)
```json
{
  "success": false,
  "message": "Invalid planId"
}
```

### Server Error (`500`)
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Minimum Required To Ship Current Billing Screen

Implement these first:
1. `GET /payments/plans`
2. `GET /payments/subscription`
3. `POST /payments/checkout-session`
4. `POST /payments/portal-session`
5. `POST /payments/subscription/cancel`
6. `POST /payments/subscription/reactivate`
7. `GET /payments/history`
8. `POST /payments/webhook`

