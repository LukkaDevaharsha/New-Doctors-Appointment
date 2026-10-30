const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const auth = require('../middleware/auth');
const { requireRole, requireVerified } = require('../middleware/auth');
const { sendVerificationEmail, sendAppointmentRescheduledEmail, sendPasswordResetEmail, sendAppointmentCancelledEmail, sendAppointmentBookedEmail, emailErrorDiagnostic } = require('../services/email');
const { getDailyAppointmentConflict, istDayWindow } = require('../services/appointmentBookingRules');
const createRateLimit = require('../middleware/rateLimit');

const router = express.Router();
const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resendRateLimit = createRateLimit({ windowMs: Number(process.env.RESEND_IP_WINDOW_MS) || 15 * 60 * 1000, max: Number(process.env.RESEND_IP_MAX) || 10, message: 'Too many verification requests from this connection. Please wait before trying again.' });
const resendEmailRateLimit = createRateLimit({ windowMs: Number(process.env.RESEND_EMAIL_WINDOW_MS) || 60 * 60 * 1000, max: Number(process.env.RESEND_EMAIL_MAX) || 3, keyGenerator: (req) => crypto.createHash('sha256').update(String(req.body?.email || '').trim().toLowerCase()).digest('hex'), message: 'Too many verification emails were requested for this address. Please wait before trying again.' });
const passwordResetRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_DOCUMENT_SIZE_BYTES) || 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) });
const privateRoot = path.resolve(process.env.PRIVATE_STORAGE_DIR || path.join(__dirname, '..', 'private-uploads'));
const tokenDigest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
const sqlId = (value) => String(value);
const validPassword = (value) => typeof value === 'string' && value.length >= 10 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
const validPhone = (value) => typeof value === 'string' && /^\+?[0-9 ()-]{7,24}$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
const db = (req) => req.app.locals.pool;
const fail = (res, error, label) => {
  if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This record already exists or the appointment time is unavailable' });
  console.error(label, { code: error?.code || 'UNKNOWN', name: error?.name || 'Error' });
  return res.status(500).json({ message: 'The request could not be completed' });
};
function idParam(req, res, next) {
  if (!validId(req.params.id || req.params.patientId || req.params.doctorId)) return res.status(400).json({ message: 'Invalid ID' });
  next();
}
function userView(row) {
  if (!row) return null;
  const result = { _id: String(row.id), id: String(row.id), role: row.role, name: row.name, email: row.email, contactNumber: row.contact_number, age: row.age, gender: row.gender, emailVerified: Boolean(row.email_verified), imageId: row.image_storage_id };
  if (row.address) result.address = row.address;
  if (row.role === 'doctor') Object.assign(result, {
    specialization: row.specialization, hospitalName: row.hospital_name, qualifications: row.qualifications || '',
    yearsExperience: row.years_experience ?? '', registrationNumber: row.registration_number || '', biography: row.biography || '',
    languages: jsonArray(row.languages_json), expertise: jsonArray(row.expertise_json), consultationFee: row.consultation_fee ?? '',
    clinicAddress: row.clinic_address || '', city: row.city || '', stateRegion: row.state_region || '', postalCode: row.postal_code || '',
    consultationModes: jsonArray(row.consultation_modes_json),
  });
  return result;
}
function doctorView(row) {
  return {
    _id: String(row.id), id: String(row.id), name: row.name, specialization: row.specialization || '', hospitalName: row.hospital_name,
    hospital: row.hospital_name, avgRating: row.avg_rating || 0, totalRating: row.total_rating || 0, totalPatients: row.total_patients || 0,
    photo: row.photo || (row.image_storage_id ? `/api/doctors/${row.id}/photo` : null), experience: row.years_experience ?? row.experience ?? null, qualifications: row.qualifications || '',
    clinicAddress: row.clinic_address || '', city: row.city || '', stateRegion: row.state_region || '', postalCode: row.postal_code || '',
    yearsExperience: row.years_experience ?? row.experience ?? null, biography: row.biography || '', expertise: jsonArray(row.expertise_json),
    consultationFee: row.consultation_fee ?? null, consultationModes: jsonArray(row.consultation_modes_json), languages: jsonArray(row.languages_json),
  };
}
function jsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function appointmentView(row) {
  const appointmentDate = row.appointment_at instanceof Date
    ? row.appointment_at
    : new Date(`${String(row.appointment_at).replace(' ', 'T')}Z`);
  return { _id: String(row.id), id: String(row.id), doctorId: String(row.doctor_id), patientId: String(row.patient_id), date: appointmentDate.toISOString(), status: row.status, createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined, doctorName: row.doctor_name, patientName: row.patient_name, visitReason: row.visit_reason || '', patientContactNumber: row.patient_contact_number || '', paymentMethod: row.payment_method || 'pay_at_hospital', paymentStatus: row.payment_status || 'pending' };
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 16) !== value.slice(0, 16) || date.getUTCMinutes() % 30 !== 0 || date.getTime() <= Date.now()) return null;
  return date;
}
function sqlDate(date) { return date.toISOString().slice(0, 23).replace('T', ' '); }
async function dailyAppointmentConflict(connection, patientId, start, excludedAppointmentId) {
  const { start: dayStart, end: dayEnd } = istDayWindow(start);
  const exclude = excludedAppointmentId ? ' AND id<>?' : '';
  const params = excludedAppointmentId
    ? [patientId, sqlDate(dayStart), sqlDate(dayEnd), excludedAppointmentId]
    : [patientId, sqlDate(dayStart), sqlDate(dayEnd)];
  const [appointments] = await connection.execute(
    `SELECT patient_id,appointment_at,status FROM appointments WHERE patient_id=? AND appointment_at>=? AND appointment_at<? AND status<>'cancelled'${exclude} FOR UPDATE`,
    params,
  );
  return getDailyAppointmentConflict(appointments, patientId, start);
}
async function slotAvailability(connection, doctorId, date, excludedAppointmentId) {
  const stamp = sqlDate(date);
  const [windows] = await connection.execute('SELECT slot_minutes FROM doctor_availability WHERE doctor_id=? AND weekday=DAYOFWEEK(?) - 1 AND TIME(?) >= start_time AND DATE_ADD(TIME(?),INTERVAL slot_minutes MINUTE) <= end_time AND slot_minutes=30 LIMIT 1', [doctorId, stamp, stamp, stamp]);
  if (!windows.length) return 'unavailable';
  const [blocks] = await connection.execute('SELECT id FROM doctor_time_blocks WHERE doctor_id=? AND starts_at<DATE_ADD(?,INTERVAL 30 MINUTE) AND ends_at>? LIMIT 1', [doctorId, stamp, stamp]);
  if (blocks.length) return 'unavailable';
  const params = excludedAppointmentId ? [doctorId, stamp, stamp, excludedAppointmentId] : [doctorId, stamp, stamp];
  const exclude = excludedAppointmentId ? ' AND id<>?' : '';
  const [appointments] = await connection.execute(`SELECT id FROM appointments WHERE doctor_id=? AND status IN ('scheduled','completed') AND appointment_at<DATE_ADD(?,INTERVAL 30 MINUTE) AND DATE_ADD(appointment_at,INTERVAL 30 MINUTE)>?${exclude} LIMIT 1`, params);
  return appointments.length ? 'booked' : 'available';
}
function inspectDocument(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: 'png' };
  return null;
}
function inspectImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
async function serveDoctorPhoto(req, res) {
  try {
    const [rows] = await db(req).execute("SELECT image_storage_id FROM users WHERE id=? AND role='doctor' LIMIT 1", [req.params.id]);
    const storageId = rows[0]?.image_storage_id;
    if (!storageId || !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(storageId)) return res.status(404).json({ message: 'Doctor photo not found' });
    const filePath = path.join(privateRoot, storageId);
    if (!(await fs.stat(filePath).catch(() => null))) return res.status(404).json({ message: 'Doctor photo not found' });
    res.set('Cache-Control', 'public, max-age=300');
    return res.sendFile(filePath);
  } catch (error) { return fail(res, error, 'Doctor photo lookup failed'); }
}

router.get('/test-connection', async (req, res) => {
  try { await db(req).query('SELECT 1'); return res.json({ message: 'Successfully connected to MySQL' }); }
  catch (error) { return fail(res, error, 'MySQL ping failed'); }
});

