import { chromium } from '@playwright/test';

async function run() {
  console.log('Iniciando Chromium con Playwright...');
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    
    console.log('Navegando a https://pecemi.web.app/pro/aidaily/...');
    await page.goto('https://pecemi.web.app/pro/aidaily/', { waitUntil: 'networkidle' });
    
    // Esperar 4 segundos para que se cargue la base de datos de Firebase y renderice las tarjetas
    await page.waitForTimeout(4000);
    
    const destDesktop = 'C:/Users/yo/.gemini/antigravity-ide/brain/71b0f204-d591-40fb-9015-b669f4c130ef/screenshot_desktop.png';
    await page.screenshot({ path: destDesktop });
    console.log('[OK] Captura desktop guardada:', destDesktop);
    
    // Vista móvil
    console.log('Cambiando a vista móvil...');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('https://pecemi.web.app/pro/aidaily/', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(4000);
    
    const destMobile = 'C:/Users/yo/.gemini/antigravity-ide/brain/71b0f204-d591-40fb-9015-b669f4c130ef/screenshot_mobile.png';
    await mobilePage.screenshot({ path: destMobile });
    console.log('[OK] Captura móvil guardada:', destMobile);
    
  } catch (err) {
    console.error('Error al capturar:', err);
  } finally {
    await browser.close();
  }
}

run();
