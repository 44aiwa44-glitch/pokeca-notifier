const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('🚀 ポケカ抽選監視開始...');

  await page.goto('https://pokecawatch.com/category/%E6%8A%BD%E9%81%B8%E3%83%BB%E4%BA%88%E7%B4%84%E6%83%85%E5%A0%B1', { waitUntil: 'networkidle2' });

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="pokecawatch.com"]'))
      .map(a => ({
        name: a.textContent.trim(),
        link: a.href
      }))
      .filter(item => 
        item.name.includes('抽選') || 
        item.name.includes('予約') || 
        item.name.includes('BOX')
      );
  });

  console.log(`📦 抽選商品を${items.length}件発見`);

  for (let item of items) {
    try {
      await page.goto(`https://pokecazilla.com/search?q=${encodeURIComponent(item.name)}`, { waitUntil: 'networkidle2' });

      const sellPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/最安価格[:：]\s*([\d,]+)円|最安値[:：]\s*([\d,]+)円|([\d,]+)円.*?(最安|最低)/);
        if (match) {
          return parseInt((match[1] || match[2] || match[3]).replace(/,/g, ''));
        }
        return 0;
      });

      const buyPrice = 5500;
      const fee = sellPrice * 0.1 + 800;
      const profit = sellPrice > 0 ? Math.floor(sellPrice - buyPrice - fee) : 0;

      // デバッグログを詳細に出力
      console.log(`商品: ${item.name} | 売値: ${sellPrice}円 | 利益: ${profit}円`);

      // テスト中は5000円未満でも通知（後で元に戻せます）
      if (profit >= 0) {   // ← 一時的に0円以上に緩め
        console.log(`🎯 通知対象: ${item.name} (利益: ${profit}円)`);
        
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🎯 **${item.name}**\n💰 予想純利益: **${profit}円**\n🔗 応募: ${item.link}\n💵 pokecazilla最安: ${sellPrice}円`
          })
        });
      }
    } catch(e) {
      console.log(`エラー: ${item.name}`);
    }
  }

  await browser.close();
  console.log('✅ 監視完了');
}

main().catch(console.error);
