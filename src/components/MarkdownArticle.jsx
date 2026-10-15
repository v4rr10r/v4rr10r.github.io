import { createElement, useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { common } from 'lowlight'
import http from 'highlight.js/lib/languages/http'
import ArticleImageLightbox from './ArticleImageLightbox.jsx'
import CodeViewer from './CodeViewer.jsx'
import ReaderToc from './ReaderToc.jsx'
import { resolveContentAsset } from '../data/content.js'
import { createHeadingIndex } from '../lib/markdownHeadings.js'

const highlightLanguages = { ...common, http }

function MarkdownArticle({ articleTitle, baseDirectory, content, header, footer }) {
  const articleRef = useRef(null)
  const { headings, idsByOffset } = useMemo(() => createHeadingIndex(content), [content])
  const leadingTitle = headings[0]?.depth === 1 && headings[0].text.trim().toLocaleLowerCase() === articleTitle.trim().toLocaleLowerCase() ? headings[0] : null
  const tocHeadings = useMemo(() => leadingTitle ? headings.slice(1) : headings, [headings, leadingTitle])
  const extraAnchors = useMemo(() => leadingTitle ? [leadingTitle.id] : [], [leadingTitle])
  const [image, setImage] = useState(null)
  const returnFocusRef = useRef(null)
  const closeImage = useCallback(() => setImage(null), [])
  const headingCounts = new Map()

  function headingId(node, children) {
    const id = idsByOffset.get(node.position?.start?.offset)
    if (id) return id
    const text = String(children).trim()
    const matches = headings.filter((heading) => heading.text === text)
    const count = headingCounts.get(text) || 0
    headingCounts.set(text, count + 1)
    return matches[count]?.id || `section-${node.position?.start?.line || 1}`
  }

  function createHeading(Tag) {
    return function Heading({ children, node, ...props }) {
      const id = headingId(node, children)
      if (leadingTitle?.id === id) return <span aria-hidden="true" className="reader-title-anchor" id={id} />
      const label = headings.find((heading) => heading.id === id)?.text || id
      return createElement(Tag, { className: 'markdown-heading', id, ...props }, children, <Link aria-label={`Link to ${label}`} className="markdown-heading-anchor" to={{ hash: `#${id}` }}>#</Link>)
    }
  }

  function openImage(event, source, alt) {
    event.currentTarget.focus()
    returnFocusRef.current = event.currentTarget
    setImage({ src: source, alt })
  }

  return (
    <div className="reader-grid">
      <div className="reader-main">
        {header}
        <article className="markdown-body panel" ref={articleRef}>
          <ReactMarkdown
            components={{
              a: ({ href, children, ...props }) => {
                const resolvedHref = resolveContentAsset(href, baseDirectory)
                const isExternal = /^(?:[a-z]+:)?\/\//i.test(resolvedHref)
                return <a {...props} href={resolvedHref} rel={isExternal ? 'noreferrer' : undefined} target={isExternal ? '_blank' : undefined}>{children}</a>
              },
              h1: createHeading('h1'),
              h2: createHeading('h2'),
              h3: createHeading('h3'),
              h4: createHeading('h4'),
              img: ({ alt, src, ...props }) => {
                const resolvedSrc = resolveContentAsset(src, baseDirectory)
                return <img {...props} alt={alt || ''} aria-label={`Enlarge image: ${alt || 'article image'}`} className="markdown-zoomable-image" loading="lazy" onClick={(event) => openImage(event, resolvedSrc, alt || '')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openImage(event, resolvedSrc, alt || '') } }} role="button" src={resolvedSrc} tabIndex="0" />
              },
              pre: ({ children, node }) => <CodeViewer node={node} source={content}>{children}</CodeViewer>,
              table: ({ children, ...props }) => <div className="markdown-table-shell" role="region" aria-label="Scrollable table" tabIndex="0"><table {...props}>{children}</table></div>,
            }}
            rehypePlugins={[[rehypeHighlight, { detect: false, languages: highlightLanguages }]]}
            remarkPlugins={[remarkGfm]}
          >{content}</ReactMarkdown>
        </article>
        {footer}
      </div>
      <ReaderToc articleRef={articleRef} extraAnchors={extraAnchors} headings={tocHeadings} />
      {image && <ArticleImageLightbox image={image} onClose={closeImage} returnFocusRef={returnFocusRef} />}
    </div>
  )
}

export default MarkdownArticle
