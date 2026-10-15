import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/useTheme.jsx'
import { terminalContent } from '../data/terminalContent.js'

const COMMANDS = ['help', 'whoami', 'about', 'skills', 'wins', 'certs', 'writeups', 'projects', 'theme', 'clear']
const HELP = [
  ['whoami', 'Show a short identity summary'],
  ['about', 'Read the full biography'],
  ['skills', 'Jump to skills and tools'],
  ['wins', 'Jump to CTF achievements'],
  ['certs', 'Jump to certifications'],
  ['writeups', 'Open the writeups page'],
  ['projects', 'Find project information'],
  ['theme', 'Toggle the site theme'],
  ['clear', 'Clear terminal output'],
  ['help', 'Show this command list'],
]

function TerminalPrompt() {
  return <span className="terminal-prompt"><span className="terminal-prompt-user">{terminalContent.username}</span><span className="terminal-prompt-host">@{terminalContent.hostname}</span><span className="terminal-prompt-path">:~$</span></span>
}

function TerminalResponse({ entry }) {
  if (entry.kind === 'whoami') {
    const { name, role, highlights, description } = terminalContent.whoami
    return <div className="terminal-response terminal-response-whoami">
      <p className="terminal-identity-name">{name}</p>
      <p className="terminal-identity-role">{role}</p>
      <p className="terminal-identity-highlights">{highlights}</p>
      <p>{description}</p>
    </div>
  }

  if (entry.kind === 'about') {
    return <div className="terminal-response terminal-response-about">
      {terminalContent.about.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      <p className="terminal-about-closing">{terminalContent.about.closing}</p>
    </div>
  }

  return <div className="terminal-response terminal-response-plain">{entry.output}</div>
}

function IdentityTerminal() {
  const navigate = useNavigate()
  const { toggleTheme } = useTheme()
  const outputRef = useRef(null)
  const inputRef = useRef(null)
  const nextEntryId = useRef(0)
  const [showWelcome, setShowWelcome] = useState(true)
  const [entries, setEntries] = useState([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [entries, showWelcome])

  function jumpTo(id) {
    const target = document.getElementById(id)
    if (!target) return false
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    return true
  }

  function execute(raw) {
    const command = raw.trim().toLowerCase()
    if (!command) return

    setHistory((current) => [...current, command])
    setHistoryIndex(-1)
    setInput('')

    if (command === 'clear') {
      setEntries([])
      setShowWelcome(false)
      return
    }

    let output = ''
    let kind = 'plain'
    switch (command) {
      case 'help':
        output = `AVAILABLE COMMANDS\n${HELP.map(([name, description]) => `${name.padEnd(15)} ${description}`).join('\n')}`
        break
      case 'whoami':
      case 'about':
        kind = command
        break
      case 'skills':
      case 'wins':
      case 'certs': {
        const target = command === 'certs' ? 'certifications' : command
        output = jumpTo(target) ? `Opening ${target}...` : 'That section is unavailable.'
        break
      }
      case 'writeups':
        output = 'Opening writeups...'
        navigate('/writeups')
        break
      case 'projects':
        output = jumpTo('projects') ? 'Opening projects...' : 'Projects are not listed on this site yet.'
        break
      case 'theme':
        output = 'Switching theme...'
        toggleTheme()
        break
      default:
        output = "Command not found. Type 'help' for available commands."
    }

    const id = nextEntryId.current++
    setEntries((current) => [...current, { id, command, kind, output }])
  }

  function onKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      execute(input)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const index = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      if (history[index]) {
        setHistoryIndex(index)
        setInput(history[index])
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const index = historyIndex + 1
      setHistoryIndex(index >= history.length ? -1 : index)
      setInput(history[index] || '')
    } else if (event.key === 'Tab' && input.trim()) {
      const matches = COMMANDS.filter((item) => item.startsWith(input.trim().toLowerCase()))
      if (matches.length === 1) {
        event.preventDefault()
        setInput(matches[0])
      }
    }
  }

  return <div className="identity-terminal" onClick={(event) => {
    if (event.target.closest('button, a, input')) return
    inputRef.current?.focus()
  }}>
    <div className="terminal-titlebar">
      <div className="terminal-window-dots" aria-hidden="true"><span /><span /><span /></div>
      <span>identity.sh</span>
      <span className="terminal-titlebar-end" aria-hidden="true">─ □ ×</span>
    </div>
    <div aria-label="Terminal output" aria-live="polite" className="terminal-output" ref={outputRef} role="log">
      {showWelcome && <div className="terminal-welcome">
        <p className="terminal-command"><TerminalPrompt /></p>
        <p>Welcome to W4RR1OR&apos;s terminal.</p>
        <p>Type &apos;help&apos; to explore or &apos;whoami&apos; to learn about me.</p>
      </div>}
      {entries.map((entry) => <div className="terminal-entry" key={entry.id}>
        <p className="terminal-command"><TerminalPrompt /> <span className="terminal-entered-command">{entry.command}</span></p>
        <TerminalResponse entry={entry} />
      </div>)}
    </div>
    <div className="terminal-input-row">
      <label htmlFor="identity-command"><TerminalPrompt /></label>
      {!input && <span aria-hidden="true" className="terminal-caret" />}
      <input aria-label="Terminal command" autoCapitalize="off" autoComplete="off" autoCorrect="off" id="identity-command" onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} ref={inputRef} spellCheck="false" type="text" value={input} />
    </div>
    {entries.length > 0 && <div aria-label="Suggested commands" className="terminal-shortcuts">
      <span>Try:</span>
      {['help', 'wins', 'certs', 'theme'].map((command) => <button key={command} onClick={() => { execute(command); inputRef.current?.focus() }} type="button">{command}</button>)}
    </div>}
  </div>
}

export default IdentityTerminal
