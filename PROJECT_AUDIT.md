# Focused project audit

## Architecture

- Frontend: React 18, React Router, Vite, Axios, existing CSS plus existing Bootstrap dependency.
- Backend: Express 4/CommonJS, bcrypt, JWT, Multer, Nodemailer.
- Database: MySQL 8 through `mysql2/promise`, parameterized queries, numbered additive migrations. MongoDB/Mongoose are no longer active dependencies or code paths.
- Configuration: backend environment variables are documented in `backend/.env.example`. Existing `.env` was left untouched.

## Status based on code and checks

| Area | Status | Evidence / limitation |
|---|---|---|
| Existing doctor search and profiles | Partially Working | SQL-backed routes preserve frontend paths; actual MySQL execution depends on local configuration. |
| Authentication | Partially Working | Password hashing, JWT checks and patient/doctor/admin roles; newly registered users must verify email. Admin provisioning remains an operator task. |
| Appointments | Partially Working | Ownership checks, future 30-minute scheduling, cancellation/rescheduling/completion, and unique active doctor slot in schema. Concurrent behavior needs MySQL integration verification. |
| Email verification | Implemented in code | Hashed random one-time token, 24-hour expiry, SMTP/mock transport, generic resend response and rate limit. SMTP delivery not verified here. |
| Patient medical history | Implemented in code | Patient-editable history separated from doctor-authored appointment summaries; treating relationship checks are server-side. |
| Private documents | Implemented in code | Signature checked PDF/JPEG/PNG, size cap, private generated storage IDs, per-request authorization, explicit share/revoke, audit table. |
| MySQL schema and startup | Implemented in code | Startup tests connection and applies additive `CREATE TABLE IF NOT EXISTS` migration. No live MySQL server was configured for this workspace. |
| MongoDB data transfer | Missing | Deliberately no connection to shared Mongo. Existing records are not copied; a reviewed export/import is required before a live cutover. |
| Admin interface | Missing | Admin API role is limited; no admin dashboard/account creation workflow was present. |

## Important fixes and risks

- Replaced Mongo-dependent API queries and startup with MySQL pool, schema migration, and bounded startup failure.
- Kept IDs as string representations of MySQL numeric IDs to preserve frontend data handling.
- Appointment slots have a database unique constraint so parallel booking cannot bypass the application check.
- JWT secret is validated at startup (minimum 32 characters); the startup error reported by the user is resolved by configuring a long secret, not by weakening the check.
- Medical history and documents remain sensitive; doctors require a scheduled/completed care relationship, and documents additionally require explicit patient sharing.
- Existing Mongo IDs/data are not MySQL compatible and are not automatically migrated. Back up/export and map records deliberately before any production cutover.

## Main implementation files

`backend/server.js`, `backend/db.js`, `backend/migrate.js`, `backend/migrations/001_initial_schema.sql`, `backend/routes/api.js`, `backend/services/email.js`, `backend/middleware/auth.js`, `backend/tests/mysql-api.test.js`, `frontend/src/api.js`, and patient/doctor dashboard components.
