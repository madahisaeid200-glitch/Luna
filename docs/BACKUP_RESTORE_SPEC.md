# LUNA Browser Backup & Restore Specification

> Status: EXPORT IMPLEMENTED IN REVIEW — browser backup export is implemented on a feature branch; real-browser download and populated-data verification are still pending. Restore remains design only.

## 1. Goals

- Preserve episode records, character profiles, and generated image assets.
- Move a project snapshot between browser profiles/devices.
- Prevent accidental overwrite or partial restore.
- Make backups inspectable and versioned.
- Never export private access tokens or other secrets.

Non-goal: this is not cloud synchronization. Import/export is a manual portability and recovery mechanism.

## 2. Backup format

Suggested filename: `luna-backup-YYYY-MM-DD-HHmmss.json`

Top-level structure:

```json
{
  "format": "luna-browser-backup",
  "schemaVersion": 1,
  "app": "LUNA Studio",
  "createdAt": "ISO-8601 timestamp",
  "source": {
    "origin": "https://madahisaeid200-glitch.github.io",
    "appVersion": "if available"
  },
  "included": {
    "characterProfile": true,
    "episodes": true,
    "images": true,
    "diagnostics": false,
    "workerEndpoint": false
  },
  "data": {
    "characterProfile": {},
    "episodes": [],
    "images": []
  },
  "integrity": {
    "algorithm": "SHA-256",
    "payloadDigest": "digest of canonicalized data payload"
  }
}
```

The example is illustrative, not a final API contract. The current exporter computes the digest over `data` only, encoded as UTF-8 after canonicalization. Canonicalization recursively sorts object keys lexicographically, preserves array order, and serializes primitive values with `JSON.stringify`; nested objects and arrays are canonicalized recursively. Image metadata is first normalized through a JSON stringify/parse round trip. The resulting hexadecimal SHA-256 digest is stored in `integrity.payloadDigest`. This describes the implemented algorithm; independent recomputation from a downloaded file and cross-browser test vectors remain pending. If Web Crypto is unavailable, backup creation must fail clearly rather than silently omit integrity validation.

## 3. Export rules

- Character profile: include only the recognized fields (`lunaName`, `lunaLook`, `lunaPersonality`, `leoName`, `leoLook`, `leoPersonality`, `style`).
- Episodes: include the full array, preserving IDs, both language titles, and both story arrays. Validate shape and reject malformed entries instead of silently dropping them.
- Images: export every record from IndexedDB database `luna-image-library`, store `images`; preserve image data, metadata, creation time, and original ID as a source ID. On restore, use newly assigned database IDs if collisions are possible and maintain an explicit source-to-restored ID map.
- Diagnostics: optional, off by default. Explain that logs are bounded and incomplete.
- Worker endpoint: optional, off by default. It is configuration, not a credential.
- Token: never export `lunaAccessToken`, sessionStorage, authorization headers, cookies, or secrets.
- Include counts and byte estimates before download; warn that image payloads can make the JSON file large.

## 4. Restore flow — two-phase and non-destructive

### Phase A: inspect, validate, preview
1. User selects a backup file.
2. Parse with strict size limits and schema-version checks.
3. Verify format marker, required fields, data types, image payload types, and digest.
4. Show a preview: episode count, profile presence, image count, approximate size, source timestamp.
5. Show conflicts: duplicate episode IDs, current records that would be replaced, image ID collisions.
6. Offer only explicit modes: **Merge safely** or **Replace after backup**. Never auto-replace.

### Phase B: commit safely
1. Create a complete pre-restore snapshot of the current profile, episodes, and IndexedDB images.
2. Verify the snapshot can be read back before changing live data.
3. Write imported data in a controlled transaction. Use a single IndexedDB transaction for image-store changes.
4. Validate resulting records and image readability.
5. If any step fails, restore the pre-restore snapshot or leave original data untouched. Never report success after a partial write.
6. Display final counts and a clear result; retain the pre-restore snapshot until the user explicitly removes it.

## 5. Conflict policy

