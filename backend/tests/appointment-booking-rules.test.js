'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDailyAppointmentConflict, istDayWindow } = require('../services/appointmentBookingRules');

const patientId = 'patient-7';
const appointment = (at, { patient = patientId, status = 'scheduled', paymentStatus = 'pending' } = {}) => ({
  patient_id: patient,
  appointment_at: at,
  status,
  payment_status: paymentStatus,
});
const requestedIst = (hour, minute = 0, day = '2032-04-05') => new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+05:30`);

test('first appointment of an IST calendar day is allowed', () => {
  assert.equal(getDailyAppointmentConflict([], patientId, requestedIst(9)), null);
});

test('second appointment less than five hours later is rejected', () => {
  const error = getDailyAppointmentConflict([appointment(requestedIst(9))], patientId, requestedIst(13, 30));
  assert.match(error, /at least 5 hours apart/);
});

test('second appointment exactly five hours later is allowed', () => {
  assert.equal(getDailyAppointmentConflict([appointment(requestedIst(9))], patientId, requestedIst(14)), null);
});

test('second appointment more than five hours later is allowed', () => {
  assert.equal(getDailyAppointmentConflict([appointment(requestedIst(9))], patientId, requestedIst(14, 30)), null);
});

test('the five-hour minimum applies symmetrically when the new appointment starts first', () => {
  assert.match(getDailyAppointmentConflict([appointment(requestedIst(15))], patientId, requestedIst(10, 30)), /at least 5 hours apart/);
  assert.equal(getDailyAppointmentConflict([appointment(requestedIst(15))], patientId, requestedIst(9, 30)), null);
});

test('third appointment is rejected regardless of spacing', () => {
  const existing = [appointment(requestedIst(8)), appointment(requestedIst(15))];
  assert.match(getDailyAppointmentConflict(existing, patientId, requestedIst(22)), /no more than 2 appointments/);
});

test('cancelled appointments do not count while scheduled and completed appointments do', () => {
  const rows = [
    appointment(requestedIst(7), { status: 'cancelled' }),
    appointment(requestedIst(8), { status: 'scheduled' }),
    appointment(requestedIst(15), { status: 'completed', paymentStatus: 'paid' }),
  ];
  assert.match(getDailyAppointmentConflict(rows, patientId, requestedIst(22)), /no more than 2 appointments/);
  assert.equal(getDailyAppointmentConflict([rows[0]], patientId, requestedIst(9)), null);
});

test('appointments belonging to another patient do not count', () => {
  assert.equal(getDailyAppointmentConflict([appointment(requestedIst(9), { patient: 'patient-8' })], patientId, requestedIst(10)), null);
});

test('UTC dates that differ but map to the same IST date are counted together', () => {
  const appointmentOnPreviousUtcDate = appointment(new Date('2032-04-04T20:00:00.000Z'));
  assert.match(getDailyAppointmentConflict([appointmentOnPreviousUtcDate], patientId, new Date('2032-04-05T00:00:00.000Z')), /at least 5 hours apart/);
});

test('UTC dates that match but fall on different IST dates are counted separately', () => {
  const beforeIstMidnight = appointment(new Date('2032-04-05T18:00:00.000Z'));
  assert.equal(getDailyAppointmentConflict([beforeIstMidnight], patientId, new Date('2032-04-05T19:00:00.000Z')), null);
});

test('IST day window includes its exact start and excludes the next IST midnight', () => {
  const { start, end } = istDayWindow(new Date('2032-04-05T19:00:00.000Z'));
  assert.equal(start.toISOString(), '2032-04-05T18:30:00.000Z');
  assert.equal(end.toISOString(), '2032-04-06T18:30:00.000Z');
  assert.match(getDailyAppointmentConflict([appointment(start)], patientId, new Date(start.getTime() + 60_000)), /at least 5 hours apart/);
  assert.equal(getDailyAppointmentConflict([appointment(new Date(end.getTime() - 60_000))], patientId, end), null);
});
