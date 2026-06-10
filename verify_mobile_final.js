const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app
  await page.goto('file://' + process.cwd() + '/mobile-demo/platforms/browser/www/index.html');

  // Wait for deviceready and IAB to open
  console.log('Waiting for IAB to open...');
  await page.waitForTimeout(5000); // Give it time to open IAB

  // Take a screenshot of the whole page
  await page.screenshot({ path: 'verification/screenshots/lp-final-state.png', fullPage: true });

  // Try to find the LP button
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div, button, span')).map(el => ({
      text: el.innerText,
      style: el.getAttribute('style'),
      tagName: el.tagName
    })).filter(el => el.text && el.text.includes('LP'));
  });
  console.log('Potential LP buttons:', JSON.stringify(buttons, null, 2));

  // If IAB is in an iframe, we might need to look inside
  const frames = page.frames();
  console.log('Number of frames:', frames.length);
  for (const frame of frames) {
    const frameButtons = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('div, button, span')).map(el => ({
            text: el.innerText,
            style: el.getAttribute('style'),
            tagName: el.tagName
        })).filter(el => el.text && el.text.includes('LP'));
    });
    if (frameButtons.length > 0) {
        console.log('Found LP button in frame:', frame.url());
        console.log(JSON.stringify(frameButtons, null, 2));
    }
  }

  await browser.close();
})();
