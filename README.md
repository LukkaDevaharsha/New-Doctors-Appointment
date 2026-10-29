# Doctor Appointment System

Existing React 18/Vite frontend with an Express 4 API, JWT authentication, and MySQL 8 persistence. Private medical files are stored outside the frontend's public/static directory. The active backend has no MongoDB dependency.

## Local setup

Requirements: Node.js 20+, MySQL 8+, and npm.

1. Create the dedicated local database and an application account (adjust the password):

   ```sql
   CREATE DATABASE doctors_appointment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'doctors_app'@'localhost' IDENTIFIED BY 'use-a-local-password';
   GRANT ALL PRIVILEGES ON doctors_appointment_db.* TO 'doctors_app'@'localhost';
   ```

2. If `backend/.env` does not exist, copy `backend/.env.example` to `backend/.env`. If it already exists, preserve it and manually add/update the needed MySQL settings and a unique `JWT_SECRET` of at least 32 characters; do not replace the existing file wholesale.
3. Install and run:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   Startup validates the MySQL connection and applies numbered additive migrations, including doctor profiles, availability, account recovery, and booking metadata. It does not connect to, modify, or import from MongoDB. Existing records need a separately reviewed import before switching a live deployment.
4. In another terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The development email transport is `EMAIL_MODE=mock`; it accepts messages without delivering their links or printing tokens. Configure SMTP to exercise real verification, password-recovery, and appointment notifications. For SMTP, set `EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`. Set `FRONTEND_ORIGIN` to the deployed frontend origin. Keep all credentials and `PRIVATE_STORAGE_DIR` out of source control and public web roots.

## Development-only UI test patients

To create five verified patient accounts in the existing `doctors_appointment_db`, run from **CMD**:

```cmd
cd /d D:\MY_PROJECTS\doc-app\backend && set "NODE_ENV=development" && node scripts\seed-test-patients.js
```

Before running, set `UI_TEST_PATIENT_PASSWORD` in the local shell to the password for those test accounts. The script refuses other database names/environments, checks the existing user/history table columns, does not run migrations, and can safely be rerun. Existing matching addresses must already be the same verified seed accounts with that password; conflicting accounts cause a safe stop. It hashes passwords with bcrypt cost 12, marks only the five test rows verified, sends no email, and does not modify real accounts. Two newly created accounts receive clearly fictional sample history; no appointments are added because that would attach test data to existing doctors.

Seed account emails are `ui-test-patient-01@example.test` through `ui-test-patient-05@example.test`.

## Development-only UI test doctors

Start the backend once so the numbered migrations are applied, or run the guarded migration check from CMD:

```cmd
cd /d D:\MY_PROJECTS\doc-app\backend && set "NODE_ENV=development" && node scripts\run-dev-migrations.js
```

Create the three fictional doctor accounts and their weekday UTC schedules:

```cmd
cd /d D:\MY_PROJECTS\doc-app\backend && set "NODE_ENV=development" && node scripts\seed-test-doctors.js
```

Before running, set `UI_TEST_DOCTOR_PASSWORD` in the local shell to the password for those test accounts. The script only operates on `doctors_appointment_db`, refuses conflicting accounts, and verifies each login through the API. Emails are `ui-test-doctor-01@example.test` through `ui-test-doctor-03@example.test`.

Appointments currently support pay at hospital and remain marked `pending` until a trusted payment workflow is added. Online payment is intentionally unavailable until a provider and sandbox/webhook configuration are selected.

## Checks

```powershell
cd backend; npm test
cd frontend; npm run build
cd frontend; npm run lint
```

Database migrations are in `backend/migrations/`. API endpoints and access rules are listed in `PROJECT_AUDIT.md`. See `FINAL_AUDIT.md` and `TEST_REPORT.md` for checks actually run and remaining limitations.
