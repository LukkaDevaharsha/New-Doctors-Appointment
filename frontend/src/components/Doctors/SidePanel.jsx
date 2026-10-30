
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { dateAtLocalNoon, formatIstDateTime, formatIstTime, getIstDateKey } from '../../utils/istDateTime';
import {
  addAppointment,
  getDoctorAvailability,
  getUserDetails,
} from '../../api';
import useAuth from '../../auth/useAuth';
import './SidePanel.css';

const SidePanel = ({ doctorId, doctorName = 'Doctor' }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [availabilityState, setAvailabilityState] = useState('idle');
  const [availabilityError, setAvailabilityError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  async function toggleBooking() {
    if (user?.role !== 'patient') {
      navigate('/login');
      return;
    }

    if (user.emailVerified !== true) {
      navigate(
        `/verify-email?email=${encodeURIComponent(user.email || '')}`
      );
      return;
    }

    setError('');
    setMessage('');

    if (showCalendar) {
      setShowCalendar(false);
      return;
    }

    if (!contactNumber && user.userId) {
      try {
        const { data } = await getUserDetails(user.userId);
        setContactNumber(data.contactNumber || '');
      } catch {
        // The patient can enter their contact number manually.
      }
    }

    setShowCalendar(true);
  }

  async function loadAvailability(date) {
    if (!date || !doctorId) {
      return;
    }

    setSelectedDate(date);
    setSelectedTime('');
    setAvailabilityState('loading');
    setAvailabilityError('');
    setSlots([]);

    const dateKey = getIstDateKey(date);

    try {
      const result = await getDoctorAvailability(doctorId, dateKey);

      setSlots(Array.isArray(result.slots) ? result.slots : []);
      setAvailabilityState(result.status || 'unavailable');
    } catch (requestError) {
      setAvailabilityError(
        requestError.response?.data?.message ||
          'Unable to check availability for this date.'
      );
      setAvailabilityState('error');
    }
  }

  async function handleBookAppointment(event) {
    event.preventDefault();

    if (!selectedTime || !doctorId) {
      setError('Please select an available appointment time.');
      return;
    }

    if (!contactNumber.trim()) {
      setError('Please enter your contact number.');
      return;
    }

    if (!termsAccepted) {
      setError('Please accept the booking terms to continue.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { data } = await addAppointment({
        doctorId,
        date: selectedTime,
        patientContactNumber: contactNumber.trim(),
        visitReason: visitReason.trim(),
        paymentMethod: 'pay_at_hospital',
      });

      setMessage(
        data?.notificationSent
          ? 'Your appointment is booked. Confirmation emails were sent.'
          : 'Your appointment is booked. Email confirmation could not be confirmed.'
      );

      setVisitReason('');
      setTermsAccepted(false);
      setShowCalendar(false);
      setSelectedDate(null);
      setSelectedTime('');
      setSlots([]);
      setAvailabilityState('idle');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'We could not book this appointment. Please choose another open time.'
      );

      if (selectedDate) {
        await loadAvailability(selectedDate);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="side-panel" aria-label="Book an appointment">
      <p className="eyebrow">Appointments</p>

      <h2>Schedule a visit</h2>

      <p>Choose an open appointment time. Dates and times are shown in India Standard Time.</p>

      {!user && (
        <p className="booking-note">
          Sign in with a patient account to book.
        </p>
      )}

      {user?.role === 'patient' && user.emailVerified !== true && (
        <p className="booking-note">
          Verify your email before booking.
        </p>
      )}

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="alert alert-success" role="status">
          {message}
        </p>
      )}

      <button
        type="button"
        className="btn w-full"
        onClick={toggleBooking}
      >
        {showCalendar
          ? 'Close date picker'
          : user?.role === 'patient'
            ? 'Choose a date'
            : 'Sign in to book'}
      </button>

      {showCalendar && (
        <form
          className="calendar-container"
          onSubmit={handleBookAppointment}
        >
          <label>Appointment date</label>

          <DatePicker
            selected={selectedDate}
            onChange={loadAvailability}
            inline
            minDate={dateAtLocalNoon(getIstDateKey(new Date()))}
          />

          {availabilityState === 'loading' && (
            <p role="status">Checking open times…</p>
          )}

          {availabilityError && (
            <p className="alert alert-error" role="alert">
              {availabilityError}
            </p>
          )}

          {availabilityState === 'unavailable' && (
            <p className="empty-state">
              This doctor has no opening on that date.
            </p>
          )}

          {availabilityState === 'fully-booked' && (
            <p className="empty-state">
              All appointment times are booked for this date.
            </p>
          )}

          {slots.some((slot) => slot.status === 'available') && (
            <fieldset className="available-slots">
              <legend>Available times · IST</legend>

              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    className={`slot-option ${
                      selectedTime === slot.startsAt ? 'selected' : ''
                    }`}
                    disabled={slot.status !== 'available'}
                    aria-pressed={selectedTime === slot.startsAt}
                    onClick={() => setSelectedTime(slot.startsAt)}
                  >
                    {formatIstTime(slot.startsAt)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {availabilityState === 'error' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => selectedDate && loadAvailability(selectedDate)}
            >
              Try again
            </button>
          )}

          {selectedTime && (
            <section
              className="booking-confirmation"
              aria-label="Appointment booking details"
            >
              <h3>Confirm visit details</h3>

              <p>
                <strong>Doctor:</strong> {doctorName}
              </p>

              <p>
                <strong>Date and time:</strong>{' '}{formatIstDateTime(selectedTime)}
              </p>

              <label>
                Contact number
                <input
                  type="tel"
                  pattern="\+?[0-9 ()-]{7,24}"
                  title="Enter 7 to 24 digits, spaces, or phone punctuation."
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  autoComplete="tel"
                  required
                />
              </label>

              <label>
                Reason for visit (optional)
                <textarea
                  value={visitReason}
                  onChange={(event) => setVisitReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </label>

              <fieldset>
                <legend>Payment</legend>

                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked
                    readOnly
                  />
                  Pay at hospital
                </label>

                <p>Online payment is not currently available.</p>
              </fieldset>

              <label className="booking-terms">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  required
                />
                I understand payment is due at the hospital and will contact
                the clinic if I need to change or cancel.
              </label>

              <button
                type="submit"
                className="btn w-full"
                disabled={
                  submitting ||
                  !contactNumber.trim() ||
                  !termsAccepted
                }
              >
                {submitting ? 'Booking…' : 'Confirm appointment'}
              </button>
            </section>
          )}
        </form>
      )}
    </aside>
  );
};

SidePanel.propTypes = {
  doctorId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  doctorName: PropTypes.string,
};

export default SidePanel;
