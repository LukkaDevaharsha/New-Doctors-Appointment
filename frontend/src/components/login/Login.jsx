import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import { loginUser } from '../../api';
import useAuth from '../../auth/useAuth';
import '../login/Login.css';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [role, setRole] = useState('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await loginUser({ ...formData, role });
      await login(data);
      if (!data.emailVerified) navigate(`/verify-email?email=${encodeURIComponent(data.email || formData.email)}`);
      else navigate(data.role === 'patient' ? '/patient-dashboard' : '/doctor-dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'We could not sign you in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="whole auth-page">
      <div className="auth-shell">
        <div className="auth-aside"><span className="auth-mark">AMC</span><p className="eyebrow">Care, made more connected</p><h1>Your health deserves a simpler next step.</h1><p>Find trusted care, manage your appointments, and keep your health information close at hand.</p></div>
        <section className="auth-container" aria-labelledby="login-title">
          <div className="auth-intro"><p className="eyebrow">WELCOME BACK</p><h2 id="login-title" className="auth-heading">Sign in to your account</h2><p>Use your registered email and password to continue.</p></div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <div className="form-group"><label htmlFor="login-role">Account type</label><select id="login-role" value={role} onChange={(event) => setRole(event.target.value)}><option value="patient">Patient</option><option value="doctor">Doctor</option></select></div>
            <div className="form-group"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" name="email" autoComplete="username" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required /></div>
            <div className="form-group"><label htmlFor="login-password">Password</label><div className="password-control"><input id="login-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} required /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <HiEyeOff aria-hidden="true" /> : <HiEye aria-hidden="true" />}</button></div></div>
            <div className="auth-meta"><Link to="/verify-email">Need a verification email?</Link></div>
            <div className="auth-meta"><Link to="/forgot-password">Forgot your password?</Link></div>
            <button type="submit" className="btn auth-btn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in securely'}</button>
          </form>
          <p className="auth-switch">New to Alpha Medical Care? <Link to="/signup">Create an account</Link></p>
        </section>
      </div>
    </main>
  );
}
