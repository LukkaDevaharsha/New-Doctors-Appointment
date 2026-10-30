'use strict';

const MAX_APPOINTMENTS_PER_IST_DAY = 2;
const MIN_APPOINTMENT_GAP_MS = 5 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function appointmentTime(value) {
  if (value instanceof Date) return value.getTime();
  const normalized = String(value || '').replace(' ', 'T');
  const time = new Date(`${normalized}${normalized.endsWith('Z') ? '' : 'Z'}`).getTime();
  return Number.isFinite(time) ? time : null;
}

function istDayWindow(date) {
  const istCalendarTime = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istCalendarTime);
  const start = Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()) - IST_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

function getDailyAppointmentConflict(appointments, patientId, requestedStart) {
  const requestedTime = requestedStart.getTime();
  const { start, end } = istDayWindow(requestedStart);
  const activeForPatientAndDay = appointments.filter((appointment) => {
    if (String(appointment.patient_id) !== String(patientId)) return false;
    if (String(appointment.status || '').toLowerCase() === 'cancelled') return false;
    const time = appointmentTime(appointment.appointment_at);
    return time !== null && time >= start.getTime() && time < end.getTime();
  });

  if (activeForPatientAndDay.length >= MAX_APPOINTMENTS_PER_IST_DAY) {
    return 'You can book no more than 2 appointments per IST calendar day.';
  }
  if (activeForPatientAndDay.length === 1) {
    const existingTime = appointmentTime(activeForPatientAndDay[0].appointment_at);
    if (Math.abs(requestedTime - existingTime) < MIN_APPOINTMENT_GAP_MS) {
      return 'Appointments on the same IST day must start at least 5 hours apart.';
    }
  }
  return null;
}

module.exports = { getDailyAppointmentConflict, istDayWindow };
