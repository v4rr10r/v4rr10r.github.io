import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="panel empty-state">
      <p className="eyebrow">404</p>
      <h1>That route is outside the notebook.</h1>
      <p>Use the navigation to head back to Home, Writeups, or Blogs.</p>
      <Link className="inline-cta" to="/">
        Return home
      </Link>
    </section>
  )
}

export default NotFoundPage
