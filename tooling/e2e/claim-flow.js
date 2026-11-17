async (page) => ((async () => {
  const log = [];
  const URL = "http://localhost:3000/track/NMU-2026-0001/open?token=Y213bDdqdmdtMDAwM2hyNXdjbzkyOWc2bHxvd2lkYXZpZDIwMDJAZ21haWwuY29tfDE3OTc1NDQ0OTcwNzI.aBGU375OsGJs00Lwf85qTTfHsplCn9DpM6-hhhRVzXY";

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  log.push("status page: " + (await page.title()));

  const approved = await page.getByText(/approved/i).first().isVisible().catch(() => false);
  log.push("approved state shown: " + approved);

  const pay = page.getByRole("button", { name: "I have paid" });
  await pay.waitFor({ state: "visible", timeout: 15000 });
  await page.getByPlaceholder("The bank you paid from").fill("Opay");
  await page.getByPlaceholder("The name on the sending account").fill("Blessing Oyibo");
  await pay.click();
  await page.waitForTimeout(3000);
  const claimed = await page.getByText("Claim recorded").first().isVisible().catch(() => false);
  log.push("claim recorded: " + claimed);

  await page.screenshot({ path: "tooling/e2e/05-claimed.png", fullPage: true });
  return log.join("\n");
})()
)