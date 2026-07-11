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
    
    await page.waitForTimeout(5000);
    
    const data = await page.evaluate(() => {
      try {
        if (!allArticles || allArticles.length === 0) return { error: 'No articles loaded' };
        
        const categories = {};
        allArticles.forEach(a => {
          categories[a.category] = (categories[a.category] || 0) + 1;
        });
        
        return {
          total: allArticles.length,
          categories: categories,
          activeCategory: activeCategory,
          activeSubcategory: activeSubcategory
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Browser evaluation result:', data);
  } catch (e) {
    console.error('Error during execution:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
