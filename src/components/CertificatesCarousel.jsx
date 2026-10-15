import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react'

function CertificateCard({ certificate, index, onOpen, duplicate = false, dragDistanceRef }) {
  return (
    <button aria-label={`View ${certificate.title} certificate`} className="certificate-card" onClick={() => {
      if (dragDistanceRef.current < 6) onOpen(index)
    }} tabIndex={duplicate ? -1 : 0} type="button">
      <span className="certificate-image-wrap"><img alt={`${certificate.title} certificate issued by ${certificate.issuer}`} loading="lazy" src={certificate.thumbnail || certificate.image} /></span>
      <span className="certificate-card-copy"><strong>{certificate.title}</strong><span>{certificate.issuer}{certificate.date ? ` · ${certificate.date}` : ''}</span></span>
    </button>
  )
}

function CertificateModal({ certificates, index, onClose, onNavigate, returnFocusRef }) {
  const modalRef = useRef(null)
  const closeRef = useRef(null)
  const certificate = certificates[index]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const returnFocus = returnFocusRef.current
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onNavigate(-1)
      if (event.key === 'ArrowRight') onNavigate(1)
      if (event.key === 'Tab') {
        const focusable = [...modalRef.current.querySelectorAll('button, a[href]')]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      returnFocus?.focus()
    }
  }, [onClose, onNavigate, returnFocusRef])

  return createPortal(
    <div className="certificate-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div aria-label={`${certificate.title} certificate preview`} aria-modal="true" className="certificate-modal" ref={modalRef} role="dialog">
        <div className="certificate-modal-header">
          <div><p className="section-kicker">Certificate {index + 1} / {certificates.length}</p><h3>{certificate.title}</h3><p>{certificate.issuer}{certificate.date ? ` · ${certificate.date}` : ''}</p></div>
          <button aria-label="Close certificate preview" className="certificate-icon-button" onClick={onClose} ref={closeRef} type="button"><X size={20} /></button>
        </div>
        <div className="certificate-modal-image"><img alt={`${certificate.title} certificate issued by ${certificate.issuer}`} src={certificate.image} /></div>
        <div className="certificate-modal-footer">
          <div className="certificate-controls"><button aria-label="Previous certificate" className="certificate-icon-button" onClick={() => onNavigate(-1)} type="button"><ArrowLeft size={19} /></button><button aria-label="Next certificate" className="certificate-icon-button" onClick={() => onNavigate(1)} type="button"><ArrowRight size={19} /></button></div>
          {certificate.credentialUrl && <a href={certificate.credentialUrl} rel="noreferrer" target="_blank">Verify credential <ArrowUpRight aria-hidden="true" size={16} /></a>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CertificatesCarousel({ certificates }) {
  const active = certificates.filter((item) => item.enabled && item.title && item.issuer && item.image)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const estimatedCardWidth = Math.min(336, Math.max(256, viewportWidth * 0.26)) + 16
  const copyCount = 2 * Math.max(1, Math.ceil(viewportWidth / ((active.length || 1) * estimatedCardWidth))) + 1
  const middleCopy = Math.floor(copyCount / 2)
  const scrollerRef = useRef(null)
  const viewportRef = useRef(null)
  const visibleRef = useRef(false)
  const firstGroupRef = useRef(null)
  const middleGroupRef = useRef(null)
  const nextGroupRef = useRef(null)
  const returnFocusRef = useRef(null)
  const dragRef = useRef(null)
  const dragDistanceRef = useRef(0)
  const pauseUntilRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [openIndex, setOpenIndex] = useState(null)
  const pausedRef = useRef(paused)
  const modalOpenRef = useRef(false)
  const closeModal = useCallback(() => setOpenIndex(null), [])
  const navigateModal = useCallback((direction) => setOpenIndex((value) => (value + direction + active.length) % active.length), [active.length])

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { modalOpenRef.current = openIndex !== null }, [openIndex])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!viewportRef.current || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting }, { threshold: 0.01 })
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [active.length])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || active.length === 0) return undefined
    let frame
    let previous = 0
    let fractionalMovement = 0
    const cycle = () => nextGroupRef.current.offsetLeft - middleGroupRef.current.offsetLeft
    const startOffset = () => middleGroupRef.current.offsetLeft - firstGroupRef.current.offsetLeft
    const start = () => { scroller.scrollLeft = startOffset() }
    start()
    const tick = (now) => {
      const length = cycle()
      if (length > 0) {
        if (now > pauseUntilRef.current) {
          const base = startOffset()
          if (scroller.scrollLeft >= base + length) scroller.scrollLeft -= length
          else if (scroller.scrollLeft < base) scroller.scrollLeft += length
          if (visibleRef.current && !document.hidden && !pausedRef.current && !modalOpenRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            fractionalMovement += (length / 30000) * Math.min(now - (previous || now), 50)
            if (fractionalMovement >= 1) {
              const pixels = Math.floor(fractionalMovement)
              scroller.scrollLeft += pixels
              fractionalMovement -= pixels
            }
          }
        }
      }
      previous = now
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [active.length, copyCount])

  function step(direction) {
    const scroller = scrollerRef.current
    if (!scroller) return
    pauseUntilRef.current = performance.now() + 2200
    const card = scroller.querySelector('.certificate-card')
    scroller.scrollBy({ left: direction * ((card?.offsetWidth || 300) + 16), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  function open(index) {
    returnFocusRef.current = document.activeElement
    setOpenIndex(index)
  }

  function onPointerDown(event) {
    if (event.pointerType !== 'mouse') return
    dragDistanceRef.current = 0
    dragRef.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft, captured: false }
  }

  function onPointerMove(event) {
    if (!dragRef.current) return
    const distance = event.clientX - dragRef.current.x
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(distance))
    if (dragDistanceRef.current > 5 && !dragRef.current.captured) {
      dragRef.current.captured = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setPaused(true)
    }
    if (!dragRef.current.captured) return
    event.currentTarget.scrollLeft = dragRef.current.scrollLeft - distance
  }

  function onPointerUp() {
    dragRef.current = null
    pauseUntilRef.current = performance.now() + 1800
    setPaused(false)
  }

  if (!active.length) return <div className="certificate-empty panel"><span className="certificate-empty-mark" aria-hidden="true">✦</span><p>Certifications will appear here soon.</p></div>

  return (
    <div className="certificates-content">
      <div className="certificate-toolbar"><p>Selected credentials</p><div className="certificate-controls"><button aria-label="Previous certificate" className="certificate-icon-button" onClick={() => step(-1)} type="button"><ArrowLeft size={19} /></button><button aria-label="Next certificate" className="certificate-icon-button" onClick={() => step(1)} type="button"><ArrowRight size={19} /></button></div></div>
      <div className="certificate-viewport" onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} ref={viewportRef}>
        <div className="certificate-scroller" onPointerCancel={onPointerUp} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} ref={scrollerRef}>
          {Array.from({ length: copyCount }, (_, copy) => <div aria-hidden={copy !== middleCopy} className="certificate-group" key={copy} ref={copy === 0 ? firstGroupRef : copy === middleCopy ? middleGroupRef : copy === middleCopy + 1 ? nextGroupRef : null}>{active.map((certificate, index) => <CertificateCard certificate={certificate} dragDistanceRef={dragDistanceRef} duplicate={copy !== middleCopy} index={index} key={`${copy}-${certificate.id}`} onOpen={open} />)}</div>)}
        </div>
      </div>
      {openIndex !== null && <CertificateModal certificates={active} index={openIndex} onClose={closeModal} onNavigate={navigateModal} returnFocusRef={returnFocusRef} />}
    </div>
  )
}

export default CertificatesCarousel
