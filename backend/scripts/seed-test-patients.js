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
const EXPECTED_AIVEN_HOST = 'doctor-appointment-db-devaharsha119-cfe2.a.aivencloud.com';
const TEST_PASSWORD = process.env.UI_TEST_PATIENT_PASSWORD;
const patients = [
  { name: 'UI Test Patient 01', email: 'ui-test-patient-01@example.test', age: 34, gender: 'female', address: 'Test-only address, 1 Clinic Way' },
  { name: 'UI Test Patient 02', email: 'ui-test-patient-02@example.test', age: 48, gender: 'male', address: 'Test-only address, 2 Clinic Way' },
  { name: 'UI Test Patient 03', email: 'ui-test-patient-03@example.test', age: 26, gender: 'other', address: 'Test-only address, 3 Clinic Way' },
  { name: 'UI Test Patient 04', email: 'ui-test-patient-04@example.test', age: 61, gender: 'female', address: 'Test-only address, 4 Clinic Way' },
  { name: 'UI Test Patient 05', email: 'ui-test-patient-05@example.test', age: 39, gender: 'male', address: 'Test-only address, 5 Clinic Way' },
];
const historyByEmail = {
  'ui-test-patient-01@example.test': {
    allergies: ['Test-only: seasonal pollen'],
    conditions: ['Test-only: mild asthma'],
    medications: ['Test-only: rescue inhaler'],
    surgeries: [],
    notes: 'Fictional seed data for checking the populated patient history UI.',
  },
  'ui-test-patient-03@example.test': {
    allergies: [],
    conditions: ['Test-only: migraine history'],
    medications: ['Test-only: sample medication'],
    surgeries: ['Test-only: routine procedure'],
    notes: 'Fictional seed data. No real patient information.',
  },
};

