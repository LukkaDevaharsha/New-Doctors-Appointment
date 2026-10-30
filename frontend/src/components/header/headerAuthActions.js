export function getHeaderAuthActions(user) {
  if (user?.role === 'patient' || user?.role === 'doctor') return ['avatar', 'dashboard', 'logout'];
  return ['login', 'register'];
}
