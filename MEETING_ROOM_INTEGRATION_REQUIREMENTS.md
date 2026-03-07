# Meeting Integration Remaining Items (Only Pending)

This file intentionally excludes endpoints already implemented in backend guide:
- create/schedule meeting
- list meetings
- update scheduled meeting
- invite preview
- join from invite flow
- join from authenticated in-app flow

## 1) Verify create route alignment (current blocker)

Frontend currently sends create request and gets:
- `404 Route not found`

This is a route mapping mismatch (path/method/base-prefix), not a payload issue.

Backend should verify frontend create call resolves to the implemented create capability.

---

## 2) Endpoint to leave meeting

Purpose: proper participant lifecycle and presence updates.

Request:
```json
{
  "participantId": "p_789"
}
```

Response:
```json
{
  "success": true,
  "message": "Left meeting"
}
```

---

## 3) Endpoint to end meeting (host)

Purpose: host ends meeting for all participants.

Request:
```json
{
  "reason": "host_ended"
}
```

Response:
```json
{
  "success": true,
  "message": "Meeting ended"
}
```

---

## 4) Endpoint for active meeting room state

Purpose: replace simulated room state with backend room state.

Response:
```json
{
  "success": true,
  "data": {
    "meetingId": "mtg_abc123",
    "title": "Weekly Product Sync",
    "status": "live",
    "participants": [
      {
        "id": "p_1",
        "displayName": "Klasique",
        "isHost": true,
        "isMicOn": true,
        "isCameraOn": true
      }
    ],
    "settings": {
      "waitingRoom": true,
      "muteOnJoin": true,
      "allowScreenShare": true,
      "allowRecording": true
    }
  }
}
```

---

## 5) Endpoint to update participant media state

Purpose: sync mic/camera changes across participants.

Request:
```json
{
  "participantId": "p_789",
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

---

## 6) Endpoints for in-meeting chat (fallback/non-socket)

Purpose: send + fetch meeting chat messages when needed.

Send request:
```json
{
  "text": "Hello team"
}
```

Send response:
```json
{
  "success": true,
  "data": {
    "id": "msg_1",
    "senderId": "p_789",
    "senderName": "Amina",
    "text": "Hello team",
    "sentAt": "2026-03-10T14:05:00.000Z"
  }
}
```

History response:
```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

---

## 7) Error cases to keep consistent

- invalid invite
- wrong password
- meeting full
- meeting ended
- unauthorized
- tier restriction
- validation failure

Error shape:
```json
{
  "success": false,
  "message": "Human-readable reason"
}
```
