const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[JS EXCEPTION] ${err.toString()}`);
  });

  console.log('Navigating to tecnologia-ciencia category page...');
  try {
    await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia-ciencia/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(5000);
    
    const articlesLength = await page.evaluate(() => {
      try {
        return allArticles ? allArticles.length : 'null';
      } catch (e) {
        return 'error: ' + e.message;
      }
    });
    console.log('allArticles length from page context:', articlesLength);
  } catch (e) {
    console.error('Error during execution:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
