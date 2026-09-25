# Media API Smoke Test

Use this guide after the media migrations are applied to the target Supabase project.

The goal is to verify the flow without connecting the owner UI yet.

## Requirements

You need:

- a running local or deployed PetManager app
- an owner access token for the target shop
- a real `shopId`
- one small compressed image file, preferably WebP or JPEG

Before starting this smoke test, run the read-only schema verification SQL:

```text
supabase/verification/media_schema_readiness.sql
```

Every row should return `exists = true`.

Do not run this against production with real customer media until the owner approves the target project and shop.

## 1. Check Variant Policy

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://127.0.0.1:3000/api/owner/media/variants/policy?shopId=<shop_id>"
```

Expected:

- `thumbnail`
- `preview`
- `optimized`
- `provider_ready`
- max byte targets

## 2. Check Usage

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://127.0.0.1:3000/api/owner/media/usage?shopId=<shop_id>"
```

Expected:

- current month usage
- soft limit
- target image bytes
- retention days
- owner-facing notice copy

## 3. Create Upload Intent

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "originalFileName": "test.webp",
    "contentType": "image/webp",
    "byteSize": 200000,
    "sourceByteSize": 9000000,
    "width": 1280,
    "height": 960,
    "mediaKind": "message_image",
    "visibility": "customer_shared",
    "retentionPolicy": "transient",
    "uploadedFrom": "owner_web"
  }' \
  "http://127.0.0.1:3000/api/owner/media/upload-intents"
```

Expected:

- `mediaAsset`
- `upload.bucket`
- `upload.path`
- signed upload URL or token
- `limits`
- `usage`

## 4. Upload Directly To Supabase Storage

Use the returned Supabase signed upload instruction.

Important:

- the image file should already be compressed before this step
- do not upload through a PetManager API route
- do not upload raw 8-10 MB phone originals for the default plan

## 5. Complete Upload

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "mediaAssetId": "<media_asset_id>",
    "byteSize": 200000,
    "width": 1280,
    "height": 960
  }' \
  "http://127.0.0.1:3000/api/owner/media/complete"
```

Expected:

- `mediaAsset.status = ready`

## 6. Create Provider-Ready Variant

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "mediaAssetId": "<media_asset_id>",
    "variantKey": "provider_ready",
    "contentType": "image/webp",
    "byteSize": 180000,
    "width": 1280,
    "height": 960
  }' \
  "http://127.0.0.1:3000/api/owner/media/variants/upload-intents"
```

Upload the variant directly to Supabase Storage, then finalize:

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "mediaAssetId": "<media_asset_id>",
    "variantKey": "provider_ready",
    "contentType": "image/webp",
    "byteSize": 180000,
    "width": 1280,
    "height": 960
  }' \
  "http://127.0.0.1:3000/api/owner/media/variants/complete"
```

Expected:

- `variant.variant_key = provider_ready`

## 7. List Media Assets

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://127.0.0.1:3000/api/owner/media/assets?shopId=<shop_id>&limit=10"
```

Expected:

- one ready media asset
- variants included by default

## 8. Attach To Notification

This requires an existing notification row.

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "notificationId": "<notification_id>",
    "channel": "alimtalk",
    "media": [
      {
        "mediaAssetId": "<media_asset_id>",
        "attachmentRole": "result_photo",
        "sortOrder": 0
      }
    ]
  }' \
  "http://127.0.0.1:3000/api/owner/media/notification-attachments"
```

Expected:

- `notification_media_attachments` row
- `send_status = queued`

## 9. Resolve Delivery Payload

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://127.0.0.1:3000/api/owner/media/notification-delivery-payload?shopId=<shop_id>&notificationId=<notification_id>"
```

Expected:

- `providerPayload.mediaAttachments`
- short-lived signed URL
- `variantKey = provider_ready` when variant exists

## 10. Record Delivery Result

```bash
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "<shop_id>",
    "notificationId": "<notification_id>",
    "status": "sent",
    "channel": "alimtalk",
    "provider": "ssodaa-relay",
    "providerMessageId": "<provider_message_id>",
    "recipientPhone": "01000000000",
    "providerMedia": [
      {
        "notificationMediaAttachmentId": "<notification_media_attachment_id>",
        "providerMediaId": "<provider_media_id>"
      }
    ]
  }' \
  "http://127.0.0.1:3000/api/owner/media/notification-delivery-results"
```

Expected:

- attachment `send_status = sent`
- `media_send_attempts` row
- monthly sent usage incremented

## 11. Recent Sent Media

```bash
curl -H "Authorization: Bearer <access_token>" \
  "http://127.0.0.1:3000/api/owner/media/recent-sent?shopId=<shop_id>&limit=10"
```

Expected:

- recently sent image reference
- media asset
- variants

## 12. Cleanup Dry Run

```bash
curl -H "Authorization: Bearer <cleanup_secret>" \
  "http://127.0.0.1:3000/api/media/cleanup-expired?dryRun=true&limit=50"
```

Expected:

- expired transient media list
- no deletion when dry-run

## Pass Criteria

The smoke test passes when:

- `/api/bootstrap` does not change or include media lists
- upload intent creates one asset
- complete marks it ready
- provider-ready variant can be recorded
- media can be listed by dedicated API
- notification attachment can be queued
- delivery payload returns a short-lived URL
- delivery result writes attachment status and send attempt
- recent sent media returns the successful attempt
- cleanup can run dry-run safely

## Development Run Log

### 2026-05-19

Target:

- Supabase project: `petmanager-dev` (`qefxdtmdtvnzgupmjlom`)
- Shop: `shop-4d57f170`
- Local app: `http://127.0.0.1:3000`

Result:

- Variant policy: passed
- Usage lookup: passed
- Upload intent: passed
- Direct Supabase Storage upload: passed
- Complete upload: passed
- Provider-ready variant upload and complete: passed
- Signed URL: passed
- Media asset listing: passed
- Notification media attachment: passed
- Delivery payload resolution: passed
- Delivery result recording: passed
- Recent sent media lookup: passed
- Cleanup dry-run: passed

Artifacts created in development:

- Media asset: `466e03b6-fafb-4150-83ba-0e889ce6ab91`
- Notification: `11b78a03-2fec-42aa-85e1-0dfbdc282606`

Notes:

- `/api/dev/create-owner` was not usable during this run because the development `shops` table was missing `booking_slot_interval_minutes`.
- Follow-up SQL was prepared at `supabase/generated/dev_202604290001_shop_booking_slot_settings_apply.sql`.
- Production Supabase was not touched.
