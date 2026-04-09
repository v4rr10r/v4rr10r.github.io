import { useEffect, useRef } from 'react'

function RevealSection({ children, className = '', ...props }) {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }

        element.dataset.visible = 'true'
        observer.unobserve(element)
      },
      {
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.18,
      },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <section
      {...props}
      className={`reveal-section ${className}`.trim()}
      data-visible="false"
      ref={elementRef}
    >
      {children}
    </section>
  )
}

export default RevealSection
