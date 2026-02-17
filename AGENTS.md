# Project Agent Notes

## Current Build Mode
- Frontend simulation first.
- Do not integrate backend APIs or Socket.io yet.
- Create important screens as placeholders first, then build each screen incrementally.
- Meetings screen is now a fully simulated local flow using `src/data/mockMeetings.tsx`.
- Chat screen is now a fully simulated local DM flow using `src/data/mockChat.ts`.
- Profile screen is now a fully simulated local profile/settings flow using `src/data/mockProfile.ts`.
- Billing screen is now a fully simulated local subscription flow using `src/data/mockBilling.ts`.
- Auth login now uses reusable Formik + Yup form primitives in `src/components/forms/*`.
- Call room is now a full simulated Zoom-like flow using `src/data/mockCall.ts` with pre-join, adaptive grid, controls, participants panel, and meeting chat.

## UI Direction
- Prioritize accessibility in color contrast and typography.
- Use a distinct visual identity (layered backgrounds, strong card surfaces, branded tab bar).
- Avoid default-looking navigation headers; prefer custom or hidden headers in this phase.
- Keep placeholder screens visually polished even before feature logic is implemented.
- For keyboard handling on form/chat screens, use `KeyboardAvoidingView` with `behavior="padding"`; avoid `height` behavior on Android.

## Routing Foundation
- Use Expo Router route groups for `/(auth)` and `/(app)`.
- Keep business logic prepared for later backend integration.
