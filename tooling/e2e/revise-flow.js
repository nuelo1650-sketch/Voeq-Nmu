async (page) => ((async () => {
  const log = [];
  const TOKEN_URL = "http://127.0.0.1:3000/track/NMU-2026-0001/open?token=Y213bDdqdmdtMDAwM2hyNXdjbzkyOWc2bHxvd2lkYXZpZDIwMDJAZ21haWwuY29tfDE3OTQ5NTM3Njk0MTg.nwqby07GEzFp7sVpfxmrWWmNfTUzc2fzukru9Lr4nYU";

  await page.goto(TOKEN_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  log.push("status page: " + (await page.title()));

  const correctionsShown = await page.getByText("Retake the shop photo").first().isVisible().catch(() => false);
  log.push("correction items shown: " + correctionsShown);

  // click through to the revise form
  await page.getByRole("link", { name: "Fix and resubmit" }).first().click();
  await page.waitForTimeout(3000);
  log.push("revise form url: " + page.url());

  // replace the flagged shop photo (2nd file input)
  const files = page.locator('input[type="file"]');
  const n = await files.count();
  log.push("file inputs: " + n);
  await files.nth(n - 1).setInputFiles("tooling/e2e/shop.jpg");
  await page.waitForTimeout(7000);
  log.push("flagged photo replaced");

  // declaration + resubmit
  const boxes = page.locator('input[type="checkbox"]');
  const bn = await boxes.count();
  for (let i = 0; i < bn; i++) await boxes.nth(i).check();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Resubmit — same reference" }).click();
  await page.waitForTimeout(4000);
  const done = await page.getByText("Resubmitted").first().isVisible().catch(() => false);
  log.push("resubmitted view: " + done);

  await page.screenshot({ path: "tooling/e2e/03-resubmitted.png", fullPage: true });
  return log.join("\n");
})()
)