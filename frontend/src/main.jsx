import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--color-bancada)',
                color: 'var(--color-cal)',
                border: '1px solid var(--color-junta-forte)',
                borderRadius: 'var(--radius-controle)',
                boxShadow: 'var(--shadow-flutua)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-apoio)',
              },
              success: { iconTheme: { primary: 'var(--color-ok)', secondary: 'var(--color-piche)' } },
              error: { iconTheme: { primary: 'var(--color-danger-solido)', secondary: 'var(--color-cal)' } },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
