#!/usr/bin/env node
'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const express = require('express');
const apiRoutes = require('../routes/api');
const { createPool } = require('../db');

const TARGET_DATABASE = 'doctors_appointment_db';
const TEST_PASSWORD = process.env.UI_TEST_DOCTOR_PASSWORD;
const doctors = [
  {
    name: 'Dr. Asha Mehta', email: 'ui-test-doctor-01@example.test', contact: '000-TEST-1001',
    specialty: 'Cardiology', hospital: 'Northstar Heart Clinic', qualifications: 'MBBS, MD (Cardiology)', years: 12,
    registration: 'TEST-MC-1001', biography: 'Fictional test profile for cardiovascular care and preventive heart health.',
    languages: ['English', 'Hindi'], expertise: ['Preventive cardiology', 'Heart health'], fee: 1200,
    address: '100 Test Health Avenue', city: 'New Delhi', state: 'Delhi', postal: '110001', modes: ['in-person', 'online'],
  },
  {
    name: 'Dr. Kabir Rao', email: 'ui-test-doctor-02@example.test', contact: '000-TEST-1002',
    specialty: 'Dermatology', hospital: 'Northstar Skin Centre', qualifications: 'MBBS, MD (Dermatology)', years: 9,
    registration: 'TEST-MC-1002', biography: 'Fictional test profile for general and preventive dermatology.',
    languages: ['English', 'Hindi', 'Kannada'], expertise: ['Skin health', 'Acne care'], fee: 900,
    address: '22 Test Wellness Road', city: 'Bengaluru', state: 'Karnataka', postal: '560001', modes: ['in-person'],
  },
  {
    name: 'Dr. Mira Sen', email: 'ui-test-doctor-03@example.test', contact: '000-TEST-1003',
    specialty: 'Pediatrics', hospital: 'Northstar Children’s Clinic', qualifications: 'MBBS, DCH', years: 7,
    registration: 'TEST-MC-1003', biography: 'Fictional test profile for routine pediatric and family care.',
    languages: ['English', 'Bengali', 'Hindi'], expertise: ['Child wellness', 'Immunization'], fee: 800,
    address: '8 Test Family Street', city: 'Kolkata', state: 'West Bengal', postal: '700001', modes: ['in-person', 'online'],
  },
];

function ensureDevelopmentTarget() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Refusing to seed unless NODE_ENV=development.');
  if (process.env.MYSQL_DATABASE !== TARGET_DATABASE) throw new Error(`Refusing to seed: MYSQL_DATABASE must be ${TARGET_DATABASE}.`);
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters to verify login.');
  if (typeof TEST_PASSWORD !== 'string' || TEST_PASSWORD.length < 10 || TEST_PASSWORD.length > 128 || !/[a-z]/.test(TEST_PASSWORD) || !/[A-Z]/.test(TEST_PASSWORD) || !/\d/.test(TEST_PASSWORD) || !/[^A-Za-z0-9]/.test(TEST_PASSWORD)) throw new Error('Set UI_TEST_DOCTOR_PASSWORD to a 10–128 character local test password with upper/lowercase, number, and symbol characters.');
}

async function checkSchema(pool) {
  const [columns] = await pool.execute('SHOW COLUMNS FROM users');
  const found = new Set(columns.map((column) => column.Field));
  const required = ['id', 'role', 'name', 'email', 'password_hash', 'contact_number', 'specialization', 'hospital_name', 'email_verified', 'verification_token_hash', 'verification_expires_at', 'verification_sent_at', 'qualifications', 'years_experience', 'registration_number', 'biography', 'languages_json', 'expertise_json', 'consultation_fee', 'clinic_address', 'city', 'state_region', 'postal_code', 'consultation_modes_json'];
  const missing = required.filter((column) => !found.has(column));
  if (missing.length) throw new Error(`Doctor profile schema is incomplete; missing columns: ${missing.join(', ')}. Run the existing backend migrations first.`);
  const [tables] = await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='doctor_availability'");
  if (!tables.length) throw new Error('Doctor availability migration has not been applied. Start the backend once in development, then rerun this script.');
  const [database] = await pool.execute('SELECT DATABASE() AS database_name');
  if (database[0]?.database_name !== TARGET_DATABASE) throw new Error(`Connected database is not ${TARGET_DATABASE}. No data was changed.`);
}

async function seedDoctors(pool) {
  const connection = await pool.getConnection();
  const created = [];
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      `SELECT id,role,name,email,password_hash,email_verified FROM users WHERE email IN (${doctors.map(() => '?').join(',')}) FOR UPDATE`,
      doctors.map((doctor) => doctor.email),
    );
    const byEmail = new Map(existing.map((row) => [row.email.toLowerCase(), row]));
    for (const doctor of doctors) {
      const row = byEmail.get(doctor.email);
      if (row && (row.role !== 'doctor' || row.name !== doctor.name || !Boolean(row.email_verified) || !(await bcrypt.compare(TEST_PASSWORD, row.password_hash)))) {
        throw new Error(`Existing account conflicts with ${doctor.email}; no data was changed.`);
      }
    }

    for (const doctor of doctors) {
      let row = byEmail.get(doctor.email);
      if (!row) {
        const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
        const [result] = await connection.execute(
          `INSERT INTO users (role,name,email,password_hash,contact_number,specialization,hospital_name,email_verified,qualifications,years_experience,registration_number,biography,languages_json,expertise_json,consultation_fee,clinic_address,city,state_region,postal_code,consultation_modes_json,verification_token_hash,verification_expires_at,verification_sent_at)
           VALUES ('doctor',?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?, ?,NULL,NULL,NULL)`,
          [doctor.name, doctor.email, passwordHash, doctor.contact, doctor.specialty, doctor.hospital, doctor.qualifications, doctor.years, doctor.registration, doctor.biography, JSON.stringify(doctor.languages), JSON.stringify(doctor.expertise), doctor.fee, doctor.address, doctor.city, doctor.state, doctor.postal, JSON.stringify(doctor.modes)],
        );
        row = { id: result.insertId };
        created.push(doctor.email);
      }

      for (const weekday of [1, 2, 3, 4, 5]) {
        await connection.execute('INSERT IGNORE INTO doctor_availability (doctor_id,weekday,start_time,end_time,slot_minutes) VALUES (?, ?, ?, ?, 30)', [row.id, weekday, '09:00:00', '17:00:00']);
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

async function verifyLogin(pool, doctor) {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.locals.pool = pool;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor', email: doctor.email, password: TEST_PASSWORD }),
    });
    const result = await response.json();
    if (!response.ok || result.role !== 'doctor' || result.emailVerified !== true || !result.token) throw new Error(`Login verification failed for ${doctor.email} (HTTP ${response.status}).`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  ensureDevelopmentTarget();
  const pool = createPool();
  try {
    await checkSchema(pool);
    const created = await seedDoctors(pool);
    for (const doctor of doctors) await verifyLogin(pool, doctor);
    console.log(`Verified ${doctors.length} development doctor accounts; created ${created.length} on this run.`);
    for (const doctor of doctors) console.log(`${doctor.name} | ${doctor.email} | role=doctor | email_verified=1 | weekday availability=09:00–17:00 UTC`);
    console.log('Login with the password supplied in UI_TEST_DOCTOR_PASSWORD.');
    console.log('Login API check: passed for all three accounts. No emails were sent.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Test doctor seed stopped safely: ${error.message}`);
  process.exitCode = 1;
});
