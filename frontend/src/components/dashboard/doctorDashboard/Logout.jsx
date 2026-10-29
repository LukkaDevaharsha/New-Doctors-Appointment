// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import './Logout.css';

// const Logout = ({ user }) => {
//   const navigate = useNavigate();
  
//   const handleLogout = () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('userId');
    
//     navigate('/login');
//   };

//   return (
//     <div className="logout">
//       <div className="logout-info">
//         {user && user.imagePath ? (
//           <img src={`http://localhost:5000/${user.imagePath}`} alt="Profile" className="profile-image" />
//         ) : (
//           <div className="default-avatar">{user ? user.name.charAt(0) : ''}</div>
//         )}
//         <div className="user-details">
//           <p className="username">{user ? user.name : 'Loading...'}</p>
//           <p className="user-role">Patient</p>
//         </div>
//       </div>
//       <button onClick={handleLogout} className="logout-button">
//         <i className="fas fa-sign-out-alt"></i> Logout
//       </button>
//     </div>
//   );
// };

// export default Logout;


// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import './Logout.css';

// const Logout = ({ user }) => {
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     // Clear localStorage
//     localStorage.removeItem('token');
//     localStorage.removeItem('userId');
//     localStorage.removeItem('role');
    
//     // Redirect to login page
//     navigate('/login');
//   };

//   return (
//     <div className="logout-container">
//       {user && (
//         <span className="user-greeting">
//           Hello, {user.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : 'User'}
//         </span>
//       )}
//       <button onClick={handleLogout} className="logout-button">Logout</button>
//     </div>
//   );
// };

// export default Logout;



import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/useAuth';
import './Logout.css';

const Logout = ({ user }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine the display name
  const displayName = user?.name || 'Doctor';

  return (
    <div className="logout-container">
      <span className="user-greeting">
        Hello, {displayName}
      </span>
      <button type="button" onClick={handleLogout} className="logout-button">Logout</button>
    </div>
  );
};

Logout.propTypes = { user: PropTypes.shape({ name: PropTypes.string }) };

export default Logout;