router.get('/doctors/search', async (req, res) => {
  const fields = ['name', 'specialty', 'hospital', 'city', 'location'];
  const input = Object.fromEntries(fields.map((key) => [key, String(req.query[key] || '').trim().slice(0, 100)]));
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 12));
  const sort = ['name', 'experience', 'rating'].includes(req.query.sort) ? req.query.sort : 'name';
  const availableAt = req.query.availableAt ? dateValue(req.query.availableAt) : null;
  if (req.query.availableAt && !availableAt) return res.status(400).json({ message: 'Choose a valid future date and time on a 30-minute boundary' });
  const filters = ["u.role='doctor'"];
  const values = [];
  for (const [key, column] of [['name', 'u.name'], ['specialty', 'u.specialization'], ['hospital', 'u.hospital_name'], ['city', 'u.city']]) {
    if (input[key]) { filters.push(`${column} LIKE ?`); values.push(`%${input[key]}%`); }
  }
  if (input.location) {
    filters.push('(u.clinic_address LIKE ? OR u.city LIKE ? OR u.state_region LIKE ? OR u.postal_code LIKE ?)');
    values.push(...Array(4).fill(`%${input.location}%`));
  }
  if (req.query.mode && ['in-person', 'online'].includes(req.query.mode)) {
    filters.push('JSON_CONTAINS(u.consultation_modes_json, JSON_QUOTE(?))'); values.push(req.query.mode);
  }
  if (availableAt) {
    const slot = sqlDate(availableAt);
    filters.push("EXISTS (SELECT 1 FROM doctor_availability av WHERE av.doctor_id=u.id AND av.weekday=DAYOFWEEK(?) - 1 AND TIME(?) >= av.start_time AND DATE_ADD(TIME(?), INTERVAL av.slot_minutes MINUTE) <= av.end_time)");
    values.push(slot, slot, slot);
    filters.push('NOT EXISTS (SELECT 1 FROM doctor_time_blocks b WHERE b.doctor_id=u.id AND b.starts_at < DATE_ADD(?, INTERVAL 30 MINUTE) AND b.ends_at > ?)'); values.push(slot, slot);
    filters.push("NOT EXISTS (SELECT 1 FROM appointments a WHERE a.doctor_id=u.id AND a.status IN ('scheduled','completed') AND a.active_slot=? )"); values.push(slot);
  }
  const order = sort === 'experience' ? 'u.years_experience DESC,u.name' : sort === 'rating' ? 'avg_rating DESC,u.name' : 'u.name';
  try {
    const [[countRow]] = await db(req).execute(`SELECT COUNT(*) AS total FROM users u WHERE ${filters.join(' AND ')}`, values);
    const [rows] = await db(req).execute(`SELECT u.id,u.name,u.specialization,u.hospital_name,u.image_storage_id,u.qualifications,u.years_experience,u.clinic_address,u.city,u.state_region,u.postal_code,u.consultation_fee,u.consultation_modes_json,u.languages_json,(SELECT AVG(r.rating) FROM doctor_reviews r WHERE r.doctor_id=u.id) AS avg_rating,(SELECT COUNT(*) FROM doctor_reviews r WHERE r.doctor_id=u.id) AS total_rating,(SELECT COUNT(DISTINCT a.patient_id) FROM appointments a WHERE a.doctor_id=u.id) AS total_patients FROM users u WHERE ${filters.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
    return res.json({ doctors: rows.map(doctorView), page, limit, total: Number(countRow.total), pages: Math.ceil(Number(countRow.total) / limit) });
  } catch (error) { return fail(res, error, 'Doctor search failed'); }
});

router.get('/doctors', async (req, res) => {
  try {
    const [rows] = await db(req).execute("SELECT u.id, u.name, u.specialization, u.hospital_name, u.image_storage_id, (SELECT AVG(r.rating) FROM doctor_reviews r WHERE r.doctor_id=u.id) AS avg_rating, (SELECT COUNT(*) FROM doctor_reviews r WHERE r.doctor_id=u.id) AS total_rating, (SELECT COUNT(DISTINCT a.patient_id) FROM appointments a WHERE a.doctor_id=u.id) AS total_patients FROM users u WHERE u.role='doctor' ORDER BY u.name LIMIT 200");
    return res.json(rows.map(doctorView));
  } catch (error) { return fail(res, error, 'Doctor list failed'); }
});
router.get('/doctors/search/:term', async (req, res) => {
  const term = String(req.params.term || '').trim().slice(0, 80);
  if (!term) return res.status(400).json({ message: 'Search term is required' });
  try {
    const pattern = `%${term}%`;
    const [rows] = await db(req).execute("SELECT id, name, specialization, hospital_name, image_storage_id FROM users WHERE role='doctor' AND specialization LIKE ? ORDER BY name LIMIT 50", [pattern]);
    return res.json(rows.map(doctorView));
  } catch (error) { return fail(res, error, 'Doctor search failed'); }
});
router.get('/doctors/:id/reviews', idParam, async (req, res) => {
  try {
    const [rows] = await db(req).execute('SELECT rating, comment, created_at AS createdAt FROM doctor_reviews WHERE doctor_id=? ORDER BY created_at DESC LIMIT 100', [req.params.id]);
    return res.json(rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })));
  } catch (error) { return fail(res, error, 'Doctor reviews lookup failed'); }
});
router.get('/doctors/:id/photo', idParam, serveDoctorPhoto);
router.get('/doctor/profile/:id/photo', idParam, serveDoctorPhoto);
router.get('/doctors/:id/availability', idParam, async (req, res) => {
  const date = String(req.query.date || '');
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return res.status(400).json({ message: 'Choose a valid calendar date' });
  try {
    const [[doctor]] = await db(req).execute("SELECT id FROM users WHERE id=? AND role='doctor' LIMIT 1", [req.params.id]);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const utcDates = [...new Set([dayStart.toISOString().slice(0, 10), new Date(dayEnd.getTime() - 1).toISOString().slice(0, 10)])];
    const utcDays = utcDates.map((utcDate) => ({ date: utcDate, weekday: new Date(`${utcDate}T00:00:00Z`).getUTCDay() }));
    const [windows] = await db(req).execute('SELECT weekday,start_time,end_time,slot_minutes FROM doctor_availability WHERE doctor_id=? AND weekday IN (?,?) ORDER BY weekday,start_time', [req.params.id, ...utcDays.map((day) => day.weekday)]);
    const startOfDay = sqlDate(dayStart);
    const endOfDay = sqlDate(dayEnd);
    const [appointments] = await db(req).execute("SELECT appointment_at FROM appointments WHERE doctor_id=? AND status IN ('scheduled','completed') AND appointment_at>=? AND appointment_at<?", [req.params.id, startOfDay, endOfDay]);
    const [blocks] = await db(req).execute('SELECT starts_at,ends_at FROM doctor_time_blocks WHERE doctor_id=? AND starts_at<? AND ends_at>? ORDER BY starts_at', [req.params.id, endOfDay, startOfDay]);
    const booked = new Set(appointments.map((item) => item.appointment_at instanceof Date ? item.appointment_at.getTime() : new Date(`${String(item.appointment_at).replace(' ', 'T')}Z`).getTime()));
    const blocked = blocks.map((item) => ({ start: item.starts_at instanceof Date ? item.starts_at.getTime() : new Date(`${String(item.starts_at).replace(' ', 'T')}Z`).getTime(), end: item.ends_at instanceof Date ? item.ends_at.getTime() : new Date(`${String(item.ends_at).replace(' ', 'T')}Z`).getTime() }));
    const slots = [];
    let eligible = 0;
    for (const day of utcDays) for (const window of windows.filter((item) => Number(item.weekday) === day.weekday)) {
      const startTime = String(window.start_time).slice(0, 5);
      const endTime = String(window.end_time).slice(0, 5);
      const start = Date.parse(`${day.date}T${startTime === '24:00' ? '00:00' : startTime}:00Z`) + (startTime === '24:00' ? 24 * 60 * 60 * 1000 : 0);
      const end = Date.parse(`${day.date}T${endTime === '24:00' ? '00:00' : endTime}:00Z`) + (endTime === '24:00' ? 24 * 60 * 60 * 1000 : 0);
      for (let time = start; time + Number(window.slot_minutes) * 60000 <= end; time += Number(window.slot_minutes) * 60000) {
        if (time < dayStart.getTime() || time >= dayEnd.getTime()) continue;
        const isBlocked = blocked.some((range) => time < range.end && time + Number(window.slot_minutes) * 60000 > range.start);
        if (time > Date.now() && !isBlocked) eligible += 1;
        const status = time <= Date.now() || isBlocked ? 'unavailable' : booked.has(time) ? 'booked' : 'available';
        slots.push({ startsAt: new Date(time).toISOString(), status });
      }
    }
    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const status = slots.some((slot) => slot.status === 'available') ? 'available' : eligible > 0 ? 'fully-booked' : 'unavailable';
    return res.json({ date, timezone: 'UTC', status, slots });
  } catch (error) { return fail(res, error, 'Doctor availability lookup failed'); }
});
router.get('/doctors/:id', idParam, async (req, res) => {
  try {
    const [rows] = await db(req).execute("SELECT id,name,specialization,hospital_name,image_storage_id,qualifications,years_experience,biography,expertise_json,clinic_address,city,state_region,postal_code,consultation_fee,consultation_modes_json,languages_json,(SELECT AVG(rating) FROM doctor_reviews WHERE doctor_id=users.id) AS avg_rating,(SELECT COUNT(*) FROM doctor_reviews WHERE doctor_id=users.id) AS total_rating FROM users WHERE id=? AND role='doctor' LIMIT 1", [req.params.id]);
    return rows[0] ? res.json(doctorView(rows[0])) : res.status(404).json({ message: 'Doctor not found' });
  } catch (error) { return fail(res, error, 'Doctor lookup failed'); }
});
router.post('/doctors/:id/reviews', auth, requireRole('patient'), requireVerified, idParam, async (req, res) => {
  const { appointmentId, rating, comment } = req.body || {};
  if (!validId(String(appointmentId || '')) || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || comment.trim().length < 8 || comment.trim().length > 2000) return res.status(400).json({ message: 'Provide a completed appointment, a 1-5 rating, and a comment of 8-2000 characters' });
  try {
    const [rows] = await db(req).execute("SELECT id FROM appointments WHERE id=? AND doctor_id=? AND patient_id=? AND appointment_at<=UTC_TIMESTAMP(3) AND status='completed' LIMIT 1", [appointmentId, req.params.id, req.user.userId]);
    if (!rows.length) return res.status(403).json({ message: 'A completed appointment with this doctor is required to leave a review' });
    await db(req).execute('INSERT INTO doctor_reviews (appointment_id, doctor_id, patient_id, rating, comment) VALUES (?,?,?,?,?)', [appointmentId, req.params.id, req.user.userId, rating, comment.trim()]);
    return res.status(201).json({ message: 'Thank you for your feedback' });
  } catch (error) { return fail(res, error, 'Doctor review submission failed'); }
});

router.post('/register', authRateLimit, imageUpload.single('image'), async (req, res) => {
  const { role, name, email, password, contactNumber, age, gender } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!['patient', 'doctor'].includes(role)) return res.status(400).json({ message: 'Choose a valid account type' });
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return res.status(400).json({ message: 'Enter a valid name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (!validPassword(password)) return res.status(400).json({ message: 'Password must be 10–128 characters and include uppercase, lowercase, number, and symbol characters' });
  if (!validPhone(String(contactNumber || '').trim())) return res.status(400).json({ message: 'Enter a valid contact number' });
  if (!req.file) return res.status(400).json({ message: 'A JPEG, PNG, or WebP profile image is required' });
  const profileImageType = inspectImage(req.file.buffer);
  if (!profileImageType || `image/${profileImageType === 'jpg' ? 'jpeg' : profileImageType}` !== req.file.mimetype) return res.status(400).json({ message: 'The uploaded file is not a valid JPEG, PNG, or WebP image' });
  if (!Number.isInteger(Number(age)) || Number(age) < 1 || Number(age) > 120) return res.status(400).json({ message: 'Enter a valid age' });
  if (!['female', 'male', 'other', 'prefer-not-to-say'].includes(String(gender || '').trim().toLowerCase())) return res.status(400).json({ message: 'Choose a valid gender option' });
  if (role === 'doctor' && (typeof req.body.specialization !== 'string' || req.body.specialization.trim().length < 2 || req.body.specialization.trim().length > 150 || typeof req.body.hospitalName !== 'string' || req.body.hospitalName.trim().length < 2 || req.body.hospitalName.trim().length > 180)) return res.status(400).json({ message: 'Enter a valid specialization and hospital or clinic name' });
  if (role === 'patient' && (typeof req.body.address !== 'string' || req.body.address.trim().length < 3 || req.body.address.trim().length > 500)) return res.status(400).json({ message: 'Enter a valid address' });
  const token = crypto.randomBytes(32).toString('hex');
  const storageId = `${crypto.randomUUID()}.${req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg'}`;
  try {
    await fs.mkdir(privateRoot, { recursive: true });
    await fs.writeFile(path.join(privateRoot, storageId), req.file.buffer, { flag: 'wx', mode: 0o600 });
    const values = [role, name.trim(), normalizedEmail, await bcrypt.hash(password, 12), String(contactNumber || '').trim(), Number(age), String(gender || '').trim(), role === 'patient' ? String(req.body.address).trim() : null, role === 'doctor' ? String(req.body.specialization).trim() : null, role === 'doctor' ? String(req.body.hospitalName).trim() : null, storageId, tokenDigest(token), new Date(Date.now() + 24 * 60 * 60 * 1000)];
    const [result] = await db(req).execute('INSERT INTO users (role,name,email,password_hash,contact_number,age,gender,address,specialization,hospital_name,image_storage_id,email_verified,verification_token_hash,verification_expires_at,verification_sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,FALSE,?,?,UTC_TIMESTAMP(3))', values);
    let verificationEmailSent = true;
    try { await sendVerificationEmail(normalizedEmail, token); }
    catch (error) {
      verificationEmailSent = false;
      await db(req).execute('UPDATE users SET verification_token_hash=NULL,verification_expires_at=NULL,verification_sent_at=NULL WHERE id=? AND verification_token_hash=?', [result.insertId, tokenDigest(token)]).catch(() => {});
      console.error('Verification email delivery failed after account creation:', emailErrorDiagnostic(error));
    }
    return res.status(201).json({ success: true, verificationEmailSent, message: verificationEmailSent ? 'Account created. Check your email to verify it.' : 'Account created, but the verification email could not be sent. Use the resend form to try again.', userId: String(result.insertId) });
  } catch (error) {
    await fs.unlink(path.join(privateRoot, storageId)).catch(() => {});
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with this email address already exists' });
    return fail(res, error, 'Registration failed');
  }
});

router.post('/email/verify', async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
  try {
    const [result] = await db(req).execute('UPDATE users SET email_verified=TRUE, verification_token_hash=NULL, verification_expires_at=NULL, verification_sent_at=NULL WHERE verification_token_hash=? AND verification_expires_at>UTC_TIMESTAMP(3) AND email_verified=FALSE', [tokenDigest(token)]);
    return result.affectedRows ? res.json({ message: 'Your email has been verified. You can now sign in.' }) : res.status(400).json({ message: 'This verification link is invalid, expired, or already used.' });
  } catch (error) { return fail(res, error, 'Email verification failed'); }
});
router.post('/email/resend', resendRateLimit, resendEmailRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const generic = { message: 'If an account needs verification, a new email will be sent shortly.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic);
  try {
    const [rows] = await db(req).execute("SELECT id,email FROM users WHERE email=? AND role IN ('patient','doctor') AND email_verified=FALSE LIMIT 1", [email]);
    if (!rows.length) return res.json(generic);
    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await db(req).execute('UPDATE users SET verification_token_hash=?,verification_expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 24 HOUR),verification_sent_at=UTC_TIMESTAMP(3) WHERE id=? AND email_verified=FALSE AND (verification_sent_at IS NULL OR verification_sent_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 60 SECOND))', [tokenDigest(token), rows[0].id]);
    if (result.affectedRows) {
      try { await sendVerificationEmail(rows[0].email, token); }
      catch (error) {
        await db(req).execute('UPDATE users SET verification_token_hash=NULL,verification_expires_at=NULL,verification_sent_at=NULL WHERE id=? AND verification_token_hash=?', [rows[0].id, tokenDigest(token)]).catch(() => {});
        console.error('Verification resend delivery failed:', emailErrorDiagnostic(error));
        return res.status(503).json({ message: 'The verification email could not be sent right now. Please try again shortly.' });
      }
    }
    return res.json(generic);
  } catch (error) { return fail(res, error, 'Verification email resend failed'); }
});

