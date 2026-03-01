"use client"

import React, { useEffect, useImperativeHandle, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"

// ===================== Types & API =====================
export type TimeRange = { start: string; end: string }
export type AvailabilitySelectorHandle = {
  /** Validate according to the min-available rule. */
  validate: () => { ok: boolean; errors: string[] }
  /** Get unavailable ranges in time notation (e.g. 12:00-13:30). */
  getUnavailable: () => TimeRange[]
  /** Helper: get available ranges in time notation. */
  getAvailable: () => TimeRange[]
  /** Programmatically set unavailable ranges (e.g. edit mode). */
  setUnavailable: (ranges: TimeRange[]) => void
  /** Clear all selections. */
  clear: () => void
}

export type AvailabilitySelectorProps = {
  /** Event start time, e.g. "09:00" */
  eventStart: string
  /** Event end time, e.g. "18:00" */
  eventEnd: string
  /** Pre-filled unavailable ranges (edit mode). */
  initialUnavailable?: TimeRange[]
  /** Min available length in minutes (default 60). */
  minAvailableMinutes?: number
  /** Optional title for the card. */
  title?: string
  /** Optional ref to control/validate from parent form. */
  innerRef?: React.Ref<AvailabilitySelectorHandle>
  /** Optional: show a compact legend on top (default true). */
  showLegend?: boolean
  /** Slot duration in minutes (default 30). Supported values: 15, 30. */
  slotDuration?: number
}

// ===================== Helpers =====================
function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function fromMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function generateSlots(start: string, end: string, slotDuration = 30): string[] {
  const out: string[] = []
  let cur = toMinutes(start)
  const endMin = toMinutes(end)
  while (cur < endMin) {
    out.push(fromMinutes(cur))
    cur += slotDuration
  }
  return out
}

/** Range in slot indices (inclusive). */
type RangeIdx = { start: number; end: number }

function timeRangeToIdxRange(range: TimeRange, slots: string[], eventEnd?: string): RangeIdx | null {
  const s = slots.indexOf(range.start)
  if (s === -1) return null
  
  // End kann eventEnd sein (nicht in slots[]) → letzter Slot
  let eExclusive = slots.indexOf(range.end)
  if (eExclusive === -1 && range.end === eventEnd) {
    eExclusive = slots.length // exklusiv = einer nach dem letzten
  } else if (eExclusive === -1) {
    return null
  }
  
  return { start: s, end: Math.max(s, eExclusive - 1) }
}

function idxRangeToTimeRange(
  r: RangeIdx, 
  slots: string[], 
  slotDuration = 30,
  eventEnd?: string
): TimeRange {
  const start = slots[r.start]
  const endIdxExclusive = r.end + 1
  const end = endIdxExclusive < slots.length
    ? slots[endIdxExclusive]
    : eventEnd ?? fromMinutes(toMinutes(slots[slots.length - 1]) + slotDuration)
  return { start, end }
}

function mergeRanges(ranges: RangeIdx[]): RangeIdx[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: RangeIdx[] = []
  let cur = { ...sorted[0] }
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i]
    if (r.start <= cur.end + 1) {
      cur.end = Math.max(cur.end, r.end)
    } else {
      out.push(cur)
      cur = { ...r }
    }
  }
  out.push(cur)
  return out
}

function removeIndexFromRanges(ranges: RangeIdx[], index: number): RangeIdx[] {
  const out: RangeIdx[] = []
  for (const r of ranges) {
    if (index < r.start || index > r.end) {
      out.push(r)
      continue
    }
    // index is inside r
    if (r.start === r.end && r.start === index) {
      // drop this single-slot range
      continue
    }
    if (index === r.start) {
      out.push({ start: r.start + 1, end: r.end })
      continue
    }
    if (index === r.end) {
      out.push({ start: r.start, end: r.end - 1 })
      continue
    }
    // split into two ranges
    out.push({ start: r.start, end: index - 1 })
    out.push({ start: index + 1, end: r.end })
  }
  return out
}

function isIndexInRanges(ranges: RangeIdx[], idx: number) {
  return ranges.some((r) => idx >= r.start && idx <= r.end)
}

function computeAvailableSegments(totalSlots: number, unavailable: RangeIdx[]): Array<{ start: number; end: number }> {
  const blocked = Array(totalSlots).fill(false)
  for (const r of unavailable) {
    for (let i = r.start; i <= r.end; i++) blocked[i] = true
  }
  const segs: Array<{ start: number; end: number }> = []
  let i = 0
  while (i < totalSlots) {
    if (blocked[i]) {
      i++
      continue
    }
    const start = i
    while (i < totalSlots && !blocked[i]) i++
    segs.push({ start, end: i - 1 })
  }
  return segs
}

// ===================== Component =====================
const Legend = () => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
    <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-500" /> verfügbar</div>
    <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-400" /> Bereich wählen</div>
    <div className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-500" /> nicht verfügbar</div>
  </div>
)

