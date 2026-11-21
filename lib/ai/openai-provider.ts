import { aiTimeoutMs } from "@/lib/ai/config";
import { analysisSchema } from "@/lib/ai/schema";
import type { AnalysisResult, AnalyzeInput, AIProvider } from "@/lib/ai/types";
import { HttpError } from "@/lib/http";

const SYSTEM = `You facilitate collaborative meaning discovery between two people who may not share a language.
You do not declare a meaning correct, verified, or translated.
You never claim that unfamiliar speech has been translated.
Return only JSON with this shape:
{
  "observations": string[],
  "ambiguities": string[],
  "inferences": string[],
  "cannotDetermine": string[],
  "followUps": string[],
  "hypotheses": [
    {
      "proposedMeaning": string,
      "explanation": string,
      "supportingEvidence": string,
      "alternatives": string,
      "missingInformation": string,
      "culturalAmbiguity": string,
      "confidence": number,
      "suggestedExperiment": string
    }
  ]
}
observations are things directly available in the input. inferences are possible meanings, kept separate.
cannotDetermine lists what this input does not settle.
confidence is your rough estimate from 0 to 1, not a measured probability. Never use a value outside 0 to 1.
Provide 3 to 5 competing hypotheses. Do not pick a winner.
Do not invent IPA, phonemes, or a translation of unfamiliar speech.
If audio or video bytes were not actually analyzed, say so in cannotDetermine.
Separate a visible object from an inferred request, name, or action.`;

