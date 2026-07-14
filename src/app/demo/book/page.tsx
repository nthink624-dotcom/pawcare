import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DemoBookingEntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; token?: string; t?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextUrl = new URL(resolvedSearchParams?.mode === "manage" ? "/demo/book/manage" : "/demo/book/start", "http://localhost");
  const token = resolvedSearchParams?.t || resolvedSearchParams?.token;

  if (token) {
    nextUrl.searchParams.set("t", token);
  }

  redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
}
