import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, request as pwRequest } from "playwright-core";

const base = process.env.SMOKE_BASE ?? "https://first-contact-language-builder.vercel.app";
const screenshotDir = process.env.WORKFLOW_SCREENSHOT_DIR ?? "";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const results = [];
let failures = 0;

function note(step, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  results.push({ step, ok, detail });
  if (!ok) failures += 1;
}

async function capture(page, name) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function safeGoto(page, url, waitUntil = "domcontentloaded") {
  let lastErr;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(url, { waitUntil, timeout: 25000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(500);
    }
  }
  throw lastErr;
}

async function safeReload(page) {
  const url = page.url();
  for (let i = 0; i < 2; i += 1) {
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 25000 });
      return;
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => undefined);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const rawApi = await pwRequest.newContext({ timeout: 45000 });
  const retry = (method) => async (url, opts) => {
    let last;
    for (let i = 0; i < 3; i += 1) {
      try {
        return await rawApi[method](url, opts);
      } catch (err) {
        last = err;
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw last;
  };
  const api = {
    get: retry("get"),
    post: retry("post"),
    delete: retry("delete"),
    dispose: () => rawApi.dispose(),
  };

  let code = "";
  let tokenA = "";
  let tokenB = "";
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const apiCall = async (pathname, token, body) => {
    const res = await api.post(`${base}${pathname}`, {
      headers: { "x-participant-token": token, "content-type": "application/json" },
      data: body,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status(), ok: res.ok(), data: json };
  };

  try {
    // Capture landing & start pages from live deployment if screenshotDir is set
    await safeGoto(pageA, `${base}/`, "load");
    await pageA.waitForTimeout(400);
    await capture(pageA, "01-landing.png");

    // 1. Create a fresh community session in Browser 1
    await safeGoto(pageA, `${base}/start`, "load");
    await capture(pageA, "02-start-join.png");
    const createForm = pageA.locator("form").filter({
      has: pageA.getByRole("heading", { name: "Start a session" }),
    });
    await createForm.getByLabel("Session name").fill("Phase 2 Full Workflow");
    await createForm.getByLabel("Your name").fill("Ada");
    await createForm.getByRole("checkbox").check();
    const [createRes] = await Promise.all([
      pageA.waitForResponse((r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST", { timeout: 45000 }),
      createForm.getByRole("button", { name: "Create session" }).click(),
    ]);
    const createJson = await createRes.json();
    code = createJson?.code || createJson?.session?.code || "";
    tokenA = createJson?.token || createJson?.participant?.token || "";
    await pageA.waitForURL(new RegExp(`/session/${code}`), { timeout: 45000, waitUntil: "domcontentloaded" });
    note("1. create community session (Browser 1)", createRes.status() === 201 && Boolean(code) && code !== "SHORE-1001", `code=${code}`);

    // 2. Join from a separate browser context
    await safeGoto(pageB, `${base}/start?code=${code}`, "load");
    const joinForm = pageB.locator("form").filter({
      has: pageB.getByRole("heading", { name: "Join with a code" }),
    });
    await joinForm.getByLabel("Session code").fill(code);
    await joinForm.getByLabel("Your name").fill("Bao");
    await joinForm.locator("select").selectOption("B");
    const [joinRes] = await Promise.all([
      pageB.waitForResponse((r) => r.url().endsWith("/api/sessions/join") && r.request().method() === "POST", { timeout: 45000 }),
      joinForm.getByRole("button", { name: "Join" }).click(),
    ]);
    const joinJson = await joinRes.json();
    tokenB = joinJson?.token || joinJson?.participant?.token || "";
    await pageB.waitForURL(new RegExp(`/session/${code}`), { timeout: 45000, waitUntil: "domcontentloaded" });
    await safeGoto(pageB, `${base}/session/${code}/community`);
    await pageB.getByRole("heading", { name: "Community access" }).waitFor({ timeout: 45000 });
    note("2. independent join (Browser 2)", joinRes.status() === 200 && Boolean(tokenB) && tokenB !== tokenA, `seatB_joined=${code}`);

    // 3. Submit independent evidence from both participants
    const evARes = await api.post(`${base}/api/sessions/${code}/evidence`, {
      headers: { "x-participant-token": tokenA },
      multipart: {
        type: "image",
        description: "Participant A photo of cupped hands near a water vessel.",
        actionCategory: "drinking",
        consentToAnalyze: "yes",
        file: { name: "vessel-a.png", mimeType: "image/png", buffer: PNG_BYTES },
      },
    });
    const evAJson = await evARes.json().catch(() => null);
    const evBRes = await api.post(`${base}/api/sessions/${code}/evidence`, {
      headers: { "x-participant-token": tokenB },
      multipart: {
        type: "gesture",
        description: "Participant B scooping hand gesture toward mouth twice.",
        actionCategory: "drinking",
        gestureDirection: "inward",
        gestureRepetition: "twice",
        gestureBody: "right hand",
        consentToAnalyze: "yes",
      },
    });
    const evBJson = await evBRes.json().catch(() => null);
    note(
      "3. independent evidence from both participants",
      evARes.status() === 201 && evBRes.status() === 201 && Boolean(evAJson?.evidenceId) && Boolean(evBJson?.evidenceId),
      `evA=${evARes.status()} evB=${evBRes.status()}`,
    );

    // 4. Create competing hypotheses (and confirm non-verification + community blinding + protected-data boundaries)
    const analyzeDeniedB = await apiCall(`/api/sessions/${code}/analyze`, tokenB, { evidenceId: evAJson.evidenceId });
    const deleteDeniedB = await api.delete(`${base}/api/sessions/${code}/evidence/${evAJson.evidenceId}`, {
      headers: { "x-participant-token": tokenB },
    });
    const mediaUnauth = await api.get(`${base}/api/media/${evAJson.evidenceId}`);
    note(
      "4a. participant blocked from facilitator actions, other's evidence, and unsigned media",
      analyzeDeniedB.status === 403 && deleteDeniedB.status() === 403 && mediaUnauth.status() === 404,
      `analyzeB=${analyzeDeniedB.status} deleteB=${deleteDeniedB.status()} mediaUnauth=${mediaUnauth.status()}`,
    );

    const analyzeRes = await apiCall(`/api/sessions/${code}/analyze`, tokenA, { evidenceId: evAJson.evidenceId });
    const stateAAfterAnalyze = await (await api.get(`${base}/api/sessions/${code}`, { headers: { "x-participant-token": tokenA } })).json();
    const stateBAfterAnalyze = await (await api.get(`${base}/api/sessions/${code}`, { headers: { "x-participant-token": tokenB } })).json();
    const hypsA = stateAAfterAnalyze?.hypotheses ?? [];
    const hypsB = stateBAfterAnalyze?.hypotheses ?? [];
    note(
      "4. competing hypotheses created & not auto-verified",
      analyzeRes.ok && hypsA.length >= 3 && hypsA.every((h) => h.status === "open" && h.simulated === true) && (stateAAfterAnalyze?.concepts?.length ?? 0) === 0 && hypsB.length === 0,
      `hypsA=${hypsA.length} hypsB_blinded=${hypsB.length} concepts=${stateAAfterAnalyze?.concepts?.length ?? -1}`,
    );

    await safeGoto(pageA, `${base}/session/${code}`);
    await pageA.locator("#tab-hypotheses").waitFor({ state: "visible", timeout: 45000 });
    await pageA.locator("#tab-hypotheses").click();
    await pageA.waitForTimeout(600);
    await capture(pageA, "03-discovery-hypotheses.png");

    // 5. Create discriminating experiment via /experiments UI
    await safeGoto(pageA, `${base}/session/${code}/experiments`, "load");
    await pageA.getByRole("heading", { name: "What could still be true" }).waitFor({ timeout: 45000 });
    const [planRes] = await Promise.all([
      pageA.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageA.getByRole("button", { name: "Ask for a check" }).click(),
    ]);
    if (!planRes.ok()) {
      throw new Error(`POST /plans failed: ${planRes.status()} ${await planRes.text()}`);
    }
    await pageA.getByText("Simulated experiment recommendation").first().waitFor({ timeout: 45000 });
    const approveReady = await pageA
      .waitForSelector('button:has-text("Approve and show the neutral prompt"):not([disabled])', { timeout: 8000 })
      .catch(() => null);
    if (!approveReady) {
      await safeReload(pageA);
      await pageA.waitForSelector('button:has-text("Approve and show the neutral prompt"):not([disabled])', { timeout: 45000 });
    }
    const [approveRes] = await Promise.all([
      pageA.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageA.getByRole("button", { name: "Approve and show the neutral prompt" }).click(),
    ]);
    if (!approveRes.ok()) {
      throw new Error(`Approve /plans failed: ${approveRes.status()} ${await approveRes.text()}`);
    }
    await pageA.getByText("Instruction.").waitFor({ timeout: 45000 });
    note("5. discriminating experiment approved in UI", true, code);

    // 6 & 7 & 8. Independent responses, pre-lock invisibility, and post-both-lock reveal
    await safeGoto(pageB, `${base}/session/${code}/experiments`, "load");
    await pageB.getByText("You will see the instruction").waitFor({ timeout: 45000 });
    await pageB.getByLabel("Your response").fill("Bao private draft before locking.");
    await Promise.all([
      pageB.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageB.getByRole("button", { name: "Save my response" }).click(),
    ]);
    await pageB.getByText("Bao private draft before locking.").waitFor({ timeout: 45000 });

    // Check Ada CANNOT see Bao's unlocked draft
    await safeReload(pageA);
    await pageA.getByText("Instruction.").waitFor({ timeout: 45000 });
    const aBeforeLock = await pageA.locator("body").innerText();
    note("6a. draft hidden from other participant before lock", !aBeforeLock.includes("Bao private draft before locking."), "hidden before lock");

    // Bao locks first; check Ada STILL cannot see Bao's locked reply before Ada locks!
    await pageB.waitForSelector('button:has-text("Lock my response"):not([disabled])', { timeout: 45000 });
    await Promise.all([
      pageB.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageB.getByRole("button", { name: "Lock my response" }).click(),
    ]);
    await safeReload(pageA);
    await pageA.getByText("Instruction.").waitFor({ timeout: 45000 });
    const aAfterOneLock = await pageA.locator("body").innerText();
    await capture(pageA, "04-experiments-blinded.png");
    note("6b. response stays hidden after only one lock", !aAfterOneLock.includes("Bao private draft before locking."), "hidden after 1 lock");

    // Now Ada responds, clicks "It matches", waits for save, then locks -> both reveal!
    await pageA.getByLabel("Your response").fill("Ada matching observation.");
    await pageA.waitForSelector('button:has-text("It matches"):not([disabled])', { timeout: 45000 });
    await Promise.all([
      pageA.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageA.getByRole("button", { name: "It matches" }).click(),
    ]);
    await pageA.waitForSelector('button:has-text("Lock my response"):not([disabled])', { timeout: 45000 });
    await Promise.all([
      pageA.waitForResponse((r) => r.url().includes("/plans") && r.request().method() === "POST", { timeout: 45000 }),
      pageA.getByRole("button", { name: "Lock my response" }).click(),
    ]);
    await safeReload(pageA);
    await pageA.getByText("Bao private draft before locking.").waitFor({ timeout: 45000 });
    await capture(pageA, "05-experiments-revealed.png");
    await safeReload(pageB);
    await pageB.getByText("Ada matching observation.").waitFor({ timeout: 30000 }).catch(() => undefined);
    const bAfterBothLock = await pageB.locator("body").innerText().catch(() => "");
    const bRevealState = await (await api.get(`${base}/api/sessions/${code}`, { headers: { "x-participant-token": tokenB } })).json();
    const bRepliesText = JSON.stringify((bRevealState?.proposals ?? []).flatMap((p) => p.replies ?? []));
    const bOutcomeLeaked = JSON.stringify(bRevealState?.proposals ?? []).includes("This reading predicts");
    await ctxB.close();
    note(
      "7 & 8. responses reveal only after both lock",
      (bAfterBothLock.includes("Ada matching observation.") || bRepliesText.includes("Ada matching observation.")) &&
        bRepliesText.includes("Bao private draft before locking.") &&
        !bOutcomeLeaked,
      `revealed=true outcome_mappings_hidden=${!bOutcomeLeaked}`,
    );

    // 9 & 10. Verification threshold matrix across stimuli, methods, participants, disagreement, and match rate
    // Non-facilitator cannot accept a hypothesis
    const partReject = await apiCall(`/api/sessions/${code}/hypotheses/${hypsA[0].id}`, tokenB, {
      action: "accept",
      category: "actions",
      meaning: "drinking",
    });
    note("9a. participant blocked from accepting hypothesis", partReject.status === 403, `status=${partReject.status}`);

    // Accept hyp 0 -> tentative conceptA ("drinking action")
    const acceptA = await apiCall(`/api/sessions/${code}/hypotheses/${hypsA[0].id}`, tokenA, {
      action: "accept",
      category: "actions",
      meaning: "drinking action",
    });
    const conceptAId = acceptA.data?.conceptId;
    const stateTentative = await (await api.get(`${base}/api/sessions/${code}`, { headers: { "x-participant-token": tokenA } })).json();
    const conceptATentative = (stateTentative?.concepts ?? []).find((c) => c.id === conceptAId);
    note("9b. accepting hypothesis stays tentative (not verified)", acceptA.ok && conceptATentative?.status === "tentative", `status=${conceptATentative?.status}`);

    // Single participant threshold test: Seat A answers Check 1 & Check 2 on 2 stimuli + 2 methods -> awaiting
    const chkA1 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptAId,
      type: "visual_discrimination",
      stimulusNote: "clay cup",
    });
    await apiCall(`/api/sessions/${code}/experiments/${chkA1.data.experimentId}/respond`, tokenA, {
      result: "correct",
      selectedOptionId: "target",
      notes: "Seat A visual check",
    });
    const chkA2 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptAId,
      type: "context_testing",
      stimulusNote: "riverbank cup",
    });
    const respA2 = await apiCall(`/api/sessions/${code}/experiments/${chkA2.data.experimentId}/respond`, tokenA, {
      result: "correct",
      selectedOptionId: "target",
      notes: "Seat A context check",
    });
    note("10a. single participant meeting numeric thresholds stays awaiting", respA2.ok && respA2.data?.status === "awaiting", `status=${respA2.data?.status}`);

    // Single stimulus test: new conceptB accepted, both A and B answer Check B1 (only 1 stimulus, 1 method) -> awaiting
    const acceptB = await apiCall(`/api/sessions/${code}/hypotheses/${hypsA[1].id}`, tokenA, {
      action: "accept",
      category: "objects",
      meaning: "clay bowl",
    });
    const conceptBId = acceptB.data?.conceptId;
    const chkB1 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptBId,
      type: "visual_discrimination",
      stimulusNote: "single bowl stimulus",
    });
    await apiCall(`/api/sessions/${code}/experiments/${chkB1.data.experimentId}/respond`, tokenA, { result: "correct", selectedOptionId: "target" });
    const respSingleStim = await apiCall(`/api/sessions/${code}/experiments/${chkB1.data.experimentId}/respond`, tokenB, { result: "correct", selectedOptionId: "target" });
    note("10b. single stimulus cannot session-verify", respSingleStim.ok && respSingleStim.data?.status === "awaiting", `status=${respSingleStim.data?.status}`);

    // Single method test: new conceptC accepted, two stimuli (evening/morning) with ONLY one varied method -> awaiting
    const acceptC = await apiCall(`/api/sessions/${code}/hypotheses/${hypsA[2].id}`, tokenA, {
      action: "accept",
      category: "objects",
      meaning: "pouring vessel",
    });
    const conceptCId = acceptC.data?.conceptId;
    const chkC1 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptCId,
      type: "reverse_demonstration",
      stimulusNote: "morning spring",
    });
    const chkC2 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptCId,
      type: "reverse_demonstration",
      stimulusNote: "evening camp",
    });
    const respC1 = await apiCall(`/api/sessions/${code}/experiments/${chkC1.data?.experimentId}/respond`, tokenA, { result: "correct", selectedOptionId: "target" });
    const respSingleMethod = await apiCall(`/api/sessions/${code}/experiments/${chkC2.data?.experimentId}/respond`, tokenB, { result: "correct", selectedOptionId: "target" });
    note(
      "10c. single method across two stimuli cannot session-verify",
      respSingleMethod.ok && respSingleMethod.data?.status === "awaiting",
      `status=${respSingleMethod.data?.status}${!respSingleMethod.ok ? ` err=${acceptC.status}/${chkC1.status}/${chkC2.status}/${respC1.status}/${respSingleMethod.status}:${JSON.stringify(respSingleMethod.data)}` : ""}`,
    );

    // Two participants + 2 stimuli + 2 methods + >= 75% match rate on conceptA -> verified!
    const respVerified = await apiCall(`/api/sessions/${code}/experiments/${chkA2.data.experimentId}/respond`, tokenB, {
      result: "correct",
      selectedOptionId: "target",
      notes: "Seat B confirms different stimulus and method",
    });
    note("9c. multi-stimulus + multi-method + two participants verifies", respVerified.ok && respVerified.data?.status === "verified", `status=${respVerified.data?.status}`);

    // Check vocabulary & practice pages reflect ONLY verified conceptA (not awaiting B/C)
    await safeGoto(pageA, `${base}/session/${code}/vocabulary`);
    await pageA.getByText("drinking action").first().waitFor({ timeout: 45000 });
    await pageA.waitForTimeout(300);
    await capture(pageA, "06-vocabulary-verified.png");

    // Disagreement test: recording disagree on conceptA moves it to disputed!
    const chkA3 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptAId,
      type: "reverse_demonstration",
      stimulusNote: "empty cup shake",
    });
    const respDisagree = await apiCall(`/api/sessions/${code}/experiments/${chkA3.data.experimentId}/respond`, tokenB, {
      result: "disagree",
      selectedOptionId: "other",
      notes: "Empty cup means something else",
    });
    note("10d. disagreement revokes verified status to disputed", respDisagree.ok && respDisagree.data?.status === "disputed", `status=${respDisagree.data?.status}`);

    // Insufficient match rate (< 75%) test: manual conceptD with 2 correct (2 stimuli, 2 methods, 2 authors) + 1 ambiguous => 2/3 = 66.7% -> awaiting
    const createD = await apiCall(`/api/sessions/${code}/concepts`, tokenA, {
      agreedMeaning: "fresh spring",
      category: "objects",
      contextualNotes: "Synthetic threshold concept D",
    });
    const conceptDId = createD.data?.conceptId;
    const chkD1 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptDId,
      type: "visual_discrimination",
      stimulusNote: "spring stone",
    });
    const chkD2 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptDId,
      type: "context_testing",
      stimulusNote: "dry gourd",
    });
    const chkD3 = await apiCall(`/api/sessions/${code}/experiments`, tokenA, {
      conceptId: conceptDId,
      type: "reverse_demonstration",
      stimulusNote: "shaded pool",
    });
    await apiCall(`/api/sessions/${code}/experiments/${chkD1.data.experimentId}/respond`, tokenA, { result: "correct", selectedOptionId: "target" });
    await apiCall(`/api/sessions/${code}/experiments/${chkD2.data.experimentId}/respond`, tokenB, { result: "correct", selectedOptionId: "target" });
    const respLowRate = await apiCall(`/api/sessions/${code}/experiments/${chkD3.data.experimentId}/respond`, tokenA, { result: "ambiguous", selectedOptionId: "other" });
    note("10e. match rate below 75% (2/3 = 66.7%) stays awaiting", respLowRate.ok && respLowRate.data?.status === "awaiting", `status=${respLowRate.data?.status}`);
  } finally {
    if (code && tokenA) {
      const delRes = await api.delete(`${base}/api/sessions/${code}`, {
        headers: { "x-participant-token": tokenA, "content-type": "application/json" },
        data: { confirmCode: code },
      });
      const goneRes = await api.get(`${base}/api/sessions/${code}`, { headers: { "x-participant-token": tokenA } });
      const shoreCount = Number(
        execFileSync(
          "sqlite3",
          ["data/first-contact.db", "SELECT COUNT(*) FROM Concept WHERE sessionId = (SELECT id FROM DiscoverySession WHERE code = 'SHORE-1001');"],
          { encoding: "utf8" },
        ).trim(),
      );
      note("11. cleanup test session & SHORE-1001 intact", delRes.ok() && goneRes.status() === 404 && shoreCount === 8, `del=${delRes.status()} after=${goneRes.status()} shore=${shoreCount}`);
    }
    await browser.close();
    await api.dispose();
  }

  console.log(`\nWORKFLOW SUMMARY: ${results.length - failures}/${results.length} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Workflow runner error:", err);
  process.exit(1);
});
