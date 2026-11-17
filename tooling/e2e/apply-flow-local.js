async (page) => ((async () => {
  const log = [];

  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  log.push("home loaded: " + (await page.title()));
  await page.waitForTimeout(3500);

  await page.getByLabel("Business name").fill("Atlantic Cold Store (E2E)");
  await page.getByLabel("What it sells").selectOption({ label: "Food & Drink" });
  await page.getByLabel("Describe it in a line or two").fill("Frozen fish, chicken and cold drinks — opposite the main gate junction, open 8am to 6pm. E2E test entry.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your full name").waitFor({ state: "visible", timeout: 15000 });
  log.push("step 2 visible");

  await page.getByLabel("Your full name").fill("David E2E Test");
  await page.getByLabel("Phone number").fill("08099990001");
  await page.getByLabel("Email address").fill("owidavid2002@gmail.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="file"]').first().waitFor({ state: "attached", timeout: 15000 });
  log.push("step 3 visible");

  const files = page.locator('input[type="file"]');
  await files.nth(0).setInputFiles("tooling/e2e/owner.jpg");
  await page.waitForTimeout(7000);
  await files.nth(1).setInputFiles("tooling/e2e/shop.jpg");
  await page.waitForTimeout(7000);
  log.push("photos uploaded");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(2000);

  const boxes = page.locator('input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i++) await boxes.nth(i).check();
  log.push("consents checked: " + count);

  let submitReady = false;
  for (let i = 0; i < 40; i++) {
    const btn = page.getByRole("button", { name: "Submit application" });
    if (await btn.isVisible().catch(() => false)) { submitReady = true; break; }
    try {
      const tframe = page.frameLocator("iframe[src*='challenges.cloudflare.com']").first();
      const cb = tframe.locator("input[type='checkbox'], label").first();
      if (await cb.isVisible().catch(() => false)) { await cb.click({ timeout: 2000 }); }
    } catch (e) {}
    await page.waitForTimeout(1500);
  }
  log.push("turnstile resolved: " + submitReady);
  if (!submitReady) {
    await page.screenshot({ path: "tooling/e2e/err-stuck.png", fullPage: true });
    return log.join("\n") + "\nFAILED: turnstile never resolved";
  }

  await page.getByRole("button", { name: "Submit application" }).click();
  const ref = await page.getByText(/NMU-2026-\d{4}/).first().textContent({ timeout: 30000 });
  log.push("reference: " + ref);

  await page.screenshot({ path: "tooling/e2e/01-success.png", fullPage: true });
  return log.join("\n") + "\nREFERENCE=" + (ref || "").trim();
})())