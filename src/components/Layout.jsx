import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import CursorTrail from './CursorTrail.jsx'
import Footer from './Footer.jsx'
import Navbar from './Navbar.jsx'
import ScrollToTop from './ScrollToTop.jsx'
import { useTheme } from '../context/useTheme.jsx'

const LetterGlitch = lazy(() => import('./LetterGlitch.jsx'))

function Layout({ siteConfig }) {
  const { theme } = useTheme()

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />
      <div className="site-glitch-background" aria-hidden="true">
        <Suspense fallback={null}>
          <LetterGlitch
            baseOpacity={0.12}
            clickEffect="none"
            density={0.38}
            dpr={1}
            flow={0.16}
            fontSize={14}
            glitchAmount={0.12}
            glitchColors={theme === 'dark' ? ['#7cc4ff', '#98ffc5'] : ['#007acc', '#009a72']}
            intro={false}
            lightMode={theme === 'light'}
            speed={0.28}
          />
        </Suspense>
      </div>
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
