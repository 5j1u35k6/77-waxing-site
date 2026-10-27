const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = file => read(file).replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace(/\bexport /g, '');
const c = vm.createContext({ Intl, Date, Map });
vm.runInContext(source('assets/admin-service-distribution.js'), c);
const catalog = [
  { key: 'women', name: '女仕熱蠟' }, { key: 'men', name: '男仕熱蠟' },
  { key: 'skin', name: '臉部保養' }, { key: 'relax', name: '臉部放鬆' },
  { key: 'retired', name: '已停用分類', enabled: false },
];
const booking = (serviceName, status = 'completed', preferredDate = '2026-10-30') => ({ serviceName, status, preferredDate });
const run = (rows, categories = catalog) => c.completedServiceDistribution(rows, categories, '2026-10');
const count = (result, name) => result.services.find(row => row.name === name)?.count;

// The actual production spelling that previously disappeared must count exactly once.
let result = run([booking('男仕熱蠟｜腹部'), booking('男仕熱蠟｜腹部', 'pending_confirmation')]);
assert.equal(result.total, 1); assert.equal(count(result, '男仕熱蠟'), 1);
for (const status of ['pending_confirmation', 'pending_payment', 'confirmed', 'cancelled', 'no_show', undefined]) {
  assert.equal(run([{ ...booking('男仕熱蠟｜腹部'), status }]).total, 0);
}
assert.equal(run([booking('男士熱蠟｜腹部'), booking('男仕熱蠟 | 全腿')]).services.filter(row => row.count).length, 1);
assert.equal(count(run([booking('男士熱蠟｜腹部'), booking('男仕熱蠟 | 全腿')]), '男仕熱蠟'), 2);
assert.equal(count(run([booking('女性熱蠟｜全腿'), booking('女士熱蠟｜半腿')]), '女仕熱蠟'), 2);
assert.equal(count(run([booking('肌膚管理｜清潔')]), '臉部保養'), 1);
assert.equal(count(run([booking('臉部放鬆｜鬆筋')]), '臉部放鬆'), 1);
assert.equal(count(run([booking('已停用分類｜舊項目')]), '已停用分類'), 1);
assert.equal(count(run([booking('已移除的歷史服務｜舊項目')]), '已移除的歷史服務'), 1);
assert.equal(count(run([booking('男仕熱蠟｜腹部')], [{ key: 'men', name: '男士專屬服務' }]), '男士專屬服務'), 1);
assert.equal(count(run([booking('男仕熱蠟｜腹部')], []), '男仕熱蠟'), 1, 'catalog failure must not discard completed bookings');
assert.equal(count(run([booking('')]), '未分類服務'), 1);
assert.equal(count(run([{ ...booking('舊名稱｜項目'), serviceCategoryKey: 'relax' }]), '臉部放鬆'), 1);
assert.equal(run([booking('男仕熱蠟｜腹部', 'completed', '2026-09-30'), booking('男仕熱蠟｜腹部', 'completed', '2026-11-01')]).total, 0);
assert.equal(run([booking('男仕熱蠟｜腹部', 'completed', '2026-10-extra')]).total, 0);
assert.equal(c.taipeiMonth(new Date('2026-10-31T16:30:00Z')), '2026-11');
assert.equal(c.taipeiMonth(new Date('2026-10-31T15:59:59Z')), '2026-10');

// Exercise the real renderer: status changes and catalog renames must redraw it,
// and dynamic category labels must stay escaped HTML.
const panel = { innerHTML: '', hidden: false, querySelector: () => null };
const host = { querySelector: selector => selector === '[data-dashboard-v3]' ? panel : null, querySelectorAll: () => [] };
const document = { querySelector: () => host, querySelectorAll: () => [], addEventListener() {} };
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-27T04:00:00Z'])); } }
const ui = vm.createContext({ Intl, Date: FixedDate, Map, document, location: { hash: '#dashboard' }, getApps: () => [], setTimeout() {}, addEventListener() {} });
vm.runInContext(source('assets/admin-service-distribution.js') + '\n' + source('assets/admin-dashboard.js'), ui);
vm.runInContext('catalog=' + JSON.stringify(catalog) + ';rows=' + JSON.stringify([booking('男仕熱蠟｜腹部', 'confirmed')]) + ';render();', ui);
assert.match(panel.innerHTML, /0 筆已完成/);
vm.runInContext('rows[0].status="completed";render();', ui);
assert.match(panel.innerHTML, /1 筆已完成/);
assert.match(panel.innerHTML, /男仕熱蠟<\/b><small>1 筆/);
vm.runInContext('catalog[1].name="男士專屬服務";render();', ui);
assert.match(panel.innerHTML, /男士專屬服務<\/b><small>1 筆/);
vm.runInContext('catalog.push({key:"new",name:"<img src=x onerror=alert(1)>"});render();', ui);
assert.match(panel.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(panel.innerHTML, /<img src=x/);
console.log('PASS: completed monthly service distribution, current catalog / legacy aliases, status updates, deleted categories, Taipei month boundary and escaped rendering');
