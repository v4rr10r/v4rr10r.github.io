import { useState } from 'react'
import { ArrowUpRight, Trophy } from 'lucide-react'

function rankNumber(rank) {
  const value = Number.parseInt(String(rank), 10)
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

function WinCard({ achievement }) {
  return (
    <article className={`win-card${rankNumber(achievement.rank) === 1 ? ' win-card-first' : ''}`}>
      <div className="win-card-top">
        <Trophy aria-hidden="true" size={21} strokeWidth={1.6} />
        <span>{achievement.date}</span>
      </div>
      <div>
        <p className="win-rank">{achievement.rank} place</p>
        <h3>{achievement.title}</h3>
        <p className="win-organization">{achievement.organization}</p>
      </div>
      {(achievement.team || achievement.category || achievement.proofUrl) && <div className="win-extra">
        {achievement.team && <span>{achievement.team}</span>}
        {achievement.category && <span>{achievement.category}</span>}
        {achievement.proofUrl && <a href={achievement.proofUrl} rel="noreferrer" target="_blank">View result <ArrowUpRight aria-hidden="true" size={14} /></a>}
      </div>}
    </article>
  )
}

function WinsGrid({ achievements }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...achievements].sort((left, right) => rankNumber(left.rank) - rankNumber(right.rank))
  const featured = sorted.slice(0, 4)
  const remaining = sorted.slice(4)

  return (
    <div className="wins-content">
      <p className="section-copy">Competitions, challenges, and milestones along the way.</p>
      <div className="wins-grid">{featured.map((achievement) => <WinCard achievement={achievement} key={`${achievement.title}-${achievement.date}`} />)}</div>
      {remaining.length > 0 && <>
        <div className={`wins-extra-shell${expanded ? ' wins-extra-open' : ''}`} aria-hidden={!expanded} inert={!expanded}>
          <div className="wins-extra-inner">
            <div className="wins-grid wins-grid-extra">{remaining.map((achievement) => <WinCard achievement={achievement} key={`${achievement.title}-${achievement.date}`} />)}</div>
          </div>
        </div>
        <button aria-expanded={expanded} className="wins-toggle" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? 'Show Less' : `View All Achievements (${achievements.length})`}
          <span aria-hidden="true">{expanded ? '↑' : '↗'}</span>
        </button>
      </>}
    </div>
  )
}

export default WinsGrid
