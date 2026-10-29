
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import { formateDate } from '../../utils/formateDate';
import { getDoctorReviews } from '../../api';
import FeedbackForm from './FeedbackForm';
import SidePanel from './SidePanel';
import './Feedback.css';

export default function Feedback({
  doctorId: providedDoctorId,
  doctorName: providedDoctorName,
  showBookingPanel = true,
}) {
  const [queryDoctorId, setQueryDoctorId] = useState('');
  const [queryDoctorName, setQueryDoctorName] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(providedDoctorId));
  const [error, setError] = useState('');

  const location = useLocation();

  const doctorId = providedDoctorId || queryDoctorId;
  const doctorName = providedDoctorName || queryDoctorName;

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    setQueryDoctorName(params.get('doctorName') || '');
    setQueryDoctorId(params.get('doctorId') || '');
  }, [location.search]);

  useEffect(() => {
    setError('');

    if (!doctorId) {
      setReviews([]);
      setLoading(false);
      return undefined;
    }

    let active = true;

    setLoading(true);

    getDoctorReviews(doctorId)
      .then(({ data }) => {
        if (active) {
          setReviews(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (active) {
          setError('Unable to load reviews right now.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [doctorId]);

  return (
    <div
      className={`feedback-container ${
        showBookingPanel ? '' : 'feedback-embedded'
      }`}
    >
      <section
        className="feedback-content"
        aria-labelledby="reviews-title"
      >
        <h2 id="reviews-title" className="feedback-heading">
          Patient reviews <span>({reviews.length})</span>
        </h2>

        {doctorName && (
          <p className="feedback-subtitle">
            Feedback for {doctorName}
          </p>
        )}

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading reviews…</p>}

        {!loading && !error && reviews.length === 0 && (
          <p className="empty-state">
            No reviews have been shared yet.
          </p>
        )}

        {!loading &&
          !error &&
          reviews.map((review, index) => (
            <article
              className="feedback-item"
              key={`${review.createdAt || 'review'}-${index}`}
            >
              <div className="feedback-info">
                <h3 className="feedback-name">Verified patient</h3>

                <p className="feedback-date">
                  {review.createdAt
                    ? formateDate(
                        new Date(review.createdAt)
                          .toISOString()
                          .slice(0, 10)
                      )
                    : 'Recently'}
                </p>

                <p className="doctor-rating">
                  Rating: {review.rating} / 5
                </p>

                <p className="feedback-comment">
                  {review.comment}
                </p>
              </div>
            </article>
          ))}

        {!showFeedbackForm && doctorId && (
          <button
            type="button"
            className="btn"
            onClick={() => setShowFeedbackForm(true)}
          >
            Write a review
          </button>
        )}

        {showFeedbackForm && doctorId && (
          <FeedbackForm doctorId={doctorId} />
        )}

        {!doctorId && (
          <p className="empty-state">
            Choose a doctor profile to view or leave a review.
          </p>
        )}
      </section>

      {showBookingPanel && doctorId && (
        <aside className="side-panel-container">
          <SidePanel
            doctorId={String(doctorId)}
            doctorName={doctorName || 'Doctor'}
          />
        </aside>
      )}
    </div>
  );
}

Feedback.propTypes = {
  doctorId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  doctorName: PropTypes.string,
  showBookingPanel: PropTypes.bool,
};