router.post('/password/forgot', passwordResetRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const generic = { message: 'If an account matches that email, password reset instructions will be sent shortly.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic);
  try {
    const [accounts] = await db(req).execute('SELECT id,email FROM users WHERE email=? LIMIT 1', [email]);
    if (!accounts.length) return res.json(generic);
    const token = crypto.randomBytes(32).toString('hex');
    const [updated] = await db(req).execute('UPDATE users SET password_reset_token_hash=?,password_reset_expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE),password_reset_sent_at=UTC_TIMESTAMP(3) WHERE id=? AND (password_reset_sent_at IS NULL OR password_reset_sent_at<=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 60 SECOND))', [tokenDigest(token), accounts[0].id]);
    if (updated.affectedRows) {
      try { await sendPasswordResetEmail(accounts[0].email, token); }
      catch (emailError) { console.error('Password reset delivery failed:', emailError?.message || emailError); }
    }
    return res.json(generic);
  } catch (error) { return fail(res, error, 'Password reset request failed'); }
});

router.post('/password/reset', passwordResetRateLimit, async (req, res) => {
  const token = req.body?.token;
  const password = req.body?.password;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ message: 'This password reset link is invalid or expired.' });
  if (!validPassword(password)) return res.status(400).json({ message: 'Password must be 10–128 characters and include uppercase, lowercase, number, and symbol characters' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db(req).execute('UPDATE users SET password_hash=?,auth_version=auth_version+1,password_reset_token_hash=NULL,password_reset_expires_at=NULL,password_reset_sent_at=NULL,updated_at=UTC_TIMESTAMP(3) WHERE password_reset_token_hash=? AND password_reset_expires_at>UTC_TIMESTAMP(3)', [passwordHash, tokenDigest(token)]);
    return result.affectedRows ? res.json({ message: 'Password updated. Sign in with your new password.' }) : res.status(400).json({ message: 'This password reset link is invalid, expired, or already used.' });
  } catch (error) { return fail(res, error, 'Password reset failed'); }
});

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!['patient', 'doctor', 'admin'].includes(role) || typeof password !== 'string') return res.status(401).json({ message: 'Invalid credentials' });
  try {
    const [rows] = await db(req).execute('SELECT * FROM users WHERE email=? AND role=? LIMIT 1', [String(email || '').trim().toLowerCase(), role]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) return res.status(401).json({ message: 'Invalid credentials' });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ message: 'Authentication is not configured' });
    const emailVerified = Boolean(user.email_verified);
    const token = require('jsonwebtoken').sign({ userId: String(user.id), email: user.email, role: user.role, emailVerified, authVersion: Number(user.auth_version || 0) }, process.env.JWT_SECRET, { expiresIn: '1h', issuer: 'doctor-appointment-system', audience: 'doctor-appointment-client' });
    return res.json({ token, userId: String(user.id), role: user.role, email: user.email, name: user.name, emailVerified });
  } catch (error) { return fail(res, error, 'Login failed'); }
});

