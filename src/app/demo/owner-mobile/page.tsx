import OwnerLandingEmbed from "@/components/owner/owner-landing-embed";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export const dynamic = "force-dynamic";

/**
 * Public, read-only landing-page embed. The parent page supplies the phone
 * frame; this route deliberately renders only the real mobile owner UI.
 */
export default function OwnerMobileLandingEmbedPage() {
  const data = buildOwnerDemoBootstrap();

  return (
    <OwnerLandingEmbed data={data} />
  );
}
