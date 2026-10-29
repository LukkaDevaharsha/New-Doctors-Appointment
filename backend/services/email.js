const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM) throw new Error('SMTP email configuration is required');
  transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: String(SMTP_SECURE).toLowerCase() === 'true', auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  return transporter;
}

async function sendVerificationEmail(email, token) {
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173';
  const link = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Doctor Appointment System <no-reply@localhost>',
    to: email,
    subject: 'Verify your email address',
    text: `Complete your account verification using this one-time link (expires in 24 hours):\n\n${link}\n`,
  });
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') console.info('Development verification email accepted by mock transport for:', email);
}

async function sendAppointmentRescheduledEmail(email, appointmentDate, reason) {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return;
  const date = new Date(appointmentDate).toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Doctor Appointment System <no-reply@localhost>',
    to: email,
    subject: 'Your appointment time has changed',
    text: `Your appointment has been rescheduled to ${date}.${reason ? `\n\nReason: ${reason}` : ''}\n\nSign in to your patient portal to review the updated appointment.`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173';
  const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Doctor Appointment System <no-reply@localhost>',
    to: email,
    subject: 'Reset your password',
    text: `Use this one-time link to reset your password. It expires in 30 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
  });
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') console.info('Development password reset email accepted by mock transport for:', email);
}

async function sendAppointmentCancelledEmail(email, appointmentDate, reason) {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return;
  const date = new Date(appointmentDate).toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Doctor Appointment System <no-reply@localhost>',
    to: email,
    subject: 'Your appointment was cancelled',
    text: `The appointment scheduled for ${date} was cancelled.${reason ? `\n\nReason: ${reason}` : ''}\n\nSign in to your portal if you need to arrange another visit.`,
  });
}

async function sendAppointmentBookedEmail(email, appointmentDate, doctorName, audience = 'patient') {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return;
  const date = new Date(appointmentDate).toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const patientText = `Your appointment with ${doctorName} is booked for ${date}. Sign in to your patient portal to review the details.`;
  const doctorText = `A new patient appointment is scheduled for ${date}. Sign in to your practice portal to review the authorized appointment details.`;
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'Doctor Appointment System <no-reply@localhost>',
    to: email,
    subject: 'Appointment booked',
    text: audience === 'doctor' ? doctorText : patientText,
  });
}

module.exports = { sendVerificationEmail, sendAppointmentRescheduledEmail, sendPasswordResetEmail, sendAppointmentCancelledEmail, sendAppointmentBookedEmail };
