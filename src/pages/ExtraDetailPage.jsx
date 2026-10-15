import { Link, useParams } from 'react-router-dom'
import ArticleReader from '../components/ArticleReader.jsx'

function ExtraDetailPage({ posts }) {
  const { slug } = useParams()
  const post = posts.find((item) => item.slug === slug)

  if (!post) {
    return (
      <section className="panel empty-state">
        <h1>Post not found</h1>
        <p>That blog post could not be found.</p>
        <Link className="inline-cta" to="/blogs">
          Back to blogs
        </Link>
      </section>
    )
  }

  return <ArticleReader entries={posts} entry={post} type="blog" />
}

export default ExtraDetailPage
