export function getOwnerEmailConfirmationRedirectUrl(requestOrigin: string) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL("/login?message=email-confirmed", configuredSiteUrl || requestOrigin).toString();
  } catch {
    return new URL("/login?message=email-confirmed", requestOrigin).toString();
  }
}