- Profile: never merge fields silently. Present current vs imported profile and ask user to choose.
- Episodes: preserve records with distinct stable IDs. If IDs collide, do not overwrite; generate new IDs only after recording the mapping and showing the conflict.
- Images: preserve imported image records as new records by default; do not overwrite existing image IDs.
- Replace mode: requires a separate explicit confirmation and a verified pre-restore backup.
- Unknown schema versions: reject safely and explain that a compatible importer is required.

## 6. Data validation and limits

- Validate strings and array shapes before writing.
- Reject unexpected object fields where they could carry secrets or executable content.
- Do not execute imported content; render text as text.
- Define maximum file size, per-image size, total image count, and total payload limits based on mobile-browser testing.
- Handle quota errors, private browsing restrictions, unavailable IndexedDB, malformed JSON, digest mismatch, and interrupted transactions.
- If browser storage quota is insufficient, abort before replacing any current data.

## 7. Security and privacy

- Never include sessionStorage or access tokens.
- Never include authorization headers, cookies, or Worker secrets.
- Treat backups as sensitive user data because they may contain private drafts and generated images.
- Avoid sending backup contents to a server; local export/import should remain client-side.
- Explain that anyone holding the backup file may read its contents unless a separately designed encryption feature is implemented.

## 8. Acceptance test matrix

| Test | Expected result |
|---|---|
| Export empty project | Valid backup with zero counts |
| Export populated project | All profile fields, episodes, and images included |
| Export with no IndexedDB support | Clear error; no misleading partial backup |
| Tampered JSON / digest mismatch | Reject before modifying live data |
| Unsupported schema version | Reject before modifying live data |
| Restore into empty browser | All records restored and readable |
| Restore with duplicate episode IDs | Conflict preview; no silent overwrite |
| Restore with existing images | Imported images receive safe new IDs |
| Simulated quota failure | Existing data remains intact |
| Interrupted restore | Roll back or retain original state |
| Verify token exclusion | No token or authorization data in backup |
| Cross-device test | Export on A, restore on clean B, compare counts and image readability |

## 9. Rollout sequence

1. Implement export only. **Code now exists on `feat/producer-full-backup-export`; it is not merged or runtime-verified.**
2. Test export with real project data and inspect the JSON structure.
3. Implement backup validation and preview without writing.
4. Implement restore to an empty browser.
5. Add conflict handling and pre-restore snapshots.
6. Test failure cases and mobile storage limits.
7. Only then enable Replace mode.
8. Update user documentation and mark LUNA-001 partially or fully resolved only against the defined acceptance tests.

## 10. Export implementation notes — 2026-11-25

- Producer adds a dedicated full-backup download action.
- Export reads the saved profile and complete episode array from localStorage, plus every image record from IndexedDB. If `lunaEpisodes` has never been stored, it includes the same three bundled seed episodes currently shown by the dashboard and marks the source as `bundled-seed`.
- Export validates the recognized profile fields, episode fields, and image payload structure; it stops rather than silently dropping malformed records or unknown episode fields.
- SHA-256 is calculated over a canonical payload whose object keys are recursively sorted (`recursive-sorted-object-keys-v1`). The digest is included in the JSON.
- The JSON records schema version, source origin/build, included flags, episode/image counts, and digest metadata.
- Diagnostics and Worker endpoint are excluded by default; session token is never read or exported.
- Large files above 30 MiB trigger a confirmation before download. This is a caution, not a tested mobile memory limit.
- **Not yet verified:** real populated-browser export, image-heavy memory behavior, actual digest recomputation from downloaded file, token absence in downloaded artifact, or cross-device restore.

## 11. Definition of done

The feature is not complete until backup and restore pass the entire acceptance matrix on at least two separate browser profiles/devices, including an image-heavy project and a forced failure case. Successful download alone is not proof of recoverability.


### Empty image-library behavior clarification — 2026-11-25

- Acceptance test requires an empty project export to succeed with zero image records. A never-created IndexedDB database is now treated as an empty image library: the implicit database creation is aborted and the exporter returns an empty array without persisting a database.
- An existing database with a missing `images` store, blocked open, read error, malformed record, or aborted read transaction still fails closed.
- Static source patch only; browser verification of absent-database behavior remains required.