export const openAIProvider: AIProvider = {
  id: "openai",
  async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new HttpError(503, "No API key is configured. Demo mode should be used instead.");
    }
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const plan = mediaPlan(input);
    const model = plan.sendAudio && process.env.OPENAI_AUDIO_MODEL?.trim()
      ? process.env.OPENAI_AUDIO_MODEL.trim()
      : process.env.OPENAI_MODEL || "gpt-4o-mini";
    const timeout = aiTimeoutMs();
    const userText = [
      `Evidence type: ${input.evidenceType}`,
      `Action label: ${input.actionCategory ?? "none"}`,
      `Gesture direction: ${input.gestureDirection || "none"}`,
      `Gesture repetition: ${input.gestureRepetition || "none"}`,
      `Gesture body: ${input.gestureBody || "none"}`,
      `Description: ${input.description || "none"}`,
      `Notes: ${input.notes || "none"}`,
      `File name: ${input.fileName || "none"}`,
      `MIME type: ${input.mimeType || "none"}`,
      `Duration ms: ${input.durationMs ?? "unknown"}`,
      `Quality note: ${input.qualityNote || "none"}`,
      `Selected frame of another item: ${input.parentEvidenceId ? "yes" : "no"}`,
      plan.note,
      `Known session entries (do not treat these as confirmed translations): ${
        input.knownConcepts.map((concept) => `${concept.meaning} [${concept.status}]`).join("; ") || "none"
      }`,
    ].join("\n");

    const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
    let providerNote = plan.note;
    if (plan.sendImage) {
      const mime = input.mimeType || "image/png";
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${input.mediaBytes!.toString("base64")}` },
      });
      providerNote = input.parentEvidenceId
        ? "The model received one selected video frame and the written context. The rest of the video was not analyzed. This is still a hypothesis."
        : "The model received the written context and the image. Direct observations are not the same as a verified meaning.";
    } else if (plan.sendAudio) {
      content.push({
        type: "input_audio",
        input_audio: { data: input.mediaBytes!.toString("base64"), format: audioFormat(input.mimeType) },
      });
      providerNote = "The model received the audio for acoustic description only. Unfamiliar speech was not translated, and no phonetic transcription was requested.";
    }

    const payloadBase = {
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    };

    let raw = await complete(base, key, timeout, { ...payloadBase, response_format: { type: "json_object" } }, true);
    if (raw.usedFallback) {
      raw = await complete(base, key, timeout, payloadBase, false);
    }

    let parsed: unknown;
    try {
      parsed = extractJson(raw.text);
    } catch {
      throw new HttpError(502, "The model response was not valid JSON. No vocabulary was changed.");
    }
    const checked = analysisSchema.safeParse(parsed);
    if (!checked.success) {
      throw new HttpError(502, "The model response did not match the expected hypothesis format. No vocabulary was changed.");
    }
    return {
      simulated: false,
      providerNote,
      observations: checked.data.observations,
      inferences: checked.data.inferences,
      cannotDetermine: checked.data.cannotDetermine,
      ambiguities: checked.data.ambiguities,
      followUps: checked.data.followUps,
      hypotheses: checked.data.hypotheses,
    };
  },
};

export function mediaPlan(input: AnalyzeInput): { sendImage: boolean; sendAudio: boolean; note: string } {
  if (!input.consentToAnalyze) {
    return {
      sendImage: false,
      sendAudio: false,
      note: "The file was not sent to the provider. Consent for external analysis was not recorded. Use only the written description. Do not invent a transcription.",
    };
  }
  if (!input.mediaBytes) {
    return { sendImage: false, sendAudio: false, note: "Consent was recorded, but no file bytes were attached." };
  }
  if (input.evidenceType === "audio") {
    const mime = input.mimeType || "";
    const supported = mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/mpeg";
    if (!process.env.OPENAI_AUDIO_MODEL?.trim()) {
      return {
        sendImage: false,
        sendAudio: false,
        note: "Audio is stored and consent was recorded, but OPENAI_AUDIO_MODEL is not set. The recording was not sent. No phonetic transcription was produced.",
      };
    }
    if (!supported) {
      return {
        sendImage: false,
        sendAudio: false,
        note: "This recording is stored, but the configured audio path only accepts wav or mp3. It was not sent, and no transcription was invented. Upload a wav or describe what you heard.",
      };
    }
    return {
      sendImage: false,
      sendAudio: true,
      note: "Audio will be sent for acoustic description only. Do not translate unfamiliar speech or invent phonemes.",
    };
  }
  if (input.evidenceType === "video" || input.evidenceType === "gesture") {
    return {
      sendImage: false,
      sendAudio: false,
      note: "The video file was not sent. Select individual frames and submit those as images if a vision model should see them. Do not claim the video was understood.",
    };
  }
  if (canSendImage(input)) {
    return { sendImage: true, sendAudio: false, note: "The image is included for visual description. Keep observations separate from inferred meaning." };
  }
  return {
    sendImage: false,
    sendAudio: false,
    note: "The file was not sent because of its type or size. Use the written description. SVG is never sent.",
  };
}

function canSendImage(input: AnalyzeInput) {
  if (!input.mediaBytes || !input.consentToAnalyze) return false;
  if (input.evidenceType !== "image" && input.evidenceType !== "drawing") return false;
  const mime = input.mimeType || "";
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime)) return false;
  return input.mediaBytes.length <= 4_000_000;
}

function audioFormat(mime: string | null | undefined) {
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/mpeg") return "mp3";
  return "wav";
}

async function complete(
  base: string,
  key: string,
  timeout: number,
  body: Record<string, unknown>,
  allowFormatFallback: boolean,
) {
  const run = async () => {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await response.text();
    if (!response.ok) {
      const formatRejected = response.status === 400 && text.toLowerCase().includes("response_format");
      if (allowFormatFallback && formatRejected) {
        return { text: "", usedFallback: true };
      }
      if (response.status === 429) {
        throw new HttpError(429, "The AI provider is rate limiting requests. Nothing was verified. Wait and try again, or keep working in demo mode.");
      }
      throw new HttpError(502, "The AI provider returned an error. No interpretation was saved as verified.");
    }
    let data: { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new HttpError(502, "The AI provider returned an unreadable response.");
    }
    const content = data.choices?.[0]?.message?.content;
    const message = typeof content === "string" ? content : content?.map((part) => part.text || "").join("\n") || "";
    if (!message) throw new HttpError(502, "The AI provider returned an empty response.");
    return { text: message, usedFallback: false };
  };

  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError && error.status === 502 && !allowFormatFallback) throw error;
    try {
      return await run();
    } catch (second) {
      if (second instanceof HttpError) throw second;
      const aborted = second instanceof Error && second.name === "TimeoutError";
      throw new HttpError(504, aborted ? "The AI provider timed out. Nothing was verified." : "The AI provider could not be reached. Nothing was verified.");
    }
  }
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object.");
  return JSON.parse(text.slice(start, end + 1));
}
