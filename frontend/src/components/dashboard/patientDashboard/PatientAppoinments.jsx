import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { cancelAppointment, getAppointmentRescheduleHistory, getDoctorAvailability, getPatientAppointments, getConsultationNotes, rescheduleAppointment } from '../../../api';
import './PatientAppointments.css';

export default function PatientAppointments() {
  const { user } = useOutletContext();
  const [appointments, setAppointments] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [histories, setHistories] = useState({});
  const [rescheduleDates, setRescheduleDates] = useState({});
  const [availableSlots, setAvailableSlots] = useState({});
  const [selectedSlots, setSelectedSlots] = useState({});
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try { const response = await getPatientAppointments(user._id); setAppointments(response.data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load appointments.'); }
    finally { setLoading(false); }
  }, [user._id]);
  useEffect(() => { refresh(); }, [refresh]);

  async function cancel(id) {
    if (!window.confirm('Cancel this appointment?')) return;
    setBusyId(id); setError(''); setMessage('');
    try { const { data } = await cancelAppointment(id); setMessage(data.notificationSent ? 'Appointment cancelled. A notice was sent to the care team.' : 'Appointment cancelled. Email notification could not be confirmed.'); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to cancel this appointment.'); }
    finally { setBusyId(''); }
  }
  async function loadSlots(event, id) {
    const date = event.target.value;
    setRescheduleDates((current) => ({ ...current, [id]: date }));
    setSelectedSlots((current) => ({ ...current, [id]: '' })); setAvailableSlots((current) => ({ ...current, [id]: [] })); setError('');
    if (!date) return;
    try {
      const result = await getDoctorAvailability(appointments.find((item) => String(item._id) === id).doctorId, date);
      const open = result.slots.filter((slot) => slot.status === 'available');
      setAvailableSlots((current) => ({ ...current, [id]: open }));
      if (!open.length) setError('No open appointment times on that date.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to check that date.'); }
  }
  async function reschedule(id) {
    const date = selectedSlots[id];
    if (!date) return;
    setBusyId(id); setError(''); setMessage('');
    try {
      const { data } = await rescheduleAppointment(id, date, reasons[id] || '');
      setMessage(data.notificationSent ? 'Appointment rescheduled. Both parties were notified by email.' : 'Appointment rescheduled. Email notification could not be confirmed.');
      await refresh();
      if (histories[id]) await loadHistory(id);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to reschedule the appointment.'); }
    finally { setBusyId(''); }
  }
  async function loadSummary(id) {
    try { const response = await getConsultationNotes(id); setSummaries((current) => ({ ...current, [id]: response.data.summary || 'No visit summary is available.' })); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load the visit summary.'); }
  }
  async function loadHistory(id) {
    try { const response = await getAppointmentRescheduleHistory(id); setHistories((current) => ({ ...current, [id]: response.data })); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load appointment history.'); }
  }

  if (loading) return <section className="appointments"><h2>Your appointments</h2><p className="empty-state" role="status">Loading your appointments…</p></section>;
  return <section className="appointments patient-appointments-page">
    <header className="dashboard-page-heading"><p className="eyebrow">YOUR CARE</p><h2>Appointments</h2><p>Review upcoming visits and manage schedule changes.</p></header>
    {error && <p className="alert alert-error" role="alert">{error}</p>}{message && <p className="alert alert-success" role="status">{message}</p>}
    {appointments.length === 0 ? <p className="empty-state">You have no appointments yet. Find a doctor to request your first visit.</p> : <div className="appointments-grid">{appointments.map((app) => {
      const id = String(app._id);
      const date = new Date(app.date);
      const status = app.status || 'scheduled';
      return <article className="appointment-card patient-appointment-card" key={id}>
        <div className="appointment-card-top"><div><p className="eyebrow">{date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}</p><h3>{app.doctorName || 'Doctor'}</h3></div><span className={`status-badge status-${status}`}>{status}</span></div>
        <p><strong>Time:</strong> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</p>
        <p><strong>Payment:</strong> {app.paymentMethod === 'pay_at_hospital' ? 'Pay at hospital' : app.paymentMethod} · {app.paymentStatus || 'pending'}</p>
        {app.visitReason && <p><strong>Reason for visit:</strong> {app.visitReason}</p>}
        {status === 'scheduled' && <div className="patient-appointment-actions"><button type="button" className="btn-secondary" onClick={() => cancel(id)} disabled={busyId === id}>{busyId === id ? 'Updating…' : 'Cancel appointment'}</button><button type="button" className="btn-secondary" onClick={() => { setRescheduleDates((current) => ({ ...current, [id]: '' })); setAvailableSlots((current) => ({ ...current, [id]: [] })); }}>Choose a new time</button></div>}
        {status === 'scheduled' && <div className="patient-reschedule-form"><label>New date (UTC)<input type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDates[id] || ''} onChange={(event) => loadSlots(event, id)} /></label>{availableSlots[id]?.length > 0 && <label>Open time<select value={selectedSlots[id] || ''} onChange={(event) => setSelectedSlots((current) => ({ ...current, [id]: event.target.value }))}><option value="">Choose an available time</option>{availableSlots[id].map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{new Date(slot.startsAt).toISOString().slice(11, 16)}</option>)}</select></label>}<label>Reason (optional)<input maxLength="500" value={reasons[id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [id]: event.target.value }))} /></label>{selectedSlots[id] && <button type="button" onClick={() => reschedule(id)} disabled={busyId === id}>{busyId === id ? 'Rescheduling…' : 'Confirm reschedule'}</button>}</div>}
        {status === 'completed' && <button type="button" className="btn-secondary" onClick={() => loadSummary(id)}>View visit summary</button>}
        {summaries[id] && <p className="visit-summary">{summaries[id]}</p>}
        <button type="button" className="text-button history-toggle" onClick={() => loadHistory(id)}>View rescheduling history</button>
        {histories[id]?.length > 0 && <ul className="reschedule-history">{histories[id].map((entry, index) => <li key={`${entry.createdAt}-${index}`}><strong>{new Date(entry.rescheduledAt).toLocaleString(undefined, { timeZone: 'UTC' })} UTC</strong><span>Changed by {entry.actorRole}{entry.reason ? ` · ${entry.reason}` : ''}</span></li>)}</ul>}
        {histories[id]?.length === 0 && <p className="history-empty">No rescheduling history.</p>}
      </article>;
    })}</div>}
  </section>;
}
