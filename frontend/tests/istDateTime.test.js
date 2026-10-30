import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatIstDate,
  formatIstDateTime,
  formatIstTime,
  getIstDateKey,
  istLocalDateTimeToUtc,
  istWindowsToUtc,
  utcToIstLocalDateTime,
  utcWindowsToIst,
} from '../src/utils/istDateTime.js';

test('UTC appointment timestamps display as IST without applying the offset twice', () => {
  const appointment = '2026-10-30T09:00:00.000Z';
  assert.equal(getIstDateKey(appointment), '2026-10-30');
  assert.match(formatIstTime(appointment), /2:30\s*pm IST/i);
  assert.match(formatIstDateTime(appointment), /30 Oct 2026/i);
});

test('IST date grouping handles UTC midnight boundaries', () => {
  assert.equal(getIstDateKey('2026-10-30T18:29:00.000Z'), '2026-10-30');
  assert.equal(getIstDateKey('2026-10-30T18:30:00.000Z'), '2026-10-31');
  assert.equal(getIstDateKey('2026-10-30T20:00:00.000Z'), '2026-10-31');
  assert.match(formatIstDate('2026-10-30T20:00:00.000Z'), /31 Oct 2026/i);
});

test('datetime-local input values are interpreted as IST and round-trip as UTC', () => {
  const utc = istLocalDateTimeToUtc('2026-10-30T14:30');
  assert.equal(utc, '2026-10-30T09:00:00.000Z');
  assert.equal(utcToIstLocalDateTime(utc), '2026-10-30T14:30');
});

test('weekly availability conversion accounts for weekday and midnight crossings', () => {
  const ist = utcWindowsToIst([{ weekday: 0, startTime: '20:00', endTime: '23:00', slotMinutes: 30 }]);
  assert.deepEqual(ist, [{ weekday: 1, startTime: '01:30', endTime: '04:30', slotMinutes: 30 }]);
  const utc = istWindowsToUtc([{ weekday: 0, startTime: '01:30', endTime: '04:30', slotMinutes: 30 }]);
  assert.deepEqual(utc, [{ weekday: 6, startTime: '20:00', endTime: '23:00', slotMinutes: 30 }]);
});

test('weekly windows crossing midnight split into adjacent weekdays', () => {
  const result = utcWindowsToIst([{ weekday: 0, startTime: '18:00', endTime: '21:00', slotMinutes: 30 }]);
  assert.deepEqual(result, [
    { weekday: 0, startTime: '23:30', endTime: '24:00', slotMinutes: 30 },
    { weekday: 1, startTime: '00:00', endTime: '02:30', slotMinutes: 30 },
  ]);
  assert.deepEqual(istWindowsToUtc(result), [{ weekday: 0, startTime: '18:00', endTime: '21:00', slotMinutes: 30 }]);
});
