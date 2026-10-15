import { useEffect, useMemo, useState } from 'react'

const TARGET_TEXT = 'W4RR1OR'
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const BOOT_DELAY = 220
const LETTER_MIN = 160
const LETTER_VARIANCE = 70
const FINAL_PAUSE = 260
const FADE_DURATION = 420

function randomCharacter() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
}

function BootLoader({ onComplete }) {
  const targetCharacters = useMemo(() => TARGET_TEXT.split(''), [])
  const [letterDurations] = useState(() =>
    targetCharacters.map(() => LETTER_MIN + Math.floor(Math.random() * LETTER_VARIANCE)),
  )
  const [letterCadences] = useState(() =>
    targetCharacters.map(() => 26 + Math.floor(Math.random() * 30)),
  )
  const [displayCharacters, setDisplayCharacters] = useState(() =>
    targetCharacters.map(() => randomCharacter()),
  )
  const [resolvedCount, setResolvedCount] = useState(0)
  const [phase, setPhase] = useState('boot')
  const [isExiting, setIsExiting] = useState(false)
  const [noiseActive, setNoiseActive] = useState(false)
  const [scanlineActive, setScanlineActive] = useState(false)
  const [shakeActive, setShakeActive] = useState(false)
  const [jitterMap, setJitterMap] = useState(() => targetCharacters.map(() => ({ x: 0, y: 0, rotate: 0 })))
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 })
  const totalDecodeDuration = useMemo(
    () => letterDurations.reduce((sum, duration) => sum + duration, BOOT_DELAY),
    [letterDurations],
  )
  const totalDuration = totalDecodeDuration + FINAL_PAUSE + FADE_DURATION

  useEffect(() => {
    const startTime = performance.now()
    let frameId = 0
    let lastNoise = 0
    let scanlineTriggered = false
    let burstShakeTimeout = 0
    let noiseTimeout = 0
    let shakeBurstActive = false
    let lastJitterUpdate = 0
    let finalShakeTriggered = false
    const letterStartOffsets = letterDurations.reduce((offsets, duration, index) => {
      offsets[index] = index === 0 ? 0 : offsets[index - 1] + letterDurations[index - 1]
      return offsets
    }, [])

    const runFrame = (now) => {
      const elapsed = now - startTime
      let nextPhase = 'boot'
      let nextResolvedCount = 0

      if (elapsed < BOOT_DELAY) {
        nextPhase = 'boot'
      } else if (elapsed < totalDecodeDuration) {
        nextPhase = 'scramble'
      } else if (elapsed < totalDecodeDuration + FINAL_PAUSE) {
        nextPhase = 'stable'
      }
      setPhase(nextPhase)

      if (elapsed >= BOOT_DELAY) {
        const decodeElapsed = elapsed - BOOT_DELAY
        let accumulated = 0

        for (let index = 0; index < letterDurations.length; index += 1) {
          const duration = letterDurations[index]

          if (decodeElapsed >= accumulated + duration) {
            nextResolvedCount = index + 1
            accumulated += duration
            continue
          }

          break
        }
      }

      setResolvedCount(nextResolvedCount)
      setDisplayCharacters((currentCharacters) =>
        currentCharacters.map((currentCharacter, index) => {
          if (index < nextResolvedCount) {
            return targetCharacters[index]
          }

          if (elapsed < BOOT_DELAY) {
            return currentCharacter
          }

          const decodeOffset = elapsed - BOOT_DELAY - letterStartOffsets[Math.min(index, nextResolvedCount)]
          const cadence = letterCadences[index]
          const shouldSkipFrame = Math.random() < 0.18 && decodeOffset % 84 < 26

          if (shouldSkipFrame || decodeOffset % cadence > cadence * 0.62) {
            return currentCharacter
          }

          return randomCharacter()
        }),
      )

      if (now - lastJitterUpdate > 38) {
        lastJitterUpdate = now
        setJitterMap(
          targetCharacters.map((_, index) => {
            if (index < nextResolvedCount || nextPhase === 'stable') {
              return { x: 0, y: 0, rotate: 0 }
            }

            return {
              x: Math.round((Math.random() - 0.5) * 8),
              y: Math.round((Math.random() - 0.5) * 8),
              rotate: Number(((Math.random() - 0.5) * 2).toFixed(2)),
            }
          }),
        )
      }

      if (
        elapsed > BOOT_DELAY + 120 &&
        elapsed < totalDecodeDuration &&
        now - lastNoise > 120 &&
        Math.random() < 0.018
      ) {
        lastNoise = now
        setNoiseActive(true)
        window.clearTimeout(noiseTimeout)
        noiseTimeout = window.setTimeout(() => setNoiseActive(false), 60)
      }

      if (elapsed > BOOT_DELAY + 180 && !scanlineTriggered) {
        scanlineTriggered = true
        setScanlineActive(true)
      }

      if (
        nextResolvedCount >= targetCharacters.length - 2 &&
        elapsed < totalDecodeDuration &&
        elapsed > totalDecodeDuration - 260 &&
        !shakeBurstActive
      ) {
        shakeBurstActive = true
        setShakeActive(true)
        setScreenShake({
          x: Math.round((Math.random() - 0.5) * 6),
          y: Math.round((Math.random() - 0.5) * 6),
        })
        window.clearTimeout(burstShakeTimeout)
        burstShakeTimeout = window.setTimeout(() => {
          setShakeActive(false)
          setScreenShake({ x: 0, y: 0 })
          shakeBurstActive = false
        }, 150)
      }

      if (elapsed >= totalDecodeDuration) {
        setDisplayCharacters(targetCharacters)
      }

      if (!finalShakeTriggered && nextResolvedCount === targetCharacters.length && elapsed >= totalDecodeDuration) {
        finalShakeTriggered = true
        setShakeActive(true)
        setScreenShake({
          x: Math.round((Math.random() - 0.5) * 8),
          y: Math.round((Math.random() - 0.5) * 8),
        })
        window.clearTimeout(burstShakeTimeout)
        burstShakeTimeout = window.setTimeout(() => {
          setShakeActive(false)
          setScreenShake({ x: 0, y: 0 })
        }, 120)
      }

      if (elapsed < totalDecodeDuration + FINAL_PAUSE) {
        frameId = window.requestAnimationFrame(runFrame)
      }
    }

    frameId = window.requestAnimationFrame(runFrame)

    const exitTimeout = window.setTimeout(() => {
      setResolvedCount(targetCharacters.length)
      setDisplayCharacters(targetCharacters)
      setPhase('stable')
      setIsExiting(true)
      setShakeActive(true)
      setScreenShake({
        x: Math.round((Math.random() - 0.5) * 8),
        y: Math.round((Math.random() - 0.5) * 8),
      })
      setJitterMap(targetCharacters.map(() => ({ x: 0, y: 0, rotate: 0 })))
      window.clearTimeout(burstShakeTimeout)
      burstShakeTimeout = window.setTimeout(() => {
        setShakeActive(false)
        setScreenShake({ x: 0, y: 0 })
      }, 120)
    }, totalDecodeDuration + FINAL_PAUSE)

    const completeTimeout = window.setTimeout(() => {
      onComplete()
    }, totalDuration)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(exitTimeout)
      window.clearTimeout(completeTimeout)
      window.clearTimeout(burstShakeTimeout)
      window.clearTimeout(noiseTimeout)
    }
  }, [letterCadences, letterDurations, onComplete, targetCharacters, totalDecodeDuration, totalDuration])

  return (
    <div
      aria-hidden="true"
      className={`boot-loader boot-loader-${phase}${isExiting ? ' boot-loader-exit' : ''}${
        noiseActive ? ' boot-loader-noise-active' : ''
      }${scanlineActive ? ' boot-loader-scanline-active' : ''}${
        shakeActive ? ' boot-loader-shake' : ''
      }`}
      style={{
        transform: `translate3d(${screenShake.x}px, ${screenShake.y}px, 0)`,
      }}
    >
      <div className="boot-loader-noise" />
      <div className="boot-loader-scanline" />
      <div className="boot-loader-mark" role="presentation">
        {displayCharacters.map((character, index) => {
          const isResolved = index < resolvedCount
          const shouldJitter = phase !== 'stable' && !isResolved

          return (
            <span
              className={`boot-loader-char${shouldJitter ? ' boot-loader-char-jitter' : ''}${
                isResolved ? ' boot-loader-char-resolved' : ''
              }${resolvedCount === targetCharacters.length ? ' boot-loader-char-final' : ''
              }`}
              key={index}
              style={
                shouldJitter
                  ? {
                      transform: `translate3d(${jitterMap[index].x}px, ${jitterMap[index].y}px, 0) rotate(${jitterMap[index].rotate}deg)`,
                    }
                  : { transform: 'translate3d(0, 0, 0) rotate(0deg)' }
              }
            >
              {character}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default BootLoader
