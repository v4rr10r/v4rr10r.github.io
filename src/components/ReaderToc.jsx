import { useEffect, useRef, useState } from 'react'
import { List, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

function scrollToHeading(article, id) {
  const target = article?.querySelector(`#${CSS.escape(id)}`)
  if (!target) return
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
}

function ReaderToc({ articleRef, extraAnchors, headings }) {
  const location = useLocation()
  const navigate = useNavigate()
  const tocRef = useRef(null)
  const frameRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeId, setActiveId] = useState(headings[0]?.id || '')

  useEffect(() => {
    const article = articleRef.current
    if (!article) return undefined
    const collectHeadings = () => headings.map(({ id }) => ({ id, element: article.querySelector(`#${CSS.escape(id)}`) })).filter(({ element }) => element)
    let trackedHeadings = collectHeadings()
    const update = () => {
      frameRef.current = 0
      if (trackedHeadings.some(({ element }) => !element.isConnected)) trackedHeadings = collectHeadings()
      const top = article.getBoundingClientRect().top + window.scrollY
      const bottom = top + article.offsetHeight
      const finish = Math.max(top + 1, bottom - window.innerHeight * 0.72)
      const percent = Math.round(Math.max(0, Math.min(1, (window.scrollY - top) / (finish - top))) * 100)
      setProgress((current) => current === percent ? current : percent)

      const cutoff = Math.min(200, window.innerHeight * 0.25)
      let currentId = headings[0]?.id || ''
      for (const { id, element } of trackedHeadings) {
        if (element.getBoundingClientRect().top <= cutoff) currentId = id
        else break
      }
      if (percent >= 99 && trackedHeadings.length) currentId = trackedHeadings.at(-1).id
      setActiveId((current) => current === currentId ? current : currentId)
    }
    const schedule = () => { if (!frameRef.current) frameRef.current = window.requestAnimationFrame(update) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => { window.cancelAnimationFrame(frameRef.current); frameRef.current = 0; window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [articleRef, headings])

  useEffect(() => {
    if (!location.hash) return undefined
    let id
    try { id = decodeURIComponent(location.hash.slice(1)) } catch { return undefined }
    if (!headings.some((heading) => heading.id === id) && !extraAnchors.includes(id)) return undefined
    const frame = window.requestAnimationFrame(() => scrollToHeading(articleRef.current, id))
    return () => window.cancelAnimationFrame(frame)
  }, [articleRef, extraAnchors, headings, location.hash])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => { if (!tocRef.current?.contains(event.target)) setOpen(false) }
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  function navigateTo(id) {
    setActiveId(id)
    setOpen(false)
    if (location.hash !== `#${id}`) navigate({ hash: `#${id}` }, { preventScrollReset: true })
    scrollToHeading(articleRef.current, id)
  }

  return (
    <aside aria-label="Article navigation" className="reader-toc" ref={tocRef}>
      <button aria-controls="reader-toc-panel" aria-expanded={open} className="reader-toc-toggle" onClick={() => setOpen((current) => !current)} type="button">{open ? <X size={18} /> : <List size={18} />}<span>On this page</span></button>
      <div className={`reader-toc-panel${open ? ' reader-toc-panel-open' : ''}`} id="reader-toc-panel">
        <p className="reader-toc-heading">On this page</p>
        <div className="reader-progress"><div className="reader-progress-label"><span>Reading progress</span><output>{progress}%</output></div><progress aria-label="Article reading progress" max="100" value={progress} /></div>
        {headings.length > 0 ? <nav aria-label="Article sections" className="reader-toc-list">{headings.map((heading) => <button aria-current={activeId === heading.id ? 'location' : undefined} className={`reader-toc-item reader-toc-depth-${heading.depth}${activeId === heading.id ? ' reader-toc-item-active' : ''}`} key={heading.id} onClick={() => navigateTo(heading.id)} type="button">{heading.text}</button>)}</nav> : <p className="reader-toc-empty">No sections in this article.</p>}
      </div>
    </aside>
  )
}

export default ReaderToc
