export type BlockType = "none" | "walk_ins_only" | "fully_blocked";

export interface DayNote {
  id: string;
  date: string; // "YYYY-MM-DD"
  note: string | null;
  block_type: BlockType;
  block_start_time: string | null; // "HH:MM" — null means all day
  block_end_time: string | null;   // "HH:MM" — null means all day
}

type BlockLike = { block_type: BlockType; block_start_time: string | null; block_end_time: string | null };

/** True when the block covers the whole day (no start/end time set). */
export function isDayNoteWholeDayBlocked(note: BlockLike | null | undefined): boolean {
  return !!note && note.block_type !== "none" && !note.block_start_time && !note.block_end_time;
}

/**
 * Shared by the public booking page (client, decides what's shown) and
 * POST /api/create-booking (server, the real enforcement boundary) — kept
 * as one function so the two checks can never silently drift apart.
 */
export function isTimeBlockedByDayNote(note: BlockLike | null | undefined, time: string | null): boolean {
  if (!note || note.block_type === "none") return false;
  if (isDayNoteWholeDayBlocked(note)) return true;
  if (!time) return false;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
  const t = toMin(time);
  const s = note.block_start_time ? toMin(note.block_start_time) : 0;
  const e = note.block_end_time ? toMin(note.block_end_time) : 24 * 60;
  return t >= s && t < e;
}

function getErrMessage(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Something went wrong.";
}

/**
 * Single source of truth for writing a day note/block. Upserts — one row
 * per (business, date). Used by the calendar side panel only.
 */
export async function saveDayNote(input: {
  date: string; note: string | null; block_type: BlockType;
  block_start_time: string | null; block_end_time: string | null;
}): Promise<{ dayNote: DayNote | null; error: string | null }> {
  try {
    const res = await fetch("/api/day-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { dayNote: null, error: data.error ?? "Something went wrong." };
    return { dayNote: data.dayNote as DayNote, error: null };
  } catch (e) {
    return { dayNote: null, error: getErrMessage(e) };
  }
}

/** Single source of truth for clearing a day note/block. */
export async function deleteDayNote(date: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/day-notes?date=${encodeURIComponent(date)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error ?? "Something went wrong." };
    }
    return { error: null };
  } catch (e) {
    return { error: getErrMessage(e) };
  }
}
