/** BEFORE WAD LAB */

// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import App from './App.jsx'
// import './index.css'
// import { BrowserRouter } from 'react-router-dom'


// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </StrictMode>,
// )


/** AFTER WAD LAB */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './design-system.css'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext.jsx'  // Note the .jsx extension

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>  {/* Add this line */}
        <App />
      </AuthProvider>  {/* Add this line */}
    </BrowserRouter>
  </StrictMode>,
)
