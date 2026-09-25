import { redirect } from "next/navigation";

export default async function ShortBookingLinkPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;

  redirect(`/entry/${encodeURIComponent(shopId)}` as never);
}
