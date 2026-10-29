import { useEffect, useState } from 'react';
import { getAllDoctors } from '../../api';
import DoctorCard from './DoctorCard';
import './DoctorList.css';

export default function DoctorList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAllDoctors()
      .then(({ data }) => { if (active) setDoctors(data); })
      .catch(() => { if (active) setError('Doctor profiles are temporarily unavailable. Please try again later.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="empty-state" role="status">Loading doctor profiles…</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!doctors.length) return <p className="empty-state">No doctor profiles are available yet.</p>;

  return <div className="doctor-list">{doctors.map((doctor) => <DoctorCard key={doctor.id || doctor._id} doctor={doctor} />)}</div>;
}
