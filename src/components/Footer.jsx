import {
  BookText,
  BriefcaseBusiness,
  FolderGit2,
  Globe,
  Shield,
  Target,
  UsersRound,
} from 'lucide-react'

function Footer({ links = [], siteName }) {
  return (
    <footer className="site-footer">
      <div className="footer-divider" aria-hidden="true" />
      <div className="footer-inner">
        <p className="footer-label">{siteName} // contact endpoints</p>
        <div className="footer-icon-row" role="list">
          {links.map((link) => {
            const Icon = resolveFooterIcon(link)

            return (
              <a
                aria-label={link.label}
                className="footer-icon-link"
                href={link.url}
                key={link.label}
                rel="noreferrer"
                role="listitem"
                target="_blank"
                title={link.label}
              >
                <span className="sr-only">{link.label}</span>
                {link.iconImage ? (
                  <img
                    alt=""
                    className="footer-icon-image"
                    loading="lazy"
                    src={link.iconImage}
                  />
                ) : (
                  <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                )}
              </a>
            )
          })}
        </div>
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} {siteName}
        </p>
        {/* <p className="footer-note">security research notebook</p> */}
      </div>
    </footer>
  )
}

function resolveFooterIcon(link) {
  const label = `${link.label} ${link.url}`.toLowerCase()

  if (label.includes('github')) {
    return FolderGit2
  }

  if (label.includes('linkedin')) {
    return BriefcaseBusiness
  }

  if (label.includes('ctftime')) {
    return Target
  }

  if (label.includes('medium')) {
    return BookText
  }

  if (label.includes('team')) {
    return UsersRound
  }

  if (label.includes('rootrunners')) {
    return Shield
  }

  return Globe
}

export default Footer
