const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const part = (file, start, end) => {
  const source = read(file), a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `${file}: function boundaries`);
  return source.slice(a, b);
};
const snap = (data, id = '') => ({ id, exists: () => data != null, data: () => data });

async function unitTests() {
  const guard = vm.createContext({ console: { warn() {} }, localStorage: { setItem() { throw Error('full'); } } });
  vm.runInContext(read('shop/checkout-guard.js').replace(/\bexport /g, ''), guard);
  const form = {};
  assert.equal(guard.beginCheckout(form), true);
  assert.equal(guard.beginCheckout(form), false, 'all checkout layers share the same pending form');
  guard.finishCheckout(form);
  assert.equal(guard.beginCheckout(form), true, 'a failed checkout can be retried');
  guard.finishCheckout(form);
  assert.doesNotThrow(() => guard.savePreference('order-hint', '1'), 'storage failure must not report a successful order as failed');
  const data = { customerName: '測試', phone: '0900000000', email: 'test@example.invalid', storeInfo: '', note: null, items: [{}], shippingFee: 60, subtotal: 100, total: 160 };
  assert.doesNotThrow(() => guard.validateOrderData(data));
  assert.throws(() => guard.validateOrderData({ ...data, items: Array(31).fill({}) }), /30/);
  assert.throws(() => guard.validateOrderData({ ...data, total: Infinity }), /金額/);
  assert.notEqual(guard.cartFingerprint([{ productId: 'p', variantId: 'v', qty: 3, price: 100 }]), guard.cartFingerprint([{ productId: 'p', variantId: 'v', qty: 1, price: 100 }]), 'stock changes require review');

  let authCallback, permissionResolve, mounted = 0;
  const privateRoot = { innerHTML:'private order data' }, user = {uid:'A'};
  const identity = vm.createContext({ auth:{currentUser:user}, authVersion:0, currentUser:user,products:[],orders:[],messages:[],filteredOrderCache:[],
    $:()=>privateRoot,cleanupListeners(){},onAuthStateChanged:(_auth,callback)=>{authCallback=callback},
    isAdmin:()=>new Promise(resolve=>permissionResolve=resolve),mountAdmin:()=>mounted++,renderLogin:()=>{privateRoot.innerHTML='login'},signOut:async()=>{} });
  vm.runInContext(part('shop/admin.js','onAuthStateChanged(auth, async (user)','document.addEventListener("input"'),identity);
  const oldPermission=authCallback(user);
  assert.doesNotMatch(privateRoot.innerHTML,/private order data/,'switching account hides private UI before checking permissions');
  identity.auth.currentUser=null;await authCallback(null);permissionResolve(true);await oldPermission;assert.equal(mounted,0);
  const pendingImages=new Map(),normalized=[];
  const input={addEventListener(){}},field={classList:{add(){}},querySelector:selector=>selector==='#p-image-file'?input:{style:{}},innerHTML:''};
  const original={dataset:{},value:'',isConnected:true,closest:()=>field},formNode={dataset:{variantEnhanced:'1'},isConnected:true};
  const media=vm.createContext({activeEditId:'A',activeField:null,activeFormToken:'',mediaState:[],MAX_IMAGES:12,
    document:{querySelector:selector=>selector==='#p-image'?original:formNode},
    loadProduct:(_db,id)=>new Promise(resolve=>pendingImages.set(id,resolve)),
    normalizeMedia:product=>{normalized.push(product.name);return[{url:product.name}]},esc:value=>value,renderGalleryCards(){} });
  vm.runInContext(part('shop/admin-media.js','async function enhanceImageField(','\ntry {'),media);
  const imageA=media.enhanceImageField({});media.activeEditId='B';const imageB=media.enhanceImageField({});
  assert.ok(pendingImages.has('B'),'switching product starts the new image read');
  pendingImages.get('B')({name:'B-image'});await imageB;pendingImages.get('A')({name:'A-image'});await imageA;
  assert.deepEqual(normalized,['B-image'],'late product A image cannot replace product B');

  const products = {
    p: { active: true, name: '商品', stock: 10, variants: [{ id: 'v', name: '一般', stock: 10, priceTWD: 100 }] },
    gift: { active: true, name: '贈品', stock: 10, variants: [{ id: 'g', name: '一般', stock: 10, priceTWD: 40 }] },
    legacy: { active: true, name: '舊商品', stock: 10, price: 75 },
  };
  let order, settings = {}, updates = [];
  const inventory = vm.createContext({ console, Map, Set, JSON, Promise,
    int: n => Math.max(0, Math.round(Number(n) || 0)),
    doc: (_db, col, id) => ({ col, id }), serverTimestamp: () => 1,
    runTransaction: async (_db, callback) => callback({
      get: async ref => snap(ref.col === 'shopOrders' ? order : ref.col === 'shopSettings' ? settings : products[ref.id], ref.id),
      update: (ref, data) => updates.push({ ref, data }),
    }),
  });
  vm.runInContext(part('shop/admin-order-variants.js', 'function normalizeVariants(', 'async function audit(') + part('shop/admin-order-variants.js', 'async function confirmVariantOrder(', 'function polishOrderUi('), inventory);
  order = { status: 'pending', items: [{ productId: 'legacy', variantId: 'default', quantity: 2, unitPrice: 75, region: 'TW' }], shippingFee: 0 };
  await inventory.confirmVariantOrder({}, 'old');
  assert.equal(updates.at(-1).data.total, 150, 'legacy default variant remains confirmable');
  const group = { minQty: 1, items: [{ productId: 'p', variantId: 'v' }] };
  settings = { promotions: [{ id: 'gift-promo', active: true, promotionType: 'gift', groups: [group, group], gift: { productId: 'gift', variantId: 'g', quantity: 1 } }] };
  const giftSummary = { subtotalBeforePromotions: 200, discountTotal: 0, adjustments: [], gifts: [{ promotionId: 'gift-promo', productId: 'gift', variantId: 'g', quantity: 1 }] };
  order = { status: 'pending', shippingFee: 60, subtotal: 200, total: 260, items: [
    { productId: 'p', variantId: 'v', region: 'TW', quantity: 2, unitPrice: 100, promotionSummary: giftSummary },
    { productId: 'gift', variantId: 'g', region: 'TW', quantity: 1, unitPrice: 0, isGift: true, promotionId: 'gift-promo' },
  ] };
  updates = [];
  await inventory.confirmVariantOrder({}, 'gift-order');
  let confirmed = updates.at(-1).data;
  assert.equal(confirmed.total, 260, 'a gift cannot become a paid item when confirmed');
  assert.equal(confirmed.items[1].unitPrice, 0);
  assert.equal(confirmed.items[1].isGift, true);
  assert.deepEqual(confirmed.items[0].promotionSummary, giftSummary);
  assert.equal(updates.find(row => row.ref.id === 'gift').data.stock, 9, 'zero-price gifts still consume stock');
  settings.promotions = [{ id: 'bundle', active: true, promotionType: 'bundle_price', groups: [group, group], discount: { bundlePriceTWD: 150 } }];
  order = { status: 'pending', shippingFee: 60, subtotal: 150, total: 210, items: [
    { productId: 'p', variantId: 'v', region: 'TW', quantity: 2, unitPrice: 100,
      promotionSummary: { subtotalBeforePromotions: 200, discountTotal: 50, adjustments: [{ id: 'bundle', type: 'bundle_price', setCount: 1, amount: 50, regularTotal: 200 }], gifts: [] } },
  ] };
  updates = [];
  await inventory.confirmVariantOrder({}, 'bundle-order');
  assert.equal(updates.at(-1).data.total, 210, 'confirmed bundle price includes the promotion');
  order.items[0].promotionSummary.discountTotal = 199;
  updates = [];
  await assert.rejects(inventory.confirmVariantOrder({}, 'tampered'), /促銷內容已變更/);
  assert.equal(updates.length, 0, 'invalid promotion cannot update stock');
  order.items[0].promotionSummary.discountTotal = 50;
  settings.promotions[0].active = false;
  await assert.rejects(inventory.confirmVariantOrder({}, 'expired'), /促銷內容已變更/);

  const transitions = vm.createContext({ doc: (_d, col, id) => ({ col, id }), db: {}, serverTimestamp: () => 1,
    runTransaction: async (_d, callback) => callback({ get: async () => snap({ status: 'completed' }), update() { throw Error('must not write'); } }) });
  vm.runInContext(part('shop/admin.js', 'async function transitionOrder(', 'async function confirmOrder('), transitions);
  await assert.rejects(transitions.transitionOrder('o', 'packing', ['confirmed']), /狀態已變更/);

  let exported;
  const csv = vm.createContext({ filteredOrderCache: [], orders: [{ orderNo: 'private-unmatched' }], formatDate() {}, STATUS: {},
    Blob: class { constructor(parts) { exported = parts.join(''); } }, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement() { return { click() {} }; } }, Date });
  vm.runInContext(part('shop/admin.js', 'function exportOrders(', 'function renderMessages('), csv);
  csv.exportOrders();
  assert.ok(!exported.includes('private-unmatched'), 'zero-result filter must export no orders');
}

