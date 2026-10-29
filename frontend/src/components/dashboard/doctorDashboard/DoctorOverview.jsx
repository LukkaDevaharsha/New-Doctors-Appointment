import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getDoctorAppointments, getDocuments } from '../../../api';
import '../DashboardOverview.css';

export default function DoctorOverview() {
  const { user } = useOutletContext();
  const [appointments, setAppointments] = useState([]);
  const [sharedCount, setSharedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getDoctorAppointments(), getDocuments()]).then(([appointmentRows, documentResponse]) => {
      if (active) { setAppointments(appointmentRows); setSharedCount(documentResponse.data.length); }
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load your dashboard.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const now = new Date();
  const upcoming = appointments.filter((appointment) => appointment.status === 'scheduled' && new Date(appointment.date) >= now);
  const today = upcoming.filter((appointment) => new Date(appointment.date).toISOString().slice(0, 10) === now.toISOString().slice(0, 10));
  const completed = appointments.filter((appointment) => appointment.status === 'completed');
  return <section className="dashboard-overview">
    <header className="dashboard-overview-heading"><div><p className="eyebrow">DOCTOR PORTAL</p><h2>Good day, Dr. {user.name}</h2><p>Your schedule and patient care workspace.</p></div><Link className="btn" to="/doctor-dashboard/appointments">Open appointments</Link></header>
    {error && <p className="alert alert-error overview-error" role="alert">{error}</p>}
    <div className="overview-metrics"><article className="overview-metric"><span>Today&apos;s visits</span><strong>{loading ? '—' : today.length}</strong></article><article className="overview-metric"><span>Upcoming visits</span><strong>{loading ? '—' : upcoming.length}</strong></article><article className="overview-metric"><span>Completed visits</span><strong>{loading ? '—' : completed.length}</strong></article></div>
    <div className="overview-main"><section className="overview-panel"><h3>Today&apos;s schedule</h3>{loading ? <p role="status">Loading your appointments…</p> : today.length ? <div className="overview-appointment-list">{today.map((appointment) => <article className="overview-appointment" key={appointment._id}><div><strong>{appointment.patientName || 'Patient'}</strong><small>{new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</small></div><span className="status-badge status-scheduled">Scheduled</span></article>)}</div> : <p className="empty-state">No visits are scheduled for today.</p>}</section>
      <aside className="overview-panel"><h3>Practice tools</h3><nav className="overview-actions" aria-label="Doctor quick actions"><Link to="/doctor-dashboard/appointments">Manage appointments</Link><Link to="/doctor-dashboard/profile">Edit professional profile</Link><Link to="/doctor-dashboard/profile#availability">Manage working hours</Link><span className="overview-document-count">{loading ? 'Loading shared records…' : `${sharedCount} shared patient documents`}</span></nav></aside></div>
  </section>;
}
