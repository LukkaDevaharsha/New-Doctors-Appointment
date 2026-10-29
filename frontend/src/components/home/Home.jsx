import { Link } from 'react-router-dom';
import { HiOutlineCalendar, HiOutlineClipboardDocumentList, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import homeImage from '../../assets/images/home2.jpg';
import './Home.css';
import About from '../about/About';
import ServicesList from '../services/ServicesList';
import DoctorList from '../theDoctors/DoctorList';

export default function Home() {
  return (
    <>
      <section className="home-section">
        <div className="container content">
          <div className="text-container">
            <p className="hero-kicker">ALPHA MEDICAL CARE</p>
            <h1 className="heading">Care that fits your life.</h1>
            <p className="paragraph">Find a doctor, request an appointment, and keep your health information organized in one secure place.</p>
            <div className="home-actions"><Link className="btn" to="/doctors">Find a doctor</Link><Link className="btn btn-secondary" to="/services">Explore services</Link></div>
          </div>
          <div className="image-container"><img className="home-image" src={homeImage} alt="Care team ready to support patients" /></div>
        </div>
      </section>
      <section className="home-assurance" aria-label="Care platform highlights"><div className="container"><div><strong>Care team access</strong><span>Explore doctor profiles and specialties</span></div><div><strong>Simple scheduling</strong><span>Request a visit that works for you</span></div><div><strong>Health information</strong><span>Manage records in your patient portal</span></div></div></section>
      <section className="home-block">
        <div className="container"><div className="home-block-heading"><p className="eyebrow">A CLEARER PATH TO CARE</p><h2>Everything you need for your next step</h2><p>Find the right information and manage your care from one connected platform.</p></div>
          <div className="home-quick-links"><Link to="/doctors" className="home-quick-link"><HiOutlineMagnifyingGlass aria-hidden="true" /><strong>Find a doctor</strong><span>Browse the care team and review each doctor’s profile.</span></Link><Link to="/doctors" className="home-quick-link"><HiOutlineCalendar aria-hidden="true" /><strong>Request an appointment</strong><span>Choose a date and time from a doctor’s profile.</span></Link><Link to="/login" className="home-quick-link"><HiOutlineClipboardDocumentList aria-hidden="true" /><strong>Manage your records</strong><span>Sign in to organize your history and documents.</span></Link></div>
        </div>
      </section>
      <section className="home-service-section"><div className="container"><div className="home-block-heading"><p className="eyebrow">OUR SERVICES</p><h2>Support for your care journey</h2><p>Tools to help you connect with healthcare and manage your information.</p></div><ServicesList /></div></section>
      <About />
      <section className="home-doctors-section"><div className="container"><div className="home-block-heading"><p className="eyebrow">MEET THE CARE TEAM</p><h2>Find a doctor for your needs</h2><p>Explore doctor profiles and learn about their specialties.</p><Link to="/doctors" className="text-link">View all doctors</Link></div><DoctorList /></div></section>
    </>
  );
}
