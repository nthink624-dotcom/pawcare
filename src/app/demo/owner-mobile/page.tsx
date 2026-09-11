import OwnerLandingEmbed from "@/components/owner/owner-landing-embed";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export const dynamic = "force-dynamic";

function buildSanitizedOwnerEmbedFixture() {
  const fixture = JSON.stringify(buildOwnerDemoBootstrap())
    .replaceAll("우진만세", "펫매니저 데모샵")
    .replaceAll("정우진", "김보호")
    .replaceAll("박수현", "이담당")
    .replaceAll("김민지", "박보호")
    .replaceAll("박서준", "최보호")
    .replaceAll("이수연", "한보호")
    .replace(/0\d{1,2}-\d{3,4}-\d{4}/g, "010-0000-0000")
    .replaceAll("서울 강남구 테헤란로 123, 2층", "서울시 데모구 반려로 10");

  return JSON.parse(fixture) as ReturnType<typeof buildOwnerDemoBootstrap>;
}

/**
 * Public, read-only landing-page embed. The parent page supplies the phone
 * frame; this route deliberately renders only the real mobile owner UI.
 */
export default function OwnerMobileLandingEmbedPage() {
  const data = buildSanitizedOwnerEmbedFixture();

  return (
    <OwnerLandingEmbed data={data} />
  );
}
