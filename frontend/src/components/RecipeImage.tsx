import { useState, type ImgHTMLAttributes, type ReactNode } from 'react'

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  /** Wird statt des Bildes gezeigt, wenn es fehlt oder nicht geladen werden kann. */
  fallback?: ReactNode
}

/**
 * Bild eines Rezepts. Bilder importierter Rezepte liegen auf fremden Servern: Sie werden ohne Referrer
 * geladen und bei einem Ladefehler ausgeblendet.
 */
export function RecipeImage({ fallback = null, ...props }: Props) {
  const [failed, setFailed] = useState(false)
  if (failed || !props.src) return fallback
  return <img {...props} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}
