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
  let code = "";
  try {
    await pageA.goto(`${base}/start`);
    const create = pageA.locator("form").filter({ has: pageA.getByRole("heading", { name: "Start a session" }) });
    await create.getByLabel("Session name").fill("Browser community");
    await create.getByLabel("Your name").fill("Ada");
    await create.getByRole("checkbox").check();
    await create.getByRole("button", { name: "Create session" }).click();
    await pageA.waitForURL(/\/session\/[A-Z]+-\d+\/community/);
    code = new URL(pageA.url()).pathname.split("/")[2];
    note("browser create", /\/community$/.test(pageA.url()) && Boolean(code), code);

    await pageB.goto(`${base}/start?code=${code}`);
    const join = pageB.locator("form").filter({ has: pageB.getByRole("heading", { name: "Join with a code" }) });
    await join.getByLabel("Session code").fill(code);
    await join.getByLabel("Your name").fill("Bao");
    await join.locator("select").selectOption("B");
    await join.getByRole("button", { name: "Join" }).click();
    await pageB.waitForURL(new RegExp(`/session/${code}`));
    await pageB.goto(`${base}/session/${code}/community`);
    await pageB.getByRole("heading", { name: "Community access" }).waitFor();
    note("browser join in a second context", await pageB.getByText(code).count() > 0, code);

    await pageA.getByRole("button", { name: /Asking for an everyday item/ }).click();
    await pageA.getByRole("button", { name: "I showed it" }).click();
    await pageA.getByLabel("Short reading, if a drawing is not enough").fill("water");
    await pageA.getByRole("button", { name: "Save my response" }).click();
    await pageA.getByText("Your saved response is still private").waitFor();
    await pageB.reload();
    const before = await pageB.locator("body").innerText();
    note("second browser does not see the private reading", !before.includes("water"), before.includes("water") ? "water was visible" : "hidden");

    await pageA.getByRole("button", { name: "Lock my response" }).click();
    await pageB.getByLabel("Short reading, if a drawing is not enough").fill("cup");
    await pageB.getByRole("button", { name: "Save my response" }).click();
    await pageB.getByRole("button", { name: "Lock my response" }).click();
    await pageA.reload();
    await pageA.getByText("What each person locked").waitFor();
    const after = await pageA.locator("body").innerText();
    note("both locked readings become visible", after.includes("water") && after.includes("cup"), "comparison");

    await pageA.getByRole("button", { name: "The object and the action are both possible" }).click();
    await pageA.getByRole("button", { name: "Suggest a check" }).click();
    await pageA.getByText("This check separates readings").waitFor();
    await pageA.getByRole("button", { name: "Approve this check" }).click();
    await pageA.getByText("Nothing was marked session-verified").waitFor();
    await pageA.getByRole("button", { name: "Another round" }).click();
    await pageA.getByText("Recorded outcome: another-round").waitFor();
    note("guided check completed in the browser", true, "");

    await pageA.screenshot({ path: "/tmp/fclb-community-ada.png", fullPage: true });
    await pageB.reload();
    await pageB.getByText("What each person locked").waitFor();
    const baoAfter = await pageB.locator("body").innerText();
    note("participant sees both locked readings", baoAfter.includes("water") && baoAfter.includes("cup"), baoAfter.includes("cup") ? "both" : "cup missing");
    await pageB.screenshot({ path: "/tmp/fclb-community-bao.png", fullPage: true });

    const identity = await pageA.evaluate((sessionCode) => localStorage.getItem(`fclb:identity:${sessionCode}`), code);
    const token = JSON.parse(identity).token;
    const removed = await pageA.request.delete(`${base}/api/sessions/${code}`, {
      headers: { "x-participant-token": token, "content-type": "application/json" },
      data: { confirmCode: code },
    });
    const shore = await pageA.request.get(`${base}/api/sessions/SHORE-1001`);
    const shoreBody = await shore.json();
    note("browser session deleted", removed.ok() && shoreBody.concepts?.length === 8, `shore=${shoreBody.concepts?.length}`);
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} browser failure(s).`);
    process.exit(1);
  }
  console.log("\nTwo-browser community journey passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