export default function AvailabilitySelectorBlock(props: AvailabilitySelectorProps) {
  const { eventStart, eventEnd, initialUnavailable, minAvailableMinutes = 60, title = "Verfügbarkeit", innerRef, showLegend = true, slotDuration = 30 } = props

  const slots = useMemo(() => generateSlots(eventStart, eventEnd, slotDuration), [eventStart, eventEnd, slotDuration])
  const [ranges, setRanges] = useState<RangeIdx[]>([])
  const [pendingStartIdx, setPendingStartIdx] = useState<number | null>(null)

  // hydrate from initialUnavailable (edit-mode)
  useEffect(() => {
    if (!initialUnavailable || initialUnavailable.length === 0) return
    const idxRanges: RangeIdx[] = []
    for (const r of initialUnavailable) {
      const idxR = timeRangeToIdxRange(r, slots, eventEnd)
      if (idxR) idxRanges.push(idxR)
    }
    setRanges(mergeRanges(idxRanges))
    setPendingStartIdx(null)
  }, [initialUnavailable, slots])

  // Imperative API for parent form
  useImperativeHandle(
    innerRef,
    (): AvailabilitySelectorHandle => ({
      validate: () => {
        const errors: string[] = []
        const segs = computeAvailableSegments(slots.length, ranges)
        const minSlots = Math.ceil(minAvailableMinutes / slotDuration)
        for (const s of segs) {
          const len = s.end - s.start + 1
          if (len > 0 && len < minSlots) {
            const tr = idxRangeToTimeRange({ start: s.start, end: s.end }, slots, slotDuration, eventEnd)
            errors.push(`Verfügbare Spanne ${tr.start}–${tr.end} ist kürzer als ${minAvailableMinutes} Minuten.`)
          }
        }
        return { ok: errors.length === 0, errors }
      },
      getUnavailable: () => ranges.map((r) => idxRangeToTimeRange(r, slots, slotDuration, eventEnd)),
      getAvailable: () => {
        const segs = computeAvailableSegments(slots.length, ranges)
        return segs.map((s) => idxRangeToTimeRange({ start: s.start, end: s.end }, slots, slotDuration, eventEnd))
      },
      setUnavailable: (tRanges: TimeRange[]) => {
        const idxRanges: RangeIdx[] = []
        for (const r of tRanges) {
          const idx = timeRangeToIdxRange(r, slots)
          if (idx) idxRanges.push(idx)
        }
        setRanges(mergeRanges(idxRanges))
        setPendingStartIdx(null)
      },
      clear: () => {
        setRanges([])
        setPendingStartIdx(null)
      },
    }),
    [ranges, slots, minAvailableMinutes, slotDuration]
  )

  // ===================== Interaction =====================
  const onSlotClick = (idx: number) => {
    // 1) Clicking an unavailable slot toggles that single slot to available (may split ranges)
    if (isIndexInRanges(ranges, idx)) {
      setRanges((prev) => removeIndexFromRanges(prev, idx))
      setPendingStartIdx(null)
      return
    }

    // 2) If no pending start → mark this slot as pending start (yellow)
    if (pendingStartIdx === null) {
      setPendingStartIdx(idx)
      return
    }

    // 3) Second click defines the end → add new unavailable range and merge overlaps
    const start = Math.min(pendingStartIdx, idx)
    const end = Math.max(pendingStartIdx, idx)
    setRanges((prev) => mergeRanges([...prev, { start, end }]))
    setPendingStartIdx(null)
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex items-start flex-col gap-3">
        <div className="flex-1">
          <span className="mt-1 text-xs text-muted-foreground">Wähle deine Verfügbarkeit aus (all Times UTC)</span>
        </div>
        
        {showLegend && <Legend />}
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {slots.map((t, i) => {
              const isPending = pendingStartIdx === i
              const isBlocked = isIndexInRanges(ranges, i)
              return (
                <Tooltip key={t}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => onSlotClick(i)}
                      className={cn(
                        "h-10 rounded-md border px-3 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      
                        // ❌ Blocked
                        isBlocked &&
                          "bg-destructive/50 text-destructive-foreground border-destructive/60 hover:bg-destructive/90",
                      
                        // ⏳ Pending
                        isPending &&
                          !isBlocked &&
                          "bg-amber-500/20 text-amber-700 border-amber-500/40 hover:bg-amber-500/30 dark:text-amber-400",
                      
                        // ✅ Available
                        !isBlocked &&
                          !isPending &&
                          "bg-green-500/30 text-primary border-primary/40 hover:bg-primary/25"
                      )}
                    >
                      {t}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isBlocked ? `Klicken, um diesen ${slotDuration}‑Min‑Slot wieder verfügbar zu machen` : pendingStartIdx!=null ? "Endzeit wählen" : "Klicken, um Nicht‑Verfügbarkeit zu starten"}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>

        {/* Preview of current unavailable ranges */}
        <div className="mt-4 space-y-1 text-sm">
          
          {ranges.length === 0 ? (
            <div>
              <div className="font-medium">Availability:</div>
              <div className="text-muted-foreground">full</div>
            </div>
          ) : (
            <div>
            <div className="font-medium pb-2">Unavailable:</div>
            <ul className="list-disc">
              {ranges.map((r, idx) => {
                const tr = idxRangeToTimeRange(r, slots, slotDuration, eventEnd)
                return (
                  <li key={idx} className="flex items-center bg-destructive/20 dark:bg-destructive/50 justify-between px-2 py-1 rounded mb-2">
                    {tr.start}z – {tr.end}z
                  <button
                  onClick={() => {
                    setRanges((prev) =>
                      prev.filter((_, i) => i !== idx)
                    )
                  }}
                  className="hover:text-destructive font-bold ml-2"
                >
                  ✕
                </button>

                </li>
                )
              })}
            </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
