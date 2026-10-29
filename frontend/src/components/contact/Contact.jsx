// import React from 'react';
// import '../contact/Contact.css';

// const Contact = () => {
//   return (
//     <section>
//       <div className="max-w-screen-md px-4 mx-auto">
//         <h2 className="mb-8 text-center">Contact Us</h2>
//         <p className="mb-8 font-light text-center lg:mb-16 text_para">
//           If you have any technical issues or want to send feedback, let us know.
//         </p>
//         <form action="#" className="space-y-8">
//           <div>
//             <label htmlFor="email" className="form_label">
//               Enter your email address
//             </label>
//             <input
//               type="email"
//               id="email"
//               placeholder="abcd@gmail.com"
//               className="form_input mt-1"
//             />
//           </div>
//         </form>
//       </div>
//     </section>
//   );
// }

// export default Contact;


import '../contact/Contact.css';

const Contact = () => {
  return (
    <section className="contact_section">
      <div className="container">
        <h2>Contact Us</h2>
        <p className="text_para">
          If you have questions, issues, or feedback, please do not hesitate to contact us.
        </p>
        <form className="contact_form">
          <div className="form_group_row">
            <div className="form_group">
              <label htmlFor="name" className="form_label">Name</label>
              <input type="text" id="name" className="form_input" placeholder="Your Name" required />
            </div>
            <div className="form_group">
              <label htmlFor="email" className="form_label">Email</label>
              <input type="email" id="email" className="form_input" placeholder="your.email@example.com" required />
            </div>
          </div>
          <div className="form_group">
            <label htmlFor="subject" className="form_label">Subject</label>
            <select id="subject" className="form_select" required>
              <option value="">Select a subject</option>
              <option value="general">General Inquiry</option>
              <option value="appointment">Appointment Request</option>
              <option value="feedback">Feedback</option>
              <option value="technical">Technical Support</option>
            </select>
          </div>
          <div className="form_group">
            <label htmlFor="message" className="form_label">Message</label>
            <textarea id="message" className="form_textarea" placeholder="Your message here..." required></textarea>
          </div>
          <div className="form_checkbox">
            <input type="checkbox" id="terms" required />
            <label htmlFor="terms">I agree to the terms and conditions</label>
          </div>
          <button type="submit" className="submit_btn">Send Message</button>
        </form>
      </div>
    </section>
  );
}

export default Contact;
