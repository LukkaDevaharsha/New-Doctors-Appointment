const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

process.env.JWT_SECRET = 'test-only-secret-value-that-is-longer-than-thirty-two-characters';
process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'mock';
process.env.PRIVATE_STORAGE_DIR = path.join(os.tmpdir(), `doc-app-api-test-${process.pid}`);
process.env.FRONTEND_ORIGIN = 'https://new-doctors-appointment-lw1hfg7og-devaharsha119-3699.vercel.app';
const apiRoutes = require('../routes/api');
const { setTransporterForTests, emailErrorDiagnostic, normalizeSmtpPassword } = require('../services/email');
const { app: configuredServerApp } = require('../server');
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const slots = new Set();
const tokens = new Set();
const rescheduleChanges = [];
const validResetHashes = new Set();
const authVersions = new Map();
const registeredEmails = new Set();
const availabilityQueryCalls = [];
const pool = {
  execute: async (sql, params = []) => {
    if (sql.startsWith('INSERT INTO users (role,name,email,password_hash')) {
      if (registeredEmails.has(params[2])) { const error = new Error('duplicate test email'); error.code = 'ER_DUP_ENTRY'; throw error; }
      registeredEmails.add(params[2]);
      return [{ insertId: registeredEmails.size + 100 }];
    }
    if (sql.includes('SELECT auth_version FROM users')) return authVersions.has(Number(params[0])) ? [[{ auth_version: authVersions.get(Number(params[0])) }]] : [[{ auth_version: 0 }]];
    if (sql.includes('SELECT contact_number,email FROM users')) return [[{ contact_number: '000-TEST-0000', email: 'patient@example.test' }]];
    if (sql.includes("SELECT id FROM users WHERE id=? AND role='patient' FOR UPDATE")) return [[{ id: params[0] }]];
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
    if (sql.includes('SELECT weekday,start_time,end_time,slot_minutes FROM doctor_availability')) {
      availabilityQueryCalls.push({ sql, params });
      return [[{ weekday: Number(params[1]), start_time: '18:30:00', end_time: '20:00:00', slot_minutes: 30 }]];
    }
    if (sql.includes('SELECT appointment_at FROM appointments')) return [[]];
    if (sql.includes('SELECT starts_at,ends_at FROM doctor_time_blocks')) return [[]];
    if (sql.includes('SELECT id,patient_id,doctor_id FROM appointments WHERE id=? AND doctor_id=?')) return params[0] === '5' && params[1] === '42' ? [[{ id: 5, patient_id: 7, doctor_id: 42 }]] : [[]];
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
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(process.env.PRIVATE_STORAGE_DIR, { recursive: true, force: true });
});

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

test('availability returns slots in the selected IST calendar date, including its UTC-midnight boundary', async () => {
  const date = '2032-04-05';
  availabilityQueryCalls.length = 0;
  const response = await request(`/doctors/42/availability?date=${date}`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.timezone, 'UTC');
  assert.deepEqual(result.slots.map((slot) => slot.startsAt), [
    '2032-04-04T18:30:00.000Z',
    '2032-04-04T19:00:00.000Z',
    '2032-04-04T19:30:00.000Z',
  ]);
  assert.deepEqual(availabilityQueryCalls[0].params, [
    '42',
    new Date('2032-04-04T00:00:00Z').getUTCDay(),
    new Date('2032-04-05T00:00:00Z').getUTCDay(),
  ]);
  assert.ok(result.slots.every((slot) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(slot.startsAt)) === date));
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
  const expiredToken = crypto.randomBytes(32).toString('hex');
  assert.equal((await request('/email/verify', { method: 'POST', body: { token: expiredToken } })).status, 400);
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(crypto.createHash('sha256').update(token).digest('hex'));
  assert.equal((await request('/email/verify', { method: 'POST', body: { token } })).status, 200);
  assert.equal((await request('/email/verify', { method: 'POST', body: { token } })).status, 400);
});