function ensureDevelopmentTarget() {
  if (process.env.NODE_ENV !== 'development') throw safeError('NODE_ENV must be set to development.');
  if (process.env.MYSQL_DATABASE !== TARGET_DATABASE) throw safeError('MYSQL_DATABASE must be defaultdb.');
  if (process.env.MYSQL_HOST !== EXPECTED_AIVEN_HOST) throw safeError('MYSQL_HOST does not match the expected Aiven hostname.');
  if (!process.env.MYSQL_USER) throw safeError('MYSQL_USER is not set.');
  if (!process.env.MYSQL_PASSWORD) throw safeError('MYSQL_PASSWORD is not set.');
  if (!process.env.MYSQL_SSL_CA) throw safeError('MYSQL_SSL_CA is not set; Aiven TLS requires a CA certificate file path.');
  if (process.env.MYSQL_PORT && (!Number.isInteger(Number(process.env.MYSQL_PORT)) || Number(process.env.MYSQL_PORT) < 1 || Number(process.env.MYSQL_PORT) > 65535)) throw safeError('MYSQL_PORT must be a valid TCP port number when provided.');
  try {
    const ca = require('node:fs').readFileSync(process.env.MYSQL_SSL_CA, 'utf8');
    if (!/-----BEGIN CERTIFICATE-----/.test(ca)) throw new Error('not PEM');
  } catch {
    throw safeError('MYSQL_SSL_CA must point to a readable PEM certificate file. The configured path and certificate contents were suppressed.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw safeError('JWT_SECRET must be configured with at least 32 characters to verify login.');
  if (!process.argv.includes('--confirm-aiven-write')) throw safeError('Confirmation flag missing. No records changed; pass --confirm-aiven-write explicitly to authorize the seed.');
  if (typeof TEST_PASSWORD !== 'string' || TEST_PASSWORD.length < 10 || TEST_PASSWORD.length > 128 || !/[a-z]/.test(TEST_PASSWORD) || !/[A-Z]/.test(TEST_PASSWORD) || !/\d/.test(TEST_PASSWORD) || !/[^A-Za-z0-9]/.test(TEST_PASSWORD)) throw safeError('UI_TEST_PATIENT_PASSWORD must be set to 10-128 characters with uppercase, lowercase, a number, and a symbol.');
}

function safeError(message) {
  const error = new Error(message);
  error.safeDiagnostic = true;
  return error;
}

async function verifyAivenTarget(pool) {
  let rows;
  try {
    [rows] = await pool.execute('SELECT DATABASE() AS database_name, @@hostname AS server_hostname');
  } catch {
    throw safeError('Could not query the connected MySQL server. Check Aiven reachability, credentials, port, and CA configuration; low-level details were suppressed.');
  }
  if (rows[0]?.database_name !== TARGET_DATABASE) throw safeError('Connected MySQL database is not defaultdb. No records were changed.');
  if (rows[0]?.server_hostname !== EXPECTED_HOST) throw safeError('Connected MySQL server identity does not match the expected Aiven server. No records were changed.');
}

async function checkSchema(pool) {
  await verifyAivenTarget(pool);
  const required = [
    'id', 'role', 'name', 'email', 'password_hash', 'contact_number', 'age',
    'gender', 'address', 'email_verified', 'verification_token_hash',
    'verification_expires_at', 'verification_sent_at',
  ];
  let columns;
  try { [columns] = await pool.execute('SHOW COLUMNS FROM users'); }
  catch { throw safeError('Could not inspect the users table after Aiven target verification. Check that the schema exists and the database user has read permission.'); }
  const found = new Set(columns.map((column) => column.Field));
  const missing = required.filter((column) => !found.has(column));
  if (missing.length) throw safeError(`Existing users table is incompatible; missing required columns: ${missing.join(', ')}. No data was changed.`);
  const historyRequired = ['patient_id', 'allergies', 'conditions_json', 'medications', 'surgeries', 'notes', 'created_by', 'updated_by'];
  let historyColumns;
  try { [historyColumns] = await pool.execute('SHOW COLUMNS FROM patient_medical_history'); }
  catch { throw safeError('Could not inspect patient_medical_history after Aiven target verification. Check that the patient history migration has been applied.'); }
  const historyFound = new Set(historyColumns.map((column) => column.Field));
  const missingHistory = historyRequired.filter((column) => !historyFound.has(column));
  if (missingHistory.length) throw safeError(`Existing patient_medical_history table is incompatible; missing columns: ${missingHistory.join(', ')}. No data was changed.`);
}

async function insertPatients(pool) {
  const connection = await pool.getConnection();
  const created = [];
  try {
    await connection.beginTransaction();
    const placeholders = patients.map(() => '?').join(',');
    const [existing] = await connection.execute(
      `SELECT id,role,name,email,password_hash,email_verified FROM users WHERE email IN (${placeholders}) FOR UPDATE`,
      patients.map((patient) => patient.email),
    );
    const byEmail = new Map(existing.map((row) => [row.email.toLowerCase(), row]));

    const statuses = new Map();
    // Existing accounts are read only; compare the configured password without changing it.
    for (const patient of patients) {
      const row = byEmail.get(patient.email);
      if (!row) continue;
      const matches = row.role === 'patient' && row.name === patient.name && Boolean(row.email_verified)
        && await bcrypt.compare(TEST_PASSWORD, row.password_hash || '');
      statuses.set(patient.email, matches ? 'login-testable-existing' : 'existing-account-not-login-testable');
    }

    for (const patient of patients) {
      let row = byEmail.get(patient.email);
      if (row) continue;
      if (!row) {
        const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
        const [result] = await connection.execute(
          `INSERT INTO users
            (role,name,email,password_hash,contact_number,age,gender,address,email_verified,
             verification_token_hash,verification_expires_at,verification_sent_at)
           VALUES ('patient',?,?,?,?,?,?,?,1,NULL,NULL,NULL)`,
          [patient.name, patient.email, passwordHash, '000-TEST-0000', patient.age, patient.gender, patient.address],
        );
        row = { id: result.insertId, role: 'patient', email_verified: 1 };
        created.push(patient.email);
        statuses.set(patient.email, 'created-login-testable');
      }

      const history = historyByEmail[patient.email];
      if (history && created.includes(patient.email)) {
        await connection.execute(
          `INSERT IGNORE INTO patient_medical_history
            (patient_id,allergies,conditions_json,medications,surgeries,notes,created_by,updated_by)
           VALUES (?,?,?,?,?,?,?,?)`,
          [row.id, JSON.stringify(history.allergies), JSON.stringify(history.conditions), JSON.stringify(history.medications), JSON.stringify(history.surgeries), history.notes, row.id, row.id],
        );
      }
    }
    await connection.commit();
    return { created, statuses };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifySeed(pool, statuses) {
  const placeholders = patients.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id,role,email,email_verified,password_hash FROM users WHERE email IN (${placeholders}) ORDER BY email`,
    patients.map((patient) => patient.email),
  );
  for (const row of rows) {
    if (row.role === 'patient' && Boolean(row.email_verified) && await bcrypt.compare(TEST_PASSWORD, row.password_hash || '') && !statuses.has(row.email)) statuses.set(row.email, 'login-testable-existing');
  }
  return rows;
}

async function verifyLogin(pool, email) {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.locals.pool = pool;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient', email, password: TEST_PASSWORD }),
    });
    const result = await response.json();
    if (!response.ok || result.role !== 'patient' || result.emailVerified !== true || !result.token) {
      throw new Error(`Existing login API check failed (HTTP ${response.status}).`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runStage(label, action) {
  try { return await action(); }
  catch (error) {
    if (error?.safeDiagnostic) throw error;
    throw safeError(`${label} failed. Sensitive low-level details were suppressed.`);
  }
}

async function main() {
  let pool;
  try {
    await runStage('Startup configuration validation', async () => ensureDevelopmentTarget());
    pool = await runStage('MySQL pool configuration', async () => createPool());
    await runStage('Aiven connection, target verification, and schema validation', () => checkSchema(pool));
    const { created, statuses } = await runStage('Synthetic patient seed transaction', () => insertPatients(pool));
    const accounts = await runStage('Seed verification', () => verifySeed(pool, statuses));
    const loginTested = new Set();
    for (const patient of patients) {
      if (statuses.get(patient.email) === 'created-login-testable' || statuses.get(patient.email) === 'login-testable-existing') {
        await runStage(`Patient login check for ${patient.email}`, () => verifyLogin(pool, patient.email));
        loginTested.add(patient.email);
      }
    }
    console.log(`Found ${accounts.length} matching test seed addresses; created ${created.length} on this run.`);
    for (const patient of patients) console.log(`${patient.email} | ${statuses.get(patient.email) || 'account-not-found'} | ${loginTested.has(patient.email) ? 'login test passed' : 'login cannot be tested with configured test password'}`);
    console.log('Patient login API checks completed without sending verification email.');
    console.log('No appointments were inserted; the seed avoids attaching test bookings to existing doctors.');
  } finally {
    if (pool) await pool.end();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error?.safeDiagnostic ? error.message : 'Patient seed stopped at an unexpected stage. Sensitive low-level details were suppressed.');
  process.exitCode = 1;
});

module.exports = { TARGET_DATABASE, EXPECTED_HOST, patients, ensureDevelopmentTarget, checkSchema, insertPatients, verifySeed };
