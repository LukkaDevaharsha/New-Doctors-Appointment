import {services} from "../../assets/data/services";
import ServicesCard from '../services/ServicesCard';
import './ServicesList.css';
import './Services.css';

const Services = () => {
  return <section className="services-page">
    <div className="container">
      <div className="services-page-intro"><p className="eyebrow">ALPHA MEDICAL CARE</p><h1>Services for your care journey</h1><p>Practical tools to help you connect with a doctor and manage your health information.</p></div>
      <div className='services-list'>
      {services.map((item, index) => (
        <ServicesCard item={item} index={index} key={index} />
      ))}
      </div>
    </div>
  </section>
}

export default Services
