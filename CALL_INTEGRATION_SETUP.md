# Call Integration Setup (Dev Build)

## What is now wired
- `react-native-webrtc` + mediasoup signaling client stack installed.
- Socket manager and room signaling helpers are added in:
  - `src/realtime/socket.ts`
  - `src/realtime/room.socket.ts`
  - `src/realtime/mediasoup.socket.ts`
- Local media stream helper added in:
  - `src/calls/webrtc.ts`
- Runtime env config added in:
  - `src/config/runtime.ts`
- Call room now supports:
  - pure simulation mode
  - optional real backend signaling mode (JWT + socket URL)

## Env configuration
Create `.env` from `.env.example` and set:
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SOCKET_URL`

Use LAN IP for real devices (not localhost), e.g.:
- `http://192.168.x.x:3000`

## Required build type
`react-native-webrtc` requires a development build (or production build).
Expo Go is not enough for full native WebRTC usage.

## Build commands
1. Install EAS CLI (if needed):
```bash
npm install -g eas-cli
```

2. Login and configure:
```bash
eas login
eas build:configure
```

3. Build dev client:
```bash
eas build --profile development --platform android
```
or
```bash
eas build --profile development --platform ios
```

4. Start metro for dev client:
```bash
npx expo start --dev-client
```

## In-app usage
Open `Call Room`:
- Leave realtime toggle off for pure simulation.
- Enable realtime toggle and paste a valid backend JWT to test actual socket/mediasoup capability handshake.
