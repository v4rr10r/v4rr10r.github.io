import { useEffect, useRef } from 'react'

const CLICKABLE_SELECTOR =
  'a, button, input, select, textarea, summary, [role="button"], [data-hover-reactive="true"]'

const BINARY_FRAGMENTS = ['0', '1', '01', '10']

function CursorTrail() {
  const containerRef = useRef(null)
  const dotRef = useRef(null)
  const glowRef = useRef(null)
  const targetPointRef = useRef({ x: -100, y: -100 })
  const currentPointRef = useRef({ x: -100, y: -100 })
  const isHoveringRef = useRef(false)
  const lastEmitRef = useRef(0)
  const lastMoveRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)
  const hasPointerRef = useRef(false)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) {
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const appStage = document.querySelector('.app-stage')

    const emitFragment = (x, y, isHovering) => {
      const container = containerRef.current

      if (!container) {
        return
      }

      const fragment = document.createElement('span')
      const lifetime = isHovering
        ? 400 + Math.round(Math.random() * 100)
        : 440 + Math.round(Math.random() * 140)
      const driftX = Math.round((Math.random() - 0.5) * 8)
      const driftY = 2 + Math.round(Math.random() * 3)
      const rotation = ((Math.random() - 0.5) * 10).toFixed(2)
      const glow = isHovering ? 0.18 : 0.12

      fragment.className = 'cursor-fragment'
      fragment.textContent =
        BINARY_FRAGMENTS[Math.floor(Math.random() * BINARY_FRAGMENTS.length)]
      fragment.style.left = `${x + (Math.random() - 0.5) * 16}px`
      fragment.style.top = `${y + (Math.random() - 0.5) * 12}px`
      fragment.style.setProperty('--fragment-drift-x', `${driftX}px`)
      fragment.style.setProperty('--fragment-drift-y', `${driftY}px`)
      fragment.style.setProperty('--fragment-rotate', `${rotation}deg`)
      fragment.style.setProperty('--fragment-glow', `${glow}`)
      fragment.style.animationDuration = `${lifetime}ms`
      container.appendChild(fragment)

      window.setTimeout(() => {
        fragment.remove()
      }, lifetime)
    }

    const updateCursor = () => {
      frameRef.current = 0
      const dot = dotRef.current
      const glow = glowRef.current

      if (!dot || !glow) {
        return
      }

      const currentPoint = currentPointRef.current
      const targetPoint = targetPointRef.current
      const easing = isHoveringRef.current ? 0.38 : 0.3
      const distanceX = targetPoint.x - currentPoint.x
      const distanceY = targetPoint.y - currentPoint.y

      currentPoint.x += distanceX * easing
      currentPoint.y += distanceY * easing

      dot.style.transform = `translate3d(${targetPoint.x}px, ${targetPoint.y}px, 0)`
      glow.style.transform = `translate3d(${currentPoint.x}px, ${currentPoint.y}px, 0)`

      if (Math.abs(distanceX) + Math.abs(distanceY) > 0.4) {
        frameRef.current = window.requestAnimationFrame(updateCursor)
      }
    }

    const wakeCursor = () => {
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(updateCursor)
    }

    const handlePointerMove = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      if (!appStage?.classList.contains('app-stage-ready')) return

      const now = performance.now()
      const target = targetPointRef.current
      const movedEnough =
        Math.hypot(event.clientX - lastMoveRef.current.x, event.clientY - lastMoveRef.current.y) > 18
      const minInterval = isHoveringRef.current ? 90 : 125
      const firstMove = !hasPointerRef.current

      target.x = event.clientX
      target.y = event.clientY

      if (firstMove) {
        currentPointRef.current = { x: event.clientX, y: event.clientY }
        lastMoveRef.current = { x: event.clientX, y: event.clientY }
        hasPointerRef.current = true
        document.body.classList.add('custom-cursor-enabled', 'cursor-pointer-active')
      }

      if (!firstMove && movedEnough && now - lastEmitRef.current > minInterval) {
        lastEmitRef.current = now
        lastMoveRef.current = { x: event.clientX, y: event.clientY }
        emitFragment(event.clientX, event.clientY, isHoveringRef.current)
      }

      wakeCursor()
    }

    const handlePointerOver = (event) => {
      isHoveringRef.current =
        event.target instanceof Element &&
        Boolean(event.target.closest(CLICKABLE_SELECTOR))
      document.body.classList.toggle('cursor-hovering', isHoveringRef.current)
    }

    const handlePointerLeave = () => {
      hasPointerRef.current = false
      isHoveringRef.current = false
      document.body.classList.remove('cursor-hovering', 'cursor-pointer-active', 'custom-cursor-enabled')
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('pointerover', handlePointerOver, { passive: true })
    document.documentElement.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('blur', handlePointerLeave)

    return () => {
      window.cancelAnimationFrame(frameRef.current)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerover', handlePointerOver)
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('blur', handlePointerLeave)
      document.body.classList.remove('cursor-hovering', 'cursor-pointer-active', 'custom-cursor-enabled')
    }
  }, [])

  return (
    <div className="cursor-layer" ref={containerRef} aria-hidden="true">
      <span className="cursor-glow" ref={glowRef} />
      <span className="cursor-dot" ref={dotRef} />
    </div>
  )
}

export default CursorTrail
