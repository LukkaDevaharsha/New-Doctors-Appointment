import { Link, useOutletContext } from 'react-router-dom';

export default function DashboardSettings() {
  const { user, role } = useOutletContext();
  const profilePath = role === 'doctor' ? '/doctor-dashboard/profile' : '/patient-dashboard/profile';
  return (
    <section className="dashboard-settings-page">
      <header className="dashboard-page-heading"><p className="eyebrow">ACCOUNT PREFERENCES</p><h2>Settings</h2><p>Review your account status and profile details.</p></header>
      <article className="settings-card">
        <div className="settings-card-icon"><span aria-hidden="true">{String(user.name || '?').slice(0, 1).toUpperCase()}</span></div>
        <div className="settings-card-content"><p className="eyebrow">SIGNED IN AS {role.toUpperCase()}</p><h3>{user.name}</h3><p>{user.email}</p><p className={user.emailVerified ? 'settings-verified' : 'settings-unverified'}>{user.emailVerified ? 'Email verified' : 'Email verification required'}</p></div>
        <Link className="btn-secondary" to={profilePath}>Edit profile</Link>
      </article>
      <p className="settings-note">To update your contact and account details, use your profile page. Account security and verification settings are managed by the application.</p>
    </section>
  );
}
