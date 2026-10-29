import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDoctor, getDoctorPhotoUrl } from '../../api';
import defaultDoctorImage from '../../assets/images/doc.png';
import DoctorAbout from './DoctorAbout';
import Feedback from './Feedback';
import SidePanel from './SidePanel';

export default function DoctorDetails() {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [tab, setTab] = useState('about');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDoctor(null);
    getDoctor(id)
      .then(({ data }) => { if (active) setDoctor(data); })
      .catch((requestError) => { if (active) setError(requestError.response?.status === 404 ? 'This doctor profile could not be found.' : 'Unable to load this doctor profile right now.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="doctor-detail-page"><p className="empty-state" role="status">Loading doctor profile…</p></main>;
  if (error || !doctor) return <main className="doctor-detail-page"><div className="alert alert-error" role="alert">{error || 'Doctor profile unavailable.'}</div><Link to="/doctors">Return to doctor directory</Link></main>;

  return (
    <main className="doctor-detail-page">
      <p className="eyebrow"><Link to="/doctors">Doctors</Link> / Profile</p>
      <div className="doctor-detail-layout">
        <section className="doctor-detail-card">
          <header className="doctor-profile-head">
            <figure><img src={doctor.photo ? getDoctorPhotoUrl(doctor.id || doctor._id) : defaultDoctorImage} alt={`${doctor.name} profile`} onError={(event) => { event.currentTarget.src = defaultDoctorImage; }} /></figure>
            <div>
              <p className="doctor-specialty">{doctor.specialization || 'General practice'}</p>
              <h1>{doctor.name}</h1>
              <p>{doctor.hospitalName || doctor.hospital || 'Healthcare professional'}</p>
              <p className="doctor-rating">{Number(doctor.avgRating) > 0 ? `${Number(doctor.avgRating).toFixed(1)} / 5` : 'New profile'} · {Number(doctor.totalRating) || 0} reviews</p>
            </div>
          </header>
          <div className="doctor-tabs" role="tablist" aria-label="Doctor information">
            <button type="button" role="tab" aria-selected={tab === 'about'} className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>About</button>
            <button type="button" role="tab" aria-selected={tab === 'feedback'} className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>Reviews</button>
          </div>
          <div role="tabpanel">{tab === 'about' ? <DoctorAbout doctor={doctor} /> : <Feedback doctorId={String(doctor.id || doctor._id)} doctorName={doctor.name} showBookingPanel={false} />}</div>
        </section>
        <SidePanel doctorId={String(doctor.id || doctor._id)} doctorName={doctor.name} />
      </div>
    </main>
  );
}
