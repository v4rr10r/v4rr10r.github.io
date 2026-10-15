import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Maximize2, Minimize2 } from 'lucide-react'

function hastText(node) {
  if (node.type === 'text') return node.value || ''
  return node.children?.map(hastText).join('') || ''
}

function getCodeDetails(node, source) {
  const codeNode = node.children?.find((child) => child.tagName === 'code')
  const classes = codeNode?.properties?.className || []
  const languageClass = classes.find((name) => name.startsWith('language-'))
  const language = languageClass?.slice(9) || 'text'
  const offset = node.position?.start?.offset
  const firstLine = typeof offset === 'number' ? source.slice(offset).split('\n', 1)[0] : ''
  const filename = /\b(?:title|filename|file)=(?:"([^"]+)"|'([^']+)'|([^\s]+))/.exec(firstLine)
  return { code: hastText(codeNode || node), language, filename: filename?.[1] || filename?.[2] || filename?.[3] || '' }
}

function CodeViewer({ children, node, source }) {
  const { code, language, filename } = getCodeDetails(node, source)
  const [expanded, setExpanded] = useState(false)
  const [copyStatus, setCopyStatus] = useState('idle')
  const feedbackTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setCopyStatus('idle'), 2200)
  }

  return (
    <div className={`code-viewer${expanded ? ' code-viewer-expanded' : ''}`}>
      <div className="code-viewer-header">
        <div className="code-viewer-title"><span className="code-viewer-dot" aria-hidden="true" />{filename && <span className="code-viewer-filename">{filename}</span>}<span className="code-viewer-language">{language}</span></div>
        <div className="code-viewer-actions">
          <button aria-label={copyStatus === 'copied' ? 'Code copied' : 'Copy entire code block'} onClick={copyCode} type="button">{copyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}<span aria-live="polite">{copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : 'Copy'}</span></button>
          <button aria-expanded={expanded} aria-label={expanded ? 'Collapse code block' : 'Expand code block'} onClick={() => setExpanded((current) => !current)} type="button">{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span>{expanded ? 'Collapse' : 'Expand'}</span></button>
        </div>
      </div>
      <pre className="code-viewer-scroll" tabIndex="0">{children}</pre>
    </div>
  )
}

export default CodeViewer
