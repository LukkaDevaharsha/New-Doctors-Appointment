#!/usr/bin/env node
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const express = require('express');
const apiRoutes = require('../routes/api');
const { createPool } = require('../db');

const TARGET_DATABASE = 'defaultdb';
const EXPECTED_HOST = 'doctor-appointment-db-1';
const TEST_PASSWORD = process.env.UI_TEST_DOCTOR_PASSWORD;

const doctors = [
  {
    name: 'Dr. Asha Mehta',
    email: 'ui-test-doctor-01@example.test',
    contact: '000-TEST-1001',
    specialty: 'Cardiology',
    hospital: 'Northstar Heart Clinic',
    qualifications: 'MBBS, MD (Cardiology)',
    years: 12,
    registration: 'TEST-MC-1001',
    biography: 'Fictional test profile for cardiovascular care and preventive heart health.',
    languages: ['English', 'Hindi'],
    expertise: ['Preventive cardiology', 'Heart health'],
    fee: 1200,
    address: '100 Test Health Avenue',
    city: 'New Delhi',
    state: 'Delhi',
    postal: '110001',
    modes: ['in-person', 'online'],
  },
  {
    name: 'Dr. Kabir Rao',
    email: 'ui-test-doctor-02@example.test',
    contact: '000-TEST-1002',
    specialty: 'Dermatology',
    hospital: 'Northstar Skin Centre',
    qualifications: 'MBBS, MD (Dermatology)',
    years: 9,
    registration: 'TEST-MC-1002',
    biography: 'Fictional test profile for general and preventive dermatology.',
    languages: ['English', 'Hindi', 'Kannada'],
    expertise: ['Skin health', 'Acne care'],
    fee: 900,
    address: '22 Test Wellness Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postal: '560001',
    modes: ['in-person'],
  },
  {
    name: 'Dr. Mira Sen',
    email: 'ui-test-doctor-03@example.test',
    contact: '000-TEST-1003',
    specialty: 'Pediatrics',
    hospital: 'Northstar Children Clinic',
    qualifications: 'MBBS, DCH',
    years: 7,
    registration: 'TEST-MC-1003',
    biography: 'Fictional test profile for routine pediatric and family care.',
    languages: ['English', 'Bengali', 'Hindi'],
    expertise: ['Child wellness', 'Immunization'],
    fee: 800,
    address: '8 Test Family Street',
    city: 'Kolkata',
    state: 'West Bengal',
    postal: '700001',
    modes: ['in-person', 'online'],
  },
];

function validateConfiguration() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to run unless NODE_ENV=development.');
  }

  if (process.env.MYSQL_DATABASE !== TARGET_DATABASE) {
    throw new Error(`MYSQL_DATABASE must be ${TARGET_DATABASE}.`);
  }

  if (!process.env.MYSQL_SSL_CA) {
    throw new Error(
      'MYSQL_SSL_CA must be configured for the remote database.'
    );
  }

  if (
    typeof TEST_PASSWORD !== 'string' ||
    TEST_PASSWORD.length < 10 ||
    TEST_PASSWORD.length > 128 ||
    !/[a-z]/.test(TEST_PASSWORD) ||
    !/[A-Z]/.test(TEST_PASSWORD) ||
    !/\d/.test(TEST_PASSWORD) ||
    !/[^A-Za-z0-9]/.test(TEST_PASSWORD)
  ) {
    throw new Error(
      'UI_TEST_DOCTOR_PASSWORD must be 10-128 characters and contain uppercase, lowercase, a number, and a symbol.'
    );
  }

  if (!process.argv.includes('--confirm-aiven-write')) {
    throw new Error(
      'No records changed. Review this script, then explicitly pass --confirm-aiven-write to authorize inserts.'
    );
  }
}

async function verifyTarget(pool) {
  const [rows] = await pool.query(
    'SELECT DATABASE() AS database_name, @@hostname AS server_hostname'
  );

  if (rows[0]?.database_name !== TARGET_DATABASE) {
    throw new Error(
      'Connected database is not defaultdb. No records were changed.'
    );
  }

  if (rows[0]?.server_hostname !== EXPECTED_HOST) {
    throw new Error(
      `Unexpected database host identifier: ${rows[0]?.server_hostname}. No records were changed.`
    );
  }

  const [userColumns] = await pool.query('SHOW COLUMNS FROM users');
  const userFields = new Set(userColumns.map((column) => column.Field));

  const requiredUserFields = [
    'id',
    'role',
    'name',
    'email',
    'password_hash',
    'contact_number',
    'specialization',
    'hospital_name',
    'email_verified',
    'verification_token_hash',
    'verification_expires_at',
    'verification_sent_at',
    'qualifications',
    'years_experience',
    'registration_number',
    'biography',
    'languages_json',
    'expertise_json',
    'consultation_fee',
    'clinic_address',
    'city',
    'state_region',
    'postal_code',
    'consultation_modes_json',
  ];

  const missing = requiredUserFields.filter(
    (field) => !userFields.has(field)
  );

  if (missing.length) {
    throw new Error(`Missing users columns: ${missing.join(', ')}`);
  }

  const [availabilityColumns] = await pool.query(
    'SHOW COLUMNS FROM doctor_availability'
  );

  const availabilityFields = new Set(
    availabilityColumns.map((column) => column.Field)
  );

  for (const field of [
    'doctor_id',
    'weekday',
    'start_time',
    'end_time',
    'slot_minutes',
  ]) {
    if (!availabilityFields.has(field)) {
      throw new Error(
        `Missing doctor_availability column: ${field}`
      );
    }
  }

  console.log('Target verified: Aiven defaultdb.');
  console.log('Required schema verified.');
}

