'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, formatLongDate, formatShortDate } from '@/lib/time'

interface Props {
  startDate: string
  days: number
  selected: string | null
  onSelect: (date: string) => void
}

/**
 * Horizontal date picker.
 *
 * The native scrollbar is hidden rather than left on show — on Windows it
 * renders as a thick grey bar that dominates the control. What replaces it as
 * the "there is more here" signal: a fade at whichever edge can still scroll,
 * plus arrow buttons for pointer users. Touch users swipe, and keyboard users
 * tab through the chips, which scrolls them into view natively.
 */
export default function DateStrip({ startDate, days, selected, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const dates = Array.from({ length: days }, (_, i) => addDays(startDate, i))

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    // 1px of slack: sub-pixel widths otherwise leave the arrow enabled forever.
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateEdges()
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateEdges])

  function nudge(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: direction * Math.max(el.clientWidth * 0.8, 160),
      behavior: reduced ? 'auto' : 'smooth',
    })
  }

  // Fade only the edge that actually has more content behind it, so the strip
  // does not look washed out when it is already at one end.
  const maskImage =
    canLeft && canRight
      ? 'linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)'
      : canLeft
        ? 'linear-gradient(to right, transparent 0, #000 28px)'
        : canRight
          ? 'linear-gradient(to right, #000 calc(100% - 28px), transparent 100%)'
          : undefined

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth py-0.5"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {dates.map((date, i) => {
          const { weekday, day, month } = formatShortDate(date)
          const isSelected = selected === date
          const relative = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday
          // Repeating "Jul Jul Jul" adds nothing. Show the month on the first
          // chip and whenever it changes, and hold the space otherwise so every
          // chip stays the same height.
          const showMonth = i === 0 || formatShortDate(dates[i - 1]).month !== month

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              // Three stacked lines read as nothing to a screen reader.
              aria-label={`${relative}, ${formatLongDate(date)}`}
              className={[
                'flex w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center',
                'rounded-cta border px-1 py-2.5 transition-colors',
                isSelected
                  ? 'border-gold bg-gold text-navy'
                  : 'border-white/10 bg-white/[0.04] text-white hover:border-white/30 hover:bg-white/[0.08]',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={`text-[0.7rem] leading-none ${isSelected ? 'text-navy/70' : 'text-white/50'}`}
              >
                {relative}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 text-xl leading-none ${isSelected ? 'font-semibold' : 'font-medium'}`}
              >
                {day}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 h-3 text-[0.7rem] uppercase leading-none tracking-wide ${
                  isSelected ? 'text-navy/70' : 'text-white/40'
                }`}
              >
                {showMonth ? month : ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Pointer-only affordance: touch users swipe, keyboard users tab. */}
      <ArrowButton side="left" show={canLeft} onClick={() => nudge(-1)} />
      <ArrowButton side="right" show={canRight} onClick={() => nudge(1)} />
    </div>
  )
}

function ArrowButton({
  side,
  show,
  onClick,
}: {
  side: 'left' | 'right'
  show: boolean
  onClick: () => void
}) {
  if (!show) return null
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden="true"
      className={[
        'absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center',
        'rounded-full border border-white/15 bg-navy/90 text-white/70 backdrop-blur',
        'transition-colors hover:border-gold hover:text-gold sm:flex',
        side === 'left' ? '-left-3' : '-right-3',
      ].join(' ')}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
        <path
          d={side === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
