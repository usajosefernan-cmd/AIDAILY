const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/home/ubuntu/workspace/AIDAILY/scratch/sslip_home.png' });
  await browser.close();
  console.log('Screenshot taken!');
})();
