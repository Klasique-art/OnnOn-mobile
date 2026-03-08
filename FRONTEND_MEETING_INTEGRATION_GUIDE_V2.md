# Frontend Meeting Integration Guide (Backend v2)

This file reflects the currently implemented backend contract for meeting integration.

## Base Paths

- Canonical meeting API base: `/api/meetings`
- Backward-compatible alias base (legacy): `/meetings`

## 1) Create Route Alignment

- Canonical create endpoint: `POST /api/meetings`
- Backward-compatible alias: `POST /api/meetings/create`
- Alias responses include header: `X-Canonical-Route: POST /api/meetings`

Use `POST /api/meetings` in new frontend code.

## 2) Error Shape Consistency

Meeting REST errors use:

```json
{
  "success": false,
  "message": "Human-readable reason",
  "code": "ERROR_CODE"
}
```

Common codes:

- `INVALID_INVITE`
- `WRONG_PASSWORD`
- `MEETING_FULL`
- `MEETING_ENDED`
- `UNAUTHORIZED`
- `TIER_RESTRICTED`
- `VALIDATION_FAILURE`

## 3) Realtime Meeting Socket Contract

## 3.1 Socket Auth

Socket connection still uses JWT auth token (`auth.token`).

After connect, server emits:

- `socket:ready`

```json
{
  "success": true,
  "data": {
    "userId": "usr_123"
  }
}
```

## 3.2 Session-Bound Room Join

Client emits:

- `room:join` with:

```json
{
  "roomId": "abc-def-ghi",
  "sessionToken": "participant_session_token"
}
```

Server validates meeting + participant session and responds via ack:

```json
{
  "success": true,
  "data": {
    "meetingId": "mtg_xxx",
    "participantId": "p_xxx",
    "role": "host",
    "participants": []
  }
}
```

Also emits:

- `room:joined`
- `room:participant-joined`
- `room:participant-left`
- `room:participant-updated`
- `room:ended`

## 3.3 Presence Payloads

`room:joined`

```json
{
  "meetingId": "mtg_123",
  "participantId": "part_123",
  "role": "host",
  "participants": []
}
```

`room:participant-joined`

```json
{
  "participant": {
    "id": "part_2",
    "displayName": "Bolu",
    "avatar": null,
    "isHost": false,
    "isMicOn": true,
    "isCameraOn": true,
    "isScreenSharing": false,
    "joinedAt": "2026-03-08T12:00:00.000Z",
    "lastSeenAt": "2026-03-08T12:03:00.000Z",
    "media": {
      "micOn": true,
      "cameraOn": true,
      "screenSharing": false
    }
  }
}
```

`room:participant-left`

```json
{
  "participantId": "part_2"
}
```

`room:participant-updated`

```json
{
  "participantId": "part_2",
  "isMicOn": false,
  "isCameraOn": true,
  "isScreenSharing": false
}
```

`room:ended`

```json
{
  "meetingId": "mtg_123",
  "reason": "host_ended"
}
```

## 4) Mediasoup Signaling (Implemented)

Supported emits:

- `mediasoup:getRouterCapabilities`
- `mediasoup:createSendTransport`
- `mediasoup:connectSendTransport`
- `mediasoup:produce`
- `mediasoup:createRecvTransport`
- `mediasoup:connectRecvTransport`
- `mediasoup:consume`
- `mediasoup:resumeConsumer`
- `mediasoup:pauseConsumer`
- `mediasoup:closeProducer`
- `mediasoup:restartIce`

Server emits:

- `mediasoup:newProducer`
- `mediasoup:producerClosed`
- `mediasoup:consumerPaused`
- `mediasoup:consumerResumed`

Ack format for new/alias events:

```json
{
  "success": true,
  "data": {}
}
```

Error ack format:

```json
{
  "success": false,
  "message": "Human-readable reason",
  "code": "SOCKET_ERROR_CODE"
}
```

`mediasoup:newProducer` payload includes `participantId` and `appData.source`.

## 5) Realtime Info in Join/Session Responses

`POST /api/meetings/:roomId/me/join` and `GET /api/meetings/:roomId/me/session` return:

- `realtime.wsUrl`
- `realtime.roomId`
- `realtime.participantId`
- `realtime.sfu.routerRtpCapabilities`
- `realtime.iceServers`

## 6) Room State Additions

`GET /api/meetings/:roomId/state` now includes:

- `endedAt`
- `lastActiveAt`
- `resumeWindowSeconds`
- participant fields:
  - `avatar`
  - `joinedAt`
  - `lastSeenAt`
  - `media` (`micOn`, `cameraOn`, `screenSharing`)

## 7) ICE/TURN Delivery

Dedicated endpoint:

- `GET /api/meetings/ice-servers` (JWT required)

Response:

```json
{
  "success": true,
  "data": {
    "iceServers": [
      { "urls": ["stun:stun.l.google.com:19302"] }
    ]
  }
}
```

TURN is included when env vars are configured:

- `ICE_TURN_URLS` (comma-separated)
- `ICE_TURN_USERNAME`
- `ICE_TURN_CREDENTIAL`

Optional STUN override:

- `ICE_STUN_URLS` (comma-separated)

## 8) Reconnect/Resume Behavior

- Participant session identity is reused for authenticated join/session calls.
- Meetings track activity with `lastActiveAt`.
- Resume window default is `600` seconds (`resumeWindowSeconds`).
- Socket room join validates session token and user binding.