router.get('/user/:id', auth, requireVerified, idParam, async (req, res) => {
  if (String(req.user.userId) !== req.params.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const [rows] = await db(req).execute('SELECT * FROM users WHERE id=? LIMIT 1', [req.params.id]);
    return rows[0] ? res.json(userView(rows[0])) : res.status(404).json({ message: 'User not found' });
  } catch (error) { return fail(res, error, 'Account lookup failed'); }
});
router.get('/doctor/profile/:id', auth, requireVerified, idParam, async (req, res) => {
  if (req.user.role !== 'doctor' || req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  try {
    const [rows] = await db(req).execute('SELECT * FROM users WHERE id=? AND role=\'doctor\' LIMIT 1', [req.params.id]);
    return rows[0] ? res.json(userView(rows[0])) : res.status(404).json({ message: 'Doctor not found' });
  } catch (error) { return fail(res, error, 'Doctor profile lookup failed'); }
});
router.put('/doctor/profile/:id/photo', auth, requireRole('doctor'), requireVerified, idParam, imageUpload.single('image'), async (req, res) => {
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  if (!req.file) return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP image no larger than 3 MB' });
  const extension = inspectImage(req.file.buffer);
  if (!extension || `image/${extension === 'jpg' ? 'jpeg' : extension}` !== req.file.mimetype) return res.status(400).json({ message: 'The uploaded file is not a valid JPEG, PNG, or WebP image' });
  const storageId = `${crypto.randomUUID()}.${extension}`;
  try {
    await fs.mkdir(privateRoot, { recursive: true });
    await fs.writeFile(path.join(privateRoot, storageId), req.file.buffer, { flag: 'wx', mode: 0o600 });
    const [rows] = await db(req).execute("SELECT image_storage_id FROM users WHERE id=? AND role='doctor' LIMIT 1", [req.params.id]);
    if (!rows.length) { await fs.unlink(path.join(privateRoot, storageId)).catch(() => {}); return res.status(404).json({ message: 'Doctor not found' }); }
    await db(req).execute("UPDATE users SET image_storage_id=?,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND role='doctor'", [storageId, req.params.id]);
    const oldId = rows[0].image_storage_id;
    if (oldId && /^[a-f0-9-]+\.(jpg|png|webp)$/i.test(oldId)) await fs.unlink(path.join(privateRoot, oldId)).catch(() => {});
    return res.json({ message: 'Profile photo updated' });
  } catch (error) { await fs.unlink(path.join(privateRoot, storageId)).catch(() => {}); return fail(res, error, 'Doctor profile photo update failed'); }
});
router.put('/doctor/update/:id', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  const allowed = ['name', 'contactNumber', 'specialization', 'hospitalName', 'qualifications', 'registrationNumber', 'biography', 'clinicAddress', 'city', 'stateRegion', 'postalCode'];
  const limits = { name: 100, contactNumber: 40, specialization: 150, hospitalName: 180, qualifications: 500, registrationNumber: 120, biography: 5000, clinicAddress: 500, city: 120, stateRegion: 120, postalCode: 24 };
  const input = Object.fromEntries(Object.entries(req.body || {}).filter(([key, value]) => allowed.includes(key) && typeof value === 'string').map(([key, value]) => [key, value.trim().slice(0, limits[key])]));
  for (const key of ['name', 'specialization', 'hospitalName']) if (input[key] !== undefined && input[key].length < 2) return res.status(400).json({ message: `${key} must contain at least 2 characters` });
  if (input.contactNumber !== undefined && input.contactNumber && !validPhone(input.contactNumber)) return res.status(400).json({ message: 'Enter a valid clinic contact number' });
  if (req.body?.yearsExperience !== undefined) {
    const number = Number(req.body.yearsExperience);
    if (!Number.isInteger(number) || number < 0 || number > 80) return res.status(400).json({ message: 'Years of experience must be between 0 and 80' });
    input.yearsExperience = number;
  }
  if (req.body?.consultationFee !== undefined) {
    const number = Number(req.body.consultationFee);
    if (!Number.isFinite(number) || number < 0 || number > 1000000) return res.status(400).json({ message: 'Enter a valid consultation fee' });
    input.consultationFee = number;
  }
  for (const key of ['languages', 'expertise', 'consultationModes']) {
    if (req.body?.[key] !== undefined) {
      const value = req.body[key];
      if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== 'string' || item.trim().length > 100)) return res.status(400).json({ message: `Invalid ${key}` });
      input[key] = JSON.stringify([...new Set(value.map((item) => item.trim()).filter(Boolean))]);
    }
  }
  if (!Object.keys(input).length) return res.status(400).json({ message: 'No valid profile fields provided' });
  const column = { name: 'name', contactNumber: 'contact_number', specialization: 'specialization', hospitalName: 'hospital_name', qualifications: 'qualifications', registrationNumber: 'registration_number', biography: 'biography', yearsExperience: 'years_experience', languages: 'languages_json', expertise: 'expertise_json', consultationFee: 'consultation_fee', clinicAddress: 'clinic_address', city: 'city', stateRegion: 'state_region', postalCode: 'postal_code', consultationModes: 'consultation_modes_json' };
  try {
    await db(req).execute(`UPDATE users SET ${Object.keys(input).map((key) => `${column[key]}=?`).join(',')},updated_at=UTC_TIMESTAMP(3) WHERE id=? AND role='doctor'`, [...Object.values(input), req.params.id]);
    return res.json({ message: 'Doctor profile updated successfully' });
  } catch (error) { return fail(res, error, 'Doctor profile update failed'); }
});

