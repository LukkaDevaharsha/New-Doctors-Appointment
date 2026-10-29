import { services } from './../../assets/data/services';
import ServicesCard from './ServicesCard';
import './ServicesList.css'; // Import the CSS file for ServicesList

const ServicesList = () => {
  return (
    <div className='services-list'>
      {services.map((item, index) => (
        <ServicesCard item={item} index={index} key={index} />
      ))}
    </div>
  );
};

export default ServicesList;
