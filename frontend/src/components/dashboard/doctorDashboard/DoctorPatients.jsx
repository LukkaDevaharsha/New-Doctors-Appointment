import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDoctorAppointments } from '../../../api';
import { formatIstDateTime } from '../../../utils/istDateTime';

export default function DoctorPatients() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getDoctorAppointments().then((rows) => { if (active) setAppointments(rows); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load your patient list.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const patients = useMemo(() => {
    const groups = new Map();
    appointments.forEach((appointment) => {
      const id = String(appointment.patientId);
      const current = groups.get(id) || { id, name: appointment.patientName || 'Patient', contact: appointment.patientContactNumber, visits: 0, nextVisit: null };
      current.visits += 1;
      if (appointment.status === 'scheduled' && new Date(appointment.date) > new Date() && (!current.nextVisit || new Date(appointment.date) < new Date(current.nextVisit))) current.nextVisit = appointment.date;
      groups.set(id, current);
    });
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  return <section className="doctor-patients-page">
    <header className="dashboard-page-heading"><p className="eyebrow">PATIENT RELATIONSHIPS</p><h2>My Patients</h2><p>Patients with an appointment history in your practice.</p></header>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading your patient list…</p> : patients.length ? <div className="patient-directory-grid">{patients.map((patient) => <article className="patient-directory-card" key={patient.id}>
      <div className="patient-directory-avatar" aria-hidden="true">{patient.name.slice(0, 1).toUpperCase()}</div>
      <div className="patient-directory-details"><h3>{patient.name}</h3>{patient.contact && <p>{patient.contact}</p>}<small>{patient.visits} {patient.visits === 1 ? 'appointment' : 'appointments'}</small>{patient.nextVisit && <p className="patient-next-visit">Next visit · {formatIstDateTime(patient.nextVisit)}</p>}</div>
      <Link to={`/doctor-dashboard/appointments?patient=${encodeURIComponent(patient.id)}`} className="btn-secondary">View appointments</Link>
    </article>)}</div> : <p className="empty-state">Patients appear here after an appointment is booked.</p>}
  </section>;
}
