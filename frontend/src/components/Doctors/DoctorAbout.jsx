import PropTypes from 'prop-types';
import './DoctorAbout.css';

export default function DoctorAbout({ doctor }) {
  return (
    <section className="doctor-about-container" aria-labelledby="doctor-about-title">
      <h2 id="doctor-about-title">About {doctor.name}</h2>
      <p>Profile information is currently limited to the details provided in the doctor directory.</p>
      <dl className="doctor-facts">
        <div><dt>Specialty</dt><dd>{doctor.specialization || 'Not listed'}</dd></div>
        <div><dt>Practice</dt><dd>{doctor.hospitalName || doctor.hospital || 'Not listed'}</dd></div>
        {doctor.qualifications && <div><dt>Qualifications</dt><dd>{doctor.qualifications}</dd></div>}
        {doctor.yearsExperience !== undefined && doctor.yearsExperience !== null && doctor.yearsExperience !== '' && <div><dt>Experience</dt><dd>{doctor.yearsExperience} years</dd></div>}
        {(doctor.clinicAddress || doctor.city || doctor.stateRegion || doctor.postalCode) && <div><dt>Location</dt><dd>{[doctor.clinicAddress, doctor.city, doctor.stateRegion, doctor.postalCode].filter(Boolean).join(', ')}</dd></div>}
        {Number(doctor.consultationFee) > 0 && <div><dt>Consultation fee</dt><dd>{Number(doctor.consultationFee).toLocaleString()}</dd></div>}
        {doctor.consultationModes?.length > 0 && <div><dt>Consultation modes</dt><dd>{doctor.consultationModes.join(', ')}</dd></div>}
        {doctor.languages?.length > 0 && <div><dt>Languages</dt><dd>{doctor.languages.join(', ')}</dd></div>}
      </dl>
      {doctor.biography && <div className="doctor-biography"><h3>About the doctor</h3><p>{doctor.biography}</p></div>}
      {doctor.expertise?.length > 0 && <div className="doctor-expertise"><h3>Areas of expertise</h3><ul>{doctor.expertise.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>
  );
}

DoctorAbout.propTypes = {
  doctor: PropTypes.shape({ name: PropTypes.string, specialization: PropTypes.string, hospitalName: PropTypes.string, hospital: PropTypes.string, qualifications: PropTypes.string, yearsExperience: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), clinicAddress: PropTypes.string, city: PropTypes.string, stateRegion: PropTypes.string, postalCode: PropTypes.string, consultationFee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), consultationModes: PropTypes.arrayOf(PropTypes.string), languages: PropTypes.arrayOf(PropTypes.string), biography: PropTypes.string, expertise: PropTypes.arrayOf(PropTypes.string) }).isRequired,
};
