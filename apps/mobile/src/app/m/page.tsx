import { redirect } from "next/navigation";

import { BOOKING_ACCESS_QUERY_KEY, verifyBookingAccessToken } from "@/server/booking-access-token";

export default async function ShortManageEntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ s?: string; shop?: string; t?: string; token?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialAccessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;
  const queryShopId = resolvedSearchParams?.s || resolvedSearchParams?.shop;

  if (initialAccessToken) {
    const payload = verifyBookingAccessToken(initialAccessToken);
    const nextUrl = new URL(`/book/${payload.shopId}/manage`, "http://localhost");
    nextUrl.searchParams.set(BOOKING_ACCESS_QUERY_KEY, initialAccessToken);
    redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
  }

  if (queryShopId) {
    redirect(`/book/${queryShopId}/manage` as never);
  }

  redirect("/" as never);
}
