#!/usr/bin/env node
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const express = require('express');
const apiRoutes = require('../routes/api');
const { createPool } = require('../db');

const TARGET_DATABASE = 'doctors_appointment_db';
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
  if (process.env.NODE_ENV !== 'development') throw new Error('Refusing to seed unless NODE_ENV=development.');
  if (process.env.MYSQL_DATABASE !== TARGET_DATABASE) throw new Error(`Refusing to seed: MYSQL_DATABASE must be ${TARGET_DATABASE}.`);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters to verify login.');
  if (typeof TEST_PASSWORD !== 'string' || TEST_PASSWORD.length < 10 || TEST_PASSWORD.length > 128 || !/[a-z]/.test(TEST_PASSWORD) || !/[A-Z]/.test(TEST_PASSWORD) || !/\d/.test(TEST_PASSWORD) || !/[^A-Za-z0-9]/.test(TEST_PASSWORD)) throw new Error('Set UI_TEST_PATIENT_PASSWORD to a 10–128 character local test password with upper/lowercase, number, and symbol characters.');
}

async function checkSchema(pool) {
  const required = [
    'id', 'role', 'name', 'email', 'password_hash', 'contact_number', 'age',
    'gender', 'address', 'email_verified', 'verification_token_hash',
    'verification_expires_at', 'verification_sent_at',
  ];
  const [columns] = await pool.execute('SHOW COLUMNS FROM users');
  const found = new Set(columns.map((column) => column.Field));
  const missing = required.filter((column) => !found.has(column));
  if (missing.length) throw new Error(`Existing users table is incompatible; missing required columns: ${missing.join(', ')}. No data was changed.`);
  const historyRequired = ['patient_id', 'allergies', 'conditions_json', 'medications', 'surgeries', 'notes', 'created_by', 'updated_by'];
  const [historyColumns] = await pool.execute('SHOW COLUMNS FROM patient_medical_history');
  const historyFound = new Set(historyColumns.map((column) => column.Field));
  const missingHistory = historyRequired.filter((column) => !historyFound.has(column));
  if (missingHistory.length) throw new Error(`Existing patient_medical_history table is incompatible; missing columns: ${missingHistory.join(', ')}. No data was changed.`);
  const [rows] = await pool.execute('SELECT DATABASE() AS database_name');
  if (rows[0]?.database_name !== TARGET_DATABASE) throw new Error(`Connected database is not ${TARGET_DATABASE}. No data was changed.`);
}

async function insertPatients(pool) {
  const connection = await pool.getConnection();
  const created = [];
  try {
    await connection.beginTransaction();
    const placeholders = patients.map(() => '?').join(',');
    const [existing] = await connection.execute(
      `SELECT id,role,name,email,password_hash,email_verified FROM users WHERE email IN (${placeholders})`,
      patients.map((patient) => patient.email),
    );
    const byEmail = new Map(existing.map((row) => [row.email.toLowerCase(), row]));

    // Never adopt or mutate a matching address that is not already this exact verified seed account.
    for (const patient of patients) {
      const row = byEmail.get(patient.email);
      if (!row) continue;
      if (row.role !== 'patient' || row.name !== patient.name || !Boolean(row.email_verified)
        || !(await bcrypt.compare(TEST_PASSWORD, row.password_hash))) {
        throw new Error(`Existing account conflicts with the test seed address ${patient.email}; no data was changed.`);
      }
    }

    for (const patient of patients) {
      let row = byEmail.get(patient.email);
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
    return created;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifySeed(pool) {
  const placeholders = patients.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id,role,email,email_verified,password_hash FROM users WHERE email IN (${placeholders}) ORDER BY email`,
    patients.map((patient) => patient.email),
  );
  if (rows.length !== patients.length || rows.some((row) => row.role !== 'patient' || !Boolean(row.email_verified))) {
    throw new Error('Seed verification failed: expected five verified patient accounts.');
  }
  for (const row of rows) {
    if (!(await bcrypt.compare(TEST_PASSWORD, row.password_hash))) throw new Error(`Password verification failed for ${row.email}.`);
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

async function main() {
  ensureDevelopmentTarget();
  const pool = createPool();
  try {
    await checkSchema(pool);
    const created = await insertPatients(pool);
    const accounts = await verifySeed(pool);
    await verifyLogin(pool, patients[0].email);
    console.log(`Verified ${accounts.length} test patient accounts; created ${created.length} on this run.`);
    for (const row of accounts) console.log(`${row.email} | role=${row.role} | email_verified=1`);
    console.log('Login with the password supplied in UI_TEST_PATIENT_PASSWORD.');
    console.log('Existing login API test: passed for UI Test Patient 01. No verification email was sent.');
    console.log('No appointments were inserted; the seed avoids attaching test bookings to existing doctors.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Test patient seed stopped safely: ${error.message}`);
  process.exitCode = 1;
});
