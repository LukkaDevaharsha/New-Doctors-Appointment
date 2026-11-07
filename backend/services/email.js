const { sendTransactionalEmail, validateEmailConfiguration, safeDiagnostic, setFetchForTests, escapeHtml } = require('./brevo');

let transporter;
function emailErrorDiagnostic(error) {
  return safeDiagnostic(error);
}

function setTransporterForTests(value) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test transport injection is disabled');
  transporter = value;
}
function getTransporter() {
  if (transporter) return transporter;
  transporter = { sendMail: ({ to, subject, text, html }) => sendTransactionalEmail({ email: to, subject, text, html }) };
  return transporter;
}

async function sendVerificationEmail(email, token, name = 'there') {
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173';
  const link = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name || 'there');
  const safeLink = escapeHtml(link);
  await getTransporter().sendMail({
    to: email,
    subject: 'Verify your email address',
    text: `Hello ${name || 'there'},\n\nPlease verify your Doctors Appointment account using this one-time link (expires in 24 hours):\n\n${link}\n\nIf you did not request this account, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#f3f7f8;font-family:Arial,sans-serif;color:#18323b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="background:#087f8c;padding:28px 36px;color:#fff;font-size:21px;font-weight:bold">Doctors Appointment</td></tr><tr><td style="padding:36px"><p style="font-size:17px">Hello ${safeName},</p><p>Thank you for creating an account. Verify your email address to finish setting up your account.</p><p style="text-align:center;padding:18px"><a href="${safeLink}" style="display:inline-block;background:#087f8c;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold">Verify email address</a></p><p>This link expires in <strong>24 hours</strong>. If the button does not work, copy this link into your browser:</p><p style="overflow-wrap:anywhere"><a href="${safeLink}" style="color:#087f8c">${safeLink}</a></p><p style="font-size:13px;color:#52666d;border-top:1px solid #e5edef;padding-top:20px">If you did not request this account, you can ignore this email. Your email address will not be verified.</p></td></tr></table></td></tr></table></body></html>`,
  });
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') console.info('Development verification email accepted by mock transport.');
}

async function sendAppointmentRescheduledEmail(email, appointmentDate, reason) {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return;
  const date = new Date(appointmentDate).toLocaleString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  await getTransporter().sendMail({
    to: email,
    subject: 'Your appointment time has changed',
    text: `Your appointment has been rescheduled to ${date}.${reason ? `\n\nReason: ${reason}` : ''}\n\nSign in to your patient portal to review the updated appointment.`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const origin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:5173';
  const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await getTransporter().sendMail({
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
    to: email,
    subject: 'Appointment booked',
    text: audience === 'doctor' ? doctorText : patientText,
  });
}

module.exports = { sendTransactionalEmail, sendVerificationEmail, sendAppointmentRescheduledEmail, sendPasswordResetEmail, sendAppointmentCancelledEmail, sendAppointmentBookedEmail, setTransporterForTests, emailErrorDiagnostic, validateEmailConfiguration, setBrevoFetchForTests: setFetchForTests };
