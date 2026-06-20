const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const report = {};
  const issues = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const htmlPath = '/workspace/知识星图-自主学习路径可视化.html';
    const fileUrl = 'file://' + htmlPath;

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/workspace/star_map_test.png', fullPage: false });
    report['1. 页面加载与截图'] = '通过';

    const elementsToCheck = [
      { key: 'top-bar', selector: '.top-bar' },
      { key: 'sidebar', selector: '.sidebar' },
      { key: 'canvas', selector: 'canvas' },
      { key: 'detail-panel', selector: '.detail-panel' },
      { key: 'bottom-bar', selector: '.bottom-bar' }
    ];
    const elementResults = {};
    for (const el of elementsToCheck) {
      const count = await page.locator(el.selector).count();
      elementResults[el.key] = count > 0;
    }
    report['2. 关键元素存在'] = elementResults;
    const missing = Object.entries(elementResults).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) issues.push('缺失元素: ' + missing.join(', '));

    const sidebarList = await page.locator('.sidebar li, .sidebar .map-item, .sidebar .list-item, .sidebar [class*="map"], .sidebar [class*="list"]');
    const sidebarCount = await sidebarList.count();
    const hasStarMapList = sidebarCount > 0;
    report['3. 我的星图列表'] = hasStarMapList ? `通过（找到 ${sidebarCount} 项）` : '不通过（未找到列表项）';
    if (!hasStarMapList) issues.push('左侧"我的星图"列表为空或未找到');

    const statsLocators = [
      page.locator('.stats-panel, .statistics, .stat-panel, .floating-stats'),
      page.locator(':text("节点"), :text("节点数"), :text("node")')
    ];
    let statsFound = false;
    for (const loc of statsLocators) {
      if (await loc.count() > 0) {
        statsFound = true;
        break;
      }
    }
    report['4. 统计浮窗显示节点数'] = statsFound ? '通过' : '不通过';
    if (!statsFound) issues.push('未找到统计浮窗或节点数显示');

    const title = await page.title();
    report['5. HTML 页面标题'] = title || '(空)';

    await page.waitForTimeout(1000);

    report['6. JavaScript 错误 (console.error)'] = consoleErrors.length > 0 ? `发现 ${consoleErrors.length} 个错误` : '无';
    report['7. 页面异常 (pageerror)'] = pageErrors.length > 0 ? `发现 ${pageErrors.length} 个异常` : '无';
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      issues.push('存在 JS 错误/异常');
    }

    await browser.close();

    const output = {
      测试结果: report,
      发现问题: issues,
      console_errors_sample: consoleErrors.slice(0, 5),
      page_errors_sample: pageErrors.slice(0, 5)
    };

    console.log(JSON.stringify(output, null, 2));

  } catch (e) {
    if (browser) await browser.close();
    console.log(JSON.stringify({ 错误: e.message, 堆栈: e.stack }, null, 2));
    process.exit(1);
  }
})();
