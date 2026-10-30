import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../auth/useAuth';
import logo from '../../assets/images/logo2.png';
import { getDashboardNavigation } from './dashboardNavigation';
import './DashboardLayout.css';

export default function DashboardLayout({ role, user, children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(`dashboard-sidebar-${role}`) === 'collapsed');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navigation = getDashboardNavigation(role);
  const currentItem = navigation.find((item) => item.to === pathname) || navigation.find((item) => pathname.startsWith(`${item.to}/`));
  const title = currentItem?.label || (role === 'doctor' ? 'Doctor portal' : 'Patient portal');

  useEffect(() => {
    localStorage.setItem(`dashboard-sidebar-${role}`, collapsed ? 'collapsed' : 'expanded');
  }, [collapsed, role]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const updateViewport = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };
    setIsMobile(media.matches);
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector('a, button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = [...sidebarRef.current.querySelectorAll('a[href], button:not(:disabled)')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  function toggleNavigation() {
    if (isMobile) setDrawerOpen((open) => !open);
    else setCollapsed((value) => !value);
  }

  function signOut() {
    logout();
    setDrawerOpen(false);
    navigate('/login', { replace: true });
  }

  const initials = String(user?.name || (role === 'doctor' ? 'Doctor' : 'Patient'))
    .split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

  return (
    <div className={`dashboard-layout dashboard-${role}`} data-collapsed={collapsed}>
      <header className="dashboard-topbar">
        <button
          ref={menuButtonRef}
          type="button"
          className="dashboard-menu-toggle"
          aria-label={isMobile ? drawerOpen ? 'Close dashboard navigation' : 'Open dashboard navigation' : collapsed ? 'Expand dashboard navigation' : 'Collapse dashboard navigation'}
          aria-controls="dashboard-sidebar"
          aria-expanded={isMobile ? drawerOpen : !collapsed}
          onClick={toggleNavigation}
        >
          {drawerOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
        <Link className="dashboard-brand" to={role === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'} aria-label={`${role} dashboard home`}>
          <img src={logo} alt="Alpha Medical Care" />
        </Link>
        <div className="dashboard-topbar-heading"><span>{role === 'doctor' ? 'DOCTOR WORKSPACE' : 'PATIENT PORTAL'}</span><h1>{title}</h1></div>
        <div className="dashboard-user-menu">
          <span className="dashboard-user-avatar" aria-hidden="true">{initials}</span>
          <span className="dashboard-user-name"><strong>{user?.name}</strong><small>{role === 'doctor' ? 'Doctor' : 'Patient'}</small></span>
        </div>
      </header>

      {drawerOpen && <button className="dashboard-backdrop" type="button" aria-label="Close dashboard navigation" onClick={() => setDrawerOpen(false)} />}
      <div className="dashboard-body">
        <aside
          id="dashboard-sidebar"
          ref={sidebarRef}
          className={`dashboard-sidebar ${drawerOpen ? 'is-open' : ''}`}
          aria-label={`${role} dashboard navigation`}
          aria-modal={drawerOpen || undefined}
          role={drawerOpen ? 'dialog' : undefined}
        >
          <nav>
            <ul>
              {navigation.map(({ label, to, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} title={collapsed ? label : undefined} onClick={() => setDrawerOpen(false)}>
                    <Icon aria-hidden="true" /><span className="dashboard-nav-label">{label}</span><span className="dashboard-nav-tooltip" aria-hidden="true">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="dashboard-logout-link" title={collapsed ? 'Logout' : undefined} onClick={signOut}>
            <FiLogOut aria-hidden="true" /><span className="dashboard-nav-label">Logout</span><span className="dashboard-nav-tooltip" aria-hidden="true">Logout</span>
          </button>
        </aside>
        <main id="dashboard-main" className="dashboard-main" tabIndex="-1">{children}</main>
      </div>
    </div>
  );
}

DashboardLayout.propTypes = {
  role: PropTypes.oneOf(['patient', 'doctor']).isRequired,
  user: PropTypes.shape({ name: PropTypes.string }),
  children: PropTypes.node.isRequired,
};
