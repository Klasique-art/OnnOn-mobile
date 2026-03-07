# Frontend Guide: Auth-Context Meeting Session Endpoints

This guide covers only the newest frontend integration items:
- Join meeting and always get `participantId` for authenticated user
- Recover my current meeting session on reconnect
- Update my media state without sending `participantId`
- Leave my session without sending `participantId`

Base URL:
- Primary: `/api/meetings`
- Compatibility also exists: `/meetings`

All endpoints below require:
- `Authorization: Bearer <token>`

## 1) Join as Authenticated User (Idempotent)

Endpoint:
- `POST /api/meetings/:roomId/me/join`

Request:
```json
{
  "displayName": "Amina",
  "password": "",
  "preJoin": {
    "micOn": false,
    "cameraOn": false
  },
  "device": {
    "platform": "ios",
    "appVersion": "1.0.0"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Joined meeting",
  "data": {
    "meetingId": "mtg_abc123",
    "participantId": "p_789",
    "role": "attendee",
    "status": "joined",
    "waitingRoom": false,
    "session": {
      "token": "session-token",
      "expiresAt": "2026-03-10T15:00:00.000Z"
    },
    "effective": {
      "micOn": false,
      "cameraOn": false
    },
    "capabilities": {
      "canUnmuteSelf": true,
      "canStartVideo": true,
      "canScreenShare": true,
      "canRecord": false,
      "maxParticipants": 5
    }
  }
}
```

Notes:
- If user already joined, backend returns existing active session instead of failing.
- This is the recommended endpoint for authenticated in-app joins.

## 2) Recover My Session (Reconnect Flow)

Endpoint:
- `GET /api/meetings/:roomId/me/session`

Response:
```json
{
  "success": true,
  "data": {
    "meetingId": "mtg_abc123",
    "participantId": "p_789",
    "role": "attendee",
    "status": "joined",
    "waitingRoom": false,
    "session": {
      "token": "session-token",
      "expiresAt": "2026-03-10T15:00:00.000Z"
    },
    "effective": {
      "micOn": false,
      "cameraOn": true
    },
    "capabilities": {
      "canUnmuteSelf": true,
      "canStartVideo": true,
      "canScreenShare": true,
      "canRecord": false,
      "maxParticipants": 5
    }
  }
}
```

Reconnect strategy:
1. App enters meeting screen.
2. Call `GET /me/session`.
3. If success, restore `participantId`, token, media/capabilities.
4. If `404 Participant session not found`, call `POST /me/join`.

## 3) Update My Media (Auth Context Only)

Endpoint:
- `PATCH /api/meetings/:roomId/me/media`

Request:
```json
{
  "isMicOn": false,
  "isCameraOn": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "participantId": "p_789",
    "isMicOn": false,
    "isCameraOn": true
  }
}
```

Frontend behavior:
- Use optimistic toggle for UX.
- Reconcile final state from response (`isMicOn`, `isCameraOn`).

## 4) Leave My Session (Auth Context Only)

Endpoint:
- `POST /api/meetings/:roomId/me/leave`

Response:
```json
{
  "success": true,
  "message": "Left meeting"
}
```

Frontend behavior:
- On success clear local session state (`participantId`, token, media state).
- Navigate away from meeting room.

## 5) Minimal Frontend State to Persist

- `meetingId`
- `roomId`
- `participantId`
- `session.token`
- `session.expiresAt`
- `role`
- `effective.micOn`
- `effective.cameraOn`
- `capabilities`

## 6) Error Handling

Standard error shape:
```json
{
  "success": false,
  "message": "Human-readable reason"
}
```

Common messages:
- `Unauthorized` (401)
- `Invalid invite link` (404)
- `Meeting not found` (404)
- `Participant session not found` (404)
- `Meeting has ended` (409)
- `Incorrect meeting password` (401)
- `Meeting is full` (409)
