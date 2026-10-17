# App Store Connect metadata (pointer)

Store listing copy, ASC field checklist, Privacy Nutrition Labels, privacy policy draft, and App Review notes live under:

**[`docs/asc/`](../../docs/asc/README.md)** (Epic #150 · Issues #151–#153, #157–#159).

Runtime identity for ASC must match this app config:

| Field | Value (`app.config.ts`) |
| --- | --- |
| Display name | `Vemoki` |
| Bundle ID | `com.hangndat.ticket` |
| Apple Team | `BLUA62D52G` |
| Version / build | `version` + `ios.buildNumber` |
| Encryption export | `ITSAppUsesNonExemptEncryption: false` |
| Camera usage | “Scan ticket QR codes at the gate.” |

**Do not** submit to the App Store from this pointer file. No EAS Cloud Build.
