import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import BootLoader from './components/BootLoader.jsx'
import Layout from './components/Layout.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { extraPosts, siteConfig, writeups } from './data/content.js'
import ExtraPage from './pages/ExtraPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import WriteupsPage from './pages/WriteupsPage.jsx'

const ExtraDetailPage = lazy(() => import('./pages/ExtraDetailPage.jsx'))
const WriteupDetailPage = lazy(() => import('./pages/WriteupDetailPage.jsx'))

function ArticleLoading() {
  return <section aria-live="polite" className="panel empty-state"><p>Loading article…</p></section>
}

function App() {
  const [isLoaderComplete, setIsLoaderComplete] = useState(false)

  return (
    <ThemeProvider>
      <div className={`app-stage${isLoaderComplete ? ' app-stage-ready' : ''}`}>
        {!isLoaderComplete ? <BootLoader onComplete={() => setIsLoaderComplete(true)} /> : null}
        <div className="app-stage-content">
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route element={<Layout siteConfig={siteConfig} />}>
                <Route
                  index
                  element={
                    <HomePage
                      extraPosts={extraPosts}
                      siteConfig={siteConfig}
                      writeups={writeups}
                    />
                  }
                />
                <Route path="writeups" element={<WriteupsPage writeups={writeups} />} />
                <Route path="writeups/:slug" element={<Suspense fallback={<ArticleLoading />}><WriteupDetailPage writeups={writeups} /></Suspense>} />
                <Route path="blogs" element={<ExtraPage posts={extraPosts} />} />
                <Route path="blogs/:slug" element={<Suspense fallback={<ArticleLoading />}><ExtraDetailPage posts={extraPosts} /></Suspense>} />
                <Route path="extra" element={<Navigate replace to="/blogs" />} />
                <Route path="extra/:slug" element={<LegacyBlogRedirect />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </div>
      </div>
    </ThemeProvider>
  )
}

function LegacyBlogRedirect() {
  const { slug } = useParams()
  return <Navigate replace to={`/blogs/${slug}`} />
}

export default App
