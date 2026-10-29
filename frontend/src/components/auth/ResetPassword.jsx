import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api';
import '../login/Login.css';

const passwordIsValid = (password) => password.length >= 10 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const token = params.get('token') || '';

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!token) return setError('This reset link is missing its security token. Request a new one.');
    if (!passwordIsValid(password)) return setError('Use 10 to 128 characters with uppercase, lowercase, number, and symbol characters.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try { const { data } = await resetPassword(token, password); setMessage(data.message); }
    catch (requestError) { setError(requestError.response?.data?.message || 'This reset link could not be used. Request a new one.'); }
    finally { setLoading(false); }
  }

  return <main className="whole auth-page"><section className="auth-container verification-card" aria-labelledby="reset-title">
    <div className="auth-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1 id="reset-title" className="auth-heading">Choose a new password</h1><p>Use a strong password you have not used for another account.</p></div>
    {message && <p className="alert alert-success" role="status">{message}</p>}{error && <p className="alert alert-error" role="alert">{error}</p>}
    {!message && <form className="auth-form verification-form" onSubmit={submit}><div className="form-group"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength="10" maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} required /><small>10 to 128 characters with uppercase, lowercase, number, and symbol.</small></div><div className="form-group"><label htmlFor="confirm-new-password">Confirm new password</label><input id="confirm-new-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></div><button className="btn auth-btn" type="submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button></form>}
    {message && <p className="auth-switch"><Link to="/login">Sign in with your new password</Link></p>}
    {error && <p className="auth-switch"><Link to="/forgot-password">Request another reset link</Link></p>}
  </section></main>;
}
