# Service care reminders — 2026-10-23

## Scope

- Dynamic service cards open before/during/after care, without altering catalog data or prices.
- Booking selection opens the before-care reminder immediately, including price-list preselection.
- The selected guide remains below the selection, appears again at confirmation and successful submission.
- Customer booking email states `pending_confirmation`, `pending_payment`, and `confirmed` include before-care. Cancellation and shop templates are unchanged. Existing sent-status deduplication is unchanged: past emails are not resent.
- `assets/service-care-content.js` and `apps-script/ServiceCare.gs` must be identical. Change both and run `node tests/service-care.cjs`.
- Frontend uses service category/item/group. Email derives category/item from the existing `serviceName` and addons from the existing `[加購項目]` note. No new Firestore fields, writes, permissions, or schema migrations.

## Content

Source: four owner-supplied reference images (face care, care intervals, waxing, breast care). Medical mechanisms, universal "normal reaction" assertions and guaranteed outcomes are not reproduced as medical facts. During-care uses the site's existing explain/stop-on-discomfort policy. No individualized medical assessment is performed.

- Female/male waxing share waxing care.
- Facial care uses face care; facial massage additionally includes massage reminders.
- Breast care uses breast care only.
- Body/back/buttocks or unrecognized services have an explicit contact-store reminder, not unrelated facial instructions. A dedicated guide should be added when the owner provides one.
- Future custom catalog categories are not automatically assigned potentially incorrect treatment instructions.

## Apps Script deployment

Update the existing `77waxing Email` project as the store account. Add `ServiceCare.gs` and modify only the three booking email templates and the `bookingCareBefore_` helper in the existing code. Preserve production LINE OAuth GET routing, identity POST routing, customer upload routing, shop behavior and deployment settings.

Deployment 35: description `服務須知：預約需求、定金與確認通知加入施作前提醒`.
The original web-app URL, execution identity, access and OAuth scopes are unchanged. No authorization change is necessary.
The repository's shop URL and the pre-existing deployed shop URL differ; this release deliberately does not replace the deployed value. Only the booking templates/helper and script version were changed in the live Code file; other source files were not replaced.

## Validation

- `node tests/service-care.cjs`: category/item mapping, fallback and addons, three customer email states, safe HTML, cancellation unchanged. Uses VM stubs and sends no email.
- `tests/service-care-browser.cjs`: desktop/mobile, service cards, modal close/Escape/focus, immediate selection, price-hash preselection, clearing category, confirmation and successful mocked booking. Does not write real bookings or accept a real customer's consent.
- Existing Production static check workflow run blocks executed locally; all passed.
- No existing booking/member/customer data was modified for this release.
