import { Link } from 'react-router-dom';
import logo2 from '../../assets/images/logo2.png';
import { RiLinkedinFill } from 'react-icons/ri';
import { AiFillYoutube, AiFillGithub, AiOutlineInstagram } from 'react-icons/ai';
import './Footer.css'; 

const socialLinks = [
    {
      path: 'https://www.youtube.com/',
      icon: <AiFillYoutube className="w-6 h-6 group-hover:text-white" />,
    },
    {
      path: 'https://github.com/',
      icon: <AiFillGithub className="w-6 h-6 group-hover:text-white" />,
    },
    {
      path: 'https://www.instagram.com/',
      icon: <AiOutlineInstagram className="w-6 h-6 group-hover:text-white" />,
    },
    {
      path: 'https://www.linkedin.com/',
      icon: <RiLinkedinFill className="w-6 h-6 group-hover:text-white" />,
    },
  ];
  

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        {/* Logo, Copyright, and Social Media Links */}
        <div className="logo-container">
          <Link to="/" aria-label="Alpha Medical Care home"><img src={logo2} alt="Alpha Medical Care" className="logo" /></Link>
          {/* <p className="footer-text">© {new Date().getFullYear()} ALPHA MEDICAL CARE. All rights reserved.</p> */}
          <p className="footer-text">ALPHA MEDICAL CARE. All rights reserved.</p>
          
          <div className="social-media">
            {socialLinks.map((social, index) => (
              <a
                key={index}
                href={social.path}
                target="_blank"
                className="social-link"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h4>QUICK LINKS</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/services">Services</Link></li>
          </ul>
        </div>

        {/* I Want To Section */}
        <div className="footer-section">
          <h4>ACTIONS</h4>
          <ul>
            <li><Link to="/doctors">Find a Doctor</Link></li>
            <li><Link to="/doctors">Book an Appointment</Link></li>
            <li><Link to="/services">Our Services</Link></li>
            <li><Link to="/login">Patient Login</Link></li>
          </ul>
        </div>

        {/* Support Section */}
        <div className="footer-section">
          <h4>SUPPORT</h4>
          <ul>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
