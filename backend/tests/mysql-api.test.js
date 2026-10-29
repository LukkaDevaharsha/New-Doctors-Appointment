const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

process.env.JWT_SECRET = 'test-only-secret-value-that-is-longer-than-thirty-two-characters';
process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'mock';
const apiRoutes = require('../routes/api');
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const slots = new Set();
const tokens = new Set();
const rescheduleChanges = [];
const validResetHashes = new Set();
const authVersions = new Map();
const pool = {
  execute: async (sql, params = []) => {
    if (sql.includes('SELECT auth_version FROM users')) return authVersions.has(Number(params[0])) ? [[{ auth_version: authVersions.get(Number(params[0])) }]] : [[{ auth_version: 0 }]];
    if (sql.includes('SELECT contact_number,email FROM users')) return [[{ contact_number: '000-TEST-0000', email: 'patient@example.test' }]];
    if (sql.startsWith('UPDATE users SET password_hash=?,auth_version=auth_version+1')) {
      const hash = params[1];
      if (!validResetHashes.has(hash)) return [{ affectedRows: 0 }];
      validResetHashes.delete(hash);
      authVersions.set(7, (authVersions.get(7) || 0) + 1);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT id,email FROM users WHERE email=?')) return params[0] === 'known@example.test' ? [[{ id: 7, email: 'known@example.test' }]] : [[]];
    if (sql.includes('SELECT slot_minutes FROM doctor_availability')) return params[0] === '99' ? [[]] : [[{ slot_minutes: 30 }]];
    if (sql.includes('FROM doctor_time_blocks WHERE doctor_id=?')) return [[]];
    if (sql.includes('SELECT start_time,end_time,slot_minutes FROM doctor_availability')) return [[{ start_time: '09:00:00', end_time: '17:00:00', slot_minutes: 30 }]];
    if (sql.includes('SELECT appointment_at FROM appointments')) return [[]];
    if (sql.includes('SELECT starts_at,ends_at FROM doctor_time_blocks')) return [[]];
    if (sql.includes('SELECT id,doctor_id FROM appointments WHERE id=? AND doctor_id=?')) return params[0] === '5' && params[1] === '42' ? [[{ id: 5, doctor_id: 42 }]] : [[]];
    if (sql.includes('SELECT id,doctor_id,patient_id,appointment_at FROM appointments WHERE id=? AND doctor_id=?')) return params[0] === '5' && params[1] === '42' ? [[{ id: 5, doctor_id: 42, patient_id: 7, appointment_at: new Date('2030-01-01T10:30:00.000Z') }]] : [[]];
    if (sql.includes('SELECT id,doctor_id,patient_id,appointment_at FROM appointments WHERE id=? AND patient_id=?')) return params[0] === '5' && params[1] === '7' ? [[{ id: 5, doctor_id: 42, patient_id: 7, appointment_at: new Date('2030-01-01T10:30:00.000Z') }]] : [[]];
    if (sql.includes('SELECT email FROM users WHERE id=?')) return [[{ email: 'patient@example.test' }]];
    if (sql.includes('INSERT INTO appointment_reschedule_history')) { rescheduleChanges.push(params); return [{ insertId: rescheduleChanges.length }]; }
    if (sql.includes('SELECT h.actor_role,h.previous_at')) return Number(params[1]) === 7 || Number(params[1]) === 42 ? [[{ actor_role: 'doctor', previous_at: new Date('2030-01-01T10:30:00.000Z'), rescheduled_at: new Date('2030-01-08T11:00:00.000Z'), reason: 'Schedule change', created_at: new Date('2030-01-01T09:00:00.000Z') }]] : [[]];
    if (sql.startsWith('UPDATE appointments SET appointment_at=')) return [{ affectedRows: 1 }];
    if (sql.startsWith("UPDATE appointments SET status='cancelled'")) return [{ affectedRows: 1 }];
    if (sql.includes('SELECT a.id,a.doctor_id')) return [[{ id: 3, doctor_id: 42, patient_id: 7, appointment_at: new Date('2030-01-01T10:30:00.000Z'), status: 'scheduled', created_at: new Date('2029-12-01T09:00:00.000Z'), doctor_name: 'Dr Example' }]];
    if (sql.includes("FROM users WHERE id=? AND role='doctor'")) return [[{ id: params[0] }]];
    if (sql.includes('FROM appointments WHERE doctor_id=? AND status IN')) {
      const key = `${params[0]}:${params[1]}`;
      return [slots.has(key) ? [{ id: 1 }] : []];
    }
    if (sql.startsWith('INSERT INTO appointments')) {
      const key = `${params[0]}:${params[2]}`;
      if (slots.has(key)) { const error = new Error('duplicate slot'); error.code = 'ER_DUP_ENTRY'; throw error; }
      slots.add(key);
      return [{ insertId: slots.size }];
    }
    if (sql.startsWith('UPDATE users SET email_verified=TRUE')) {
      const hash = params[0];
      if (!tokens.has(hash)) return [{ affectedRows: 0 }];
      tokens.delete(hash);
      return [{ affectedRows: 1 }];
    }
    return [[]];
  },
};
pool.getConnection = async () => ({
  execute: pool.execute,
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
});
app.locals.pool = pool;

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(async () => new Promise((resolve) => server.close(resolve)));

function bearer(role, userId, emailVerified = true, authVersion = authVersions.get(Number(userId)) || 0) {
  return `Bearer ${jwt.sign({ userId: String(userId), role, emailVerified, authVersion }, process.env.JWT_SECRET, { expiresIn: '5m', issuer: 'doctor-appointment-system', audience: 'doctor-appointment-client' })}`;
}
async function request(path, { method = 'GET', token, body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('appointment APIs reject missing and unverified tokens', async () => {
  assert.equal((await request('/appointments')).status, 401);
  const expired = `Bearer ${jwt.sign({ userId: '7', role: 'patient', emailVerified: true, authVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1, issuer: 'doctor-appointment-system', audience: 'doctor-appointment-client' })}`;
  assert.equal((await request('/appointments', { token: expired })).status, 401);
  const response = await request('/appointments/create', { method: 'POST', token: bearer('patient', 1, false), body: {} });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'EMAIL_NOT_VERIFIED');
});

test('registration enforces the backend password policy', async () => {
  const response = await request('/register', { method: 'POST', body: { role: 'patient', name: 'Test User', email: 'test@example.test', password: 'alllowercase123!' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /uppercase, lowercase, number, and symbol/);
});

test('password reset is single-use, enforces strength, and invalidates existing JWT sessions', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  validResetHashes.add(crypto.createHash('sha256').update(token).digest('hex'));
  const weak = await request('/password/reset', { method: 'POST', body: { token, password: 'weakpassword' } });
  assert.equal(weak.status, 400);
  const reset = await request('/password/reset', { method: 'POST', body: { token, password: 'StrongPass123!' } });
  assert.equal(reset.status, 200);
  assert.equal((await request('/password/reset', { method: 'POST', body: { token, password: 'StrongPass123!' } })).status, 400);
  assert.equal((await request('/appointments', { token: bearer('patient', 7, true, 0) })).status, 401);
});

test('forgot-password responses do not disclose whether an account exists', async () => {
  const known = await request('/password/forgot', { method: 'POST', body: { email: 'known@example.test' } });
  const unknown = await request('/password/forgot', { method: 'POST', body: { email: 'unknown@example.test' } });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(await known.json(), await unknown.json());
});

test('booking accepts valid future appointments and rejects duplicate or invalid slots', async () => {
  const slot = new Date(Date.now() + 86_400_000);
  slot.setUTCSeconds(0, 0);
  slot.setUTCMinutes(slot.getUTCMinutes() < 30 ? 0 : 30);
  const payload = { doctorId: '42', date: slot.toISOString(), patientContactNumber: '555-010-1000', paymentMethod: 'pay_at_hospital' };
  const options = { method: 'POST', token: bearer('patient', 7), body: payload };
  assert.equal((await request('/appointments/create', options)).status, 201);
  assert.equal((await request('/appointments/create', options)).status, 409);
  assert.equal((await request('/appointments/create', { ...options, body: { ...payload, doctorId: 'bad' } })).status, 400);
  assert.equal((await request('/appointments/create', { ...options, body: { ...payload, date: 'yesterday' } })).status, 400);
  assert.equal((await request('/appointments/create', { ...options, body: { ...payload, doctorId: '99' } })).status, 409);
});

test('availability exposes only scheduled working-hour slots', async () => {
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const response = await request(`/doctors/42/availability?date=${date}`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.timezone, 'UTC');
  assert.ok(result.slots.every((slot) => ['available', 'booked', 'unavailable'].includes(slot.status)));
});

test('doctor availability management and both public photo paths are registered', async () => {
  const schedule = await request('/doctor/availability/42', { token: bearer('doctor', 42) });
  assert.equal(schedule.status, 200);
  const primary = await request('/doctors/42/photo');
  const legacy = await request('/doctor/profile/42/photo');
  assert.equal(primary.status, 404);
  assert.equal(legacy.status, 404);
  assert.match((await legacy.json()).message, /photo not found/i);
});

test('doctor rescheduling validates a new open slot and records history for both appointment parties', async () => {
  const slot = new Date(Date.now() + 5 * 86_400_000);
  slot.setUTCSeconds(0, 0); slot.setUTCMinutes(slot.getUTCMinutes() < 30 ? 0 : 30);
  const response = await request('/appointments/5/reschedule', { method: 'PATCH', token: bearer('doctor', 42), body: { date: slot.toISOString(), reason: 'Schedule change' } });
  assert.equal(response.status, 200);
  assert.equal(rescheduleChanges.length, 1);
  assert.equal((await request('/appointments/5/reschedule-history', { token: bearer('patient', 7) })).status, 200);
  assert.equal((await request('/appointments/5/reschedule-history', { token: bearer('patient', 8) })).status, 200);
  assert.deepEqual(await (await request('/appointments/5/reschedule-history', { token: bearer('patient', 8) })).json(), []);
});

test('appointment cancellation is ownership checked and notifies through the configured mail service', async () => {
  assert.equal((await request('/appointments/5/cancel', { method: 'PATCH', token: bearer('patient', 8) })).status, 404);
  const response = await request('/appointments/5/cancel', { method: 'PATCH', token: bearer('patient', 7) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notificationSent, true);
  assert.equal((await request('/appointments/5/cancel', { method: 'PATCH', token: bearer('admin', 99) })).status, 403);
});

test('numeric account IDs prevent access to another patient appointment list', async () => {
  assert.equal((await request('/appointments/patient/9', { token: bearer('patient', 8) })).status, 403);
  assert.equal((await request('/appointments/patient/not-an-id', { token: bearer('patient', 8) })).status, 400);
});

test('appointment listing serializes MySQL DATETIME values returned as Date objects', async () => {
  const response = await request('/appointments', { token: bearer('patient', 7) });
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0].date, '2030-01-01T10:30:00.000Z');
});

test('patient history is role restricted and doctors need a care relationship', async () => {
  assert.equal((await request('/medical-history', { token: bearer('doctor', 42) })).status, 403);
  assert.equal((await request('/medical-history/patient/9', { token: bearer('doctor', 42) })).status, 403);
  assert.equal((await request('/medical-history/patient/9', { token: bearer('patient', 7) })).status, 403);
});

test('document sharing requires patient role and a treating relationship', async () => {
  assert.equal((await request('/documents/5/share', { method: 'POST', token: bearer('doctor', 42), body: { doctorId: '42' } })).status, 403);
  assert.equal((await request('/documents/5/share', { method: 'POST', token: bearer('patient', 7), body: { doctorId: '42' } })).status, 403);
  assert.equal((await request('/documents/5/share/42', { method: 'DELETE', token: bearer('patient', 8) })).status, 404);
});

test('verification token is single use and malformed tokens fail closed', async () => {
  assert.equal((await request('/email/verify', { method: 'POST', body: { token: 'bad' } })).status, 400);
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(crypto.createHash('sha256').update(token).digest('hex'));
  assert.equal((await request('/email/verify', { method: 'POST', body: { token } })).status, 200);
  assert.equal((await request('/email/verify', { method: 'POST', body: { token } })).status, 400);
});
