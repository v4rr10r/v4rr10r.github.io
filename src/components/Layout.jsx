import { Outlet } from 'react-router-dom'
import CursorTrail from './CursorTrail.jsx'
import Footer from './Footer.jsx'
import Navbar from './Navbar.jsx'
import ScrollToTop from './ScrollToTop.jsx'

function Layout({ siteConfig }) {
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />
      <CursorTrail />
      <ScrollToTop />
      <Navbar siteName={siteConfig.name} />
      <main className="page-shell">
        <Outlet />
      </main>
      <Footer links={siteConfig.links} siteName={siteConfig.name} />
    </div>
  )
}

export default Layout
