import { useTheme } from '../context/useTheme.jsx'

function ThemeToggle() {
  const { isTransitioning, theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-busy={isTransitioning}
      className="theme-toggle"
      disabled={isTransitioning}
      onClick={toggleTheme}
      type="button"
    >
      <span className={`toggle-thumb${isDark ? ' toggle-thumb-dark' : ''}`} />
      <span className="toggle-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}

export default ThemeToggle
