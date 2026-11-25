import { getAIMode, aiTimeoutMs } from "@/lib/ai/config";
import { discriminationSchema, selectDiscriminatingExperiment, type Discrimination } from "@/lib/community/selector";
import { HttpError } from "@/lib/http";

export async function proposeDiscrimination(interpretations: string[]): Promise<{
  draft: Discrimination;
  source: "rules" | "ai";
  simulated: boolean;
}> {
  const rules = selectDiscriminatingExperiment(interpretations);
  if (getAIMode() !== "openai") return { draft: rules, source: "rules", simulated: false };
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new HttpError(503, "No API key is configured. No rule-based check was substituted.");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You propose one follow-up check that could separate competing readings. You do not verify a meaning, claim optimal information gain, invent a transcription, or invent IPA. Return JSON with distinguishes, missing, rationale, experimentType, prompt, outcomes (2 to 4 objects with outcome, supports, weakens), and disclaimer. experimentType must be one of visual_discrimination, context_testing, reverse_demonstration, contrast_testing, repeated_verification, action_demonstration, gesture_reproduction, audio_matching, counterexample.",
          },
          { role: "user", content: `Competing readings:\n${interpretations.map((item) => `- ${item}`).join("\n")}` },
        ],
      }),
    });
    if (!response.ok) {
      throw new HttpError(502, "The discrimination request failed. No rule-based check was substituted.");
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content ?? "";
    const draft = discriminationSchema.parse(JSON.parse(text));
    return { draft, source: "ai", simulated: false };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "The discrimination request failed. No rule-based check was substituted.");
  } finally {
    clearTimeout(timer);
  }
}
