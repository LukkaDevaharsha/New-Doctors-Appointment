import { useEffect, useRef, useState } from 'react';
import { BiMenu, BiX } from 'react-icons/bi';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../auth/useAuth';
import logo from '../../assets/images/logo2.png';
import { getHeaderAuthActions } from './headerAuthActions';
import './Header.css';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const authActions = getHeaderAuthActions(user);
  const isAuthenticated = authActions.includes('logout');

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === 'Escape') setMenuOpen(false); }
    function updateStickyState() { headerRef.current?.classList.toggle('sticky_header', window.scrollY > 12); }
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', updateStickyState, { passive: true });
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', updateStickyState);
    };
  }, []);

  function goToDashboard() {
    if (user?.role === 'doctor') navigate('/doctor-dashboard');
    else if (user?.role === 'patient') navigate('/patient-dashboard');
    else navigate('/login');
    setMenuOpen(false);
  }

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate('/', { replace: true });
  }

  const initials = String(user?.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

  return (
    <header className="header" ref={headerRef}>
      <div className="container">
        <div className="logo-container"><Link to="/" aria-label="Alpha Medical Care home" onClick={() => setMenuOpen(false)}><img src={logo} alt="Alpha Medical Care" className="logo" /></Link></div>
        <nav id="public-navigation" className={`navigation ${menuOpen ? 'show-menu' : ''}`} aria-label="Main navigation" aria-hidden={!menuOpen && undefined}>
          <ul className="menu">
            <li><NavLink to="/home" onClick={() => setMenuOpen(false)} className="nav-link">Home</NavLink></li>
            <li><NavLink to="/doctors" onClick={() => setMenuOpen(false)} className="nav-link">Find a Doctor</NavLink></li>
            <li><NavLink to="/services" onClick={() => setMenuOpen(false)} className="nav-link">Services</NavLink></li>
            <li><NavLink to="/about" onClick={() => setMenuOpen(false)} className="nav-link">About</NavLink></li>
            <li><NavLink to="/contact" onClick={() => setMenuOpen(false)} className="nav-link">Contact</NavLink></li>
          </ul>
        </nav>
        <div className="profile-login">
          {isAuthenticated ? <>
            <button type="button" className="profile-pic" aria-label={`Open ${user.role} dashboard`} onClick={goToDashboard}>{initials}</button>
            <button type="button" className="register-login portal-link" onClick={goToDashboard}>My portal</button>
            <button type="button" className="logout-btn" onClick={handleLogout}>Logout</button>
          </> : <>
            <Link to="/login" className="register-login login-link" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/signup" className="header-register-link" onClick={() => setMenuOpen(false)}>Register</Link>
          </>}
          <button type="button" className="mobile-menu-icon" aria-controls="public-navigation" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <BiX aria-hidden="true" /> : <BiMenu aria-hidden="true" />}</button>
        </div>
      </div>
    </header>
  );
}
