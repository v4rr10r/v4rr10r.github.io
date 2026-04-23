import { Menu, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { resolveContentAsset } from '../data/content.js'

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function createHeadingIndex(markdown) {
  const headings = []
  const slugCounts = new Map()
  let inCodeFence = false

  for (const line of markdown.split('\n')) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('```')) {
      inCodeFence = !inCodeFence
      continue
    }

    if (inCodeFence) {
      continue
    }

    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(trimmedLine)

    if (!match) {
      continue
    }

    const depth = match[1].length
    const text = match[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~]/g, '')
      .trim()

    if (!text) {
      continue
    }

    const baseId = slugifyHeading(text) || `section-${headings.length + 1}`
    const duplicateCount = slugCounts.get(baseId) || 0
    const id = duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`

    slugCounts.set(baseId, duplicateCount + 1)
    headings.push({ depth, id, text })
  }

  return headings
}

function flattenText(children) {
  return children
    .map((child) => {
      if (typeof child === 'string') {
        return child
      }

      if (typeof child === 'number') {
        return String(child)
      }

      if (child && typeof child === 'object' && 'props' in child) {
        const nestedChildren = Array.isArray(child.props.children)
          ? child.props.children
          : [child.props.children]

        return flattenText(nestedChildren)
      }

      return ''
    })
    .join('')
}

function MarkdownArticle({ baseDirectory, content }) {
  const articleRef = useRef(null)
  const tocRef = useRef(null)
  const [isTocOpen, setIsTocOpen] = useState(false)
  const [activeHeadingId, setActiveHeadingId] = useState('')
  const headingIndex = useMemo(() => createHeadingIndex(content), [content])
  const headingOccurrenceMap = useMemo(() => {
    const grouped = new Map()

    headingIndex.forEach((heading) => {
      const entries = grouped.get(heading.text) || []
      entries.push(heading.id)
      grouped.set(heading.text, entries)
    })

    return grouped
  }, [headingIndex])
  const renderCounts = new Map()

  useEffect(() => {
    setIsTocOpen(false)
  }, [content])

  useEffect(() => {
    if (!headingIndex.length) {
      return undefined
    }

    const articleElement = articleRef.current

    if (!articleElement || typeof IntersectionObserver === 'undefined') {
      return undefined
    }

    const headingElements = headingIndex
      .map(({ id }) => articleElement.querySelector(`#${CSS.escape(id)}`))
      .filter(Boolean)

    if (!headingElements.length) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => {
            if (Math.abs(left.boundingClientRect.top) !== Math.abs(right.boundingClientRect.top)) {
              return Math.abs(left.boundingClientRect.top) - Math.abs(right.boundingClientRect.top)
            }

            return right.intersectionRatio - left.intersectionRatio
          })

        if (visibleEntries.length) {
          setActiveHeadingId(visibleEntries[0].target.id)
        }
      },
      {
        rootMargin: '-16% 0px -70% 0px',
        threshold: [0.1, 0.35, 0.6],
      },
    )

    headingElements.forEach((element) => observer.observe(element))
    setActiveHeadingId(headingIndex[0].id)

    return () => {
      observer.disconnect()
    }
  }, [headingIndex])

  useEffect(() => {
    if (!isTocOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (tocRef.current && !tocRef.current.contains(event.target)) {
        setIsTocOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsTocOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isTocOpen])

  const getHeadingId = (children, fallbackDepth) => {
    const text = flattenText(Array.isArray(children) ? children : [children]).trim()
    const matches = headingOccurrenceMap.get(text)

    if (!matches?.length) {
      return `${slugifyHeading(text) || 'section'}-${fallbackDepth}`
    }

    const currentCount = renderCounts.get(text) || 0
    renderCounts.set(text, currentCount + 1)

    return matches[currentCount] || matches[matches.length - 1]
  }

  const createHeading = (Tag, depth) =>
    function HeadingComponent({ children, ...props }) {
      const headingId = getHeadingId(children, depth)
      const isActive = activeHeadingId === headingId

      return (
        <Tag
          className={`markdown-heading markdown-heading-${depth}${isActive ? ' markdown-heading-active' : ''}`}
          id={headingId}
          {...props}
        >
          {children}
        </Tag>
      )
    }

  const handleNavigate = (id) => {
    const target = articleRef.current?.querySelector(`#${CSS.escape(id)}`)

    if (!target) {
      return
    }

    setActiveHeadingId(id)
    setIsTocOpen(false)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="markdown-shell">
      {headingIndex.length ? (
        <div className="markdown-toc" ref={tocRef}>
          <button
            aria-expanded={isTocOpen}
            aria-label={isTocOpen ? 'Close table of contents' : 'Open table of contents'}
            className={`markdown-toc-toggle${isTocOpen ? ' markdown-toc-toggle-open' : ''}`}
            onClick={() => setIsTocOpen((current) => !current)}
            type="button"
          >
            {isTocOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
          </button>

          <div className={`markdown-toc-panel${isTocOpen ? ' markdown-toc-panel-open' : ''}`}>
            <p className="markdown-toc-label">Table of Contents</p>
            <nav aria-label="Table of contents" className="markdown-toc-list">
              {headingIndex.map((heading) => (
                <button
                  className={`markdown-toc-item markdown-toc-depth-${heading.depth}${
                    activeHeadingId === heading.id ? ' markdown-toc-item-active' : ''
                  }`}
                  key={heading.id}
                  onClick={() => handleNavigate(heading.id)}
                  type="button"
                >
                  <span>{heading.text}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <article className="markdown-body panel" ref={articleRef}>
        <ReactMarkdown
          components={{
            a: ({ href, children, ...props }) => {
              const resolvedHref = resolveContentAsset(href, baseDirectory)
              const isExternal = /^(?:[a-z]+:)?\/\//i.test(resolvedHref)

              return (
                <a
                  href={resolvedHref}
                  rel={isExternal ? 'noreferrer' : undefined}
                  target={isExternal ? '_blank' : undefined}
                  {...props}
                >
                  {children}
                </a>
              )
            },
            h1: createHeading('h1', 1),
            h2: createHeading('h2', 2),
            h3: createHeading('h3', 3),
            img: ({ alt, src, ...props }) => (
              <img
                alt={alt || ''}
                loading="lazy"
                src={resolveContentAsset(src, baseDirectory)}
                {...props}
              />
            ),
            table: ({ children, ...props }) => (
              <div className="markdown-table-shell">
                <table {...props}>{children}</table>
              </div>
            ),
          }}
          rehypePlugins={[rehypeHighlight]}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}

export default MarkdownArticle
