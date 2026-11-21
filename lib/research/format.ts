import { METHODOLOGY } from "@/lib/verification/methodology";

export type ReportConcept = {
  code: string;
  meaning: string;
  category: string;
  status: string;
  statusReason: string;
  alternatives: string;
  notes: string;
  examples: string;
  aiConfidence: number | null;
  checks: number;
  correct: number;
  incorrect: number;
  ambiguous: number;
  disagreements: number;
};

export type ReportInput = {
  generatedAt: string;
  sessions: Array<{
    code: string;
    name: string;
    illustrative: boolean;
    description: string;
    participants: string[];
    concepts: ReportConcept[];
    notes: Array<{ title: string; body: string; conceptCode: string | null }>;
    relationships: Array<{ from: string; to: string; type: string; status: string }>;
  }>;
};

export function toMarkdown(report: ReportInput) {
  const lines: string[] = [];
  lines.push("# First-Contact research report");
  lines.push("");
  lines.push(`Generated ${report.generatedAt}.`);
  lines.push("");
  lines.push("This report describes records in the local database. Session-verified means the participants' own checks met the rule in this session. It is not linguistic truth. AI-estimated confidence is not a measured probability.");
  lines.push("");
  lines.push("### Methodology");
  lines.push("");
  lines.push(METHODOLOGY);
  lines.push("");
  if (report.sessions.some((session) => session.illustrative)) {
    lines.push("At least one session is illustrative sample data. It is not real linguistic fieldwork.");
    lines.push("");
  }
  for (const session of report.sessions) {
    lines.push(`## ${session.name}`);
    lines.push("");
    lines.push(`Session code: ${session.code}`);
    lines.push("");
    if (session.illustrative) {
      lines.push("Illustrative sample. Not a record of real research.");
      lines.push("");
    }
    if (session.description) {
      lines.push(session.description);
      lines.push("");
    }
    lines.push(`Participants: ${session.participants.join(", ") || "None recorded"}.`);
    lines.push("");
    lines.push("### Concepts");
    lines.push("");
    if (!session.concepts.length) {
      lines.push("No concepts recorded.");
      lines.push("");
    }
    for (const concept of session.concepts) {
      lines.push(`#### ${concept.code} ${concept.meaning || "Unnamed"}`);
      lines.push("");
      lines.push(`Category: ${concept.category}. Status: ${concept.status}.`);
      lines.push("");
      lines.push(concept.statusReason || "No status reason recorded.");
      lines.push("");
      lines.push(`Checks: ${concept.checks}. Marked correct: ${concept.correct}. Incorrect: ${concept.incorrect}. Ambiguous: ${concept.ambiguous}. Disagreements: ${concept.disagreements}.`);
      lines.push("");
      if (concept.aiConfidence !== null) {
        lines.push(`Highest AI-estimated confidence on record: ${concept.aiConfidence.toFixed(2)}. This is not a scientific probability.`);
        lines.push("");
      }
      if (concept.alternatives) {
        lines.push(`Alternatives: ${concept.alternatives}`);
        lines.push("");
      }
      if (concept.examples) {
        lines.push(`Examples: ${concept.examples}`);
        lines.push("");
      }
      if (concept.notes) {
        lines.push(`Context notes: ${concept.notes}`);
        lines.push("");
      }
    }
    lines.push("### Relationships");
    lines.push("");
    if (!session.relationships.length) lines.push("No relationships recorded.");
    for (const link of session.relationships) {
      lines.push(`- ${link.from} → ${link.to} (${link.type}, ${link.status})`);
    }
    lines.push("");
    const unresolved = session.concepts.filter((concept) => concept.status !== "verified" && concept.status !== "archived");
    const disagreements = session.concepts.filter((concept) => concept.disagreements > 0 || concept.status === "disputed");
    lines.push("### Disagreements");
    lines.push("");
    if (!disagreements.length) lines.push("No recorded disagreements.");
    for (const concept of disagreements) {
      lines.push(`- ${concept.code} ${concept.meaning || "Unnamed"}: ${concept.disagreements} disagreement${concept.disagreements === 1 ? "" : "s"}. ${concept.statusReason}`);
    }
    lines.push("");
    lines.push("### Unresolved interpretations");
    lines.push("");
    if (!unresolved.length) lines.push("Every current concept is session-verified or archived. That still does not make the meanings final.");
    for (const concept of unresolved) {
      lines.push(`- ${concept.code} ${concept.meaning || "Unnamed"} (${concept.status})`);
    }
    lines.push("");
    lines.push("### Notes");
    lines.push("");
    if (!session.notes.length) lines.push("No research notes.");
    for (const note of session.notes) {
      lines.push(`#### ${note.title}`);
      lines.push("");
      if (note.conceptCode) lines.push(`Linked concept: ${note.conceptCode}`);
      lines.push("");
      lines.push(note.body);
      lines.push("");
    }
  }
  lines.push("### Limitations");
  lines.push("");
  lines.push("Deleted media is omitted. File bytes are not embedded in this report. Session-verified entries can still be reopened. This application does not train a model on the recordings.");
  lines.push("");
  return lines.join("\n");
}

export function conceptsToCsv(concepts: Array<ReportConcept & { sessionCode: string }>) {
  const headers = [
    "sessionCode",
    "conceptCode",
    "meaning",
    "category",
    "status",
    "checks",
    "correct",
    "incorrect",
    "ambiguous",
    "disagreements",
    "aiEstimatedConfidence",
  ];
  const rows = concepts.map((concept) =>
    [
      concept.sessionCode,
      concept.code,
      concept.meaning,
      concept.category,
      concept.status,
      concept.checks,
      concept.correct,
      concept.incorrect,
      concept.ambiguous,
      concept.disagreements,
      concept.aiConfidence ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const body = rows.map((row) => row.map((value) => csvCell(value ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}
