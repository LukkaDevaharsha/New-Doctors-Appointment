import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/header/Header';
import Footer from './components/footer/Footer';



// Importing Pages
import Home from './components/home/Home';
import Services from './components/services/Services';
import Login from './components/login/Login';
import Signup from './components/Signup/Signup';
import Contact from './components/contact/Contact';
import Doctors from './components/Doctors/Doctors';
import DoctorDetails from './components/Doctors/DoctorDetails';
import Feedback from './components/Doctors/Feedback';

// Import Doctor Dashboard components
import DoctorDashboard from './components/dashboard/doctorDashboard/DoctorDashboard.jsx';
import DoctorProfile from './components/dashboard/doctorDashboard/DoctorProfile.jsx';
import DoctorAppointments from './components/dashboard/doctorDashboard/DoctorAppointments.jsx';
import DoctorOverview from './components/dashboard/doctorDashboard/DoctorOverview.jsx';
import DoctorPatients from './components/dashboard/doctorDashboard/DoctorPatients.jsx';

import PatientDashboard from './components/dashboard/patientDashboard/PatientDashboard.jsx';
import PatientProfile from './components/dashboard/patientDashboard/PatientProfile.jsx';
import PatientAppointments from './components/dashboard/patientDashboard/PatientAppoinments.jsx'
import PatientOverview from './components/dashboard/patientDashboard/PatientOverview.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import VerifyEmail from './components/auth/VerifyEmail.jsx';
import MedicalRecords from './components/dashboard/patientDashboard/MedicalRecords.jsx';
import DashboardSettings from './components/dashboard/DashboardSettings.jsx';
import About from './components/about/About.jsx';
import ForgotPassword from './components/auth/ForgotPassword.jsx';
import ResetPassword from './components/auth/ResetPassword.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith('/patient-dashboard') || pathname.startsWith('/doctor-dashboard');

  return (
    <div className="app-shell">
      <ScrollToTop />
      {!isDashboard && <Header />}
      <main className="app-main">
       <Routes>
        {/* Home Page */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={<About />} />

        {/* Doctors Page */}
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorDetails />} />

        {/* Authentication Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Services and Contact Pages */}
        <Route path="/services" element={<Services />} />
        <Route path="/contact" element={<Contact />} />

        {/* Feedback path */}
        <Route path="/feedback" element={<Feedback />} />

        {/* Doctor Dashboard Routes */}
        <Route element={<ProtectedRoute roles={['doctor']} />}>
        <Route path="/doctor-dashboard" element={<DoctorDashboard />}>
          <Route index element={<DoctorOverview />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="availability" element={<DoctorProfile />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="settings" element={<DashboardSettings />} />
        </Route>
        </Route>

        {/* Patient Dashboard Routes */}
        <Route element={<ProtectedRoute roles={['patient']} />}>
        <Route path="/patient-dashboard" element={<PatientDashboard />}>
          <Route index element={<PatientOverview />} />
          <Route path="find-doctors" element={<Doctors />} />
          <Route path="profile" element={<PatientProfile />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="records" element={<MedicalRecords />} />
          <Route path="settings" element={<DashboardSettings />} />
        </Route>
        </Route>

        {/* Fallback Route for non-existent pages */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
       </Routes>
      </main>
      {!isDashboard && <Footer />}
    </div>
  );
}

export default App;