router.put('/patient/update/:id', auth, requireRole('patient'), requireVerified, idParam, async (req, res) => {
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  const allowed = { name: ['name', 100], contactNumber: ['contact_number', 40], address: ['address', 500], gender: ['gender', 40] };
  const input = Object.fromEntries(Object.entries(req.body || {}).filter(([key, value]) => allowed[key] && typeof value === 'string').map(([key, value]) => [key, value.trim().slice(0, allowed[key][1])]));
  if (input.name !== undefined && input.name.length < 2) return res.status(400).json({ message: 'Name must contain at least 2 characters' });
  if (input.address !== undefined && input.address.length < 3) return res.status(400).json({ message: 'Enter a more complete address' });
  if (input.contactNumber !== undefined && !validPhone(input.contactNumber)) return res.status(400).json({ message: 'Enter a valid contact number' });
  if (req.body?.age !== undefined) {
    const age = Number(req.body.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ message: 'Enter an age between 1 and 120' });
    input.age = age;
  }
  if (!Object.keys(input).length) return res.status(400).json({ message: 'No valid profile fields provided' });
  const columns = { name: 'name', contactNumber: 'contact_number', address: 'address', gender: 'gender', age: 'age' };
  try {
    await db(req).execute(`UPDATE users SET ${Object.keys(input).map((key) => `${columns[key]}=?`).join(',')},updated_at=UTC_TIMESTAMP(3) WHERE id=? AND role='patient'`, [...Object.values(input), req.params.id]);
    return res.json({ message: 'Patient profile updated successfully' });
  } catch (error) { return fail(res, error, 'Patient profile update failed'); }
});

router.get('/doctor/availability/:id', auth, requireVerified, idParam, async (req, res) => {
  if (req.user.role !== 'doctor' || req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  try {
    const [windows] = await db(req).execute('SELECT id,weekday,start_time,end_time,slot_minutes FROM doctor_availability WHERE doctor_id=? ORDER BY weekday,start_time', [req.params.id]);
    const [blocks] = await db(req).execute('SELECT id,starts_at,ends_at,reason FROM doctor_time_blocks WHERE doctor_id=? AND ends_at>UTC_TIMESTAMP(3) ORDER BY starts_at LIMIT 100', [req.params.id]);
    return res.json({ timezone: 'UTC', windows, blocks: blocks.map((block) => ({ ...block, startsAt: block.starts_at instanceof Date ? block.starts_at.toISOString() : new Date(`${String(block.starts_at).replace(' ', 'T')}Z`).toISOString(), endsAt: block.ends_at instanceof Date ? block.ends_at.toISOString() : new Date(`${String(block.ends_at).replace(' ', 'T')}Z`).toISOString() })) });
  } catch (error) { return fail(res, error, 'Doctor availability management lookup failed'); }
});

router.put('/doctor/availability/:id', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  const windows = req.body?.windows;
  if (!Array.isArray(windows) || windows.length > 35) return res.status(400).json({ message: 'Provide weekly availability windows' });
  const normalized = [];
  for (const item of windows) {
    const weekday = Number(item.weekday);
    const slotMinutes = Number(item.slotMinutes || 30);
    const startTime = String(item.startTime || '');
    const endTime = String(item.endTime || '');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) && endTime !== '24:00' || startTime >= endTime || slotMinutes !== 30) return res.status(400).json({ message: 'Each window needs a valid weekday, time range, and a 30-minute appointment duration' });
    normalized.push({ weekday, startTime, endTime, slotMinutes });
  }
  for (let i = 0; i < normalized.length; i++) for (let j = i + 1; j < normalized.length; j++) {
    if (normalized[i].weekday === normalized[j].weekday && normalized[i].startTime < normalized[j].endTime && normalized[i].endTime > normalized[j].startTime) return res.status(400).json({ message: 'Availability windows on the same day cannot overlap' });
  }
  const connection = await db(req).getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM users WHERE id=? AND role=\'doctor\' FOR UPDATE', [req.params.id]);
    const [appointments] = await connection.execute("SELECT appointment_at FROM appointments WHERE doctor_id=? AND status='scheduled' AND appointment_at>UTC_TIMESTAMP(3)", [req.params.id]);
    const removesBookedAvailability = appointments.some((item) => {
      const appointmentAt = item.appointment_at instanceof Date ? item.appointment_at : new Date(`${String(item.appointment_at).replace(' ', 'T')}Z`);
      const weekday = appointmentAt.getUTCDay();
      const time = `${String(appointmentAt.getUTCHours()).padStart(2, '0')}:${String(appointmentAt.getUTCMinutes()).padStart(2, '0')}`;
      const slotEnd = new Date(appointmentAt.getTime() + 30 * 60000);
      const endTime = `${String(slotEnd.getUTCHours()).padStart(2, '0')}:${String(slotEnd.getUTCMinutes()).padStart(2, '0')}`;
      return !normalized.some((window) => window.weekday === weekday && time >= window.startTime && endTime <= window.endTime);
    });
    if (removesBookedAvailability) { await connection.rollback(); return res.status(409).json({ message: 'Working hours cannot be removed while scheduled appointments remain in those periods' }); }
    await connection.execute('DELETE FROM doctor_availability WHERE doctor_id=?', [req.params.id]);
    for (const item of normalized) await connection.execute('INSERT INTO doctor_availability (doctor_id,weekday,start_time,end_time,slot_minutes) VALUES (?,?,?,?,?)', [req.params.id, item.weekday, item.startTime, item.endTime, item.slotMinutes]);
    await connection.commit();
    return res.json({ message: 'Weekly availability saved', windows: normalized, timezone: 'UTC' });
  } catch (error) { await connection.rollback(); return fail(res, error, 'Doctor availability update failed'); }
  finally { connection.release(); }
});

router.post('/doctor/availability/:id/blocks', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  const start = new Date(req.body?.startsAt);
  const end = new Date(req.body?.endsAt);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 240) : '';
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || end <= start || end - start > 90 * 86400000) return res.status(400).json({ message: 'Choose a future block period of no more than 90 days' });
  const connection = await db(req).getConnection();
  try {
    await connection.beginTransaction();
    const [doctors] = await connection.execute("SELECT id FROM users WHERE id=? AND role='doctor' FOR UPDATE", [req.params.id]);
    if (!doctors.length) { await connection.rollback(); return res.status(404).json({ message: 'Doctor not found' }); }
    const [booked] = await connection.execute("SELECT id FROM appointments WHERE doctor_id=? AND status='scheduled' AND appointment_at<? AND DATE_ADD(appointment_at,INTERVAL 30 MINUTE)>? LIMIT 1", [req.params.id, sqlDate(end), sqlDate(start)]);
    if (booked.length) { await connection.rollback(); return res.status(409).json({ message: 'This block overlaps a scheduled appointment' }); }
    const [result] = await connection.execute('INSERT INTO doctor_time_blocks (doctor_id,starts_at,ends_at,reason) VALUES (?,?,?,?)', [req.params.id, sqlDate(start), sqlDate(end), reason]);
    await connection.commit();
    return res.status(201).json({ message: 'Time blocked', id: String(result.insertId) });
  } catch (error) { await connection.rollback(); return fail(res, error, 'Doctor time block failed'); }
  finally { connection.release(); }
});
router.delete('/doctor/availability/:id/blocks/:blockId', auth, requireRole('doctor'), requireVerified, async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.blockId)) return res.status(400).json({ message: 'Invalid ID' });
  if (req.user.userId !== req.params.id) return res.status(403).json({ message: 'Access denied' });
  try {
    const [result] = await db(req).execute('DELETE FROM doctor_time_blocks WHERE id=? AND doctor_id=?', [req.params.blockId, req.params.id]);
    return result.affectedRows ? res.json({ message: 'Time block removed' }) : res.status(404).json({ message: 'Time block not found' });
  } catch (error) { return fail(res, error, 'Doctor time block removal failed'); }
});

