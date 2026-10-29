import './About.css';

export default function About() {
  return (
    <section className="about-section">
      <div className="container"><div className="about-box">
        <p className="eyebrow">ABOUT ALPHA MEDICAL CARE</p>
        <h2 className="about-heading">A more connected way to manage everyday care.</h2>
        <ul className="feature-list">
          <li className="feature-item"><strong>Find care:</strong> Browse doctor profiles and specialties in one place.</li>
          <li className="feature-item"><strong>Plan visits:</strong> Request, review, cancel, or reschedule appointments through your account.</li>
          <li className="feature-item"><strong>Organize health details:</strong> Maintain your medical history and private documents in the patient portal.</li>
          <li className="feature-item"><strong>Stay in control:</strong> Share documents with treating doctors and revoke access when needed.</li>
        </ul>
      </div></div>
    </section>
  );
}
