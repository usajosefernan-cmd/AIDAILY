const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to subcategory ia page...');
  try {
    const response = await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia/ia/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log(`Page status code: ${response.status()}`);
    console.log('Page Title:', await page.title());
    
    await page.waitForTimeout(5000);
    
    const rowCards = await page.locator('.row-card').count();
    console.log('Number of .row-card items rendered:', rowCards);
    
    const state = await page.evaluate(() => {
      return {
        activeCategory: activeCategory,
        activeSubcategory: activeSubcategory,
        filteredArticlesLength: getFilteredArticles().length
      };
    });
    console.log('Page State:', state);
  } catch (e) {
    console.error('Error during execution:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
