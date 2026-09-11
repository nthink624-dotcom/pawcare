import { notFound } from "next/navigation";

import CustomerDeleteBottomActionPreviewClient from "./customer-delete-bottom-action-preview-client";

export default function CustomerDeleteBottomActionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <CustomerDeleteBottomActionPreviewClient />;
}
