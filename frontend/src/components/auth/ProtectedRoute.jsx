import { Navigate, Outlet } from 'react-router-dom';
import PropTypes from 'prop-types';
import useAuth from '../../auth/useAuth';

export default function ProtectedRoute({ roles }) {
  const { user } = useAuth();
  if (!user || !localStorage.getItem('token')) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (user.emailVerified !== true) return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}`} replace />;
  return <Outlet />;
}

ProtectedRoute.propTypes = { roles: PropTypes.arrayOf(PropTypes.string) };
