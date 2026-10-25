import { notFound } from "next/navigation";

import ApplicationFlowDemo from "@/components/admin/application-flow-demo";

export default function ApplicationFlowDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ApplicationFlowDemo />;
}
