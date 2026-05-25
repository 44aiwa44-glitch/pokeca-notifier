const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  // より本物らしいブラウザ設定（ブロック回避強化）
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
  });

  console.log('🚀 高精度ポケカ抽選監視開始...');

  const monitorUrls = [
    'https://pokecawatch.com/category/%E6%8A%BD%E9%81%B8%E3%83%BB%E4%BA%88%E7%B4%84%E6%83%85%E5%A0%B1',
    'https://nyuka-now.com/archives/2459',
    'https://laurier-hub.com/lottery/'
  ];

  let allItems = [];
  const notified = new Set();

  for (let url of monitorUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      const items = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('a').forEach(a => {
          const text = a.textContent.trim();
          if (text.includes('抽選') || text.includes('予約') || text.includes('BOX')) {
            results.push({ name: text, link: a.href });
          }
        });
        return results;
      });
      allItems = allItems.concat(items);
    } catch(e) {
      console.error(`監視エラー (${url}):`, e.message);
    }
  }

  console.log(`📦 合計 ${allItems.length}件発見`);

  for (let item of allItems) {
    const key = `${item.name}|${item.link}`;
    if (notified.has(key)) continue;

    try {
      // 仕入れ値（詳細ページ）
      await page.goto(item.link, { waitUntil: 'networkidle2' });
      const buyPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/定価[:：]\s*([\d,]+)円|価格[:：]\s*([\d,]+)円|抽選価格[:：]\s*([\d,]+)円|1BOX[:：]\s*([\d,]+)円|BOX[:：]\s*([\d,]+)円|([\d]{4,6})円/);
        if (match) return parseInt((match[1] || match[2] || match[3] || match[4] || match[5] || match[6]).replace(/,/g, ''));
        return 5500;
      });

      // 売値（pokecazilla）
      await page.goto(`https://pokecazilla.com/search?q=${encodeURIComponent(item.name)}`, { waitUntil: 'networkidle2' });
      const sellPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        const patterns = [
          /最安価格[:：]\s*([\d,]+)円/,
          /最安値[:：]\s*([\d,]+)円/,
          /最低販売価格[:：]\s*([\d,]+)円/,
          /([\d,]+)円.*?(最安|最低|価格)/,
          /([\d]{4,6})円/
        ];
        for (let p of patterns) {
          const m = text.match(p);
          if (m && m[1]) return parseInt(m[1].replace(/,/g, ''));
        }
        return 0;
      });

      const fee = sellPrice * 0.1 + 800;
      const profit = sellPrice > 0 ? Math.floor(sellPrice - buyPrice - fee) : 0;

      console.log(`商品: ${item.name} | 仕入れ: ${buyPrice}円 | 売値: ${sellPrice}円 | 利益: ${profit}円`);

      if (profit >= 5000) {
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🎯 **${item.name}**\n💰 **予想純利益: ${profit}円**\n🔗 応募: ${item.link}\n💵 仕入れ目安: ${buyPrice}円\n💵 pokecazilla最安: ${sellPrice}円`
          })
        });
        notified.add(key);
      }
    } catch(e) {
      console.error(`処理エラー (${item.name}):`, e.message);
    }
  }

  await browser.close();
  console.log('✅ 高精度監視完了');
}

main().catch(console.error);
