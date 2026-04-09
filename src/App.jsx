import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { extraPosts, siteConfig, writeups } from './data/content.js'
import ExtraDetailPage from './pages/ExtraDetailPage.jsx'
import ExtraPage from './pages/ExtraPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import WriteupDetailPage from './pages/WriteupDetailPage.jsx'
import WriteupsPage from './pages/WriteupsPage.jsx'

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
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
            <Route
              path="writeups/:slug"
              element={<WriteupDetailPage writeups={writeups} />}
            />
            <Route path="extra" element={<ExtraPage posts={extraPosts} />} />
            <Route path="extra/:slug" element={<ExtraDetailPage posts={extraPosts} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
