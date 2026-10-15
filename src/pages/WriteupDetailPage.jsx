import { Link, useParams } from 'react-router-dom'
import ArticleReader from '../components/ArticleReader.jsx'

function WriteupDetailPage({ writeups }) {
  const { slug } = useParams()
  const writeup = writeups.find((item) => item.slug === slug)

  if (!writeup) {
    return (
      <section className="panel empty-state">
        <h1>Writeup not found</h1>
        <p>That writeup could not be found.</p>
        <Link className="inline-cta" to="/writeups">
          Back to writeups
        </Link>
      </section>
    )
  }

  return <ArticleReader entries={writeups} entry={writeup} type="writeup" />
}

export default WriteupDetailPage
