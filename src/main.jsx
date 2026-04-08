import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { WhisperProvider } from './context/WhisperContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WhisperProvider>
      <App />
    </WhisperProvider>
  </StrictMode>,
)
