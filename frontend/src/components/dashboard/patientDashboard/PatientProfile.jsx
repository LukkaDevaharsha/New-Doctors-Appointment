import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updatePatientProfile } from '../../../api';
import './PatientProfile.css';

export default function PatientProfile() {
  const { user } = useOutletContext();
  const [profile, setProfile] = useState({ name: '', contactNumber: '', age: '', gender: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setProfile({ name: user.name || '', contactNumber: user.contactNumber || '', age: user.age ?? '', gender: user.gender || '', address: user.address || '' }); }, [user]);
  function update(event) { setProfile((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError(''); setMessage('');
    try { await updatePatientProfile(user._id, { ...profile, age: Number(profile.age) }); setMessage('Your profile has been updated.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update your profile.'); }
    finally { setLoading(false); }
  }
  return <section className="patient-profile-page">
    <header className="dashboard-page-heading"><p className="eyebrow">YOUR ACCOUNT</p><h2>Patient profile</h2><p>Keep your contact information up to date.</p></header>
    {error && <p className="alert alert-error" role="alert">{error}</p>}{message && <p className="alert alert-success" role="status">{message}</p>}
    <form className="patient-profile-form" onSubmit={submit}>
      <div className="patient-profile-grid">
        <label>Full name<input name="name" maxLength="100" value={profile.name} onChange={update} required /></label>
        <label>Email address<input value={user.email || ''} readOnly aria-describedby="email-readonly-note" /><small id="email-readonly-note" className="profile-note">Email changes are managed through account verification.</small></label>
        <label>Contact number<input name="contactNumber" type="tel" pattern="\+?[0-9 ()-]{7,24}" title="Enter a contact number with 7 to 15 digits." maxLength="40" value={profile.contactNumber} onChange={update} /></label>
        <label>Age<input name="age" type="number" min="1" max="120" value={profile.age} onChange={update} required /></label>
        <label>Gender<input name="gender" maxLength="40" value={profile.gender} onChange={update} /></label>
        <label className="profile-wide">Address<input name="address" maxLength="500" value={profile.address} onChange={update} required /></label>
      </div>
      <button className="btn" type="submit" disabled={loading}>{loading ? 'Saving profile…' : 'Save profile'}</button>
    </form>
  </section>;
}
