import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getDoctorAppointments } from '../../../api';
import { formatIstDateTime, getIstDateKey } from '../../../utils/istDateTime';
import '../DashboardOverview.css';

export default function DoctorOverview() {
  const { user } = useOutletContext();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getDoctorAppointments().then((rows) => { if (active) setAppointments(rows); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load your schedule.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const now = Date.now();
  const todayKey = getIstDateKey(now);
  const upcoming = appointments.filter((appointment) => appointment.status === 'scheduled' && new Date(appointment.date).getTime() >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const today = upcoming.filter((appointment) => getIstDateKey(appointment.date) === todayKey);
  const completed = appointments.filter((appointment) => appointment.status === 'completed');

  return <section className="dashboard-overview">
    <header className="dashboard-overview-heading"><div><p className="eyebrow">YOUR PRACTICE AT A GLANCE</p><h2>Welcome, Dr. {user.name}</h2><p>Your patient visits and practice schedule.</p></div><Link className="btn" to="/doctor-dashboard/appointments">Open appointments</Link></header>
    {error && <p className="alert alert-error overview-error" role="alert">{error}</p>}
    <div className="overview-metrics">
      <article className="overview-metric"><span>Today&apos;s appointments</span><strong>{loading ? '—' : today.length}</strong><small>Appointments on today&apos;s IST date</small></article>
      <article className="overview-metric"><span>Upcoming appointments</span><strong>{loading ? '—' : upcoming.length}</strong><small>Scheduled visits ahead</small></article>
      <article className="overview-metric"><span>Completed appointments</span><strong>{loading ? '—' : completed.length}</strong><small>Completed visits</small></article>
    </div>
    <div className="overview-main">
      <section className="overview-panel"><div className="overview-panel-heading"><div><p className="eyebrow">IST · ASIA/KOLKATA</p><h3>Today&apos;s schedule</h3></div><Link to="/doctor-dashboard/appointments">Manage</Link></div>
        {loading ? <p role="status">Loading your appointments…</p> : today.length ? <div className="overview-appointment-list">{today.map((appointment) => <article className="overview-appointment" key={appointment._id}><span className="appointment-calendar-icon" aria-hidden="true">◷</span><div className="overview-appointment-details"><strong>{appointment.patientName || 'Patient'}</strong><small>{formatIstDateTime(appointment.date)}</small></div><span className={`status-badge status-${appointment.status}`}>Scheduled</span></article>)}</div> : <div className="dashboard-empty-state"><span aria-hidden="true">◷</span><h4>No appointments today</h4><p>Your schedule is clear for the rest of the IST day.</p></div>}
      </section>
      <aside className="overview-panel"><p className="eyebrow">PRACTICE TOOLS</p><h3>Manage your practice</h3><nav className="overview-actions" aria-label="Doctor quick actions"><Link to="/doctor-dashboard/patients">View my patients</Link><Link to="/doctor-dashboard/availability">Manage availability</Link><Link to="/doctor-dashboard/profile">Edit professional profile</Link><Link to="/doctor-dashboard/settings">Account settings</Link></nav><div className="appointment-request-note"><strong>Appointment requests</strong><p>The current booking flow schedules appointments immediately. New bookings appear in your upcoming appointments.</p></div></aside>
    </div>
  </section>;
}
