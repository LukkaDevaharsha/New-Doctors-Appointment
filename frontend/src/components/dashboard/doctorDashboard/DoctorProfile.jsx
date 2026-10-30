import { useCallback, useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { addDoctorTimeBlock, getDoctorSchedule, removeDoctorTimeBlock, saveDoctorSchedule, updateDoctorPhoto, updateDoctorProfile } from '../../../api';
import { formatIstDateTime, istLocalDateTimeToUtc, istWindowsToUtc, utcWindowsToIst } from '../../../utils/istDateTime';
import './DoctorProfile.css';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const blankProfile = { name: '', contactNumber: '', specialization: '', hospitalName: '', qualifications: '', yearsExperience: '', registrationNumber: '', biography: '', languages: '', expertise: '', consultationFee: '', clinicAddress: '', city: '', stateRegion: '', postalCode: '', consultationModes: [] };
const asText = (value) => Array.isArray(value) ? value.join(', ') : value || '';

export default function DoctorProfile() {
  const { user } = useOutletContext();
  const location = useLocation();
  const [profile, setProfile] = useState(blankProfile);
  const [windows, setWindows] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [blockForm, setBlockForm] = useState({ startsAt: '', endsAt: '', reason: '' });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setProfile({ ...blankProfile, ...user, yearsExperience: user.yearsExperience ?? '', consultationFee: user.consultationFee ?? '', languages: asText(user.languages), expertise: asText(user.expertise), consultationModes: user.consultationModes || [] });
  }, [user]);

  const refreshSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const result = await getDoctorSchedule(user._id);
      setWindows(utcWindowsToIst((result.windows || []).map((item) => ({ weekday: Number(item.weekday), startTime: String(item.start_time).slice(0, 5), endTime: String(item.end_time).slice(0, 5), slotMinutes: Number(item.slot_minutes) }))));
      setBlocks(result.blocks || []);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load schedule settings.'); }
    finally { setLoadingSchedule(false); }
  }, [user?._id]);

  useEffect(() => { if (user?._id) refreshSchedule(); }, [refreshSchedule, user?._id]);

  useEffect(() => {
    if (location.pathname.endsWith('/availability') && !loadingSchedule) {
      document.getElementById('availability')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.pathname, loadingSchedule]);

  function update(event) { setProfile((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function saveProfile(event) {
    event.preventDefault(); setSavingProfile(true); setError(''); setMessage('');
    const payload = { ...profile, yearsExperience: Number(profile.yearsExperience || 0), consultationFee: Number(profile.consultationFee || 0), languages: profile.languages.split(',').map((value) => value.trim()).filter(Boolean), expertise: profile.expertise.split(',').map((value) => value.trim()).filter(Boolean) };
    try { await updateDoctorProfile(user._id, payload); setMessage('Your professional profile has been saved.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save profile changes.'); }
    finally { setSavingProfile(false); }
  }

  async function savePhoto(event) {
    event.preventDefault();
    if (!photo) return;
    setSavingPhoto(true); setError(''); setMessage('');
    try { await updateDoctorPhoto(user._id, photo); setMessage('Your profile photo has been updated.'); setPhoto(null); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update your profile photo.'); }
    finally { setSavingPhoto(false); }
  }

  function addWindow(weekday) { setWindows((current) => [...current, { weekday, startTime: '09:00', endTime: '17:00', slotMinutes: 30 }]); }
  function changeWindow(index, key, value) { setWindows((current) => current.map((window, itemIndex) => itemIndex === index ? { ...window, [key]: value } : window)); }

  async function saveSchedule(event) {
    event.preventDefault(); setSavingSchedule(true); setError(''); setMessage('');
    try { await saveDoctorSchedule(user._id, istWindowsToUtc(windows)); setMessage('Weekly working hours saved in IST.'); await refreshSchedule(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save working hours.'); }
    finally { setSavingSchedule(false); }
  }

  async function addBlock(event) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await addDoctorTimeBlock(user._id, { startsAt: istLocalDateTimeToUtc(blockForm.startsAt), endsAt: istLocalDateTimeToUtc(blockForm.endsAt), reason: blockForm.reason });
      setBlockForm({ startsAt: '', endsAt: '', reason: '' }); setMessage('Time off added.'); await refreshSchedule();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to block this time.'); }
  }

  async function deleteBlock(id) {
    setError(''); setMessage('');
    try { await removeDoctorTimeBlock(user._id, id); setMessage('Time block removed.'); await refreshSchedule(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to remove this time block.'); }
  }

  return (
    <section className="doctor-profile-editor">
      <header className="dashboard-page-heading"><p className="eyebrow">YOUR PRACTICE</p><h2>Professional profile</h2><p>Maintain the information patients use to discover your practice.</p></header>
      {error && <p className="alert alert-error" role="alert">{error}</p>}{message && <p className="alert alert-success" role="status">{message}</p>}
      <form className="doctor-photo-form portal-section" onSubmit={savePhoto}>
        <div><h3>Profile photo</h3><p>Use a professional JPEG, PNG, or WebP image (up to 3 MB).</p></div>
        <input aria-label="Choose a profile photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
        <button className="btn btn-primary" type="submit" disabled={!photo || savingPhoto}>{savingPhoto ? 'Uploading…' : 'Update photo'}</button>
      </form>
      <form className="doctor-profile-form" onSubmit={saveProfile}>
        <section className="portal-section"><div className="portal-section-heading"><h3>Professional details</h3><p>Only practice information is shown on your public doctor profile.</p></div><div className="doctor-profile-grid">
          <label>Full name<input name="name" maxLength="100" value={profile.name} onChange={update} required /></label>
          <label>Specialty<input name="specialization" maxLength="150" value={profile.specialization} onChange={update} required /></label>
          <label>Qualifications and degrees<input name="qualifications" maxLength="500" value={profile.qualifications} onChange={update} placeholder="MBBS, MD" /></label>
          <label>Years of experience<input name="yearsExperience" type="number" min="0" max="80" value={profile.yearsExperience} onChange={update} /></label>
          <label>Registration number<input name="registrationNumber" maxLength="120" value={profile.registrationNumber} onChange={update} /></label>
          <label>Consultation fee<input name="consultationFee" type="number" min="0" step="0.01" value={profile.consultationFee} onChange={update} /></label>
          <label className="form-wide">Languages spoken<input name="languages" value={profile.languages} onChange={update} placeholder="English, Hindi" /></label>
          <label className="form-wide">Areas of expertise<input name="expertise" value={profile.expertise} onChange={update} placeholder="Preventive care, diabetes" /></label>
          <label className="form-wide">Professional biography<textarea name="biography" rows="4" maxLength="5000" value={profile.biography} onChange={update} /></label>
        </div></section>
        <section className="portal-section"><div className="portal-section-heading"><h3>Clinic and consultation</h3><p>Share a practice location patients can use to plan their visit.</p></div><div className="doctor-profile-grid">
          <label>Hospital or clinic<input name="hospitalName" maxLength="180" value={profile.hospitalName} onChange={update} required /></label>
          <label>Clinic contact number<input name="contactNumber" type="tel" pattern="\+?[0-9 ()-]{7,24}" title="Enter a contact number with 7 to 15 digits." maxLength="40" value={profile.contactNumber} onChange={update} /></label>
          <label className="form-wide">Practice address<input name="clinicAddress" maxLength="500" value={profile.clinicAddress} onChange={update} /></label>
          <label>City or locality<input name="city" maxLength="120" value={profile.city} onChange={update} /></label>
          <label>State or region<input name="stateRegion" maxLength="120" value={profile.stateRegion} onChange={update} /></label>
          <label>Postal code<input name="postalCode" maxLength="24" value={profile.postalCode} onChange={update} /></label>
          <fieldset className="mode-fieldset form-wide"><legend>Consultation modes</legend>{['in-person', 'online'].map((mode) => <label key={mode}><input type="checkbox" checked={profile.consultationModes.includes(mode)} onChange={(event) => setProfile((current) => ({ ...current, consultationModes: event.target.checked ? [...current.consultationModes, mode] : current.consultationModes.filter((value) => value !== mode) }))} />{mode === 'in-person' ? 'In person' : 'Online'}</label>)}</fieldset>
        </div></section>
        <button className="btn" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving profile…' : 'Save professional profile'}</button>
      </form>
      <section className="portal-section schedule-section" id="availability"><div className="portal-section-heading"><p className="eyebrow">IST · ASIA/KOLKATA</p><h3>Weekly working hours</h3><p>Set your patient-facing appointment availability in India Standard Time.</p></div>
        {loadingSchedule ? <p role="status">Loading availability…</p> : <form onSubmit={saveSchedule}>
          {days.map((day, weekday) => <div className="schedule-day" key={day}><div className="schedule-day-heading"><strong>{day}</strong><button type="button" className="btn-secondary" onClick={() => addWindow(weekday)}>Add hours</button></div>
            {windows.filter((window) => window.weekday === weekday).map((window) => { const index = windows.indexOf(window); return <div className="schedule-window" key={`${weekday}-${index}`}><label>From<input type="time" value={window.startTime} onChange={(event) => changeWindow(index, 'startTime', event.target.value)} required /></label><label>To<input type="text" inputMode="numeric" pattern="(?:[01]\d|2[0-3]):[0-5]\d|24:00" placeholder="HH:MM" value={window.endTime} onChange={(event) => changeWindow(index, 'endTime', event.target.value)} required /></label><span>30-minute slots</span><button type="button" className="text-button" aria-label={`Remove ${day} hours`} onClick={() => setWindows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>; })}
            {windows.every((window) => window.weekday !== weekday) && <p className="schedule-off">Not accepting appointments</p>}
          </div>)}
          <button className="btn" type="submit" disabled={savingSchedule}>{savingSchedule ? 'Saving hours…' : 'Save working hours'}</button>
        </form>}
      </section>
      <section className="portal-section schedule-section"><div className="portal-section-heading"><h3>Time off and blocked dates</h3><p>Blocking a time period is not allowed when it overlaps an existing appointment.</p></div>
        <form className="time-block-form" onSubmit={addBlock}><label>Start (IST)<input type="datetime-local" value={blockForm.startsAt} onChange={(event) => setBlockForm({ ...blockForm, startsAt: event.target.value })} required /></label><label>End (IST)<input type="datetime-local" value={blockForm.endsAt} onChange={(event) => setBlockForm({ ...blockForm, endsAt: event.target.value })} required /></label><label>Reason (optional)<input maxLength="240" value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} /></label><button type="submit" className="btn">Block time</button></form>
        {blocks.length ? <ul className="time-block-list">{blocks.map((block) => <li key={block.id}><span><strong>{formatIstDateTime(block.startsAt)} – {formatIstDateTime(block.endsAt)}</strong>{block.reason && <small>{block.reason}</small>}</span><button type="button" className="btn-secondary" onClick={() => deleteBlock(block.id)}>Remove block</button></li>)}</ul> : <p className="empty-state">No upcoming time off.</p>}
      </section>
    </section>
  );
}
