import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 15000,
});
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config._hasBearerToken = true;
  }
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && error.config?._hasBearerToken) {
    ['token', 'userId', 'role', 'email', 'name', 'emailVerified'].forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  return Promise.reject(error);
});

export const getAllDoctors = () => api.get('/doctors');
export const getDoctor = (id) => api.get(`/doctors/${id}`);
export const searchDoctorDirectory = (filters) => api.get('/doctors/search', { params: filters }).then((response) => response.data);
export const getDoctorAvailability = (doctorId, date) => api.get(`/doctors/${doctorId}/availability`, { params: { date } }).then((response) => response.data);
export const getDoctorReviews = (id) => api.get(`/doctors/${id}/reviews`);
export const submitDoctorReview = (id, review) => api.post(`/doctors/${id}/reviews`, review);
export const searchDoctors = (term) => api.get(`/doctors/search/${encodeURIComponent(term)}`).then((response) => response.data);
export const getUserDetails = (userId) => api.get(`/user/${userId}`);
export const updateDoctorProfile = (doctorId, profile) => api.put(`/doctor/update/${doctorId}`, profile);
export const updateDoctorPhoto = (doctorId, file) => {
  const form = new FormData();
  form.append('image', file);
  return api.put(`/doctor/profile/${doctorId}/photo`, form);
};
export const getDoctorPhotoUrl = (doctorId) => `${apiBase}/doctors/${doctorId}/photo`;
export const updatePatientProfile = (patientId, profile) => api.put(`/patient/update/${patientId}`, profile);
export const getDoctorSchedule = (doctorId) => api.get(`/doctor/availability/${doctorId}`).then((response) => response.data);
export const saveDoctorSchedule = (doctorId, windows) => api.put(`/doctor/availability/${doctorId}`, { windows });
export const addDoctorTimeBlock = (doctorId, block) => api.post(`/doctor/availability/${doctorId}/blocks`, block);
export const removeDoctorTimeBlock = (doctorId, blockId) => api.delete(`/doctor/availability/${doctorId}/blocks/${blockId}`);
export const registerUser = (userData) => api.post('/register', userData);
export const loginUser = (userData) => api.post('/login', userData);
export const verifyEmail = (token) => api.post('/email/verify', { token });
export const resendVerificationEmail = (email) => api.post('/email/resend', { email });
export const requestPasswordReset = (email) => api.post('/password/forgot', { email });
export const resetPassword = (token, password) => api.post('/password/reset', { token, password });
export const getPatientAppointments = (patientId) => api.get(`/appointments/patient/${patientId}`);
export const getDoctorAppointments = async () => (await api.get('/appointments')).data;
export const addAppointment = (appointmentData) => api.post('/appointments/create', appointmentData);
export const cancelAppointment = (appointmentId, reason = '') => api.patch(`/appointments/${appointmentId}/cancel`, { reason });
export const rescheduleAppointment = (appointmentId, date, reason = '') => api.patch(`/appointments/${appointmentId}/reschedule`, { date, reason });
export const getAppointmentRescheduleHistory = (appointmentId) => api.get(`/appointments/${appointmentId}/reschedule-history`);
export const completeAppointment = (appointmentId) => api.patch(`/appointments/${appointmentId}/complete`);
export const getMedicalHistory = () => api.get('/medical-history');
export const getPatientMedicalHistory = (patientId) => api.get(`/medical-history/patient/${patientId}`);
export const saveMedicalHistory = (history) => api.put('/medical-history', history);
export const getConsultationNotes = (appointmentId) => api.get(`/appointments/${appointmentId}/notes`);
export const saveConsultationNotes = (appointmentId, summary) => api.put(`/appointments/${appointmentId}/notes`, { summary });
export const getDocuments = () => api.get('/documents');
export const uploadDocument = (formData, onUploadProgress) => api.post('/documents', formData, { onUploadProgress });
export const shareDocument = (documentId, doctorId) => api.post(`/documents/${documentId}/share`, { doctorId });
export const revokeDocumentShare = (documentId, doctorId) => api.delete(`/documents/${documentId}/share/${doctorId}`);
export const downloadDocument = (documentId) => api.get(`/documents/${documentId}/download`, { responseType: 'blob' });
export const testDatabaseConnection = () => api.get('/test-connection');
export default api;
