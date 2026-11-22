import { notFound } from "next/navigation";
import CommunityPreview from "./preview";
export default function CommunityPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CommunityPreview />;
}
