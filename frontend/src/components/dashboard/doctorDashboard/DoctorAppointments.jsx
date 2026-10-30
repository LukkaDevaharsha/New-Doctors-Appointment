import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { cancelAppointment, completeAppointment, downloadDocument, getDoctorAppointments, getDoctorAvailability, getDocuments, getPatientMedicalHistory, rescheduleAppointment, saveConsultationNotes } from '../../../api';
import { formatIstDateTime, formatIstTime, getIstDateKey } from '../../../utils/istDateTime';
import './DoctorAppointments.css';

export default function DoctorAppointments() {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get('patient') || '';
  const [appointments, setAppointments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState({});
  const [summaries, setSummaries] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rescheduleId, setRescheduleId] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [cancelId, setCancelId] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [appointmentRows, documentResponse] = await Promise.all([getDoctorAppointments(), getDocuments()]);
      setAppointments(appointmentRows); setDocuments(documentResponse.data);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load appointments.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function showHistory(patientId) {
    try { const response = await getPatientMedicalHistory(patientId); setHistory((current) => ({ ...current, [patientId]: response.data })); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load this patient history.'); }
  }
  async function saveSummary(appointmentId) {
    setBusyId(appointmentId); setError(''); setMessage('');
    try { await saveConsultationNotes(appointmentId, summaries[appointmentId] || ''); setMessage('Visit summary saved.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save the visit summary.'); }
    finally { setBusyId(''); }
  }
  async function markComplete(appointmentId) {
    setBusyId(appointmentId); setError('');
    try { await completeAppointment(appointmentId); setMessage('Appointment marked complete.'); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to complete this appointment.'); }
    finally { setBusyId(''); }
  }
  async function openDocument(document) {
    setBusyId(document.id); setError('');
    try {
      const response = await downloadDocument(document.id);
      const url = URL.createObjectURL(response.data);
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) { const link = window.document.createElement('a'); link.href = url; link.download = document.filename; link.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) { setError(requestError.response ? 'This shared document is no longer available.' : requestError.message); }
    finally { setBusyId(''); }
  }
  async function loadSlots(event) {
    const date = event.target.value;
    setRescheduleTime(''); setRescheduleSlots([]); setError('');
    if (!date) return;
    try { const result = await getDoctorAvailability(user._id, date); setRescheduleSlots(result.slots.filter((slot) => slot.status === 'available')); if (!result.slots.some((slot) => slot.status === 'available')) setError('No open appointment times on that date.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to check this date.'); }
  }
  async function submitReschedule(event, appointmentId) {
    event.preventDefault(); if (!rescheduleTime) return;
    setBusyId(appointmentId); setError(''); setMessage('');
    try { const { data } = await rescheduleAppointment(appointmentId, rescheduleTime, rescheduleReason); setMessage(data.notificationSent ? 'Appointment rescheduled. Both parties were notified by email.' : 'Appointment rescheduled. Email notification could not be confirmed.'); setRescheduleId(''); setRescheduleReason(''); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to reschedule this appointment.'); }
    finally { setBusyId(''); }
  }
  async function submitCancellation(event, appointmentId) {
    event.preventDefault(); if (!cancelReason.trim()) return;
    setBusyId(appointmentId); setError(''); setMessage('');
    try { const { data } = await cancelAppointment(appointmentId, cancelReason.trim()); setMessage(data.notificationSent ? 'Appointment cancelled. Both parties were notified by email.' : 'Appointment cancelled. Email notification could not be confirmed.'); setCancelId(''); setCancelReason(''); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to cancel this appointment.'); }
    finally { setBusyId(''); }
  }

  const filtered = appointments.filter((appointment) => (!patientFilter || String(appointment.patientId) === patientFilter) && (!filter || (appointment.patientName || '').toLowerCase().includes(filter.toLowerCase())));
  if (loading) return <section className="appointments"><h2>Appointments</h2><p className="empty-state" role="status">Loading your schedule…</p></section>;

  return <section className="appointments doctor-appointments-page">
    <header className="dashboard-page-heading"><p className="eyebrow">PRACTICE MANAGEMENT</p><h2>Appointments</h2><p>Review your schedule, coordinate changes, and document completed visits.</p></header>
    {error && <p className="alert alert-error" role="alert">{error}</p>}{message && <p className="alert alert-success" role="status">{message}</p>}
    <label className="appointment-search">Search patient<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter your appointment list" /></label>
    {filtered.length === 0 ? <p className="empty-state">{filter ? 'No appointments match this patient search.' : 'Your schedule is clear. New patient bookings will appear here.'}</p> : <div className="appointments-grid">{filtered.map((app) => {
      const id = String(app._id);
      const status = app.status || 'scheduled';
      const appDate = new Date(app.date);
      const patientDocs = documents.filter((document) => document.patientId === String(app.patientId));
      return <article key={id} className="appointment-card doctor-appointment-card">
        <div className="appointment-card-top"><div><p className="eyebrow">{formatIstDateTime(app.date)}</p><h3>{app.patientName || 'Patient'}</h3></div><span className={`status-badge status-${status}`}>{status}</span></div>
        <p><strong>Time:</strong> {formatIstTime(app.date)}</p>
        {app.patientContactNumber && <p><strong>Patient contact:</strong> {app.patientContactNumber}</p>}
        {app.visitReason && <p><strong>Reason for visit:</strong> {app.visitReason}</p>}
        <p><strong>Payment:</strong> {app.paymentMethod === 'pay_at_hospital' ? 'Pay at hospital' : app.paymentMethod} · {app.paymentStatus || 'pending'}</p>
        <div className="appointment-actions">
          {status === 'scheduled' && <><button type="button" className="btn-secondary" onClick={() => { setRescheduleId(rescheduleId === id ? '' : id); setRescheduleSlots([]); setError(''); }}>Reschedule</button><button type="button" className="btn-secondary destructive-action" onClick={() => { setCancelId(cancelId === id ? '' : id); setCancelReason(''); }}>Cancel appointment</button></>}
          {status === 'scheduled' && appDate <= new Date() && <button type="button" onClick={() => markComplete(id)} disabled={busyId === id}>Mark complete</button>}
        </div>
        {rescheduleId === id && <form className="appointment-inline-form" onSubmit={(event) => submitReschedule(event, id)}><h4>Choose a new open time · IST</h4><label>Date<input type="date" min={getIstDateKey(new Date())} data-appointment={id} onChange={loadSlots} required /></label>{rescheduleSlots.length > 0 && <label>Available time<select value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} required><option value="">Choose a slot</option>{rescheduleSlots.map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{formatIstTime(slot.startsAt)}</option>)}</select></label>}<label>Reason (optional)<input value={rescheduleReason} maxLength="500" onChange={(event) => setRescheduleReason(event.target.value)} /></label><button type="submit" disabled={!rescheduleTime || busyId === id}>{busyId === id ? 'Saving…' : 'Confirm new time'}</button></form>}
        {cancelId === id && <form className="appointment-inline-form" onSubmit={(event) => submitCancellation(event, id)}><h4>Cancel appointment</h4><label>Reason for the patient<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength="500" required /></label><button type="submit" className="destructive-action" disabled={!cancelReason.trim() || busyId === id}>{busyId === id ? 'Cancelling…' : 'Confirm cancellation'}</button></form>}
        <div className="appointment-record-actions"><button type="button" className="btn-secondary" onClick={() => showHistory(String(app.patientId))}>View medical history</button><label>Consultation notes<textarea rows="3" maxLength="10000" value={summaries[id] || ''} onChange={(event) => setSummaries((current) => ({ ...current, [id]: event.target.value }))} /></label><button type="button" onClick={() => saveSummary(id)} disabled={busyId === id}>{busyId === id ? 'Saving…' : 'Save notes'}</button></div>
        {history[String(app.patientId)] && <section className="patient-history-panel"><h4>Patient-provided history</h4><p><strong>Allergies:</strong> {history[String(app.patientId)].allergies?.join(', ') || 'None listed'}</p><p><strong>Conditions:</strong> {history[String(app.patientId)].conditions?.join(', ') || 'None listed'}</p><p><strong>Medications:</strong> {history[String(app.patientId)].medications?.join(', ') || 'None listed'}</p><p><strong>Surgeries:</strong> {history[String(app.patientId)].surgeries?.join(', ') || 'None listed'}</p></section>}
        {patientDocs.map((document) => <button type="button" className="btn-secondary" key={document.id} onClick={() => openDocument(document)} disabled={busyId === document.id}>Open shared document: {document.filename}</button>)}
      </article>;
    })}</div>}
  </section>;
}