async function seedDoctors(pool) {
  const connection = await pool.getConnection();
  const created = [];

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id, role, name, email, password_hash, email_verified
       FROM users
       WHERE email IN (${doctors.map(() => '?').join(',')})
       FOR UPDATE`,
      doctors.map((doctor) => doctor.email)
    );

    const byEmail = new Map(
      existing.map((row) => [
        row.email.toLowerCase(),
        row,
      ])
    );

    // Check all existing accounts before making changes.
    for (const doctor of doctors) {
      const row = byEmail.get(doctor.email);

      if (
        row &&
        (
          row.role !== 'doctor' ||
          row.name !== doctor.name ||
          !Boolean(row.email_verified) ||
          !(await bcrypt.compare(
            TEST_PASSWORD,
            row.password_hash || ''
          ))
        )
      ) {
        throw new Error(
          `Existing account conflicts with ${doctor.email}; transaction aborted.`
        );
      }
    }

    // Create missing test doctor accounts.
    for (const doctor of doctors) {
      let row = byEmail.get(doctor.email);

      if (!row) {
        const passwordHash = await bcrypt.hash(
          TEST_PASSWORD,
          12
        );

        const [result] = await connection.execute(
          `INSERT INTO users (
            role,
            name,
            email,
            password_hash,
            contact_number,
            specialization,
            hospital_name,
            email_verified,
            qualifications,
            years_experience,
            registration_number,
            biography,
            languages_json,
            expertise_json,
            consultation_fee,
            clinic_address,
            city,
            state_region,
            postal_code,
            consultation_modes_json,
            verification_token_hash,
            verification_expires_at,
            verification_sent_at
          ) VALUES (
            'doctor',
            ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL
          )`,
          [
            doctor.name,
            doctor.email,
            passwordHash,
            doctor.contact,
            doctor.specialty,
            doctor.hospital,
            doctor.qualifications,
            doctor.years,
            doctor.registration,
            doctor.biography,
            JSON.stringify(doctor.languages),
            JSON.stringify(doctor.expertise),
            doctor.fee,
            doctor.address,
            doctor.city,
            doctor.state,
            doctor.postal,
            JSON.stringify(doctor.modes),
          ]
        );

        row = { id: result.insertId };
        created.push(doctor.email);
      }

      // Add weekday availability; do not duplicate existing slots.
      for (const weekday of [1, 2, 3, 4, 5]) {
        await connection.execute(
          `INSERT IGNORE INTO doctor_availability
           (
             doctor_id,
             weekday,
             start_time,
             end_time,
             slot_minutes
           )
           VALUES (?, ?, '09:00:00', '17:00:00', 30)`,
          [row.id, weekday]
        );
      }
    }

    // Verify login using this transaction's connection.
    // This allows the login route to see uncommitted test accounts.
    const transactionDb = {
      execute: connection.execute.bind(connection),
    };

    for (const doctor of doctors) {
      await verifyLogin(transactionDb, doctor);
    }

    // Commit only after all three logins pass.
    await connection.commit();

    console.log(
      'All three doctor logins verified before commit.'
    );

    return created;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyLogin(databaseHandle, doctor) {
  const app = express();

  app.use(express.json());
  app.use('/api', apiRoutes);

  // The login route uses databaseHandle.execute().
  app.locals.pool = databaseHandle;

  const server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'doctor',
          email: doctor.email,
          password: TEST_PASSWORD,
        }),
      }
    );

    const result = await response.json();

    if (
      !response.ok ||
      result.role !== 'doctor' ||
      result.emailVerified !== true ||
      !result.token
    ) {
      throw new Error(
        `Login verification failed for ${doctor.email} (HTTP ${response.status}).`
      );
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  validateConfiguration();

  const pool = createPool();

  try {
    await verifyTarget(pool);

    // seedDoctors commits only after login checks succeed.
    const created = await seedDoctors(pool);

    console.log(
      `Verified ${doctors.length} test doctors; created ${created.length} in this run.`
    );

    for (const doctor of doctors) {
      console.log(
        `${doctor.name} | ${doctor.email} | role=doctor | email_verified=1`
      );
    }

    console.log('Weekday availability: 09:00-17:00 UTC.');
    console.log('Login verification passed. No emails were sent.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    `Aiven test seeding stopped: ${error.message}`
  );
  process.exitCode = 1;
});
