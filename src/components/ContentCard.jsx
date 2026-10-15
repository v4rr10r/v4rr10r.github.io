import { Link } from 'react-router-dom'

function ContentCard({ item, to, variant = 'writeup' }) {
  const label = variant === 'writeup' ? `CTF // ${item.ctfName}` : item.collection === 'labs' ? 'Lab' : 'Blog'
  const summary = variant === 'writeup' ? item.summary : item.description
  const cardClassName = `content-card panel${variant === 'writeup' ? ' content-card-writeup' : ''}`

  return (
    <Link className={cardClassName} to={to}>
      <p className="card-kicker">{label}</p>
      <h3>{variant === 'writeup' ? item.challengeName : item.title}</h3>
      <p className="card-copy">{summary}</p>
      <div className="card-chip-row">
        {item.tags.length ? (
          item.tags.map((tag) => (
            <span className="chip chip-muted" key={tag}>
              {tag}
            </span>
          ))
        ) : (
          <span className="chip chip-muted">No tags yet</span>
        )}
      </div>
      <div className="card-meta-row">
        <span>{item.displayDate}</span>
        <span>{variant === 'writeup' ? item.title : item.folderName}</span>
      </div>
    </Link>
  )
}

export default ContentCard
