const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/tecnologia-ciencia/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(5000);
    
    const data = await page.evaluate(() => {
      try {
        const norm = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const rawMatches = allArticles.filter(art => art.category === 'tecnologia');
        const normMatches = allArticles.filter(art => norm(art.category) === 'tecnologia');
        const getFiltered = getFilteredArticles();
        
        return {
          total: allArticles.length,
          rawMatchesLength: rawMatches.length,
          normMatchesLength: normMatches.length,
          getFilteredLength: getFiltered.length,
          firstTenFiltered: getFiltered.slice(0, 5).map(a => ({ title: a.title, category: a.category, subcategory: a.subcategory }))
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Filter evaluation result:', data);
  } catch (e) {
    console.error('Error during execution:', e);
  }

  await browser.close();
  console.log('Browser closed.');
})();
