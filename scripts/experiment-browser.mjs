import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3010";
const failures = [];

function note(step, ok, detail) {
  const line = `${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (!ok) failures.push(line);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ada = await browser.newContext();
  const bao = await browser.newContext();
  const pageA = await ada.newPage();
  const pageB = await bao.newPage();
  const leaks = [];
  pageB.on("response", async (response) => {
    if (!response.url().includes("/api/sessions/")) return;
    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("json")) return;
    const text = await response.text().catch(() => "");
    if (text.includes("stays possible")) leaks.push(response.url());
  });
  let code = "";
  try {
    await pageA.goto(`${base}/start`);
    const create = pageA.locator("form").filter({ has: pageA.getByRole("heading", { name: "Start a session" }) });
    await create.getByLabel("Session name").fill("Browser checks");
    await create.getByLabel("Your name").fill("Ada");
    await create.getByRole("checkbox").check();
    await create.getByRole("button", { name: "Create session" }).click();
    await pageA.waitForURL(/\/session\/[A-Z]+-\d+\/community/);
    code = new URL(pageA.url()).pathname.split("/")[2];
    const identity = await pageA.evaluate((sessionCode) => localStorage.getItem(`fclb:identity:${sessionCode}`), code);
    const token = JSON.parse(identity).token;
    const evidence = await pageA.request.post(`${base}/api/sessions/${code}/evidence`, { headers: { "x-participant-token": token }, multipart: { type: "image", description: "A person points at a glass and mimes drinking.", actionCategory: "drinking", file: { name: "glass.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") } } });
    const evidenceBody = await evidence.json();
    const analyzed = await pageA.request.post(`${base}/api/sessions/${code}/analyze`, {
      headers: { "x-participant-token": token, "content-type": "application/json" },
      data: { evidenceId: evidenceBody.evidenceId },
    });
    note("browser evidence and hypotheses", evidence.ok() && analyzed.ok(), `evidence=${evidence.status()} analyze=${analyzed.status()}`);

    await pageA.goto(`${base}/session/${code}/experiments`);
    await pageA.getByRole("heading", { name: "What could still be true" }).waitFor();
    await pageA.getByRole("button", { name: "Ask for a check" }).click();
    await pageA.getByText("Simulated experiment recommendation").first().waitFor();
    await pageA.getByRole("button", { name: "Approve and show the neutral prompt" }).click();
    await pageA.getByText("Instruction.").waitFor();
    note("facilitator approves from the page", true, code);

    await pageB.goto(`${base}/start?code=${code}`);
    const join = pageB.locator("form").filter({ has: pageB.getByRole("heading", { name: "Join with a code" }) });
    await join.getByLabel("Session code").fill(code);
    await join.getByLabel("Your name").fill("Bao");
    await join.locator("select").selectOption("B");
    await join.getByRole("button", { name: "Join" }).click();
    await pageB.waitForURL(new RegExp(`/session/${code}`));
    await pageB.goto(`${base}/session/${code}/experiments`);
    await pageB.getByText("You will see the instruction").waitFor();
    const body = await pageB.locator("body").innerText();
    note("second browser does not see the mapping", !body.toLowerCase().includes("stays possible") && leaks.length === 0, leaks.length ? "network leak" : "hidden");
    await pageB.getByLabel("Your response").fill("The empty hands do not match.");
    await pageB.getByRole("button", { name: "Save my response" }).click();
    await pageB.getByText("The empty hands do not match.").waitFor();
    await pageB.getByRole("button", { name: "Lock my response" }).click();
    note("participant submits from a second browser", true, "");

    await pageA.getByLabel("Your response").fill("The liquid matches.");
    await pageA.getByRole("button", { name: "It matches" }).click();
    await pageA.getByRole("button", { name: "Lock my response" }).click();
    await pageA.getByRole("button", { name: /The answers disagree/ }).click();
    await pageA.getByText("This comparison does not session-verify").waitFor();
    await pageA.reload();
    await pageB.reload();
    await pageA.getByText("This comparison does not session-verify").waitFor();
    await pageB.getByText("The empty hands do not match.").waitFor();
    const after = await pageB.locator("body").innerText();
    note("reload keeps the record private", after.includes("The empty hands do not match.") && !after.toLowerCase().includes("stays possible"), "reloaded");

    const removed = await pageA.request.delete(`${base}/api/sessions/${code}`, {
      headers: { "x-participant-token": token, "content-type": "application/json" },
      data: { confirmCode: code },
    });
    const shore = await pageA.request.get(`${base}/api/sessions/SHORE-1001`);
    const shoreCount = Number(execFileSync("sqlite3", ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"], { encoding: "utf8" }).trim());
    note("browser session deleted", removed.ok() && shore.status() === 404 && shoreCount === 8, `shore=${shoreCount}`);
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`${failures.length} browser experiment check(s) failed.`);
    process.exit(1);
  }
  console.log("Two-browser experiment journey passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Browser experiment journey failed.");
  process.exit(1);
});
