"use client";

import { use } from "react";
import { ResearchView } from "@/components/research/overview";

export default function SessionResearchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <ResearchView code={code} />;
}
