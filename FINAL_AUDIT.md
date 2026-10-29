# Final application audit

Audit date: 2026-10-29. This checklist records the current source and the checks run for this pass.

## Prioritized checklist

| Priority | Area | Result |
|---|---|---|
| P0 | Preserve the existing architecture and MySQL data | React/Vite, Express, JWT, bcrypt, Nodemailer, and MySQL remain in use. Three additive migrations are applied to the local development database. No tables or existing accounts were deleted. |
| P0 | Authentication and session expiry | Login uses normalized email, JWT role/verification claims, and `auth_version`. Protected requests check the stored auth version; password resets increment it. The client clears expired or invalid bearer sessions and redirects protected pages to sign-in. |
| P0 | Account recovery | Added generic forgot-password responses, hashed single-use 30-minute reset tokens, rate limiting, backend password-strength enforcement, reset UI, and session invalidation. SMTP delivery was not verified. |
| P0 | Booking safety | Booking checks verified patient identity, contact number, valid UTC date/time, configured doctor availability, and the locked doctor row in a transaction. The existing unique active-slot constraint remains the final duplicate guard. |
| P0 | Authorization and medical data | Patient/doctor ownership checks and care/share checks remain enforced in the API. Admins cannot access clinical appointment routes. No Admin management API or dashboard exists in this project. |
| P1 | Doctor availability and appointments | Weekly UTC schedules, time blocks, available-slot lookup, booking, cancellation, doctor/patient rescheduling, and reschedule history are connected to MySQL. Cancellation and rescheduling are rejected after the appointment time. |
| P1 | Doctor photo endpoints | Both the existing public `/doctors/:id/photo` URL and the reported legacy GET `/doctor/profile/:id/photo` now use the same public image handler. Upload remains an authenticated doctor-only PUT. Uploaded bytes must match their declared JPEG/PNG/WebP type. |
| P1 | Booking information and offline payment | Booking captures a contact snapshot, optional visit reason, and pay-at-hospital choice. Payment is stored as `pending`; patients cannot mark it collected. Online payment is unavailable because no provider, sandbox, or verified webhook configuration exists. |
| P1 | Notifications | Booking, cancellation, and rescheduling attempt email notifications to the affected parties. The development mock no longer prints reset or verification tokens. Real delivery requires SMTP configuration. |
| P2 | Responsive UI and reported component 404s | All six reported Vite component URLs returned HTTP 200 from the running frontend. Imports/routes use the existing components. No browser automation or visual screenshot tool was available, so responsive rendering and console behavior were not visually inspected. |

Test-account seeders now require `UI_TEST_PATIENT_PASSWORD` or `UI_TEST_DOCTOR_PASSWORD` from the local shell instead of embedding those passwords in source. Both remain restricted to `NODE_ENV=development` and `doctors_appointment_db`. These are optional seeder-only variables; the application itself adds no new environment variable requirement. Existing test account passwords were not changed by this audit.
| P2 | Documents and medical history | Existing APIs retain patient ownership, doctor care relationship, explicit document sharing, and private file storage. These flows were not exercised end to end during this pass. |

## Reported browser errors

| Reported request | Verification in this pass |
|---|---|
| `GET /api/user/2` → 401 | Fresh login for the patient account whose ID is 2 followed by `GET /api/user/2` returned 200. Expired/invalid bearer sessions now clear client auth state and redirect protected pages. |
| Vite 404 for `SidePanel.jsx`, `Doctors.jsx`, doctor profile/appointments, patient profile/appointments | The exact six `/src/components/...` URLs all returned 200 from `http://localhost:5173`. The files and case-sensitive imports exist. The previous Vite/HMR failure was not reproducible; it appears consistent with stale/wrong-root Vite state. |
| `GET /api/doctor/availability/7` → 404 | With doctor 7's valid JWT, the same request returned 200. The route exists and checks doctor ownership. |
| `GET /api/doctor/profile/7/photo` → 404 | With the development doctor's image stored, the legacy path returned 200. It is now an alias for the public doctor-photo handler; missing-photo accounts correctly return a specific photo-not-found response. |

The old process on port 5000 served `/health` but returned “Route not found” for source routes. It was replaced with the current backend after a privileged stop was required. The current API is running on port 5000; the Vite frontend is on port 5173.

## Test scenarios run

- Backend `npm test`: 14 HTTP-level tests using a mock MySQL pool, including authentication expiry, registration password rules, generic reset responses, single-use password reset and JWT invalidation, availability, booking conflict handling, rescheduling history, cancellation permissions, profile ownership, document permissions, and email verification token reuse.
- Frontend `npm run build`: passed.
- Frontend `npm run lint`: passed.
- Backend JavaScript `node --check`: passed for API routes, auth middleware, email service, and seed/migration scripts.
- Live MySQL/API: migrations checked; test patient and doctor login succeeded; patient profile, doctor profile, and doctor schedule returned 200; doctor search returned a matching test profile.
- Live appointment flow: booked a fictional test appointment with a contact snapshot and `pay_at_hospital`; duplicate booking returned 409; rescheduled it and verified history; cancelled it; confirmed the final status was `cancelled`, payment remained `pending`, and its slot returned to `available`.
- Live access checks: own patient profile returned 200 and another role's profile returned 403.
- Live photo flow: authenticated doctor upload returned 200; both public and legacy photo GET paths returned 200.
- Live component paths: six component URLs returned 200.

Live email delivery reported `notificationSent=false`; SMTP delivery could not be confirmed from this environment. No online payment flow was run or claimed.

## Remaining limitations

- Configure and verify SMTP to test real verification, password-recovery, booking, cancellation, and rescheduling emails. `EMAIL_MODE=mock` deliberately does not deliver messages or print tokens.
- No payment provider is selected or configured. Pay-at-hospital bookings remain pending, and there is no payment collection/refund workflow or amount/currency ledger.
- No Admin dashboard or management endpoints exist; administrative functionality was not invented.
- No browser automation was available. The source build/lint, live endpoint checks, and component URL checks passed, but 1440/1024/768/390/320 viewport rendering, keyboard interaction, and browser console output remain unverified.
- Medical history/document permissions have automated mock-pool coverage but were not manually exercised against this live MySQL database in this pass.
- Registration/email verification and password recovery were not run end to end with a real SMTP mailbox; reset behavior was covered with API tests and mock persistence.
- The integration tests use a mocked SQL pool; database concurrency and transaction behavior were exercised via the local API only for the recorded booking flow, not through simultaneous race requests.