async function listAppointments(req, ownerColumn, ownerId, subjectColumn) {
  const subjectName = subjectColumn === 'doctor_id' ? 'd.name AS doctor_name' : 'p.name AS patient_name';
  const join = subjectColumn === 'doctor_id' ? 'JOIN users d ON d.id=a.doctor_id' : 'JOIN users p ON p.id=a.patient_id';
  const [rows] = await db(req).execute(`SELECT a.id,a.doctor_id,a.patient_id,a.appointment_at,a.status,a.created_at,a.visit_reason,a.patient_contact_number,a.payment_method,a.payment_status,${subjectName} FROM appointments a ${join} WHERE a.${ownerColumn}=? ORDER BY a.appointment_at`, [ownerId]);
  return rows.map(appointmentView);
}
router.get('/appointments', auth, requireVerified, async (req, res) => {
  if (!['patient', 'doctor'].includes(req.user.role)) return res.status(403).json({ message: 'Administrative access does not include clinical appointment records' });
  try { return res.json(await listAppointments(req, req.user.role === 'patient' ? 'patient_id' : 'doctor_id', req.user.userId, req.user.role === 'patient' ? 'doctor_id' : 'patient_id')); }
  catch (error) { return fail(res, error, 'Appointment listing failed'); }
});
router.get('/appointments/patient/:patientId', auth, requireVerified, idParam, async (req, res) => {
  if (req.user.role !== 'patient' || req.user.userId !== req.params.patientId) return res.status(403).json({ message: 'Access denied' });
  try { return res.json(await listAppointments(req, 'patient_id', req.params.patientId, 'doctor_id')); }
  catch (error) { return fail(res, error, 'Patient appointments lookup failed'); }
});
router.get('/appointments/doctor/:doctorId', auth, requireVerified, idParam, async (req, res) => {
  if (req.user.role !== 'doctor' || req.user.userId !== req.params.doctorId) return res.status(403).json({ message: 'Access denied' });
  try { return res.json(await listAppointments(req, 'doctor_id', req.params.doctorId, 'patient_id')); }
  catch (error) { return fail(res, error, 'Doctor appointments lookup failed'); }
});
async function createAppointment(req, res) {
  const { doctorId, date } = req.body || {};
  if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients may book appointments' });
  if (!validId(String(doctorId || ''))) return res.status(400).json({ message: 'Valid doctorId is required' });
  const start = dateValue(date);
  if (!start) return res.status(400).json({ message: 'Appointment date must be a future time on a 30-minute boundary' });
  const paymentMethod = req.body?.paymentMethod || 'pay_at_hospital';
  if (paymentMethod !== 'pay_at_hospital') return res.status(400).json({ message: 'Online payment is not configured. Choose pay at hospital.' });
  const requestedContact = typeof req.body?.patientContactNumber === 'string' ? req.body.patientContactNumber.trim().slice(0, 40) : '';
  if (requestedContact && !validPhone(requestedContact)) return res.status(400).json({ message: 'Enter a valid contact number' });
  const visitReason = typeof req.body?.visitReason === 'string' ? req.body.visitReason.trim().slice(0, 500) : '';
  const connection = await db(req).getConnection();
  try {
    await connection.beginTransaction();
    const [patients] = await connection.execute("SELECT contact_number,email FROM users WHERE id=? AND role='patient' AND email_verified=TRUE FOR UPDATE", [req.user.userId]);
    if (!patients.length) { await connection.rollback(); return res.status(403).json({ message: 'A verified patient account is required to book' }); }
    const contact = requestedContact || String(patients[0].contact_number || '').trim();
    if (!validPhone(contact)) { await connection.rollback(); return res.status(400).json({ message: 'Add a valid contact number to your profile or enter one for this booking' }); }
    const dailyConflict = await dailyAppointmentConflict(connection, req.user.userId, start);
    if (dailyConflict) { await connection.rollback(); return res.status(409).json({ message: dailyConflict }); }
    const [doctors] = await connection.execute("SELECT id,name,email FROM users WHERE id=? AND role='doctor' FOR UPDATE", [doctorId]);
    if (!doctors.length) { await connection.rollback(); return res.status(404).json({ message: 'Doctor not found' }); }
    const availability = await slotAvailability(connection, doctorId, start, null);
    if (availability !== 'available') { await connection.rollback(); return res.status(409).json({ message: availability === 'booked' ? 'This appointment time is already booked' : 'This doctor is not available at the selected time' }); }
    const [result] = await connection.execute('INSERT INTO appointments (doctor_id,patient_id,appointment_at,status,visit_reason,patient_contact_number,payment_method,payment_status) VALUES (?,?,?,\'scheduled\',?,?,?,\'pending\')', [doctorId, req.user.userId, sqlDate(start), visitReason || null, contact, paymentMethod]);
    await connection.commit();
    const notices = [
      patients[0]?.email && sendAppointmentBookedEmail(patients[0].email, start, doctors[0].name, 'patient'),
      doctors[0]?.email && sendAppointmentBookedEmail(doctors[0].email, start, doctors[0].name, 'doctor'),
    ].filter(Boolean);
    const delivery = await Promise.allSettled(notices);
    const notificationSent = delivery.length > 0 && delivery.every((item) => item.status === 'fulfilled');
    return res.status(201).json({ message: 'Appointment created successfully', appointmentId: String(result.insertId), notificationSent });
  } catch (error) { await connection.rollback(); return fail(res, error, 'Appointment creation failed'); }
  finally { connection.release(); }
}
router.post('/appointments/create', auth, requireVerified, createAppointment);
router.post('/appointments', auth, requireVerified, createAppointment);
router.patch('/appointments/:id/cancel', auth, requireVerified, idParam, async (req, res) => {
  const ownerColumn = req.user.role === 'patient' ? 'patient_id' : req.user.role === 'doctor' ? 'doctor_id' : null;
  if (!ownerColumn) return res.status(403).json({ message: 'Access denied' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  if (req.user.role === 'doctor' && !reason) return res.status(400).json({ message: 'Doctors must provide a cancellation reason' });
  const connection = await db(req).getConnection();
  try {
    await connection.beginTransaction();
    const [appointments] = await connection.execute(`SELECT id,doctor_id,patient_id,appointment_at FROM appointments WHERE id=? AND ${ownerColumn}=? AND status='scheduled' AND appointment_at>UTC_TIMESTAMP(3) FOR UPDATE`, [req.params.id, req.user.userId]);
    if (!appointments.length) { await connection.rollback(); return res.status(404).json({ message: 'Appointment not found or no longer cancellable' }); }
    const appointment = appointments[0];
    const [result] = await connection.execute(`UPDATE appointments SET status='cancelled',cancellation_reason=?,cancelled_by=?,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND ${ownerColumn}=? AND status='scheduled' AND appointment_at>UTC_TIMESTAMP(3)`, [reason || null, req.user.userId, req.params.id, req.user.userId]);
    if (!result.affectedRows) { await connection.rollback(); return res.status(409).json({ message: 'Appointment changed while cancellation was being processed' }); }
    const [patients] = await connection.execute("SELECT email FROM users WHERE id=? AND role='patient'", [appointment.patient_id]);
    const [doctors] = await connection.execute("SELECT email FROM users WHERE id=? AND role='doctor'", [appointment.doctor_id]);
    await connection.commit();
    const recipients = [patients[0]?.email, doctors[0]?.email].filter(Boolean);
    const notifications = await Promise.allSettled(recipients.map((email) => sendAppointmentCancelledEmail(email, appointment.appointment_at, reason)));
    const notificationSent = notifications.length > 0 && notifications.every((item) => item.status === 'fulfilled');
    return res.json({ message: 'Appointment cancelled', notificationSent });
  } catch (error) { await connection.rollback(); return fail(res, error, 'Appointment cancellation failed'); }
  finally { connection.release(); }
});
router.patch('/appointments/:id/reschedule', auth, requireVerified, idParam, async (req, res) => {
  const ownerColumn = req.user.role === 'patient' ? 'patient_id' : req.user.role === 'doctor' ? 'doctor_id' : null;
  const date = dateValue(req.body?.date);
  if (!ownerColumn) return res.status(403).json({ message: 'Access denied' });
  if (!date) return res.status(400).json({ message: 'Choose a valid future time on a 30-minute boundary' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
  const connection = await db(req).getConnection();
  let patientEmail = '';
  let doctorEmail = '';
  try {
    await connection.beginTransaction();
    const [initialRows] = await connection.execute(`SELECT id,patient_id,doctor_id FROM appointments WHERE id=? AND ${ownerColumn}=? AND status='scheduled' AND appointment_at>UTC_TIMESTAMP(3)`, [req.params.id, req.user.userId]);
    if (!initialRows.length) { await connection.rollback(); return res.status(404).json({ message: 'Appointment not found or no longer reschedulable' }); }
    const patientId = initialRows[0].patient_id;
    const [lockedPatients] = await connection.execute("SELECT id FROM users WHERE id=? AND role='patient' FOR UPDATE", [patientId]);
    if (!lockedPatients.length) { await connection.rollback(); return res.status(404).json({ message: 'Patient account not found' }); }
    const dailyConflict = await dailyAppointmentConflict(connection, patientId, date, req.params.id);
    if (dailyConflict) { await connection.rollback(); return res.status(409).json({ message: dailyConflict }); }
    await connection.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [initialRows[0].doctor_id]);
    const [rows] = await connection.execute(`SELECT id,doctor_id,patient_id,appointment_at FROM appointments WHERE id=? AND ${ownerColumn}=? AND status='scheduled' AND appointment_at>UTC_TIMESTAMP(3) FOR UPDATE`, [req.params.id, req.user.userId]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Appointment changed while you were rescheduling it' }); }
    const appointment = rows[0];
    const availability = await slotAvailability(connection, appointment.doctor_id, date, req.params.id);
    if (availability !== 'available') { await connection.rollback(); return res.status(409).json({ message: availability === 'booked' ? 'The selected time is already booked' : 'The doctor is not available at the selected time' }); }
    const previous = appointment.appointment_at instanceof Date ? appointment.appointment_at : new Date(`${String(appointment.appointment_at).replace(' ', 'T')}Z`);
    const [result] = await connection.execute(`UPDATE appointments SET appointment_at=?,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND ${ownerColumn}=? AND status='scheduled'`, [sqlDate(date), req.params.id, req.user.userId]);
    if (!result.affectedRows) { await connection.rollback(); return res.status(409).json({ message: 'Appointment changed while you were rescheduling it. Refresh and try again.' }); }
    await connection.execute('INSERT INTO appointment_reschedule_history (appointment_id,actor_id,actor_role,previous_at,rescheduled_at,reason) VALUES (?,?,?,?,?,?)', [req.params.id, req.user.userId, req.user.role, sqlDate(previous), sqlDate(date), reason || null]);
    const [patients] = await connection.execute('SELECT email FROM users WHERE id=? AND role=\'patient\'', [appointment.patient_id]);
    const [doctors] = await connection.execute('SELECT email FROM users WHERE id=? AND role=\'doctor\'', [appointment.doctor_id]);
    patientEmail = patients[0]?.email || '';
    doctorEmail = doctors[0]?.email || '';
    await connection.commit();
    const recipients = [...new Set([patientEmail, doctorEmail].filter(Boolean))];
    const notifications = await Promise.allSettled(recipients.map((email) => sendAppointmentRescheduledEmail(email, date, reason)));
    const notificationSent = notifications.length > 0 && notifications.every((item) => item.status === 'fulfilled');
    return res.json({ message: 'Appointment rescheduled', date: date.toISOString(), notificationSent });
  } catch (error) { await connection.rollback(); return fail(res, error, 'Appointment rescheduling failed'); }
  finally { connection.release(); }
});
router.get('/appointments/:id/reschedule-history', auth, requireVerified, idParam, async (req, res) => {
  const ownerColumn = req.user.role === 'patient' ? 'patient_id' : req.user.role === 'doctor' ? 'doctor_id' : null;
  if (!ownerColumn) return res.status(403).json({ message: 'Access denied' });
  try {
    const [rows] = await db(req).execute(`SELECT h.actor_role,h.previous_at,h.rescheduled_at,h.reason,h.created_at FROM appointment_reschedule_history h JOIN appointments a ON a.id=h.appointment_id WHERE h.appointment_id=? AND a.${ownerColumn}=? ORDER BY h.created_at DESC`, [req.params.id, req.user.userId]);
    return res.json(rows.map((item) => ({ actorRole: item.actor_role, previousAt: item.previous_at instanceof Date ? item.previous_at.toISOString() : new Date(`${String(item.previous_at).replace(' ', 'T')}Z`).toISOString(), rescheduledAt: item.rescheduled_at instanceof Date ? item.rescheduled_at.toISOString() : new Date(`${String(item.rescheduled_at).replace(' ', 'T')}Z`).toISOString(), reason: item.reason, createdAt: item.created_at instanceof Date ? item.created_at.toISOString() : new Date(`${String(item.created_at).replace(' ', 'T')}Z`).toISOString() })));
  } catch (error) { return fail(res, error, 'Appointment reschedule history lookup failed'); }
});
router.patch('/appointments/:id/complete', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  try {
    const [result] = await db(req).execute("UPDATE appointments SET status='completed',updated_at=UTC_TIMESTAMP(3) WHERE id=? AND doctor_id=? AND appointment_at<=UTC_TIMESTAMP(3) AND status='scheduled'", [req.params.id, req.user.userId]);
    return result.affectedRows ? res.json({ message: 'Appointment marked complete' }) : res.status(404).json({ message: 'Past appointment not found or already updated' });
  } catch (error) { return fail(res, error, 'Appointment completion failed'); }
});

const defaultHistory = { allergies: [], conditions: [], medications: [], surgeries: [], notes: '' };
router.get('/medical-history', auth, requireRole('patient'), requireVerified, async (req, res) => {
  try {
    const [rows] = await db(req).execute('SELECT allergies,conditions_json AS conditions,medications,surgeries,notes,created_at AS createdAt,updated_at AS updatedAt FROM patient_medical_history WHERE patient_id=? LIMIT 1', [req.user.userId]);
    const history = rows[0] || defaultHistory;
    for (const key of ['allergies', 'conditions', 'medications', 'surgeries']) if (typeof history[key] === 'string') history[key] = JSON.parse(history[key]);
    return res.json(history);
  } catch (error) { return fail(res, error, 'Medical history lookup failed'); }
});
router.put('/medical-history', auth, requireRole('patient'), requireVerified, async (req, res) => {
  const fields = {};
  for (const key of ['allergies', 'conditions', 'medications', 'surgeries']) {
    const value = req.body?.[key] ?? [];
    if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === 'string' && item.length <= 300)) return res.status(400).json({ message: `Invalid ${key} value` });
    fields[key] = JSON.stringify(value.map((item) => item.trim()).filter(Boolean));
  }
  const notes = req.body?.notes ?? '';
  if (typeof notes !== 'string' || notes.length > 5000) return res.status(400).json({ message: 'Invalid notes value' });
  try {
    await db(req).execute('INSERT INTO patient_medical_history (patient_id,allergies,conditions_json,medications,surgeries,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE allergies=VALUES(allergies),conditions_json=VALUES(conditions_json),medications=VALUES(medications),surgeries=VALUES(surgeries),notes=VALUES(notes),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(3)', [req.user.userId, fields.allergies, fields.conditions, fields.medications, fields.surgeries, notes.trim(), req.user.userId, req.user.userId]);
    return res.json({ message: 'Medical history saved' });
  } catch (error) { return fail(res, error, 'Medical history update failed'); }
});
router.get('/medical-history/patient/:patientId', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  try {
    const [care] = await db(req).execute("SELECT id FROM appointments WHERE patient_id=? AND doctor_id=? AND status IN ('scheduled','completed') LIMIT 1", [req.params.patientId, req.user.userId]);
    if (!care.length) return res.status(403).json({ message: 'No treating relationship is available for this patient' });
    const [rows] = await db(req).execute('SELECT allergies,conditions_json AS conditions,medications,surgeries,notes FROM patient_medical_history WHERE patient_id=? LIMIT 1', [req.params.patientId]);
    const history = rows[0] || defaultHistory;
    for (const key of ['allergies', 'conditions', 'medications', 'surgeries']) if (typeof history[key] === 'string') history[key] = JSON.parse(history[key]);
    return res.json(history);
  } catch (error) { return fail(res, error, 'Authorized medical history lookup failed'); }
});
router.get('/appointments/:id/notes', auth, requireVerified, idParam, async (req, res) => {
  try {
    const [rows] = await db(req).execute('SELECT n.appointment_id AS appointmentId,n.summary FROM consultation_notes n JOIN appointments a ON a.id=n.appointment_id WHERE n.appointment_id=? AND ((?=\'patient\' AND a.patient_id=?) OR (?=\'doctor\' AND a.doctor_id=?)) LIMIT 1', [req.params.id, req.user.role, req.user.userId, req.user.role, req.user.userId]);
    if (!rows.length) {
      const [appointment] = await db(req).execute('SELECT id FROM appointments WHERE id=? AND ((?=\'patient\' AND patient_id=?) OR (?=\'doctor\' AND doctor_id=?)) LIMIT 1', [req.params.id, req.user.role, req.user.userId, req.user.role, req.user.userId]);
      return appointment.length ? res.json({ appointmentId: req.params.id, summary: '' }) : res.status(404).json({ message: 'Appointment not found' });
    }
    return res.json({ appointmentId: String(rows[0].appointmentId), summary: rows[0].summary });
  } catch (error) { return fail(res, error, 'Consultation note lookup failed'); }
});
router.put('/appointments/:id/notes', auth, requireRole('doctor'), requireVerified, idParam, async (req, res) => {
  const summary = req.body?.summary;
  if (typeof summary !== 'string' || summary.length > 10000) return res.status(400).json({ message: 'A valid consultation summary is required' });
  try {
    const [rows] = await db(req).execute('SELECT patient_id AS patientId FROM appointments WHERE id=? AND doctor_id=? LIMIT 1', [req.params.id, req.user.userId]);
    if (!rows.length) return res.status(404).json({ message: 'Appointment not found' });
    await db(req).execute('INSERT INTO consultation_notes (appointment_id,patient_id,doctor_id,summary,created_by,updated_by) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE summary=VALUES(summary),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(3)', [req.params.id, rows[0].patientId, req.user.userId, summary.trim(), req.user.userId, req.user.userId]);
    return res.json({ message: 'Consultation summary saved' });
  } catch (error) { return fail(res, error, 'Consultation note update failed'); }
});

