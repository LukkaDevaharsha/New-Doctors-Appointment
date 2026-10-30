import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/useAuth';
import { getUserDetails } from '../../../api';
import DashboardLayout from '../DashboardLayout';

export default function DoctorDashboard() {
  const { user: sessionUser, logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getUserDetails(sessionUser.userId).then(({ data }) => { if (active) setUser(data); })
      .catch((requestError) => {
        if (!active) return;
        if ([401, 403].includes(requestError.response?.status)) { logout(); navigate('/login', { replace: true }); }
        else setError('We could not load your account. Please try again.');
      });
    return () => { active = false; };
  }, [logout, navigate, sessionUser.userId]);

  if (error) return <p className="dashboard-load-error" role="alert">{error}</p>;
  if (!user) return <p className="dashboard-loading" role="status">Loading your doctor workspace…</p>;
  return <DashboardLayout role="doctor" user={user}><Outlet context={{ user, role: 'doctor' }} /></DashboardLayout>;
}
