const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to tecnologia-ciencia category page...');
  try {
    await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia-ciencia/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    const state = await page.evaluate(() => {
      return {
        activeCategory: window.activeCategory,
        activeSubcategory: window.activeSubcategory,
        allArticlesLength: window.allArticles ? window.allArticles.length : 'undefined',
        sampleArticle: window.allArticles && window.allArticles.length > 0 ? window.allArticles[0] : null
      };
    });
    
    console.log('Browser State:', state);
  } catch (e) {
    console.error('Error:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
