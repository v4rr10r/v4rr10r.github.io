function MarqueeRow({ items, label, reverse = false }) {
  const badges = (copy) => items.map((item, index) => (
    <span className="skill-badge" key={`${copy}-${item}-${index}`}>
      <span className="skill-badge-mark" aria-hidden="true">✦</span>{item.label}
      <small>{item.group}</small>
    </span>
  ))

  return (
    <div aria-label={label} className={`skills-marquee${reverse ? ' skills-marquee-reverse' : ''}`} tabIndex="0">
      <div className="skills-marquee-track">
        <div className="skills-marquee-group">{badges('primary')}</div>
        <div aria-hidden="true" className="skills-marquee-group">{badges('repeat')}</div>
      </div>
    </div>
  )
}

function SkillsMarquee({ siteConfig }) {
  const firstRow = [
    ...siteConfig.skills.languages.map((label) => ({ label, group: 'Language' })),
    ...siteConfig.skills.core.map((label) => ({ label, group: 'Core area' })),
  ]
  const secondRow = siteConfig.tools.map((label) => ({ label, group: 'Toolkit' }))
  return (
    <div className="skills-marquee-stack">
      <div>
        <p className="marquee-label">Languages / core areas</p>
        <MarqueeRow items={firstRow} label="Languages and core areas. Moving left to right." reverse />
      </div>
      <div>
        <p className="marquee-label">Toolkit</p>
        <MarqueeRow items={secondRow} label="Tools. Moving right to left." />
      </div>
    </div>
  )
}

export default SkillsMarquee
