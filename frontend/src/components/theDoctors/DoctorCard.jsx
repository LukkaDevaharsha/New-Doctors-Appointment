import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BsArrowRight } from 'react-icons/bs';
import defaultDoctorImage from '../../assets/images/doc.png';
import { getDoctorPhotoUrl } from '../../api';
import './DoctorCard.css';

export default function DoctorCard({ doctor }) {
  const id = String(doctor.id || doctor._id || '');
  const name = doctor.name || 'Doctor';
  const doctorUrl = `/doctors/${encodeURIComponent(id)}`;
  const bookingUrl = `/feedback?doctorName=${encodeURIComponent(name)}&doctorId=${encodeURIComponent(id)}`;
  return (
    <article className="doctor-card">
      <img src={doctor.photo ? getDoctorPhotoUrl(doctor.id || doctor._id) : defaultDoctorImage} alt={`${name} profile`} className="doctor-photo" loading="lazy" onError={(event) => { event.currentTarget.src = defaultDoctorImage; }} />
      <div className="doctor-card-body">
        <p className="doctor-specialty">{doctor.specialization || 'General practice'}</p>
        <h3 className="doctor-name">{name}</h3>
        {doctor.qualifications && <p className="doctor-qualifications">{doctor.qualifications}</p>}
        {doctor.experience !== null && doctor.experience !== undefined && <p className="doctor-experience">{doctor.experience} years of experience</p>}
        <p className="doctor-hospital">{doctor.hospitalName || doctor.hospital || 'Healthcare professional'}{doctor.city ? ` · ${doctor.city}` : ''}</p>
        {doctor.clinicAddress && <p className="doctor-location">{doctor.clinicAddress}</p>}
        <div className="doctor-info">
          <span className="doctor-rating">{Number(doctor.avgRating) > 0 ? `${Number(doctor.avgRating).toFixed(1)} / 5` : 'New profile'}</span>
          {Number(doctor.consultationFee) > 0 && <span>Fee {Number(doctor.consultationFee).toLocaleString()}</span>}
          {doctor.consultationModes?.length > 0 && <span>{doctor.consultationModes.join(' · ')}</span>}
        </div>
      </div>
      <div className="doctor-card-actions">
        <Link to={doctorUrl} className="doctor-profile-link">View profile <BsArrowRight aria-hidden="true" /></Link>
        <Link to={bookingUrl} className="feedback-btn">Book appointment</Link>
      </div>
    </article>
  );
}

DoctorCard.propTypes = {
  doctor: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    specialization: PropTypes.string,
    hospitalName: PropTypes.string,
    hospital: PropTypes.string,
    qualifications: PropTypes.string,
    experience: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    clinicAddress: PropTypes.string,
    city: PropTypes.string,
    consultationFee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    consultationModes: PropTypes.arrayOf(PropTypes.string),
    avgRating: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    totalPatients: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    photo: PropTypes.string,
  }).isRequired,
};
