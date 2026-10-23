const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
// Developer-authored UI only. Never rewrite customer/OCR/signed content at runtime.
const rejected = ['掃碼', '已保存', '重試', '信息', '視頻', '二維碼', '點擊', '查看'];
const directories = ['assets', 'admin', 'booking', 'services', 'shop', 'apps-script'];
const files = ['index.html'];
function walk(dir) {
  for (const item of fs.readdirSync(path.join(root, dir), {withFileTypes:true})) {
    const name = dir + '/' + item.name;
    if (item.isDirectory()) { if (item.name !== 'vendor') walk(name); }
    else if (/\.(?:js|html|gs)$/.test(name)) files.push(name);
  }
}
directories.forEach(walk);
const failures = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const word of rejected) if (content.includes(word)) failures.push(file + ': ' + word);
}
assert.deepEqual(failures, [], 'Use Taiwan UI wording');
assert.match(fs.readFileSync(path.join(root, 'assets/customer-record-import.js'), 'utf8'), /掃描 QR Code 上傳/);
assert.match(fs.readFileSync(path.join(root, 'shop/admin-order-variants.js'), 'utf8'), /原因已儲存/);
console.log('PASS: Taiwan UI copy across public site, admin, shared store/admin assets and Apps Script; no customer data rewriting.');

