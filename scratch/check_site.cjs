const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.toString()}`);
  });

  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  console.log('Navigating to website...');
  try {
    const response = await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log(`Page status code: ${response.status()}`);
    console.log('Page Title:', await page.title());
    await page.waitForTimeout(5000);
  } catch (e) {
    console.error('Error during navigation:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
