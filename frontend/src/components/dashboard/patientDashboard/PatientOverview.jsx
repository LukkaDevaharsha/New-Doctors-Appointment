import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getDocuments, getPatientAppointments } from '../../../api';
import { formatIstDateTime } from '../../../utils/istDateTime';
import '../DashboardOverview.css';

export default function PatientOverview() {
  const { user } = useOutletContext();
  const [appointments, setAppointments] = useState([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getPatientAppointments(user._id), getDocuments()])
      .then(([appointmentResponse, documentResponse]) => {
        if (active) { setAppointments(appointmentResponse.data); setDocumentCount(documentResponse.data.length); }
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load your overview.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user._id]);
  const now = Date.now();
  const upcoming = appointments.filter((appointment) => appointment.status === 'scheduled' && new Date(appointment.date).getTime() > now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const completed = appointments.filter((appointment) => appointment.status === 'completed');

  return <section className="dashboard-overview">
    <header className="dashboard-overview-heading"><div><p className="eyebrow">YOUR CARE AT A GLANCE</p><h2>Welcome, {user.name}</h2><p>Your appointments and health information, together in one place.</p></div><Link className="btn" to="/patient-dashboard/find-doctors">Find a doctor</Link></header>
    {error && <p className="alert alert-error overview-error" role="alert">{error}</p>}
    <div className="overview-metrics">
      <article className="overview-metric"><span>Upcoming appointments</span><strong>{loading ? '—' : upcoming.length}</strong><small>Scheduled visits ahead</small></article>
      <article className="overview-metric"><span>Completed appointments</span><strong>{loading ? '—' : completed.length}</strong><small>Your completed visits</small></article>
      <article className="overview-metric"><span>Health documents</span><strong>{loading ? '—' : documentCount}</strong><small>Documents in your record</small></article>
    </div>
    <div className="overview-main">
      <section className="overview-panel"><div className="overview-panel-heading"><div><p className="eyebrow">COMING UP</p><h3>Next appointments</h3></div><Link to="/patient-dashboard/appointments">View all</Link></div>
        {loading ? <p role="status">Loading your schedule…</p> : upcoming.length ? <div className="overview-appointment-list">{upcoming.slice(0, 5).map((appointment) => <article className="overview-appointment" key={appointment._id}><span className="appointment-calendar-icon" aria-hidden="true">✦</span><div className="overview-appointment-details"><strong>{appointment.doctorName || 'Doctor'}</strong><small>{formatIstDateTime(appointment.date)}</small></div><span className={`status-badge status-${appointment.status}`}>Scheduled</span></article>)}</div> : <div className="dashboard-empty-state"><span aria-hidden="true">♡</span><h4>No upcoming appointments</h4><p>Find a doctor to book your first visit.</p><Link className="btn-secondary" to="/patient-dashboard/find-doctors">Browse doctors</Link></div>}
      </section>
      <aside className="overview-panel"><p className="eyebrow">QUICK ACCESS</p><h3>Care tools</h3><nav className="overview-actions" aria-label="Patient quick actions"><Link to="/patient-dashboard/appointments">Manage appointments</Link><Link to="/patient-dashboard/records">Medical records and documents</Link><Link to="/patient-dashboard/profile">Review your profile</Link><Link to="/patient-dashboard/settings">Account settings</Link></nav></aside>
    </div>
  </section>;
}
