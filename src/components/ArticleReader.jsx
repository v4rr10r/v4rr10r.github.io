import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import MarkdownArticle from './MarkdownArticle.jsx'

function readingMinutes(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function ArticleReader({ entry, entries, type }) {
  const isWriteup = type === 'writeup'
  const baseRoute = isWriteup ? '/writeups' : '/blogs'
  const collectionName = isWriteup ? 'writeups' : 'blogs'
  const title = isWriteup ? entry.challengeName : entry.title
  const summary = isWriteup ? entry.summary : entry.description
  const category = isWriteup ? entry.ctfName : entry.collection === 'labs' ? 'Lab' : 'Blog'
  const index = entries.findIndex((item) => item.slug === entry.slug)
  const previous = entries[index - 1]
  const next = entries[index + 1]
  const entryTitle = (item) => isWriteup ? item.challengeName : item.title

  const header = <header className="reader-header panel">
    <Link className="reader-back" to={baseRoute}><ArrowLeft aria-hidden="true" size={16} /> All {collectionName}</Link>
    <p className="reader-category">{isWriteup ? 'CTF Writeup' : category}{isWriteup && category ? ` / ${category}` : ''}</p>
    <h1>{title}</h1>
    {summary && <p className="reader-summary">{summary}</p>}
    <div className="reader-meta">
      {entry.date && <span>{entry.displayDate}</span>}
      <span>{readingMinutes(entry.content)} min read</span>
      {entry.tags.map((tag) => <span className="reader-tag" key={tag}>{tag}</span>)}
    </div>
  </header>

  const footer = (previous || next) && <nav aria-label="More articles" className="reader-neighbors">
    {previous && <Link className="reader-neighbor panel" to={`${baseRoute}/${previous.slug}`}><span><ArrowLeft aria-hidden="true" size={15} /> Previous</span><strong>{entryTitle(previous)}</strong></Link>}
    {next && <Link className="reader-neighbor panel" to={`${baseRoute}/${next.slug}`}><span>Next <ArrowRight aria-hidden="true" size={15} /></span><strong>{entryTitle(next)}</strong></Link>}
  </nav>

  return <div className="reader-page"><MarkdownArticle articleTitle={title} baseDirectory={entry.baseDirectory} content={entry.content} footer={footer} header={header} key={entry.slug} /></div>
}

export default ArticleReader
