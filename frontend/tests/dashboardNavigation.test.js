import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardNavigation } from '../src/components/dashboard/dashboardNavigation.js';
import { getHeaderAuthActions } from '../src/components/header/headerAuthActions.js';

test('patient sidebar contains only patient navigation destinations', () => {
  const items = getDashboardNavigation('patient');
  assert.deepEqual(items.map(({ label }) => label), ['Overview', 'Find Doctors', 'My Appointments', 'Medical Records', 'My Profile', 'Settings']);
  assert.ok(items.every(({ to }) => to.startsWith('/patient-dashboard')));
});

test('doctor sidebar contains the requested doctor tools without patient-only navigation', () => {
  const items = getDashboardNavigation('doctor');
  assert.deepEqual(items.map(({ label }) => label), ['Overview', 'Appointments', 'My Patients', 'Schedule / Availability', 'My Profile', 'Settings']);
  assert.ok(items.every(({ to }) => to.startsWith('/doctor-dashboard')));
  assert.equal(items.some(({ label }) => label === 'Find Doctors'), false);
});

test('public header shows one coherent action set for logged-out users and each role', () => {
  assert.deepEqual(getHeaderAuthActions(null), ['login', 'register']);
  assert.deepEqual(getHeaderAuthActions({ role: 'patient' }), ['avatar', 'dashboard', 'logout']);
  assert.deepEqual(getHeaderAuthActions({ role: 'doctor' }), ['avatar', 'dashboard', 'logout']);
  assert.deepEqual(getHeaderAuthActions({ role: 'admin' }), ['login', 'register']);
});
