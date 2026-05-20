# Media Cost And Relay Guide

PetManager image features must be designed as a paid operational resource, not as unlimited raw photo storage.

This guide defines how images, Supabase, Vercel, and the Ssodaa/Alimtalk relay server should be separated.

## Core Principle

Images should not flow through every server.

- Supabase Storage stores image files.
- Supabase Postgres stores image metadata and send history.
- Vercel verifies permissions and creates short-lived upload/download instructions.
- The relay server sends Ssodaa/Alimtalk messages.

Vercel and the relay server must not become image storage or image CDN layers.

## Cost Problem

Phone camera photos are often 8-10 MB each.

A single grooming update can contain before/after photos:

- raw before photo: about 10 MB
- raw after photo: about 10 MB
- total per job: about 20 MB

If a shop handles 400 photo jobs per month, raw storage can reach about 8 GB per shop per month. That is not acceptable for a base SaaS plan.

The target should be:

- normal shop: 50-150 MB per month
- heavy photo shop: 200-300 MB per month before upgrade
- raw/original long-term storage: paid option only

## Image Storage Policy

Default policy:

- Do not store original phone camera files by default.
- Compress images before upload.
- Store only optimized images needed for product features.
- Keep customer-send temporary images for a limited period.
- Do not duplicate files for "recent sent images".

Recommended variants:

- thumbnail: list/grid display
- preview: owner/customer detail display
- provider_ready: customer message send
- original: optional, short-lived, or paid archive only

Recommended target sizes:

- one customer-send image: about 250 KB when quality is acceptable
- before/after pair: about 500 KB total
- preview image: 300-600 KB
- thumbnail: under 100-200 KB

## Retention Policy

Use `media_assets.retention_policy` to control cost.

- `transient`: temporary send image, delete after 30-90 days
- launch default: temporary send image, delete after 30 days
- `standard`: owner intentionally saved image in grooming/customer record
- `archive`: paid long-term storage or original-retention feature

Recommended defaults:

- customer-send temporary images: 30-90 days
- grooming record selected images: retained while the record exists
- original uploads: not stored, or deleted after variants are ready
- archived originals: paid plan only

## Recent Sent Images

Recent sent images must be references, not copied files.

Correct model:

- one file in Supabase Storage
- one `media_assets` row
- one or more `notification_media_attachments` rows
- one or more `media_send_attempts` rows

Incorrect model:

- copying the same image each time it is sent
- storing image URLs inside notification JSON as the source of truth
- saving full image blobs in the database

## Vercel Boundary

Use Vercel for:

- owner authentication and shop authorization
- creating `media_assets` rows
- issuing short-lived Supabase Storage upload instructions
- creating notification/media attachment records
- returning short-lived signed URLs for authorized reads

Do not use Vercel for:

- streaming image uploads through Next.js API routes
- serving images as a proxy/CDN
- long-running image compression jobs
- storing binary image data in memory, logs, or database JSON

Preferred flow:

1. Client compresses the image.
2. Vercel verifies the owner and creates metadata.
3. Client uploads directly to Supabase Storage.
4. Vercel finalizes metadata and send attachments.

Current structural endpoints:

- `POST /api/owner/media/upload-intents`
- `POST /api/owner/media/complete`
- `GET /api/owner/media/signed-url`
- `GET /api/owner/media/assets`
- `GET /api/owner/media/recent-sent`
- `GET /api/owner/media/usage`
- `POST /api/owner/media/notification-attachments`
- `GET /api/owner/media/notification-delivery-payload`
- `POST /api/owner/media/notification-delivery-results`
- `POST /api/owner/media/variants/upload-intents`
- `POST /api/owner/media/variants/complete`
- `GET /api/owner/media/variants/policy`
- `GET /api/media/cleanup-expired`
- `POST /api/media/cleanup-expired`

Current client compression helper:

- `src/lib/media/client-image-compression.ts`

Current shared media policy constants:

- `src/lib/media/media-policy.ts`

## Supabase Boundary

Use Supabase Storage for:

- optimized image files
- thumbnails
- previews
- provider-ready message images
- optional archived originals

Use Supabase Postgres for:

- media metadata
- customer/pet/appointment/grooming record links
- send history
- retention status
- deletion markers

Do not include image lists in `/api/bootstrap`.

Media must be loaded through dedicated APIs:

- appointment media
- grooming record media
- customer/pet media
- recent sent media

## Relay Server Boundary

The current relay server is for Ssodaa/Alimtalk, not media storage.

Use the relay server for:

- hiding Ssodaa provider credentials
- normalizing Alimtalk payloads
- managing provider template mapping
- testing provider connectivity
- sending approved Alimtalk messages

Do not use the relay server for:

- storing image files
- proxying image downloads
- resizing or compressing images
- serving recent sent images
- acting as a CDN

If a future Alimtalk/SMS provider requires uploaded media, PetManager should pass a provider-ready image URL or provider upload reference into the message flow. The canonical image still remains in Supabase Storage.

Current adapter shape:

- `src/server/media-delivery-service.ts` resolves attached media into provider-ready signed URLs.
- `src/server/alimtalk-provider.ts` accepts optional `mediaAttachments` without changing text-only sends.
- The relay must map `mediaAttachments` to the exact Ssodaa image-message format before real image delivery is enabled.
- Signed Supabase URLs are short-lived and should be treated as delivery instructions, not permanent stored URLs.

## Plan And Pricing Implication

Photo features should be plan-limited.

Possible policy:

- Basic: compressed send images, limited retention, monthly storage cap
- Standard: higher monthly storage cap, customer history images
- Pro: long-term archive, original retention, larger image volume

Recommended limits can be adjusted later, but the architecture must support:

- per-shop storage tracking
- monthly media usage tracking
- retention cleanup
- paid archive/original retention
- clear owner-facing warnings before quota limits

Current implementation:

- default monthly soft limit: 150 MB
- default hard limit: none
- default enforcement mode: warn
- per-shop override table: `shop_media_limits`

## Implementation Checklist

Before implementing photo upload:

- client-side compression exists
- upload does not stream through Vercel
- `media_assets` is created before upload
- Supabase Storage path does not include customer names, phone numbers, pet names, or memo text
- variants are tracked in `media_variants`
- customer message attachments use `notification_media_attachments`
- send attempts use `media_send_attempts`
- recent sent images query references existing media
- raw originals are disabled by default
- retention cleanup plan exists
