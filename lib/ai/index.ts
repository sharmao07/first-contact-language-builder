import { getAIMode } from "@/lib/ai/config";
import { demoProvider } from "@/lib/ai/demo-provider";
import { openAIProvider } from "@/lib/ai/openai-provider";
import type { AIProvider } from "@/lib/ai/types";

export function getProvider(): AIProvider {
  return getAIMode() === "openai" ? openAIProvider : demoProvider;
}
