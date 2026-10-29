import { Link } from 'react-router-dom';
import { BsArrowRight } from 'react-icons/bs'; // Assuming you're using this icon
import PropTypes from 'prop-types';
import './ServicesCard.css'; // Import the CSS file for ServicesCard

const ServicesCard = ({ item, index }) => {
  const { name, desc } = item;

  return (
    <div className='services-card'>
      <div className="service-index-circle">{index + 1}</div> {/* Index in a rounded circle */}
      <h2 className='services-card-title'>{name}</h2>
      <p className='services-card-desc'>{desc}</p>
    
      <div className='services-card-footer'>
        <Link to="/doctors" className="icon-link" aria-label={`Find a doctor for ${name}`}>
          <div className="circle-icon">
            <BsArrowRight className="arrow-icon" />
          </div>
        </Link>
      </div>
    </div>
  );
};

ServicesCard.propTypes = { item: PropTypes.shape({ name: PropTypes.string, desc: PropTypes.string, title: PropTypes.string, description: PropTypes.string }).isRequired, index: PropTypes.number.isRequired };

export default ServicesCard;
