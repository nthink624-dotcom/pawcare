# Backup artifact boundary guard

The encrypted restore reader now rejects payloads shorter than 72 bytes or with a ciphertext length not divisible by 16, before reading a portable or DPAPI recovery key. PMDUMP02 has a 56-byte header and CBC/PKCS7 requires at least one 16-byte ciphertext block.

Verified: static backup recovery contract passed; PowerShell AST parsing passed; nine length-boundary cases passed (0, 55, 56, 57, 71, 72, 73, 87, 88 bytes). This is not artifact authentication, a full restore drill, or proof of an uploaded backup.

No key was opened, changed or moved. No production dump, Drive transfer, recurring job or remote write was performed. Those operational steps remain incomplete, including verified 24-hour freshness and 60-day Drive retention.

## Runtime preflight

Extended and executed the production-target no-network preflight using generated temporary fixture keys only. PMDUMP02 file roundtrip and portable-key roundtrip passed. A modified ciphertext was rejected by HMAC authentication; a truncated payload was rejected before attempting to read an intentionally nonexistent key path. Output reported RemoteWrites=0 and NetworkAccess=none. Existing E: recovery key and production password were not read. Temporary preflight archive/key files were removed by the fixture finally block; subsequent filename inventory found none remaining. Static backup contract passed after these changes.
