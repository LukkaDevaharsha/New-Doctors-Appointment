import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { resendVerificationEmail, verifyEmail } from '../../api';
import '../login/Login.css';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token');
  const verificationStarted = useRef(false);
  const [email, setEmail] = useState(params.get('email') || '');
  const [message, setMessage] = useState(token ? 'Checking your verification link…' : location.state?.notice || 'Enter your account email and we will send a new verification link.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token || verificationStarted.current) return undefined;
    verificationStarted.current = true;
    let active = true;
    verifyEmail(token)
      .then((response) => { if (active) { setMessage(response.data.message || 'Your email has been verified.'); setVerified(true); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'This verification link could not be confirmed. Request a new link and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function handleResend(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await resendVerificationEmail(email.trim());
      setMessage(response.data.message || 'If the account needs verification, a new email has been sent.');
    } catch (requestError) {
      const retryAfter = Number(requestError.response?.headers?.['retry-after']);
      const retryText = retryAfter ? ` Try again in about ${Math.ceil(retryAfter / 60)} minute(s).` : '';
      setError((requestError.response?.data?.message || (requestError.response ? 'The verification email request failed.' : 'Could not reach the email service. Check your connection and try again.')) + retryText);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="whole auth-page">
      <section className="auth-container verification-card" aria-labelledby="verify-title">
        <div className="auth-intro"><p className="eyebrow">ACCOUNT SECURITY</p><h1 id="verify-title" className="auth-heading">{verified ? 'Email verified' : 'Verify your email'}</h1><p>{verified ? 'Your address is confirmed. Sign in to continue to your account.' : 'Email verification protects your account and keeps your care information secure.'}</p></div>
        {loading && <p className="alert" role="status">{token ? 'Checking your verification link…' : 'Sending your request…'}</p>}
        {!loading && message && <p className={`alert ${verified ? 'alert-success' : ''}`} role="status">{message}</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!verified && <form className="auth-form verification-form" onSubmit={handleResend}>
          <div className="form-group"><label htmlFor="verify-email">Email address</label><input id="verify-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <button className="btn auth-btn" type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Send a new verification link'}</button>
        </form>}
        {verified ? <p className="auth-switch"><Link to="/login">Sign in to your account</Link></p> : <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>}
      </section>
    </main>
  );
}