const authMock = `
export const browserLocalPersistence={};
export const getAuth=()=>window.__shop.auth;
export const setPersistence=async()=>{};
export const signInAnonymously=async()=>({user:window.__shop.auth.currentUser});
export function onAuthStateChanged(auth,cb){window.__shop.authCallbacks.push(cb);queueMicrotask(()=>cb(auth.currentUser));return()=>{};}
`;
const firestoreMock = `
const s=window.__shop;
export const doc=(_db,col,id)=>({col,id});
export const collection=(_db,col)=>({col});
export const where=(key,op,value)=>({key,op,value});
export const query=(ref,...filters)=>({...ref,filters});
export const serverTimestamp=()=>({toMillis:()=>Date.now(),toDate:()=>new Date()});
export const getFirestore=()=>({});
const wrap=(data,id='')=>({id,exists:()=>data!=null,data:()=>data});
const docs=ref=>Object.entries(ref.col==='shopProducts'?s.products:ref.col==='shopOrders'?s.orders:{}).filter(([,d])=>(ref.filters||[]).every(f=>d[f.key]===f.value)).map(([id,data])=>wrap(data,id));
export async function getDoc(ref){return wrap(ref.col==='shopSettings'?s.settings:ref.col==='shopProducts'?s.products[ref.id]:ref.col==='admins'?{}:null,ref.id);}
export async function getDocFromServer(ref){await new Promise(r=>setTimeout(r,40));return getDoc(ref);}
export async function getDocs(ref){return {docs:docs(ref)};}
export async function getDocsFromServer(ref){await new Promise(r=>setTimeout(r,40));return getDocs(ref);}
export function onSnapshot(ref,cb,error){const sub={ref,cb,error,active:true};s.subscriptions.push(sub);queueMicrotask(()=>cb(ref.id?wrap(s.settings,ref.id):{docs:docs(ref)}));return()=>{sub.active=false;};}
export async function setDoc(ref,data){s.writes.push({ref,data});await new Promise(r=>setTimeout(r,80));if(ref.col==='shopOrders'){s.orders[ref.id]=data;s.emit('shopOrders');}}
export const addDoc=async()=>({id:'qa'});
`;

