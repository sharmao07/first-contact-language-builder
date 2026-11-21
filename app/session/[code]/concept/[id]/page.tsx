"use client";

import { use } from "react";
import { ConceptDetail } from "@/components/concept/detail";

export default function ConceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ConceptDetail id={id} />;
}
