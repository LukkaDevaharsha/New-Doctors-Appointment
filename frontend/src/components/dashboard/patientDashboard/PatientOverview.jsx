import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getDocuments, getPatientAppointments } from '../../../api';
import '../DashboardOverview.css';

export default function PatientOverview() {
  const { user } = useOutletContext();
  const [appointments, setAppointments] = useState([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getPatientAppointments(user._id), getDocuments()]).then(([appointmentResponse, documentResponse]) => {
      if (active) { setAppointments(appointmentResponse.data); setDocumentCount(documentResponse.data.length); }
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load your overview.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user._id]);
  const upcoming = appointments.filter((appointment) => appointment.status === 'scheduled' && new Date(appointment.date) > new Date());
  const completed = appointments.filter((appointment) => appointment.status === 'completed');
  return <section className="dashboard-overview">
    <header className="dashboard-overview-heading"><div><p className="eyebrow">PATIENT PORTAL</p><h2>Welcome, {user.name}</h2><p>Your care and appointments, organized in one place.</p></div><Link className="btn" to="/doctors">Find a doctor</Link></header>
    {error && <p className="alert alert-error overview-error" role="alert">{error}</p>}
    <div className="overview-metrics"><article className="overview-metric"><span>Upcoming visits</span><strong>{loading ? '—' : upcoming.length}</strong></article><article className="overview-metric"><span>Completed visits</span><strong>{loading ? '—' : completed.length}</strong></article><article className="overview-metric"><span>Health documents</span><strong>{loading ? '—' : documentCount}</strong></article></div>
    <div className="overview-main"><section className="overview-panel"><h3>Next appointments</h3>{loading ? <p role="status">Loading your schedule…</p> : upcoming.length ? <div className="overview-appointment-list">{upcoming.slice(0, 5).map((appointment) => <article className="overview-appointment" key={appointment._id}><div><strong>{appointment.doctorName || 'Doctor'}</strong><small>{new Date(appointment.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</small></div><span className="status-badge status-scheduled">Scheduled</span></article>)}</div> : <p className="empty-state">No upcoming appointments. Search the care team to book a visit.</p>}</section>
      <aside className="overview-panel"><h3>Quick actions</h3><nav className="overview-actions" aria-label="Patient quick actions"><Link to="/doctors">Browse doctors</Link><Link to="/patient-dashboard/appointments">View appointment history</Link><Link to="/patient-dashboard/records">Medical history and documents</Link><Link to="/patient-dashboard/profile">Review your profile</Link></nav></aside></div>
  </section>;
}
