/** AFTER WAD LAB */

import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import AuthContext from './auth/context';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    const email = localStorage.getItem('email');
    const name = localStorage.getItem('name');
    const emailVerified = localStorage.getItem('emailVerified') === 'true';
    return token && userId && role ? { _id: userId, userId, role, email, name, emailVerified } : null;
  });

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);
    window.addEventListener('auth:expired', handleExpiredSession);
    return () => window.removeEventListener('auth:expired', handleExpiredSession);
  }, []);

  const login = useCallback((userData) => {
    const userInfo = {
      _id: userData.userId,
      userId: userData.userId,
      email: userData.email,
      role: userData.role,
      name: userData.name,
      emailVerified: userData.emailVerified === true
    };
    setUser(userInfo);
    localStorage.setItem('token', userData.token);
    localStorage.setItem('userId', userData.userId);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('email', userData.email);
    localStorage.setItem('name', userData.name);
    localStorage.setItem('emailVerified', String(userInfo.emailVerified));

  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('name');
    localStorage.removeItem('emailVerified');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = { children: PropTypes.node.isRequired };

