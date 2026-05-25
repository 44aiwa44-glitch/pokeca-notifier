const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log('ポケカ抽選監視開始...');

  // 1. pokecawatch.comから抽選情報を取得
  await page.goto('https://pokecawatch.com/category/%E6%8A%BD%E9%81%B8%E3%83%BB%E4%BA%88%E7%B4%84%E6%83%85%E5%A0%B1', { waitUntil: 'networkidle2' });

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      name: a.textContent.trim(),
      link: a.href
    })).filter(item => 
      item.name.includes('抽選') || 
      item.name.includes('予約') || 
      item.name.includes('BOX')
    );
  });

  console.log(`抽選商品を${items.length}件発見`);

  // Discord通知（簡易版）
  for (let item of items) {
    console.log('発見: ' + item.name);
    // ここに利益計算と通知を後で追加
  }

  await browser.close();
}

main().catch(console.error);
