# Test report

## Final audit update — 2026-10-29

This update supersedes the earlier counts and live-service limitations below.

- Backend `npm test`: **passed, 14/14** HTTP-level tests with a mocked MySQL pool.
- Frontend `npm run build`: **passed**.
- Frontend `npm run lint`: **passed**.
- Backend syntax checks: **passed** for changed JavaScript files.
- Local MySQL migration check: **passed**; migrations 001–003 are applied.
- Live login, profiles, doctor schedule, search, booking, duplicate-slot rejection, rescheduling/history, cancellation, freed availability, ownership denial, and profile-photo upload/retrieval were exercised with fictional seeded accounts.
- Six original Vite component URLs returned **200**. Original API profile/schedule/photo routes were retested with current authenticated test accounts.
- SMTP was not confirmed; live appointment notification responses reported delivery unconfirmed. Online payment remains unconfigured and unavailable.
- No browser automation was available, so viewport screenshots, real browser console inspection, and keyboard interaction were not performed.

See [FINAL_AUDIT.md](FINAL_AUDIT.md) for the issue-by-issue checklist, remaining limitations, and scenario details.

---

Executed in this workspace:

- Backend `npm test`: **passed, 7/7** HTTP-level tests using a mocked MySQL pool (authentication gate, appointment validation/duplicate/ownership, history role and care access, document-sharing permissions, MySQL DATETIME serialization, one-use token).
- Frontend `npm run build`: **passed** (Vite production build).
- Frontend `npm run lint`: **passed**.
- Backend JavaScript syntax checks: **passed** for server, API routes, DB pool, and migration runner.
- Search for Mongo/Mongoose/ObjectId references in active backend/source (excluding docs, lockfiles, and `.env`): **no matches**.

Not verified: live MySQL migration/startup, real SMTP delivery, concurrency against a MySQL server, browser workflows, and legacy record import. MySQL is installed and the `MySQL80` service is running with port 3306 reachable, but all MySQL connection variables are absent from `backend/.env`, so database identity/schema could not be inspected. Existing `.env` and any shared MongoDB were left untouched. The SQL migration is additive but should only be applied to the intended dedicated MySQL database after credentials and target database are verified.
