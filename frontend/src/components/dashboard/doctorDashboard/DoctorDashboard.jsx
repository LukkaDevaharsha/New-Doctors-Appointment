// import React, { useState } from 'react';
// import { Outlet, Link, useLocation } from 'react-router-dom';
// import Logout from './Logout';
// import './DoctorDashboard.css';

// const DoctorDashboard = () => {
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const location = useLocation();

//   const toggleMenu = () => {
//     setIsMenuOpen(!isMenuOpen);
//   };

//   return (
//     <div className="doctor-dashboard">
//       <header className="dashboard-header">
//         <div className="hamburger" onClick={toggleMenu}>
//           <div className="line"></div>
//           <div className="line"></div>
//           <div className="line"></div>
//         </div>
//         <h1>Doctor Dashboard</h1>
//         <Logout />
//       </header>
//       <div className="dashboard-content">
//         <aside className={`dashboard-sidebar ${isMenuOpen ? 'open' : ''}`}>
//           <nav>
//             <ul>
//               <li>
//                 <Link 
//                   to="/doctor-dashboard/profile" 
//                   className={location.pathname.includes('/profile') ? 'active' : ''}
//                 >
//                   Profile
//                 </Link>
//               </li>
//               <li>
//                 <Link 
//                   to="/doctor-dashboard/appointments" 
//                   className={location.pathname.includes('/appointments') ? 'active' : ''}
//                 >
//                   Appointments
//                 </Link>
//               </li>
//             </ul>
//           </nav>
//         </aside>
//         <main className="dashboard-main">
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// };

// export default DoctorDashboard;



import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import Logout from './Logout';
import { getUserDetails } from '../../../api';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');

        if (!userId || !token || !role) {
          throw new Error('Missing user information in localStorage');
        }

        const response = await getUserDetails(userId);
        setUser(response.data);
      } catch (error) {
        setError('Failed to load your account. Please sign in again.');
        // Redirect to login if there's an authentication error
        if (error.response && [401, 403].includes(error.response.status)) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };

    fetchUserDetails();
  }, [navigate]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') setIsMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="doctor-dashboard">
      <header className="dashboard-header">
        <button type="button" className="hamburger" aria-label={isMenuOpen ? 'Close dashboard navigation' : 'Open dashboard navigation'} aria-controls="doctor-dashboard-navigation" aria-expanded={isMenuOpen} onClick={toggleMenu}>
          <span className="line"></span><span className="line"></span><span className="line"></span>
        </button>
        <h1 className='hh1'>Doctor Dashboard</h1>
        <Logout user={user} />
      </header>
      <div className="dashboard-content">
        {isMenuOpen && <button className="dashboard-scrim" type="button" aria-label="Close dashboard navigation" onClick={() => setIsMenuOpen(false)} />}
        <aside id="doctor-dashboard-navigation" className={`dashboard-sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="dashboard-mobile-nav-heading">
            <span>Navigation</span>
            <button type="button" className="dashboard-nav-close" aria-label="Close dashboard navigation" onClick={() => setIsMenuOpen(false)}>Close</button>
          </div>
          <nav aria-label="Doctor dashboard navigation">
            <ul>
              <li><Link to="/doctor-dashboard" className={location.pathname === '/doctor-dashboard' ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Overview</Link></li>
              <li>
                <Link 
                  to="/doctor-dashboard/profile" 
                  className={location.pathname.includes('/profile') ? 'active' : ''} onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
              </li>
              <li>
                <Link 
                  to="/doctor-dashboard/appointments" 
                  className={location.pathname.includes('/appointments') ? 'active' : ''} onClick={() => setIsMenuOpen(false)}
                >
                  Appointments
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
        <main className="dashboard-main">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
};

export default DoctorDashboard;
