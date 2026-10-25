# Drive backup automation connection gate

## Current verified state

- Approved folder ID: `1jrDncb5E5Ukhj_HCo9HiWXYb4LeAyrnO`.
- Live folder listing on 2026-10-05 still contains only `petmanager-prod-20261001.pmdump`, 1,072,024 bytes, modified 2026-10-01T03:32:42.652Z. This listing establishes metadata only, not internal recovery-point time or archive authentication.
- The file is reported as not shared. This does not establish all folder/ancestor access rules.
- Connected Drive supports an interactive upload action. It does not supply an unattended Windows credential to a scheduled job.
- No running GoogleDriveFS process or available rclone/gdrive executable was found in the current host check. This does not prove no separately hosted backup service exists.

## Required representative decision

An unattended transfer needs a separately authorized connection. Choose either Google Drive for desktop with a dedicated encrypted-backup output folder, or a dedicated Drive API OAuth connection for a scheduled uploader. Do not extract browser or connector tokens to make an unattended job.

Installing a sync client, granting OAuth access, registering a scheduled task and remote retention changes need explicit approval. The sync scope must contain only encrypted .pmdump files and non-secret integrity metadata, never raw dumps, DPAPI secrets or E: recovery keys. A 60-day retention rule must be scoped to backup artifacts and preserve a verified newest recovery point; it must not remove unrelated Drive files.

## Acceptance after connection

1. Generate a fresh production read-only encrypted backup without replacing the existing E: recovery key.
2. Verify local artifact authentication and isolated restore.
3. Upload into the approved folder and read back file identity, size and integrity evidence.
4. Run the next scheduled cycle and prove it succeeds unattended.
5. Verify 24-hour recoverable-point freshness and approved 60-day retention behavior.

No installation, upload, permission change, task registration or file deletion was performed by this connection review.
