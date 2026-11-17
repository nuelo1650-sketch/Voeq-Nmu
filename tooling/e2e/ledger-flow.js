async (page) => ((async () => {
  const log = [];

  await page.goto("http://127.0.0.1:3000/dev/ledger", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  log.push("ledger: " + (await page.title()));

  await page.locator('input[type="file"]').setInputFiles("tooling/e2e/statement-e2e.csv");
  await page.getByRole("button", { name: "Import statement" }).click();
  await page.waitForTimeout(4000);
  const imported = await page.getByText(/Imported/).first().isVisible().catch(() => false);
  log.push("import confirmed on screen: " + imported);

  await page.waitForTimeout(2000);
  const confirmBtn = page.getByRole("button", { name: "Confirm fee" }).first();
  const visible = await confirmBtn.isVisible().catch(() => false);
  log.push("staged allocation with Confirm fee: " + visible);
  if (visible) {
    await confirmBtn.click();
    await page.waitForTimeout(4000);
    const confirmed = await page.getByText("confirmed — on the record").first().isVisible().catch(() => false);
    log.push("fee confirmed on screen: " + confirmed);
  }

  await page.screenshot({ path: "tooling/e2e/06-ledger.png", fullPage: true });
  return log.join("\n");
})()
)