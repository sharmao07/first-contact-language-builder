export type AIMode = "demo" | "openai";

export function getAIMode(): AIMode {
  const preference = process.env.AI_PROVIDER?.trim().toLowerCase();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (preference === "openai" && key) return "openai";
  return "demo";
}

export function getAIPublicStatus() {
  const mode = getAIMode();
  if (mode === "openai") {
    return {
      mode,
      disclosure:
        "An OpenAI-compatible provider is configured on the server. The key stays on the server. Files are sent only after a participant records consent. Audio is not translated. Video is not analyzed unless a selected frame is submitted as an image.",
    };
  }
  const missingKey = process.env.AI_PROVIDER?.trim().toLowerCase() === "openai";
  return {
    mode,
    disclosure: missingKey
      ? "AI_PROVIDER is set to openai, but no API key is configured. Demo mode is active. Hypotheses are simulated from written context and are not a model's reading of the files."
      : "Demo mode is active. Hypotheses are simulated from the written description, evidence type, and action label. No model inspects the image, drawing, or audio.",
  };
}

export function aiTimeoutMs() {
  const value = Number(process.env.AI_TIMEOUT_MS ?? 25000);
  return Number.isFinite(value) && value >= 3000 ? value : 25000;
}
