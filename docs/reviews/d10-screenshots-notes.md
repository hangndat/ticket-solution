# D10 S2 — Screenshots capture notes

**Story / tasks:** [#154](https://github.com/hangndat/ticket-solution/issues/154), [#155](https://github.com/hangndat/ticket-solution/issues/155), [#156](https://github.com/hangndat/ticket-solution/issues/156)  
**Branch:** `hangndat/d10-screenshots`  
**Checklist:** [`docs/ops/D10-SCREENSHOTS-CHECKLIST.md`](../ops/D10-SCREENSHOTS-CHECKLIST.md)  
**Captured:** 2026-10-17  
**Method:** `xcrun simctl io … screenshot` + AXe HID taps — **no EAS Cloud**, no cliclick / Computer Use.

## Devices

| Simulator | UDID | Native pixels | ASC slot |
| --- | --- | --- | --- |
| iPhone 17 Pro Max | `4ADE0D85-4146-495A-9B26-2A4D0B85F388` | 1320×2868 | iPhone 6.9" |
| iPad Pro 13-inch (M5) | `95B2A507-8FDF-4F69-992A-A66C780DDBEB` | 2064×2752 | iPad 13" |

## Local evidence (gitignored)

```text
apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/01-events.png
apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/02-my-tickets.png
apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/03-redeem.png
apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/04-event-detail.png
apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/05-staff.png
apps/mobile/.uat-artifacts/d10-asc/ipad-13/01-events.png
apps/mobile/.uat-artifacts/d10-asc/manifest.json
```

Verify on capture host:

```bash
sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/0*.png
test -f apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/01-events.png && echo OK
```

## Preview (T2)

**N/A** — App Preview video không bắt buộc cho prep screenshot; storyboard tối thiểu = dãy 5 PNG iPhone 6.9". Lý do đầy đủ trong checklist § T2.

## Limits

- Signed-out session trên sim; demo event labels.
- iPad secondary screens: a11y duplicate labels — retake bằng tọa độ trước khi upload ASC.
- Không store submission trong S2.
