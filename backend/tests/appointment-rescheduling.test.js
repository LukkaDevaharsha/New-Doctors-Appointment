'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-reschedule-secret-longer-than-thirty-two-characters';
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

function createFixture(initialAppointments) {
  const appointments = initialAppointments.map((appointment) => ({ ...appointment }));
  const acquirePatientLock = createPatientMutex();
  const parseUtc = (value) => {
    if (value instanceof Date) return value.getTime();
    const normalized = String(value).replace(' ', 'T');
    return new Date(`${normalized}${normalized.endsWith('Z') ? '' : 'Z'}`).getTime();
  };
  const pool = {
    execute: async (sql) => sql.includes('SELECT auth_version FROM users') ? [[{ auth_version: 0 }]] : [[]],
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
          if (sql.includes('SELECT id,patient_id,doctor_id FROM appointments WHERE id=?')) {
            const row = appointments.find((item) => String(item.id) === String(params[0])
              && String(item.doctor_id) === String(params[1]) && item.status === 'scheduled');
            return [row ? [{ id: row.id, patient_id: row.patient_id, doctor_id: row.doctor_id }] : []];
          }
          if (sql.includes("SELECT id FROM users WHERE id=? AND role='patient' FOR UPDATE")) {
            releasePatientLock = await acquirePatientLock(params[0]);
            return [[{ id: params[0] }]];
          }
          if (sql.includes("SELECT patient_id,appointment_at,status FROM appointments WHERE patient_id=?")) {
            const [patientId, from, to, excludedId] = params;
            return [appointments.filter((item) => String(item.patient_id) === String(patientId)
              && String(item.id) !== String(excludedId)
              && item.status !== 'cancelled'
              && parseUtc(item.appointment_at) >= parseUtc(from)
              && parseUtc(item.appointment_at) < parseUtc(to))];
          }
          if (sql.includes('SELECT id FROM users WHERE id=? FOR UPDATE')) return [[{ id: params[0] }]];
          if (sql.includes('SELECT id,doctor_id,patient_id,appointment_at FROM appointments WHERE id=?')) {
            const row = appointments.find((item) => String(item.id) === String(params[0])
              && String(item.doctor_id) === String(params[1]) && item.status === 'scheduled');
            return [row ? [{ ...row }] : []];
          }
          if (sql.includes('SELECT slot_minutes FROM doctor_availability')) return [[{ slot_minutes: 30 }]];
          if (sql.includes('FROM doctor_time_blocks WHERE doctor_id=?')) return [[]];
          if (sql.includes("SELECT id FROM appointments WHERE doctor_id=? AND status IN")) {
            const [doctorId, slotStart, _slotEnd, excludedId] = params;
            const slotStartTime = parseUtc(slotStart);
            const slotEndTime = slotStartTime + 30 * 60 * 1000;
            return [appointments.some((item) => String(item.doctor_id) === String(doctorId)
              && String(item.id) !== String(excludedId)
              && item.status !== 'cancelled'
              && parseUtc(item.appointment_at) < slotEndTime
              && parseUtc(item.appointment_at) + 30 * 60 * 1000 > slotStartTime) ? [{ id: 1 }] : []];
          }
          if (sql.startsWith('UPDATE appointments SET appointment_at=')) {
            const row = appointments.find((item) => String(item.id) === String(params[1])
              && String(item.doctor_id) === String(params[2]) && item.status === 'scheduled');
            if (!row) return [{ affectedRows: 0 }];
            row.appointment_at = params[0];
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith('INSERT INTO appointment_reschedule_history')) return [{ insertId: 1 }];
          if (sql.includes("SELECT email FROM users WHERE id=? AND role='patient'")) return [[{ email: 'patient@example.test' }]];
          if (sql.includes("SELECT email FROM users WHERE id=? AND role='doctor'")) return [[{ email: 'doctor@example.test' }]];
          throw new Error(`Unexpected SQL in rescheduling test: ${sql}`);
        },
      };
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.locals.pool = pool;
  const server = app.listen(0, '127.0.0.1');
  const ready = new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const token = jwt.sign({ userId: '42', role: 'doctor', emailVerified: true, authVersion: 0 }, process.env.JWT_SECRET);
  return {
    appointments,
    server,
    ready,
    close: () => new Promise((resolve) => server.close(resolve)),
    reschedule: async (id, date) => {
      await ready;
      return fetch(`http://127.0.0.1:${server.address().port}/api/appointments/${id}/reschedule`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date.toISOString(), reason: 'Test reschedule' }),
      });
    },
  };
}

function istDate(daysFromNow, hour, minute = 0) {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + daysFromNow);
  const istCalendar = new Date(base.getTime() + 5.5 * 60 * 60 * 1000);
  const istDateText = `${istCalendar.getUTCFullYear()}-${String(istCalendar.getUTCMonth() + 1).padStart(2, '0')}-${String(istCalendar.getUTCDate()).padStart(2, '0')}`;
  return new Date(`${istDateText}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
}

const scheduled = (id, at) => ({ id, patient_id: 77, doctor_id: 42, appointment_at: at, status: 'scheduled' });

test('rescheduling into an already full IST day is rejected', async (t) => {
  const target = istDate(12, 12);
  const fixture = createFixture([
    scheduled(1, istDate(11, 9)),
    scheduled(2, istDate(12, 8)),
    scheduled(3, istDate(12, 16)),
  ]);
  t.after(fixture.close);
  const response = await fixture.reschedule(1, target);
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /no more than 2 appointments/);
  assert.equal(fixture.appointments[0].appointment_at.getTime(), istDate(11, 9).getTime());
});

test('rescheduling out of a full IST day is allowed', async (t) => {
  const sourceOne = istDate(11, 9);
  const sourceTwo = istDate(11, 16);
  const target = istDate(12, 9);
  const fixture = createFixture([scheduled(1, sourceOne), scheduled(2, sourceTwo)]);
  t.after(fixture.close);
  const response = await fixture.reschedule(1, target);
  assert.equal(response.status, 200);
  assert.equal(fixture.appointments[0].appointment_at, target.toISOString().replace('T', ' ').replace('Z', ''));
});

test('rescheduling does not count the appointment being moved against itself', async (t) => {
  const source = istDate(12, 9);
  const target = istDate(12, 10);
  const fixture = createFixture([scheduled(1, source)]);
  t.after(fixture.close);
  const response = await fixture.reschedule(1, target);
  assert.equal(response.status, 200);
});

test('concurrent reschedules for one patient cannot both violate the IST gap', async (t) => {
  const targetOne = istDate(12, 9);
  const targetTwo = istDate(12, 11);
  const fixture = createFixture([
    scheduled(1, istDate(10, 9)),
    scheduled(2, istDate(10, 16)),
  ]);
  t.after(fixture.close);
  const responses = await Promise.all([
    fixture.reschedule(1, targetOne),
    fixture.reschedule(2, targetTwo),
  ]);
  const results = await Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.json() })));
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  assert.match(results.find(({ status }) => status === 409).body.message, /at least 5 hours apart/);
});
