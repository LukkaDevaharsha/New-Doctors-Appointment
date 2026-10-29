import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../api';
import '../login/Login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try { const { data } = await requestPasswordReset(email.trim()); setMessage(data.message); }
    catch (requestError) { setError(requestError.response?.data?.message || 'We could not process that request right now.'); }
    finally { setLoading(false); }
  }

  return <main className="whole auth-page"><section className="auth-container verification-card" aria-labelledby="forgot-title">
    <div className="auth-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1 id="forgot-title" className="auth-heading">Reset your password</h1><p>Enter your account email. If it matches an account, we’ll send a one-time reset link.</p></div>
    {message && <p className="alert alert-success" role="status">{message}</p>}{error && <p className="alert alert-error" role="alert">{error}</p>}
    <form className="auth-form verification-form" onSubmit={submit}><div className="form-group"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><button className="btn auth-btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button></form>
    <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
  </section></main>;
}
