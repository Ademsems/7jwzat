import { supabase } from "@/lib/supabase";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

function getErrMessage(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Something went wrong.";
}

/**
 * Single source of truth for updating a booking's status. Used by the
 * bookings table page and the Calendar side panel — never duplicate this
 * Supabase call elsewhere.
 */
export async function updateBookingStatus(id: string, status: BookingStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  return { error: error ? getErrMessage(error) : null };
}
