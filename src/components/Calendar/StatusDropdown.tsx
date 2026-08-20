import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

export interface StatusOption {
  value: string
  icon: string
  label: string
}

interface Props {
  value: string
  options: StatusOption[]
  onChange: (value: string) => void
  color: string
  hatched?: boolean
  /** Ob im geschlossenen Zustand neben dem Icon auch der Textlabel steht (Desktop ja, Mobile nein — Issue #36). */
  showLabelWhenClosed: boolean
  ariaLabel: string
}

/**
 * Eigene Dropdown-Komponente statt natives <select>: bei nativem <select>
 * zeigen geschlossener und geöffneter Zustand denselben Options-Text, weil
 * beide vom selben <option>-Text abhängen. Damit auf Mobile die Zelle
 * geschlossen nur das Icon zeigt, aber beim Öffnen zum Ändern der Auswahl
 * Icon + Text lesbar ist, brauchen zu/offen unabhängig gestaltbare Markup
 * (Issue #36).
 */
export function StatusDropdown({ value, options, onChange, color, hatched, showLabelWhenClosed, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex)
      listRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
  }

  const handleListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(options.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="status-dropdown" ref={rootRef} style={{ '--status-color': color } as CSSProperties}>
      <button
        type="button"
        className={hatched ? 'status-dropdown-trigger status-dropdown-trigger--hatched' : 'status-dropdown-trigger'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="status-dropdown-icon" aria-hidden="true">
          {selected.icon}
        </span>
        {showLabelWhenClosed && <span className="status-dropdown-label">{selected.label}</span>}
        <span className="status-dropdown-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <ul
          className="status-dropdown-list"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${activeIndex}`}
          ref={listRef}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={
                index === activeIndex ? 'status-dropdown-option status-dropdown-option--active' : 'status-dropdown-option'
              }
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span>{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
