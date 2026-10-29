import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AiFillStar } from 'react-icons/ai';
import { getPatientAppointments, submitDoctorReview } from '../../api';
import useAuth from '../../auth/useAuth';
import './FeedbackForm.css';

export default function FeedbackForm({ doctorId }) {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'patient' || !user.userId) return;
    getPatientAppointments(user.userId)
      .then((response) => setAppointments(response.data.filter((appointment) => String(appointment.doctorId) === doctorId && appointment.status === 'completed')))
      .catch(() => setMessage('Unable to find completed appointments for this doctor.'));
  }, [doctorId, user]);

  if (user?.role !== 'patient') return <p>Sign in as a patient to leave a review. <Link to="/login">Sign in</Link></p>;
  if (user.emailVerified !== true) return <p>Verify your email before submitting a review. <Link to="/verify-email">Verify email</Link></p>;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!appointmentId || !rating || review.trim().length < 8) {
      setMessage('Choose a completed appointment, select a rating, and enter at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const response = await submitDoctorReview(doctorId, { appointmentId, rating, comment: review.trim() });
      setMessage(response.data.message);
      setReview('');
      setRating(0);
      setAppointmentId('');
      setAppointments((current) => current.filter((appointment) => String(appointment._id) !== appointmentId));
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to submit your review.'); }
    finally { setLoading(false); }
  }

  return (
    <form className="feedback-form" onSubmit={handleSubmit}>
      <label htmlFor="review-appointment">Completed appointment</label>
      <select id="review-appointment" required value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
        <option value="">Choose an appointment</option>
        {appointments.map((appointment) => <option key={appointment._id} value={appointment._id}>{new Date(appointment.date).toLocaleString()}</option>)}
      </select>
      <fieldset>
        <legend>Overall experience (required)</legend>
        <div className="rating-stars">
          {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value} className={`star-button ${value <= rating ? 'text-yellowColor' : 'text-gray-400'}`} onClick={() => setRating(value)}>
            <AiFillStar className="star-icon" />
          </button>)}
        </div>
      </fieldset>
      <label htmlFor="review-comment">Share your feedback</label>
      <textarea id="review-comment" className="feedback-textarea-field" rows="5" minLength="8" maxLength="2000" required placeholder="Write a review" value={review} onChange={(event) => setReview(event.target.value)} />
      {message && <p role="status">{message}</p>}
      <button type="submit" className="btn" disabled={loading || appointments.length === 0}>{loading ? 'Submitting…' : 'Submit feedback'}</button>
      {appointments.length === 0 && <p>Reviews are available after a completed visit.</p>}
    </form>
  );
}

FeedbackForm.propTypes = { doctorId: PropTypes.string.isRequired };
