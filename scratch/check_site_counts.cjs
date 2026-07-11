const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://143-47-35-167.sslip.io/pro/aidaily/', { waitUntil: 'networkidle', timeout: 30000 });
  
  await page.waitForTimeout(6000);
  
  const totalText = await page.locator('#pagination-total-info').innerText();
  console.log('Pagination Total Info Text:', totalText);
  
  const allArticlesLength = await page.evaluate(() => {
    return typeof allArticles !== 'undefined' ? allArticles.length : 'undefined';
  });
  console.log('allArticles length in browser:', allArticlesLength);
  
  const filteredLength = await page.evaluate(() => {
    return typeof getFilteredArticles !== 'undefined' ? getFilteredArticles().length : 'undefined';
  });
  console.log('filteredArticles length in browser:', filteredLength);
  
  await browser.close();
})();
