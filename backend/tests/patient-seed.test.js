'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// A disposable fixture value used only by this test process.
process.env.UI_TEST_PATIENT_PASSWORD = 'TestOnlyPass123!';
const { TARGET_DATABASE, EXPECTED_HOST, patients, ensureDevelopmentTarget, insertPatients } = require('../scripts/seed-test-patients');

test('patient seed is pinned to the expected Aiven database and requires explicit write confirmation', async () => {
  assert.equal(TARGET_DATABASE, 'defaultdb');
  assert.equal(EXPECTED_HOST, 'doctor-appointment-db-1');
  const original = { ...process.env };
  process.env.NODE_ENV = 'development';
  process.env.MYSQL_DATABASE = 'defaultdb';
  process.env.MYSQL_HOST = 'doctor-appointment-db-devaharsha119-cfe2.a.aivencloud.com';
  process.env.MYSQL_PASSWORD = 'test-only-database-password';
  process.env.MYSQL_PORT = '3306';
  const certDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patient-seed-test-'));
  process.env.MYSQL_SSL_CA = path.join(certDir, 'ca.pem');
  await fs.writeFile(process.env.MYSQL_SSL_CA, '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----');
  process.env.JWT_SECRET = 'test-only-jwt-secret-value-longer-than-thirty-two-characters';
  const confirmationIndex = process.argv.indexOf('--confirm-aiven-write');
  if (confirmationIndex !== -1) process.argv.splice(confirmationIndex, 1);
  assert.throws(ensureDevelopmentTarget, /pass --confirm-aiven-write explicitly/);
  process.argv.push('--confirm-aiven-write');
  assert.doesNotThrow(ensureDevelopmentTarget);
  process.argv.splice(process.argv.indexOf('--confirm-aiven-write'), 1);
  await fs.rm(certDir, { recursive: true, force: true });
  Object.assign(process.env, original);
});

test('seed creates only missing synthetic patients and leaves conflicting existing users unchanged', async () => {
  const existingHash = await bcrypt.hash(process.env.UI_TEST_PATIENT_PASSWORD, 12);
  const existingWrongPasswordHash = await bcrypt.hash('DifferentExistingPass123!', 12);
  const snapshots = [
    { id: 10, role: 'patient', name: patients[0].name, email: patients[0].email, password_hash: existingHash, email_verified: 1 },
    { id: 11, role: 'patient', name: patients[1].name, email: patients[1].email, password_hash: existingWrongPasswordHash, email_verified: 1 },
    { id: 12, role: 'doctor', name: 'Existing Doctor', email: patients[2].email, password_hash: 'unchanged', email_verified: 1 },
  ];
  const inserted = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql, params) => {
      if (sql.includes('SELECT id,role,name,email,password_hash,email_verified')) return [snapshots];
      if (sql.includes('INSERT INTO users')) {
        inserted.push({ sql, params });
        return [{ insertId: 100 + inserted.length }];
      }
      if (sql.includes('INSERT IGNORE INTO patient_medical_history')) return [{ affectedRows: 1 }];
      throw new Error('Unexpected test query');
    },
  };
  const pool = { getConnection: async () => connection };
  const { created, statuses } = await insertPatients(pool);

  assert.deepEqual(created, patients.slice(3).map(({ email }) => email));
  assert.equal(statuses.get(patients[0].email), 'login-testable-existing');
  assert.equal(statuses.get(patients[1].email), 'existing-account-not-login-testable');
  assert.equal(statuses.get(patients[2].email), 'existing-account-not-login-testable');
  assert.equal(inserted.length, 2);
  for (const { sql, params } of inserted) {
    assert.match(sql, /VALUES \('patient',\?,\?,\?,\?,\?,\?,\?,1,NULL,NULL,NULL\)/);
    assert.match(params[1], /^ui-test-patient-0[45]@example\.test$/);
    assert.equal(await bcrypt.compare(process.env.UI_TEST_PATIENT_PASSWORD, params[2]), true);
  }
  assert.equal(snapshots[1].password_hash, existingWrongPasswordHash);
});
