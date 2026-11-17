async (page) => ((async () => {
  const log = [];

  await page.goto("http://127.0.0.1:3000/dev/workbench", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  await page.getByText("Atlantic Cold Store (E2E)").first().click();
  await page.waitForTimeout(2500);
  log.push("review opened");

  // all three checklist items (looking + the two consistency affirmations)
  await page.getByText("I have opened every photo full-size").click();
  await page.getByText("The business name is consistent with the photos").click();
  await page.getByText("The category fits what the business actually is").click();
  await page.waitForTimeout(800);

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Yes — approve" }).click();
  await page.waitForTimeout(4000);
  log.push("approve recorded");

  await page.screenshot({ path: "tooling/e2e/04-approved.png", fullPage: true });
  return log.join("\n");
})()
)