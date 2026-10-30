'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-booking-secret-longer-than-thirty-two-characters';
process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'mock';
const apiRoutes = require('../routes/api');

function createPatientMutex() {
  const tails = new Map();
  return async function acquire(patientId) {
    const key = String(patientId);
    const previous = tails.get(key) || Promise.resolve();
    let unlock;
    const held = new Promise((resolve) => { unlock = resolve; });
    const tail = previous.then(() => held);
    tails.set(key, tail);
    await previous;
    return () => {
      unlock();
      if (tails.get(key) === tail) tails.delete(key);
    };
  };
}

test('concurrent booking requests for one patient serialize on the patient row lock', async (t) => {
  const bookings = [];
  const acquirePatientLock = createPatientMutex();
  let nextId = 1;
  const parseUtc = (value) => {
    if (value instanceof Date) return value.getTime();
    const normalized = String(value).replace(' ', 'T');
    return new Date(`${normalized}${normalized.endsWith('Z') ? '' : 'Z'}`).getTime();
  };
  const pool = {
    execute: async (sql, params = []) => {
      if (sql.includes('SELECT auth_version FROM users')) return [[{ auth_version: 0 }]];
      return [[]];
    },
    getConnection: async () => {
      let releasePatientLock = null;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        releasePatientLock?.();
      };
      return {
        beginTransaction: async () => {},
        commit: async () => release(),
        rollback: async () => release(),
        release,
        execute: async (sql, params = []) => {
          if (sql.includes("SELECT contact_number,email FROM users WHERE id=? AND role='patient'")) {
            releasePatientLock = await acquirePatientLock(params[0]);
            return [[{ contact_number: '555-010-1000', email: 'patient@example.test' }]];
          }
          if (sql.includes("SELECT patient_id,appointment_at,status FROM appointments WHERE patient_id=?")) {
            const [patientId, from, to] = params;
            return [bookings.filter((booking) => String(booking.patient_id) === String(patientId)
              && booking.status !== 'cancelled'
              && parseUtc(booking.appointment_at) >= parseUtc(from)
              && parseUtc(booking.appointment_at) < parseUtc(to))];
          }
          if (sql.includes("SELECT id,name,email FROM users WHERE id=? AND role='doctor'")) return [[{ id: params[0], name: 'Dr Test', email: 'doctor@example.test' }]];
          if (sql.includes('SELECT slot_minutes FROM doctor_availability')) return [[{ slot_minutes: 30 }]];
          if (sql.includes('FROM doctor_time_blocks WHERE doctor_id=?')) return [[]];
          if (sql.includes("SELECT id FROM appointments WHERE doctor_id=? AND status IN")) {
            const [doctorId, slotStart, slotEnd] = params;
            return [bookings.some((booking) => String(booking.doctor_id) === String(doctorId)
              && booking.status !== 'cancelled'
              && parseUtc(booking.appointment_at) < parseUtc(slotEnd)
              && parseUtc(booking.appointment_at) + 30 * 60 * 1000 > parseUtc(slotStart)) ? [{ id: 1 }] : []];
          }
          if (sql.startsWith('INSERT INTO appointments')) {
            const booking = { id: nextId++, doctor_id: params[0], patient_id: params[1], appointment_at: params[2].replace(' ', 'T') + 'Z', status: 'scheduled' };
            bookings.push(booking);
            return [{ insertId: booking.id }];
          }
          throw new Error(`Unexpected SQL in concurrency test: ${sql}`);
        },
      };
    },
  };

  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.locals.pool = pool;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const futureUtcDay = new Date();
  futureUtcDay.setUTCDate(futureUtcDay.getUTCDate() + 5);
  futureUtcDay.setUTCHours(0, 0, 0, 0);
  const dateAt = (hours) => new Date(Date.UTC(futureUtcDay.getUTCFullYear(), futureUtcDay.getUTCMonth(), futureUtcDay.getUTCDate(), hours)).toISOString();
  const token = jwt.sign({ userId: '77', role: 'patient', emailVerified: true, authVersion: 0 }, process.env.JWT_SECRET);
  const book = (date) => fetch(`http://127.0.0.1:${server.address().port}/api/appointments/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctorId: '42', date, patientContactNumber: '555-010-1000' }),
  });

  const responses = await Promise.all([book(dateAt(9)), book(dateAt(11))]);
  const results = await Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.json() })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  const rejected = results.find((result) => result.status === 409);
  assert.match(rejected.body.message, /at least 5 hours apart/);
  assert.equal(bookings.length, 1);
});
