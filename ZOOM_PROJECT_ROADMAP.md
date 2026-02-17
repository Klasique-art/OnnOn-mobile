# OnnOn Zoom-Like App Build Roadmap

## 1) What Exists Today (Verified)

I reviewed `D:\onnon-backend` and confirmed the backend already includes:

- Auth APIs with JWT (`/api/users/*`) and profile bootstrap.
- Profile APIs (`/api/profile/*`) including avatar upload.
- Meeting lifecycle APIs (`/api/meetings/*`) with room password, host permissions, participant limits by plan, and meeting duration logic.
- Chat REST APIs (`/api/chat/*`) for DM history, unread count, and recent conversations.
- Socket.io events for room chat, DMs, typing, file uploads, and mediasoup signaling.
- Stripe plan/subscription/payment APIs (`/api/payments/*`) and webhook handling.
- mediasoup SFU setup with RTP transport events and UDP/TCP ports `10000-10100`.

Backend build status:
- `npm run build` succeeds on the backend.

## 2) Important Backend Notes Before Frontend Work

These are key integration realities from code inspection:

- API response shape is mixed:
  - Some routes use `{ success, data }`.
  - Some chat routes return raw objects like `{ messages, totalPages, currentPage }`.
- Chat socket DMs/files are emitted with `io.to(toUserId)`, but sockets are not explicitly joined to a personal room in `src/socket/index.ts`.
  - Action: backend should add `socket.join(socket.userId)` on connection for reliable DM/file delivery.
- CORS origin uses `APP_URL`; set this correctly for Expo dev/prod hosts.
- For device testing, frontend base URL must use LAN IP (not `localhost`).
- Stripe, SMTP, Cloudinary, and mediasoup announced IP must be configured for full feature parity.

## 3) Product Scope We Should Build

MVP (Zoom-like):

- Authentication + onboarding
- Profile setup
- Create/join/leave/end meetings
- In-room realtime text chat + typing
- 1:1 direct messages + unread/read states
- File sharing in room/DM
- Audio/video call tiles with mute/camera controls (mediasoup)
- Subscription/paywall flow

## 4) Frontend Architecture (Expo)

Create this structure in this repo:

```txt
src/
  api/
    client.ts
    auth.api.ts
    profile.api.ts
    meetings.api.ts
    chat.api.ts
    payments.api.ts
  realtime/
    socket.ts
    chat.socket.ts
    files.socket.ts
    mediasoup.socket.ts
  features/
    auth/
    profile/
    meetings/
    chat/
    call/
    billing/
  store/
    auth.store.ts
    profile.store.ts
    meetings.store.ts
    chat.store.ts
    call.store.ts
  utils/
    api-normalizers.ts
    errors.ts
    links.ts
    permissions.ts
```

Use Expo Router screens under `app/` and keep business logic in `src/`.

## 5) Delivery Plan (Practical Sequence)

### Phase 0: Foundation (1-2 days)

- Configure env handling (`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL`).
- Build Axios client with auth token interceptor.
- Add API response/error normalizers.
- Add secure token persistence (AsyncStorage is acceptable for MVP; secure storage later).
- Define shared TypeScript types for backend contracts.

Exit criteria:
- App can restore token on launch and call `/api/users/me`.

### Phase 1: Auth + Profile (2-3 days)

- Screens: register, login, verify email OTP, forgot/reset password.
- Auth guard and route protection.
- Profile view/edit and avatar upload/remove.

Exit criteria:
- New user can register -> verify -> login -> edit profile.

### Phase 2: Meetings (2-3 days)

- Screens: Create Meeting, Join Meeting, Meeting Details, History.
- Handle password-protected room join and full-room errors.
- Leave/end meeting actions based on host role.

Exit criteria:
- Two accounts can join same room and lifecycle actions work.

### Phase 3: Realtime Chat + DM (3-4 days)

- Socket connection with JWT handshake.
- Room chat events and typing indicators.
- DM list + DM thread + read receipts + unread badge.

Exit criteria:
- Realtime messaging works across two devices/emulators.

### Phase 4: File Sharing (1-2 days)

- Pick file/image and send via socket `file:upload`.
- Render file messages in room and DM timelines.
- Handle >10MB rejection UX.

Exit criteria:
- Users can send and open shared files from chat.

### Phase 5: Audio/Video Calls (4-6 days)

- Integrate `react-native-webrtc`, `mediasoup-client`, socket signaling.
- Implement send/recv transports, produce/consume tracks.
- UI: participant tiles, mic/cam toggles, leave call.
- Handle producer pause/resume/close and reconnect behavior.

Exit criteria:
- Stable 2-device audio/video call in same meeting room.

### Phase 6: Billing (2-3 days)

- Plans list, current subscription, checkout launch, cancel/upgrade.
- Deep-link return handling for success/cancel.
- Refresh subscription state after checkout.

Exit criteria:
- User can subscribe and app reflects plan changes.

## 6) First Week Implementation Checklist (Start Here)

1. Create `src/api/client.ts` with bearer-token interceptor and timeout.
2. Create `src/utils/api-normalizers.ts` for mixed backend response shapes.
3. Create `src/store/auth.store.ts` for token + user bootstrap (`/api/users/me`).
4. Build `app/(auth)/login.tsx` and `app/(auth)/register.tsx`.
5. Build `app/(auth)/verify-email.tsx` for OTP flow.
6. Add guarded route group `app/(app)/` for authenticated screens.
7. Implement `src/api/profile.api.ts` and basic profile screen.
8. Implement meeting create/join APIs and simple screens.
9. Add socket bootstrap (`src/realtime/socket.ts`) but connect only after auth.
10. Validate two-account flow on emulator + physical device.

## 7) Technical Risks and Mitigations

- DM reliability risk (personal room join not explicit in backend).
  - Mitigation: backend patch `socket.join(socket.userId)` on connect.
- mediasoup on mobile is the hardest integration area.
  - Mitigation: implement call module only after meetings + socket chat are stable.
- Environment drift between backend/frontend URLs.
  - Mitigation: single env source and startup log banner showing active URLs.
- Mixed API payloads can cause UI bugs.
  - Mitigation: normalize in one layer; never parse raw responses in screens.

## 8) Definition of MVP Done

MVP is done when all are true:

- User authentication lifecycle works end-to-end.
- Meeting create/join/leave/end works with backend rules.
- Realtime room chat and DM work between two real clients.
- File sharing works with validation and user feedback.
- Audio/video call works for at least two clients.
- Subscription screens and checkout return flow are functional.

## 9) Recommended Immediate Next Action

Start with Phase 0 and Phase 1 only. Do not begin mediasoup yet.

The fastest path is:
- Build auth + profile foundations first,
- then meeting REST,
- then socket chat,
- and only then call media.