router.post('/documents', auth, requireRole('patient'), requireVerified, documentUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a PDF, JPEG, or PNG document' });
  const detected = inspectDocument(req.file.buffer);
  if (!detected || detected.mimeType !== req.file.mimetype) return res.status(400).json({ message: 'The document content does not match an allowed file type' });
  const category = String(req.body?.category || 'other').trim().slice(0, 60);
  const appointmentId = req.body?.appointmentId ? String(req.body.appointmentId) : null;
  if (appointmentId && !validId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment ID' });
  const storageId = `${crypto.randomUUID()}.${detected.extension}`;
  try {
    if (appointmentId) {
      const [appointments] = await db(req).execute('SELECT id FROM appointments WHERE id=? AND patient_id=? LIMIT 1', [appointmentId, req.user.userId]);
      if (!appointments.length) return res.status(404).json({ message: 'Appointment not found' });
    }
    await fs.mkdir(privateRoot, { recursive: true });
    await fs.writeFile(path.join(privateRoot, storageId), req.file.buffer, { flag: 'wx', mode: 0o600 });
    const originalName = path.basename(req.file.originalname || 'document').replace(/[\r\n\0]/g, '').slice(0, 180);
    const [result] = await db(req).execute('INSERT INTO medical_documents (patient_id,appointment_id,storage_id,original_name,mime_type,file_size,category,created_by) VALUES (?,?,?,?,?,?,?,?)', [req.user.userId, appointmentId, storageId, originalName, detected.mimeType, req.file.size, category, req.user.userId]);
    await db(req).execute("INSERT INTO document_access_audit (document_id,actor_id,actor_role,action) VALUES (?,?,'patient','uploaded')", [result.insertId, req.user.userId]);
    return res.status(201).json({ id: String(result.insertId), filename: originalName, category, uploadedAt: new Date().toISOString(), size: req.file.size });
  } catch (error) {
    await fs.unlink(path.join(privateRoot, storageId)).catch(() => {});
    return fail(res, error, 'Document upload failed');
  }
});
router.get('/documents', auth, requireVerified, async (req, res) => {
  if (!['patient', 'doctor'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
  try {
    const patientQuery = `SELECT d.id,d.original_name AS filename,d.category,d.created_at AS uploadedAt,d.file_size AS size,d.appointment_id AS appointmentId FROM medical_documents d WHERE d.patient_id=? ORDER BY d.created_at DESC`;
    const doctorQuery = `SELECT d.id,d.patient_id AS patientId,d.original_name AS filename,d.category,d.created_at AS uploadedAt,d.file_size AS size,d.appointment_id AS appointmentId FROM medical_documents d JOIN document_shares s ON s.document_id=d.id WHERE s.doctor_id=? AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id=d.patient_id AND a.doctor_id=s.doctor_id AND a.status IN ('scheduled','completed')) ORDER BY d.created_at DESC`;
    const [rows] = await db(req).execute(req.user.role === 'patient' ? patientQuery : doctorQuery, [req.user.userId]);
    const docs = rows.map((row) => ({ id: String(row.id), filename: row.filename, category: row.category, uploadedAt: new Date(row.uploadedAt).toISOString(), size: Number(row.size), patientId: row.patientId ? String(row.patientId) : undefined, appointmentId: row.appointmentId ? String(row.appointmentId) : undefined }));
    if (req.user.role === 'patient') {
      const [shares] = await db(req).execute('SELECT s.document_id AS documentId,s.doctor_id AS doctorId FROM document_shares s JOIN medical_documents d ON d.id=s.document_id WHERE d.patient_id=?', [req.user.userId]);
      const shared = new Map();
      for (const item of shares) shared.set(String(item.documentId), [...(shared.get(String(item.documentId)) || []), String(item.doctorId)]);
      for (const item of docs) item.shared = shared.get(item.id) || [];
    }
    return res.json(docs);
  } catch (error) { return fail(res, error, 'Document listing failed'); }
});
router.post('/documents/:id/share', auth, requireRole('patient'), requireVerified, idParam, async (req, res) => {
  const doctorId = String(req.body?.doctorId || '');
  if (!validId(doctorId)) return res.status(400).json({ message: 'Valid doctorId is required' });
  try {
    const [care] = await db(req).execute("SELECT id FROM appointments WHERE patient_id=? AND doctor_id=? AND status IN ('scheduled','completed') LIMIT 1", [req.user.userId, doctorId]);
    if (!care.length) return res.status(403).json({ message: 'Documents can only be shared with a treating doctor' });
    const [ownership] = await db(req).execute('SELECT id FROM medical_documents WHERE id=? AND patient_id=? LIMIT 1', [req.params.id, req.user.userId]);
    if (!ownership.length) return res.status(404).json({ message: 'Document not found' });
    await db(req).execute('INSERT INTO document_shares (document_id,doctor_id,shared_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE shared_by=VALUES(shared_by),shared_at=UTC_TIMESTAMP(3)', [req.params.id, doctorId, req.user.userId]);
    await db(req).execute("INSERT INTO document_access_audit (document_id,actor_id,actor_role,action,target_doctor_id) VALUES (?,?,'patient','shared',?)", [req.params.id, req.user.userId, doctorId]);
    return res.json({ message: 'Document shared with treating doctor' });
  } catch (error) { return fail(res, error, 'Document share failed'); }
});
router.delete('/documents/:id/share/:doctorId', auth, requireRole('patient'), requireVerified, async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.doctorId)) return res.status(400).json({ message: 'Invalid document or doctor ID' });
  try {
    const [result] = await db(req).execute('DELETE s FROM document_shares s JOIN medical_documents d ON d.id=s.document_id WHERE s.document_id=? AND s.doctor_id=? AND d.patient_id=?', [req.params.id, req.params.doctorId, req.user.userId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Document share not found' });
    await db(req).execute("INSERT INTO document_access_audit (document_id,actor_id,actor_role,action,target_doctor_id) VALUES (?,?,'patient','revoked',?)", [req.params.id, req.user.userId, req.params.doctorId]);
    return res.json({ message: 'Document sharing revoked' });
  } catch (error) { return fail(res, error, 'Document permission revoke failed'); }
});
router.get('/documents/:id/download', auth, requireVerified, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID' });
  try {
    const patient = req.user.role === 'patient';
    if (!patient && req.user.role !== 'doctor') return res.status(403).json({ message: 'Access denied' });
    const sql = patient
      ? 'SELECT d.* FROM medical_documents d WHERE d.id=? AND d.patient_id=? LIMIT 1'
      : "SELECT d.* FROM medical_documents d JOIN document_shares s ON s.document_id=d.id WHERE d.id=? AND s.doctor_id=? AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id=d.patient_id AND a.doctor_id=s.doctor_id AND a.status IN ('scheduled','completed')) LIMIT 1";
    const [rows] = await db(req).execute(sql, [req.params.id, req.user.userId]);
    const document = rows[0];
    if (!document) return res.status(404).json({ message: 'Document not found' });
    const fullPath = path.join(privateRoot, path.basename(document.storage_id));
    await db(req).execute('INSERT INTO document_access_audit (document_id,actor_id,actor_role,action) VALUES (?,?,?,\'accessed\')', [document.id, req.user.userId, req.user.role]);
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${String(document.original_name).replace(/["\\\r\n]/g, '_')}"`);
    return res.sendFile(fullPath, (error) => { if (error && !res.headersSent) res.status(404).json({ message: 'Document not found' }); });
  } catch (error) { return fail(res, error, 'Document download failed'); }
});

router.use((req, res) => res.status(404).json({ message: 'Route not found' }));
module.exports = router;
