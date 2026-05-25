const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('🚀 高精度ポケカ抽選監視開始...');

  // 複数の抽選まとめサイトを監視（網羅性重視）
  const monitorUrls = [
    'https://pokecawatch.com/category/%E6%8A%BD%E9%81%B8%E3%83%BB%E4%BA%88%E7%B4%84%E6%83%85%E5%A0%B1',
    'https://nyuka-now.com/archives/2459',
    'https://laurier-hub.com/lottery/'
  ];

  let allItems = [];
  const notified = new Set(); // 重複チェック用Set

  for (let url of monitorUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      console.log(`📄 監視中: ${url}`);

      const items = await page.evaluate((url) => {
        const results = [];
        const links = document.querySelectorAll('a');
        links.forEach(a => {
          const text = a.textContent.trim();
          if (text.includes('抽選') || text.includes('予約') || text.includes('BOX')) {
            results.push({
              name: text,
              link: a.href
            });
          }
        });
        return results;
      }, url);

      allItems = allItems.concat(items);
    } catch(e) {
      console.error(`監視エラー (${url}):`, e.message);
    }
  }

  console.log(`📦 合計抽選商品 ${allItems.length}件発見`);

  // 各商品の処理（重複チェック + 強力エラーハンドリング）
  for (let item of allItems) {
    const key = `${item.name}|${item.link}`;
    if (notified.has(key)) continue; // 重複スキップ

    try {
      // 仕入れ値取得（詳細ページ）
      await page.goto(item.link, { waitUntil: 'networkidle2' });
      const buyPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/定価[:：]\s*([\d,]+)円|価格[:：]\s*([\d,]+)円|抽選価格[:：]\s*([\d,]+)円|1BOX[:：]\s*([\d,]+)円|BOX[:：]\s*([\d,]+)円|([\d]{4,6})円/);
        if (match) {
          return parseInt((match[1] || match[2] || match[3] || match[4] || match[5] || match[6]).replace(/,/g, ''));
        }
        return 5500;
      });

      // 売値取得（pokecazilla最安価格）
      await page.goto(`https://pokecazilla.com/search?q=${encodeURIComponent(item.name)}`, { waitUntil: 'networkidle2' });
      const sellPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/最安価格[:：]\s*([\d,]+)円|最安値[:：]\s*([\d,]+)円|最低販売価格[:：]\s*([\d,]+)円|([\d,]+)円.*?(最安|最低)/);
        if (match) {
          return parseInt((match[1] || match[2] || match[3] || match[4]).replace(/,/g, ''));
        }
        return 0;
      });

      const fee = sellPrice * 0.1 + 800;
      const profit = sellPrice > 0 ? Math.floor(sellPrice - buyPrice - fee) : 0;

      console.log(`商品: ${item.name} | 仕入れ: ${buyPrice}円 | 売値: ${sellPrice}円 | 利益: ${profit}円`);

      if (profit >= 5000) {
        console.log(`🎯 通知対象: ${item.name}`);
        
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🎯 **${item.name}**\n💰 **予想純利益: ${profit}円**\n🔗 応募: ${item.link}\n💵 仕入れ目安: ${buyPrice}円\n💵 pokecazilla最安: ${sellPrice}円`
          })
        });

        notified.add(key); // 通知済みとして記録
      }
    } catch(e) {
      console.error(`処理エラー (${item.name}):`, e.message);
      // エラーが出ても次の商品へ進む
    }
  }

  await browser.close();
  console.log('✅ 高精度監視完了');
}

main().catch(console.error);
