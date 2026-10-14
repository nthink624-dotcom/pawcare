import { redirect } from "next/navigation";

export default async function LegacyBookingManagePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (!t) redirect("/" as never);
  // The canonical entry validates signature, expiry and the token's shop before opening a booking.
  redirect(`/m?${new URLSearchParams({ t }).toString()}` as never);
}
