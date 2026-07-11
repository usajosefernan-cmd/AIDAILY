const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia-ciencia/', {waitUntil: 'networkidle'});
  await page.waitForTimeout(5000);
  console.log('portal-lead-column:', await page.locator('.portal-lead-column').count());
  console.log('portal-secondary-item:', await page.locator('.portal-secondary-item').count());
  console.log('row-card:', await page.locator('.row-card').count());
  await browser.close();
})();
