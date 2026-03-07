# Frontend Guide: Screen Share + Recording Integration

This guide covers only the newly implemented backend features for:
- screen sharing
- recording
- realtime transport bootstrap in join response

Base URL:
- `http://<host>:3000/api`

Auth:
- `Authorization: Bearer <token>` required for all REST calls below.

## 1) Join Flow (Required First Step)

Use:
- `POST /meetings/:roomId/me/join`

Read from response:
- `data.capabilities.canScreenShare`
- `data.capabilities.canRecord`
- `data.realtime.wsUrl`
- `data.realtime.roomId`
- `data.realtime.participantId`
- `data.realtime.sfu.routerRtpCapabilities`

Do not render active share/record controls until join succeeds.

## 2) Socket + SFU Bootstrap

After join success:
1. Connect socket using JWT.
2. Request/confirm router capabilities:
   - `mediasoup:getRouterCapabilities`
3. Create/Connect send and recv transports:
   - `mediasoup:createTransport`
   - `mediasoup:connectTransport`
4. Subscribe to producers:
   - `mediasoup:getProducers`
   - `mediasoup:consume`

Listen for realtime events:
- `mediasoup:newProducer` (includes `source` = `camera` or `screen`)
- `mediasoup:producerClosed`
- `screen-share:started`
- `screen-share:stopped`
- `screen-share:producer-closed`
- `recording:started`
- `recording:processing`
- `recording:stopped`
- `recording:ready`
- `recording:failed`

## 3) Start Screen Share

### REST capability/session bind check
Call first:
- `POST /meetings/:roomId/me/screen-share/start`

If success, capture screen and produce video track with:
- `mediasoup:produce`
- include `appData.source = "screen"` and optional `appData.trackId`

Why: backend binds the produced screen track to meeting room state.

### Failure handling
- `403` -> policy/tier denied
- `409` -> another participant already sharing
- `409 Meeting has ended` -> disable controls and leave room UI

## 4) Stop Screen Share

Call:
- socket event `screen-share:stop` (preferred)

or fallback REST:
- `POST /meetings/:roomId/me/screen-share/stop`

Then close local screen producer and update UI.

## 5) Room State Sync

Poll:
- `GET /meetings/:roomId/state` every 3-5s (or on app foreground)

Use:
- `data.activeScreenShare` to show current sharer
- `participants[].isScreenSharing` for badges/tiles

If realtime and polled state conflict, trust latest server timestamp/event and reconcile.

## 6) Recording Controls

Show controls only if:
- `capabilities.canRecord === true`
- user is host in your local session state

Start:
- `POST /meetings/:roomId/recording/start`

Stop:
- `POST /meetings/:roomId/recording/stop`

Status:
- `GET /meetings/:roomId/recording/status`

Statuses to support:
- `idle`
- `recording`
- `processing`
- `ready`

Artifacts:
- render from `data.artifacts[]` with file URL and metadata.

## 7) Recommended UI State Model

Persist:
- `meetingId`
- `roomId`
- `participantId`
- `capabilities.canScreenShare`
- `capabilities.canRecord`
- `screenShare.active`
- `screenShare.participantId`
- `recording.status`
- `recording.artifacts`

## 8) Error Mapping

All errors follow:
```json
{
  "success": false,
  "message": "Human-readable reason"
}
```

Map key errors:
- `Meeting has ended` -> lock controls + leave/end state
- `Another participant is already sharing screen` -> show toast, keep local share off
- `Screen share is not allowed for this meeting` -> disable share button
- `Tier restriction: recording is not available on your current plan` -> disable record button / upgrade hint

## 9) Safe Call Order (Summary)

1. `POST /me/join`
2. Socket connect + mediasoup transport setup
3. `GET /state`
4. Start share: `POST /me/screen-share/start` -> `mediasoup:produce(source=screen)`
5. Stop share: `screen-share:stop`
6. Start/stop recording as host
7. Poll `GET /recording/status` + react to recording socket events
