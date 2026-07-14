# Mobile Owner/Staff Push Notification Contract

This document belongs to the mobile web/app project only. The PC/admin/backend project should use this contract when it later sends real push messages.

## Runtime

- Mobile app: Expo Notifications.
- Token provider saved by the app: `expo`.
- Android delivery path: Expo push service over FCM.
- iOS delivery path: Expo push service over APNs.
- Customer Alimtalk is separate and must not be called for owner/staff push.

## Device Token Registration

The app registers the current device after a real owner session and real owner data are loaded.

Endpoint:

```http
POST /api/owner/push-tokens
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

Body:

```json
{
  "shopId": "shop-id",
  "staffMemberId": null,
  "provider": "expo",
  "platform": "android",
  "pushToken": "ExponentPushToken[...]",
  "deviceId": "device-id",
  "deviceName": "Samsung SM-S916N",
  "appId": "kr.petmanager.owner",
  "appVersion": "0.1.0",
  "locale": "ko-KR",
  "timezone": "Asia/Seoul",
  "metadata": {
    "ownerId": "owner-id"
  }
}
```

Logout deactivates the stored token:

```http
DELETE /api/owner/push-tokens
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

Body:

```json
{
  "shopId": "shop-id",
  "pushToken": "ExponentPushToken[...]"
}
```

## Push Payload

For a new customer booking request, send this shape as notification data:

```json
{
  "kind": "owner_booking_requested",
  "notificationId": "notification-id",
  "shopId": "shop-id",
  "appointmentId": "appointment-id",
  "guardianId": "guardian-id",
  "petId": "pet-id",
  "serviceId": "service-id",
  "staffId": "staff-id-or-null",
  "title": "새 예약 요청이 들어왔어요",
  "body": "우유 · 정우진 보호자 / 6월 30일 14:00 · 전체미용",
  "route": {
    "tab": "Reservations",
    "screen": "ReservationDetail",
    "params": {
      "reservationId": "appointment-id"
    }
  }
}
```

When the app receives this payload:

- Foreground: shows a top toast and increments the Reservations tab badge.
- Tap/open: navigates to `Reservations > ReservationDetail`.
- If `appointmentId` is missing, it falls back to the reservation list.

## Required Env

Mobile app build/runtime:

```env
EXPO_PUBLIC_OWNER_AUTH_PROVIDER=real
EXPO_PUBLIC_OWNER_DATA_PROVIDER=real
EXPO_PUBLIC_OWNER_API_BASE_URL=https://mobile-domain.example
EXPO_PUBLIC_EAS_PROJECT_ID=<eas-project-uuid>
```

Push sender side, to be configured in the backend project when real sending is implemented:

```env
EXPO_ACCESS_TOKEN=<expo-access-token-for-server-push-send>
```

## Database

Apply this migration before production token registration:

```text
supabase/migrations/202606300001_owner_push_tokens.sql
```
