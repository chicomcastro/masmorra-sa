import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Ações destrutivas em dois toques. O segundo toque diz o que vai acontecer. */
export function TwoTapButton({
  children,
  confirmLabel,
  onConfirm,
  className = '',
  disabled,
}: {
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  className?: string
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}

export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet stack" role="dialog" aria-label={title}>
        <div className="sheet-head">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h3>{title}</h3>
          </div>
          <button type="button" className="quiet" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

/**
 * Toque longo em qualquer número abre edição direta. É de propósito escondido:
 * toque longo nunca é ação primária.
 */
export function LongPressNumber({
  value,
  label,
  onChange,
  className = 'num',
}: {
  value: number
  label: string
  onChange: (next: number) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const start = () => {
    timer.current = window.setTimeout(() => setEditing(true), 600)
  }
  const cancel = () => window.clearTimeout(timer.current)

  return (
    <>
      <span
        className={className}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'manipulation' }}
      >
        {value}
      </span>
      {editing ? (
        <Sheet title={label} eyebrow="Ajuste manual" onClose={() => setEditing(false)}>
          <p className="note">
            O valor vira um evento <code>override</code>, com o antes e o depois.
          </p>
          <div className="number-pad">
            {Array.from({ length: 13 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={i === value ? 'on' : ''}
                onClick={() => {
                  onChange(i)
                  setEditing(false)
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  )
}

export function Pips({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="pips" aria-label={`${filled} de ${total}`}>
      {'●'.repeat(Math.max(0, filled))}
      {'○'.repeat(Math.max(0, total - Math.max(0, filled)))}
    </span>
  )
}
