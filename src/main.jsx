import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './index.css'
import './styles/article-reader.css'
import App from './App.jsx'

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
const legacyRoute = window.location.hash.slice(1)

if (
  (
    window.location.pathname === `${basePath}/` ||
    window.location.pathname === basePath ||
    window.location.pathname === `${basePath}/index.html`
  ) &&
  legacyRoute.startsWith('/') &&
  !legacyRoute.startsWith('//')
) {
  window.history.replaceState(window.history.state, '', `${basePath}${legacyRoute}`)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