test('SMTP diagnostics identify safe delivery phases without exposing raw command or server response', () => {
  const diagnostic = emailErrorDiagnostic({ code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN synthetic-secret', response: 'server reply synthetic-secret', recipient: 'synthetic@example.test' });
  assert.deepEqual(diagnostic, { phase: 'authentication', code: 'EAUTH', responseCode: 535 });
  assert.equal(JSON.stringify(diagnostic).includes('synthetic-secret'), false);
  assert.equal(emailErrorDiagnostic({ code: 'ETIMEDOUT', timeoutType: 'CONNECT_TIMEOUT' }).phase, 'connection');
  assert.equal(emailErrorDiagnostic({ code: 'ETLS', command: 'STARTTLS' }).phase, 'tls');
  assert.equal(emailErrorDiagnostic({ code: 'ESOCKET', originalCode: 'ERR_TLS_CERT_ALTNAME_INVALID' }).phase, 'tls');
  assert.equal(emailErrorDiagnostic({ code: 'EENVELOPE', command: 'MAIL FROM' }).phase, 'sender_rejection');
  assert.equal(emailErrorDiagnostic({ code: 'EENVELOPE', command: 'RCPT TO' }).phase, 'recipient_rejection');
});

test('Gmail App Password display whitespace is removed without changing other SMTP passwords', () => {
  assert.equal(normalizeSmtpPassword('smtp.gmail.com', 'abcd efgh ijkl mnop'), 'abcdefghijklmnop');
  assert.equal(normalizeSmtpPassword('mail.example.test', 'pass phrase'), 'pass phrase');
});

test('registration keeps a created account when mocked SMTP fails and duplicate retries do not create another account', async () => {
  const email = `synthetic-${Date.now()}@example.test`;
  const makeForm = () => {
    const form = new FormData();
    Object.entries({ role: 'patient', name: 'Synthetic Test', email, password: 'StrongPass123!', contactNumber: '555-010-1000', age: '30', gender: 'prefer-not-to-say', address: 'Synthetic Street' }).forEach(([key, value]) => form.append(key, value));
    form.append('image', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])], { type: 'image/jpeg' }), 'synthetic.jpg');
    return form;
  };
  setTransporterForTests({ sendMail: async () => { const error = new Error('synthetic SMTP failure'); error.code = 'ESMTP'; throw error; } });
  const failedDelivery = await fetch(`${base}/register`, { method: 'POST', body: makeForm() });
  assert.equal(failedDelivery.status, 201);
  assert.equal((await failedDelivery.json()).verificationEmailSent, false);
  const retry = await fetch(`${base}/register`, { method: 'POST', body: makeForm() });
  assert.equal(retry.status, 409);
  setTransporterForTests({ sendMail: async () => ({ messageId: 'synthetic-test' }) });
});

test('registration sends verification email with a mocked transport', async () => {
  const email = `synthetic-success-${Date.now()}@example.test`;
  const form = new FormData();
  Object.entries({ role: 'patient', name: 'Synthetic Test', email, password: 'StrongPass123!', contactNumber: '555-010-1000', age: '30', gender: 'prefer-not-to-say', address: 'Synthetic Street' }).forEach(([key, value]) => form.append(key, value));
  form.append('image', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/jpeg' }), 'synthetic.jpg');
  let sent = false;
  setTransporterForTests({ sendMail: async () => { sent = true; return { messageId: 'synthetic-test' }; } });
  const response = await fetch(`${base}/register`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).verificationEmailSent, true);
  assert.equal(sent, true);
});

test('verification resend limit returns Retry-After without exposing account existence', async () => {
  let lastResponse;
  for (let attempt = 0; attempt < 11; attempt += 1) {
    lastResponse = await request('/email/resend', { method: 'POST', body: { email: `unknown-${attempt}@example.test` } });
  }
  assert.equal(lastResponse.status, 429);
  assert.ok(Number(lastResponse.headers.get('retry-after')) > 0);
});

test('frontend verification route, API endpoint, Vercel fallback, and configured CORS origin agree', async () => {
  const root = path.resolve(__dirname, '../..');
  const [appSource, apiSource, vercelConfig] = await Promise.all([
    fs.readFile(path.join(root, 'frontend/src/App.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'frontend/src/api.js'), 'utf8'),
    fs.readFile(path.join(root, 'frontend/vercel.json'), 'utf8'),
  ]);
  assert.match(appSource, /path="\/verify-email"/);
  assert.match(apiSource, /api\.post\('\/email\/verify', \{ token \}\)/);
  assert.match(vercelConfig, /"destination": "\/index\.html"/);

  const probe = configuredServerApp.listen(0);
  try {
    await new Promise((resolve) => probe.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${probe.address().port}/api/email/verify`, {
      method: 'OPTIONS',
      headers: { Origin: process.env.FRONTEND_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(response.headers.get('access-control-allow-origin'), process.env.FRONTEND_ORIGIN);
  } finally {
    await new Promise((resolve) => probe.close(resolve));
  }
});
