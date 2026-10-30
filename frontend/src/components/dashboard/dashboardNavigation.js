import { FiCalendar, FiClock, FiFolder, FiHome, FiSearch, FiSettings, FiUser, FiUsers } from 'react-icons/fi';

const patientNavigation = [
  { label: 'Overview', to: '/patient-dashboard', icon: FiHome, end: true },
  { label: 'Find Doctors', to: '/patient-dashboard/find-doctors', icon: FiSearch },
  { label: 'My Appointments', to: '/patient-dashboard/appointments', icon: FiCalendar },
  { label: 'Medical Records', to: '/patient-dashboard/records', icon: FiFolder },
  { label: 'My Profile', to: '/patient-dashboard/profile', icon: FiUser },
  { label: 'Settings', to: '/patient-dashboard/settings', icon: FiSettings },
];

const doctorNavigation = [
  { label: 'Overview', to: '/doctor-dashboard', icon: FiHome, end: true },
  { label: 'Appointments', to: '/doctor-dashboard/appointments', icon: FiCalendar },
  { label: 'My Patients', to: '/doctor-dashboard/patients', icon: FiUsers },
  { label: 'Schedule / Availability', to: '/doctor-dashboard/availability', icon: FiClock },
  { label: 'My Profile', to: '/doctor-dashboard/profile', icon: FiUser, end: true },
  { label: 'Settings', to: '/doctor-dashboard/settings', icon: FiSettings },
];

export const getDashboardNavigation = (role) => role === 'patient' ? patientNavigation : doctorNavigation;
