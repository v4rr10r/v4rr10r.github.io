import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import RevealSection from '../components/RevealSection.jsx'

function HomePage({ extraPosts, siteConfig, writeups }) {
  const pageRef = useRef(null)
  const [activeSection, setActiveSection] = useState('about')
  const stats = [
    {
      label: 'Tracked writeups',
      value: String(writeups.length).padStart(2, '0'),
    },
    {
      label: 'Research notes',
      value: String(extraPosts.length).padStart(2, '0'),
    },
    {
      label: 'Achievements',
      value: String(siteConfig.achievements.length).padStart(2, '0'),
    },
  ]
  const sortedAchievements = [...siteConfig.achievements].sort(
    (left, right) => extractRankValue(left.rank) - extractRankValue(right.rank),
  )

  useEffect(() => {
    const pageElement = pageRef.current

    if (!pageElement || typeof IntersectionObserver === 'undefined') {
      return undefined
    }

    const sectionElements = Array.from(pageElement.querySelectorAll('[data-section-id]'))
    const visibilityById = new Map()

    const updateActiveSection = () => {
      let highestSection = activeSection
      let highestRatio = 0

      for (const [sectionId, ratio] of visibilityById.entries()) {
        if (ratio > highestRatio) {
          highestSection = sectionId
          highestRatio = ratio
        }
      }

      if (highestRatio > 0.24) {
        setActiveSection(highestSection)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.getAttribute('data-section-id')

          if (!sectionId) {
            return
          }

          visibilityById.set(sectionId, entry.isIntersecting ? entry.intersectionRatio : 0)
        })

        updateActiveSection()
      },
      {
        rootMargin: '-16% 0px -32% 0px',
        threshold: [0.2, 0.35, 0.5, 0.7],
      },
    )

    sectionElements.forEach((sectionElement) => observer.observe(sectionElement))

    return () => observer.disconnect()
  }, [activeSection])

  return (
    <div className="page-stack home-document" ref={pageRef}>
      <RevealSection className="notebook-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">{siteConfig.tagline}</p>
          <h1>{siteConfig.intro.headline}</h1>
          <p className="lead-copy">{siteConfig.intro.description}</p>
          <p className="support-copy">{siteConfig.intro.supporting}</p>
          <div className="cta-row">
            <Link className="inline-cta" to="/writeups">
              Open writeups archive
            </Link>
            <Link className="inline-cta inline-cta-muted" to="/extra">
              Open research notes
            </Link>
          </div>
        </div>
        <div className="hero-ledger panel">
          <div className="hero-ledger-header">
            <p className="section-kicker">Notebook Status</p>
            <span className="status-pill">active</span>
          </div>
          <div className="terminal-content terminal-content-compact">
            <p className="terminal-line terminal-muted">w4rr1or@notebook:~$ ./focus.sh</p>
            {siteConfig.focusTracks.map((track) => (
              <p className="terminal-line" key={track}>
                <span className="terminal-prompt">&gt;</span> {track}
              </p>
            ))}
            <p className="terminal-line terminal-muted">status: building, breaking, learning</p>
          </div>
          <div className="ledger-list">
            {stats.map((stat) => (
              <div className="ledger-row" key={stat.label}>
                <span className="ledger-label">{stat.label}</span>
                <span className="ledger-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection
        className={`flow-section${activeSection === 'about' ? ' flow-section-current' : ''}`}
        data-section-id="about"
      >
        <div className="flow-heading">
          <p className="section-index">01</p>
          <div>
            <p className="section-kicker">About</p>
            <h2>Learning through hands on challenges and experimentation.</h2>
          </div>
        </div>
        <div className="flow-body">
          <p className="section-copy">{siteConfig.about}</p>
          <div className="note-block">
            <p className="field-label">Current Focus</p>
            <p className="note-copy">{siteConfig.focusTracks.join(' / ')}</p>
          </div>
        </div>
      </RevealSection>

      <RevealSection
        className={`flow-section${activeSection === 'skills' ? ' flow-section-current' : ''}`}
        data-section-id="skills"
      >
        <div className="flow-heading">
          <p className="section-index">02</p>
          <div>
            <p className="section-kicker">Skills / Tools</p>
            <h2>Tools and skills for Exploitations.</h2>
          </div>
        </div>
        <div className="flow-body">
          <div className="notebook-columns">
            <div className="notebook-column">
              <p className="field-label">Languages</p>
              <div className="line-list">
                {siteConfig.skills.languages.map((skill) => (
                  <div className="line-list-item" key={skill}>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="notebook-column">
              <p className="field-label">Core Areas</p>
              <div className="line-list">
                {siteConfig.skills.core.map((skill) => (
                  <div className="line-list-item" key={skill}>
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="notebook-column">
              <p className="field-label">Toolkit</p>
              <div className="line-list">
                {siteConfig.tools.map((tool) => (
                  <div className="line-list-item" key={tool}>
                    <span>{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection
        className={`flow-section${activeSection === 'experience' ? ' flow-section-current' : ''}`}
        data-section-id="experience"
      >
        <div className="flow-heading">
          <p className="section-index">03</p>
          <div>
            <p className="section-kicker">Experience</p>
            <h2>Communities, teams.</h2>
          </div>
        </div>
        <div className="flow-body">
          <div className="experience-list">
            {siteConfig.experience.map((entry) => (
              <a
                className="experience-row experience-link"
                href={entry.url}
                key={`${entry.organization}-${entry.role}`}
                rel="noreferrer"
                target="_blank"
              >
                <div className="experience-main">
                  <p className="timeline-title">{entry.organization}</p>
                  <p className="timeline-role">{entry.role}</p>
                </div>
                <div className="experience-meta">
                  <span className="timeline-period">{entry.period}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="experience-link-icon"
                    size={16}
                    strokeWidth={1.7}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection
        className={`flow-section${activeSection === 'achievements' ? ' flow-section-current' : ''}`}
        data-section-id="achievements"
      >
        <div className="flow-heading">
          <p className="section-index">04</p>
          <div>
            <p className="section-kicker">Achievements</p>
            <h2>CTF placements and competition results.</h2>
          </div>
        </div>
        <div className="flow-body">
          <div className="achievement-list">
            {sortedAchievements.map((achievement, index) => (
              <div
                className={`achievement-item${
                  extractRankValue(achievement.rank) === 1 ? ' achievement-top-tier' : ''
                }`}
                key={`${achievement.title}-${achievement.rank}`}
              >
                <span className="achievement-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="achievement-copy">
                  <p className="achievement-title">{achievement.title}</p>
                  <p className="achievement-meta">{achievement.organization}</p>
                </div>
                <div className="achievement-rank-block">
                  <span className="achievement-rank">Rank {achievement.rank}</span>
                  <span className="achievement-date">{achievement.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>
    </div>
  )
}

function extractRankValue(rank) {
  const numericRank = Number.parseInt(String(rank).replace(/\D/g, ''), 10)

  if (Number.isNaN(numericRank)) {
    return Number.MAX_SAFE_INTEGER
  }

  return numericRank
}

export default HomePage
