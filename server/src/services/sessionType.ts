/**
 * What kind of session a booking is, going by how the customer booked it:
 *  - laser: "Book Appointment" on a membership card. The booking carries the package's name.
 *  - cashback: a treatment from the treatments section, paid with a membership or on its own.
 *    The booking carries the treatment's name.
 * Sessions with no booking request (staff-entered) belong to the membership, so they are laser.
 */
export type SessionType = "laser" | "cashback";

type BookingLike = { isStandalone?: boolean; standaloneName?: string | null; isTreatmentBooking?: boolean | null };
type PackageNames = { name?: string | null; nameAr?: string | null };

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function isTreatmentBooking(booking: BookingLike | null | undefined, offer?: PackageNames | null): boolean {
  if (!booking) return false;
  // Saved at booking time since this was added, so renaming a package can't change it.
  if (typeof booking.isTreatmentBooking === "boolean") return booking.isTreatmentBooking;
  if (booking.isStandalone) return true;
  if (!booking.standaloneName) return false;
  return !same(booking.standaloneName, offer?.name) && !same(booking.standaloneName, offer?.nameAr);
}

export function sessionTypeOf(booking: BookingLike | null | undefined, offer?: PackageNames | null): SessionType {
  return isTreatmentBooking(booking, offer) ? "cashback" : "laser";
}
