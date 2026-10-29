import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../../api';
import '../login/Login.css';

export default function Signup() {
  const [values, setValues] = useState({ role: '', name: '', email: '', password: '', confirmPassword: '', contactNumber: '', age: '', gender: '', address: '', specialization: '', hospitalName: '' });
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (values.password.length < 10 || values.password.length > 128 || !/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/\d/.test(values.password) || !/[^A-Za-z0-9]/.test(values.password)) return setError('Use 10 to 128 characters with uppercase, lowercase, number, and symbol characters.');
    const phoneDigits = values.contactNumber.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15 || !/^\+?[0-9 ()-]{7,24}$/.test(values.contactNumber.trim())) return setError('Enter a valid contact number with 7 to 15 digits.');
    if (values.password !== values.confirmPassword) return setError('Passwords do not match.');
    if (!image) return setError('Choose a profile photo to continue.');
    setLoading(true);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => { if (key !== 'confirmPassword') formData.append(key, value.trim()); });
    formData.set('image', image);
    try {
      const { data } = await registerUser(formData);
      if (data.success) navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
      else setError(data.message || 'Registration could not be completed.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="whole auth-page auth-page-register">
      <section className="auth-container auth-register" aria-labelledby="signup-title">
        <div className="auth-intro"><p className="eyebrow">GET STARTED</p><h1 id="signup-title" className="auth-heading">Create your account</h1><p>Set up a secure account to connect with your care team.</p></div>
        <form className="auth-form signup-form" onSubmit={handleSubmit}>
          {error && <p className="alert alert-error form-wide" role="alert">{error}</p>}
          <div className="form-group"><label htmlFor="signup-role">I am registering as</label><select id="signup-role" name="role" value={values.role} onChange={update} required><option value="">Choose account type</option><option value="patient">Patient</option><option value="doctor">Doctor</option></select></div>
          <div className="form-group"><label htmlFor="signup-name">Full name</label><input id="signup-name" name="name" autoComplete="name" maxLength="100" value={values.name} onChange={update} required /></div>
          <div className="form-group"><label htmlFor="signup-email">Email address</label><input id="signup-email" name="email" type="email" autoComplete="email" value={values.email} onChange={update} required /></div>
          <div className="form-group"><label htmlFor="signup-phone">Contact number</label><input id="signup-phone" name="contactNumber" type="tel" autoComplete="tel" pattern="\+?[0-9 ()-]{7,24}" title="Enter a contact number with 7 to 15 digits." value={values.contactNumber} onChange={update} required /></div>
          <div className="form-group"><label htmlFor="signup-age">Age</label><input id="signup-age" name="age" type="number" min="1" max="120" value={values.age} onChange={update} required /></div>
          <div className="form-group"><label htmlFor="signup-gender">Gender</label><select id="signup-gender" name="gender" value={values.gender} onChange={update} required><option value="">Choose an option</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option></select></div>
          <div className="form-group"><label htmlFor="signup-password">Password</label><input id="signup-password" name="password" type="password" autoComplete="new-password" minLength="10" maxLength="128" value={values.password} onChange={update} required /><small>Use 10 to 128 characters, including uppercase, lowercase, a number, and a symbol.</small></div>
          <div className="form-group"><label htmlFor="signup-confirm">Confirm password</label><input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={update} required /></div>
          {values.role === 'patient' && <div className="form-group form-wide"><label htmlFor="signup-address">Address</label><input id="signup-address" name="address" autoComplete="street-address" value={values.address} onChange={update} required /></div>}
          {values.role === 'doctor' && <><div className="form-group"><label htmlFor="signup-specialty">Specialization</label><input id="signup-specialty" name="specialization" value={values.specialization} onChange={update} required /></div><div className="form-group"><label htmlFor="signup-hospital">Hospital or clinic</label><input id="signup-hospital" name="hospitalName" value={values.hospitalName} onChange={update} required /></div></>}
          <div className="form-group form-wide"><label htmlFor="signup-photo">Profile photo <span className="field-hint">JPEG, PNG, or WebP · up to 3 MB</span></label><input id="signup-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} required /></div>
          <button type="submit" className="btn auth-btn form-wide" disabled={loading}>{loading ? 'Creating your account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
