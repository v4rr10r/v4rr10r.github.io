import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function ArticleImageLightbox({ image, onClose, returnFocusRef }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const returnFocus = returnFocusRef.current
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      returnFocus?.focus()
    }
  }, [onClose, returnFocusRef])

  return createPortal(
    <div className="reader-image-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div aria-label={image.alt || 'Article image preview'} aria-modal="true" className="reader-image-dialog" role="dialog">
        <button aria-label="Close image preview" className="reader-image-close" onClick={onClose} ref={closeRef} type="button"><X size={20} /></button>
        <img alt={image.alt} src={image.src} />
        {image.alt && <p>{image.alt}</p>}
      </div>
    </div>,
    document.body,
  )
}

export default ArticleImageLightbox
