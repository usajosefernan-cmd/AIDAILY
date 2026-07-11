const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('[BROWSER ERROR DETAILS]');
    console.log(err.stack || err.toString());
  });
  await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/', {waitUntil: 'networkidle'});
  await browser.close();
})();
