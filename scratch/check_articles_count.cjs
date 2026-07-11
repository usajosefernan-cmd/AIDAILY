const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to tecnologia-ciencia category page...');
  try {
    const response = await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia-ciencia/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log(`Page status code: ${response.status()}`);
    console.log('Page Title:', await page.title());
    
    await page.waitForTimeout(3000);
    
    const articlesCount = await page.locator('.mobile-article-item, .editorial-lead-card, .editorial-side-card, .feed-grid-item').count();
    console.log('Number of articles rendered on page:', articlesCount);
    
    const feedHtml = await page.locator('#news-feed').innerHTML();
    console.log('Feed container HTML content preview:', feedHtml.substring(0, 500));
  } catch (e) {
    console.error('Error:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
