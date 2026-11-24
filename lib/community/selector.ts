import { z } from "zod";
import { EXPERIMENT_TYPES } from "@/lib/constants";

export const DISCRIMINATION_DISCLAIMER =
  "This check separates readings people have already offered. It is not a measured information gain, and it does not verify a meaning.";

export const outcomeSchema = z.object({
  outcome: z.string().trim().min(1).max(300),
  supports: z.string().trim().max(300),
  weakens: z.string().trim().max(300),
});

export const discriminationSchema = z.object({
  distinguishes: z.string().trim().min(1).max(400),
  missing: z.string().trim().min(1).max(800),
  rationale: z.string().trim().min(1).max(800),
  experimentType: z.enum(EXPERIMENT_TYPES),
  prompt: z.string().trim().min(1).max(800),
  outcomes: z.array(outcomeSchema).min(2).max(4),
  disclaimer: z.string().trim().min(1).max(400),
});

export type Discrimination = z.infer<typeof discriminationSchema>;

function has(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function selectDiscriminatingExperiment(interpretations: string[]): Discrimination {
  const cleaned = interpretations.map((item) => item.trim()).filter(Boolean);
  const joined = cleaned.join(" ").toLowerCase();
  const water = has(joined, ["water", "liquid", "drink", "drinking", "cup", "glass", "container", "bottle"]);
  const place = has(joined, ["place", "direction", "left", "right", "here", "there", "path", "location"]);

  if (water && cleaned.length >= 2) {
    return discriminationSchema.parse({
      distinguishes: cleaned.slice(0, 3).join(" · "),
      missing: "The same scene can show a substance, a container, or the act of drinking. One picture does not separate them.",
      rationale: "An empty container, the same container with liquid, and the drinking motion with no container give different answers if the readings are different.",
      experimentType: "contrast_testing",
      prompt: "Show three separate examples, one at a time: the empty container, the container holding liquid, and the drinking motion with nothing in the hands. Ask which example matches the earlier expression.",
      outcomes: [
        { outcome: "They match only the liquid.", supports: "A substance reading, such as water.", weakens: "A reading that is only the container or only the drinking motion." },
        { outcome: "They match only the empty container.", supports: "A container reading.", weakens: "A reading that requires the liquid or the drinking motion." },
        { outcome: "They match only the drinking motion.", supports: "An action reading, such as drinking.", weakens: "A reading that is only the object or the liquid." },
        { outcome: "They match more than one, or none.", supports: "The expression is still ambiguous.", weakens: "Any single reading treated as settled." },
      ],
      disclaimer: DISCRIMINATION_DISCLAIMER,
    });
  }

  if (place && cleaned.length >= 2) {
    return discriminationSchema.parse({
      distinguishes: cleaned.slice(0, 3).join(" · "),
      missing: "A point can mean a place, a direction of travel, or a request to go there.",
      rationale: "Repeating the point from a different spot, then walking two steps without pointing, shows whether the earlier expression was a place or a movement.",
      experimentType: "context_testing",
      prompt: "First point again from where you are. Then, without pointing, walk two steps. Ask which moment matches the earlier expression.",
      outcomes: [
        { outcome: "Only the point matches.", supports: "A place or a direction.", weakens: "A reading that is only the act of walking." },
        { outcome: "Only the walk matches.", supports: "A movement reading.", weakens: "A reading that is only a fixed place." },
        { outcome: "Both match, or neither does.", supports: "The expression still needs another check.", weakens: "Treating one reading as session-verified." },
      ],
      disclaimer: DISCRIMINATION_DISCLAIMER,
    });
  }

  const pair = cleaned.slice(0, 2);
  const label = pair.length ? pair.join(" · ") : "The two readings are not written down yet.";
  return discriminationSchema.parse({
    distinguishes: label,
    missing: pair.length >= 2
      ? "Each reading may depend on a different part of what was shown. That part has not been shown alone."
      : "There is not yet a second reading to separate from the first.",
    rationale: "Show one feature of the first reading without the feature that belongs only to the second. A match then supports the first reading. A mismatch keeps both open.",
    experimentType: "contrast_testing",
    prompt: pair.length >= 2
      ? `Show something that fits "${pair[0]}" and leave out what would be required for "${pair[1]}". Ask whether this still matches the earlier expression.`
      : "Show the same action once more, then show it with one visible part removed. Ask whether it still matches.",
    outcomes: [
      { outcome: "It still matches.", supports: pair[0] ? `The reading "${pair[0]}".` : "The reading that does not need the removed part.", weakens: pair[1] ? `A reading that needs what was left out, such as "${pair[1]}".` : "A reading that needed the removed part." },
      { outcome: "It no longer matches.", supports: "The removed part mattered.", weakens: "A reading that ignored that part." },
      { outcome: "The other person is unsure.", supports: "Keeping more than one reading open.", weakens: "Recording a session-verified meaning from this check alone." },
    ],
    disclaimer: DISCRIMINATION_DISCLAIMER,
  });
}
