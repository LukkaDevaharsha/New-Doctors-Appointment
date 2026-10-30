const nodemailer = require('nodemailer');

let transporter;
function normalizeSmtpPassword(host, password) {
  return String(host).trim().toLowerCase() === 'smtp.gmail.com'
    ? String(password).replace(/\s/g, '')
    : password;
}

function emailErrorDiagnostic(error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(error.code)
    ? error.code
    : 'UNKNOWN';
  const originalCode = typeof error?.originalCode === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(error.originalCode)
    ? error.originalCode
    : undefined;
  const command = typeof error?.command === 'string' ? error.command.toUpperCase() : '';
  let phase = 'smtp_submission';
  if (code === 'SMTP_CONFIG') phase = 'configuration';
  else if (code === 'EAUTH' || /^AUTH(?:\s|$)/.test(command)) phase = 'authentication';
  else if (/TLS|SSL|CERT/.test(`${code} ${originalCode || ''}`) || code === 'EREQUIRETLS') phase = 'tls';
  else if (/^(?:ECONNECTION|ETIMEDOUT|ESOCKET|EDNS)$/.test(code)) phase = 'connection';
  else if (/^MAIL FROM(?:\s|$)/.test(command)) phase = 'sender_rejection';
  else if (/^RCPT TO(?:\s|$)/.test(command)) phase = 'recipient_rejection';
  else if (/^DATA(?:\s|$)/.test(command)) phase = 'message_submission';

  const responseCode = Number(error?.responseCode);
  const timeoutType = ['CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'UPGRADE_TIMEOUT', 'SOCKET_TIMEOUT'].includes(error?.timeoutType)
    ? error.timeoutType
    : undefined;
  return {
    phase,
    code,
    ...(Number.isInteger(responseCode) && responseCode >= 100 && responseCode <= 599 ? { responseCode } : {}),
    ...(originalCode ? { originalCode } : {}),
    ...(timeoutType ? { timeoutType } : {}),
  };
}

function setTransporterForTests(value) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test transport injection is disabled');
  transporter = value;
}
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM || !Number.isInteger(Number(SMTP_PORT)) || !['true', 'false'].includes(String(SMTP_SECURE).toLowerCase())) {
    const error = new Error('SMTP email configuration is incomplete');
    error.code = 'SMTP_CONFIG';
    throw error;
  }
  // Google displays App Passwords in groups; remove formatting whitespace before SMTP auth.
  const smtpPassword = normalizeSmtpPassword(SMTP_HOST, SMTP_PASSWORD);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST.trim(),
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER.trim(), pass: smtpPassword },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
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
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') console.info('Development verification email accepted by mock transport.');
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

module.exports = { sendVerificationEmail, sendAppointmentRescheduledEmail, sendPasswordResetEmail, sendAppointmentCancelledEmail, sendAppointmentBookedEmail, setTransporterForTests, emailErrorDiagnostic, normalizeSmtpPassword };
