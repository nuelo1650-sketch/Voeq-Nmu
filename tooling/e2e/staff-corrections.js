async (page) => ((async () => {
  const log = [];

  await page.goto("http://127.0.0.1:3000/dev/workbench", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  log.push("workbench: " + (await page.title()));

  await page.getByText("Atlantic Cold Store (E2E)").first().click();
  await page.waitForTimeout(2500);
  log.push("review opened");

  // staff note — save and confirm it appears
  await page.getByPlaceholder(/Spoke to the owner/).fill("E2E note: dossier looks complete; testing the notes panel.");
  await page.getByRole("button", { name: "Add note" }).click();
  await page.waitForTimeout(1500);
  const noteShown = await page.getByText("E2E note: dossier looks complete").first().isVisible().catch(() => false);
  log.push("note saved + visible: " + noteShown);

  // corrections path — photo gate then builder
  await page.getByText("I have opened every photo full-size").click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Request corrections" }).click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Which part (e.g. Shop photo)").fill("Shop photo");
  await page.getByPlaceholder("The exact instruction").fill("Retake the shop photo so the front of the shop and the signboard are both clearly visible.");
  await page.getByRole("button", { name: "Send corrections" }).click();
  await page.waitForTimeout(3000);
  const confirmed = await page.getByText("Corrections requested").first().isVisible().catch(() => false);
  log.push("corrections sent: " + confirmed);

  await page.screenshot({ path: "tooling/e2e/02-corrections.png", fullPage: true });
  return log.join("\n");
})())