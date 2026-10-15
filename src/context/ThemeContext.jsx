import { flushSync } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeContext } from './theme-context.js'
import {
  preloadThemeTransitionGif,
  THEME_TRANSITION_DURATION,
  THEME_TRANSITION_EASING,
  THEME_TRANSITION_GIF_PATH,
} from '../lib/themeTransition.js'

const DEFAULT_THEME = 'dark'
const STORAGE_KEY = 'w4rr1or-theme'
const BASE_STYLE_ID = 'theme-switch-base-style'
const GIF_STYLE_ID = 'theme-switch-gif-style'

function readStoredTheme() {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME
  }

  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
}

function persistTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

function installBaseTransitionStyles() {
  if (typeof document === 'undefined' || document.getElementById(BASE_STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = BASE_STYLE_ID
  style.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
  `
  document.head.appendChild(style)
}

function installGifTransitionStyles() {
  const style = document.createElement('style')
  style.id = GIF_STYLE_ID
  style.textContent = `
    ::view-transition-group(root) {
      animation-duration: ${THEME_TRANSITION_DURATION}ms;
      animation-timing-function: ease;
      animation-timing-function: ${THEME_TRANSITION_EASING};
      z-index: 100;
    }

    ::view-transition-new(root) {
      -webkit-mask: url('${THEME_TRANSITION_GIF_PATH}') 50% / 0 no-repeat;
      mask: url('${THEME_TRANSITION_GIF_PATH}') 50% / 0 no-repeat;
      mask-mode: alpha;
      -webkit-mask-mode: alpha;
      animation: gifMaskScale ${THEME_TRANSITION_DURATION}ms ease;
      animation: gifMaskScale ${THEME_TRANSITION_DURATION}ms ${THEME_TRANSITION_EASING};
      animation-fill-mode: both;
      will-change: mask-size, -webkit-mask-size;
      mix-blend-mode: normal;
    }

    ::view-transition-old(root) {
      animation: gifMaskScale ${THEME_TRANSITION_DURATION}ms ease;
      animation: gifMaskScale ${THEME_TRANSITION_DURATION}ms ${THEME_TRANSITION_EASING};
      animation-fill-mode: both;
      z-index: -1;
      mix-blend-mode: normal;
    }

    @keyframes gifMaskScale {
      0%   { -webkit-mask-size: 0;      mask-size: 0; }
      10%  { -webkit-mask-size: 25vmax;  mask-size: 25vmax; }
      90%  { -webkit-mask-size: 25vmax;  mask-size: 25vmax; }
      100% { -webkit-mask-size: 750vmax; mask-size: 750vmax; }
    }

    @media (prefers-reduced-motion: reduce) {
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none;
      }

      ::view-transition-new(root) {
        -webkit-mask: none;
        mask: none;
      }
    }
  `
  document.head.appendChild(style)
}

function removeGifTransitionStyles() {
  document.getElementById(GIF_STYLE_ID)?.remove()
  document.documentElement.classList.remove('theme-transition-active')
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration))
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionLock = useRef(false)
  const gifAvailable = useRef(null)

  useEffect(() => {
    persistTheme(theme)
  }, [theme])

  useEffect(() => {
    installBaseTransitionStyles()
    gifAvailable.current = preloadThemeTransitionGif()

    gifAvailable.current.then((available) => {
      if (!available) {
        console.warn(
          `Theme GIF transition is unavailable. Add the transparent GIF at ${THEME_TRANSITION_GIF_PATH} to enable the custom mask.`,
        )
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      isTransitioning,
      toggleTheme: async () => {
        if (transitionLock.current) {
          return
        }

        transitionLock.current = true
        setIsTransitioning(true)

        const nextTheme = theme === 'dark' ? 'light' : 'dark'
        const canAnimate =
          typeof document !== 'undefined' &&
          typeof document.startViewTransition === 'function' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
          (await (gifAvailable.current || preloadThemeTransitionGif()))

        if (!canAnimate) {
          setTheme(nextTheme)
          persistTheme(nextTheme)
          transitionLock.current = false
          setIsTransitioning(false)
          return
        }

        installGifTransitionStyles()
        document.documentElement.classList.add('theme-transition-active')

        let animationStartedAt = performance.now()

        try {
          const transition = document.startViewTransition(() => {
            flushSync(() => {
              setTheme(nextTheme)
            })
            // Apply the attribute during the transition callback so the new
            // snapshot is captured with the target theme, not the old one.
            persistTheme(nextTheme)
          })

          // Measure from the View Transition start so cleanup cannot shorten
          // the CSS animation on a busy main thread.
          animationStartedAt = performance.now()

          await transition.ready.catch(() => undefined)
        } catch {
          // The theme has already been applied. Cleanup below leaves the
          // ordinary themed page visible if the transition cannot start.
        }

        const elapsed = performance.now() - animationStartedAt
        await wait(Math.max(0, THEME_TRANSITION_DURATION - elapsed))
        removeGifTransitionStyles()
        transitionLock.current = false
        setIsTransitioning(false)
      },
    }),
    [isTransitioning, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