async function browserTests() {
  const { chromium } = require('playwright');
  const baseDirectory = path.resolve(root, '..');
  const server = http.createServer((request, response) => {
    const file = path.resolve(baseDirectory, '.' + new URL(request.url, 'http://test').pathname);
    if (!file.startsWith(baseDirectory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const entry of ['/77-waxing-site/shop/index.html', '/77select/index.html']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const state = window.__shop = {
          auth: { currentUser: { uid: 'A', isAnonymous: false, getIdToken: async () => 'test-token' } }, authCallbacks: [], subscriptions: [], writes: [],
          products: { p: { active: true, name: '測試商品', category: '保養', stock: 10, variants: [{ id: 'v', name: '一般', capacity: '100ml', priceTWD: 100, priceHKD: 30, stock: 10 }] },
            other: { active: true, name: '另一件商品', category: '保養', stock: 10, variants: [{ id: 'v2', name: '一般', capacity: '50ml', priceTWD: 80, priceHKD: 25, stock: 10 }] } },
          settings: { enablePickup: true, enableCashPickup: true, enableTransfer: true, promotions: [] },
          orders: { 'A-old': { orderNo: 'A-old', ownerUid: 'A', items: [], total: 111, status: 'pending' }, 'B-old': { orderNo: 'B-old', ownerUid: 'B', items: [], total: 222, status: 'pending' } },
        };
        localStorage.setItem('77select_market_v1', JSON.stringify({ code: 'TW', expires: Date.now() + 600000 }));
        localStorage.setItem('77select_cart_v4', '[]');
        state.emit = col => state.subscriptions.filter(sub => sub.active && sub.ref.col === col).forEach(sub => {
          if (col === 'shopSettings') return sub.cb({ exists: () => true, data: () => state.settings });
          const source = col === 'shopOrders' ? state.orders : state.products;
          const docs = Object.entries(source).filter(([, row]) => (sub.ref.filters || []).every(filter => row[filter.key] === filter.value)).map(([id, row]) => ({ id, data: () => row }));
          sub.cb({ docs });
        });
        state.switchUser = uid => {
          state.auth.currentUser = uid ? { uid, isAnonymous: false, getIdToken: async () => 'test-token' } : null;
          state.authCallbacks.forEach(callback => callback(state.auth.currentUser));
        };
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const headers = { 'access-control-allow-origin': '*' };
        if (url.hostname === 'www.gstatic.com') {
          const body = url.pathname.endsWith('firebase-auth.js') ? authMock : url.pathname.endsWith('firebase-firestore.js') ? firestoreMock : 'export const initializeApp=()=>({}); export const getApps=()=>[];';
          return route.fulfill({ contentType: 'text/javascript', body, headers });
        }
        if (url.pathname.endsWith('/assets/public-firebase.js')) return route.fulfill({ contentType: 'text/javascript', body: 'export const getPublicFirebase=()=>({auth:window.__shop.auth,db:{},app:{}});', headers });
        if (/\/assets\/(member-auth|google-auth-ui|member-auth-popup-fix|account-linking)\.js$/.test(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '', headers });
        if (url.hostname === '5j1u35k6.github.io') {
          const file = path.resolve(baseDirectory, '.' + url.pathname);
          if (file.startsWith(baseDirectory + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : undefined, headers });
        }
        if (url.origin !== origin) return route.fulfill({ status: 200, body: '{}', contentType: 'application/json', headers });
        return route.continue();
      });
      await page.goto(origin + entry);
      await page.waitForFunction(() => document.querySelector('[data-regional-detail]') && window.__shop.authCallbacks.length >= 4);
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const oldCallbacks = window.__shop.subscriptions.filter(sub => sub.ref.col === 'shopOrders');
        window.__shop.switchUser('B');
        oldCallbacks.forEach(sub => sub.cb({ docs: [{ id: 'A-late', data: () => ({ ownerUid: 'A', orderNo: 'A-late', items: [], total: 999 }) }] }));
      });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#orders-list').innerText().then(text => text.includes('A-late')), false, 'late callbacks cannot expose the previous account');
      assert.match(await page.locator('#orders-list').innerText(), /B-old/);
      await page.evaluate(() => window.__shop.switchUser(null));
      await page.waitForTimeout(80);
      assert.doesNotMatch(await page.locator('#orders-list').innerText(), /B-old/, 'logout clears orders immediately');
      await page.evaluate(() => window.__shop.switchUser('B'));
      const addQuantity = async (productId, count) => {
        await page.locator(`[data-regional-detail="${productId}"]`).click();
        await page.waitForTimeout(80);
        for (let i = 1; i < count; i++) await page.locator('[data-detail-qty="1"]').click();
        await page.locator('#product-detail-add').click();
        await page.waitForTimeout(80);
      };
      const checkout = async () => {
        await page.locator('#cart-open').click();
        await page.locator('#checkout-open').click();
        await page.locator('#checkout-name').fill('測試顧客');
        await page.locator('#checkout-phone').fill('0900000000');
        await page.locator('#checkout-email').fill('shop-test@example.invalid');
        await page.locator('#checkout-terms').check();
      };
      await addQuantity('p', 3);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('77select_cart_v4'))[0].qty), 3, 'requested quantity is committed in the same click');
      await checkout();
      await page.evaluate(() => {
        const form = document.querySelector('#checkout-form');
        form.requestSubmit(); form.requestSubmit();
      });
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__shop.writes.length), 1, 'rapid submits create one ordinary order');
      await page.evaluate(() => {
        window.__shop.settings.promotions = [{ id: 'two', active: true, promotionType: 'any_qty_bundle', groups: [{ minQty: 2, items: [{ productId: 'p', variantId: 'v' }] }], discount: { bundlePriceTWD: 150, bundlePriceHKD: 50 } }];
        window.__shop.emit('shopSettings');
      });
      await addQuantity('p', 2);
      await checkout();
      await page.waitForTimeout(100);
      const discount = await page.locator('.cart-math-discount-toggle .cart-math-value').innerText();
      assert.equal(discount, 'NT$50', 'cart and checkout must not double count the same promotion');
      await page.evaluate(() => {
        const form = document.querySelector('#checkout-form');
        form.requestSubmit(); form.requestSubmit();
      });
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => window.__shop.writes.length), 2, 'rapid submits create one promotion order');
      assert.equal(await page.evaluate(() => window.__shop.writes[1].data.total), 150);
      await addQuantity('other', 1);
      const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('77select_cart_v4')));
      assert.equal(cart.length, 1, 'a promotion checkout clears the live regional cart');
      assert.equal(cart[0].productId, 'other');
      const mutations = await page.evaluate(() => new Promise(resolve => {
        let count = 0;
        const observer = new MutationObserver(records => { count += records.length; });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
        setTimeout(() => { observer.disconnect(); resolve(count); }, 220);
      }));
      assert.equal(mutations, 0, 'storefront observers must settle instead of changing the DOM every frame');
      assert.deepEqual(errors, [], entry + ': no runtime exceptions');
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

(async () => {
  await unitTests();
  if (!process.argv.includes('--unit-only')) await browserTests();
  console.log('PASS: shop + standalone wrapper account isolation, logout, atomic quantity, ordinary/promotion duplicate-submit protection, cart clearing, promotion math, idle observer convergence, legacy variants, zero-price gifts, promotion validation, status transitions, empty-filter CSV and storage failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
