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
  const series = await import(`data:text/javascript;base64,${Buffer.from(read('shop/series.js')).toString('base64')}`);
  assert.equal(series.blackBottleSeries, '黑瓶\u267E\uFE0E修護系列', 'infinity uses text presentation');
  for (const name of ['黑瓶無限修護系列', '黑瓶♾️修護系列', '極致呵護無香系列']) {
    assert.equal(series.collectionKey(name), 'black-bottle', 'existing names retain their collection URL');
  }
  assert.equal(series.seriesSlogan('black-bottle', { 'black-bottle': '  店家標語  ' }), '店家標語');
  assert.equal(series.seriesSlogan('black-bottle', { 'black-bottle': '' }), series.seriesSlogan('black-bottle'));
  assert.equal(series.seriesSlogan('all'), '', 'only the individual series display slogans');
  const heroHtml = read('shop/index.html');
  assert.doesNotMatch(heroHtml, /把日常保養需要的，簡單整理給你/);
  assert.match(heroHtml, /<h1 id="hero-title">77select<\/h1>/);
  assert.match(heroHtml, /\.shop-hero-pending #hero-title\{visibility:hidden\}/);
  const heroBootstrap = heroHtml.match(/<script id="shop-hero-loading">([\s\S]*?)<\/script>/)[1];
  const heroDefaults = part('shop/app.js', 'const DEFAULT_SETTINGS =', 'const STATUS =');
  const heroSource = part('shop/app.js', 'async function loadSettings()', 'async function loadProducts()');
  const makeHero = (getDoc) => {
    const classes = new Set(), nodes = new Map(), timers = [];
    const context = vm.createContext({
      document: { documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } } },
      window: { setTimeout: (callback, delay) => { assert.equal(delay, 10000); timers.push(callback); } },
      DEFAULT_EMAIL_URL: 'https://example.invalid/email', settings: {}, db: {}, doc: () => ({}), getDoc,
      renderSelectHomeSettings() {},
      $: selector => { if (!nodes.has(selector)) nodes.set(selector, { textContent: selector === '#hero-title' ? '77select' : '' }); return nodes.get(selector); },
    });
    vm.runInContext(heroBootstrap + heroDefaults + heroSource, context);
    return { context, classes, nodes, timers };
  };
  let resolveHero;
  const slowHero = makeHero(() => new Promise(resolve => { resolveHero = resolve; }));
  const heroRequest = slowHero.context.loadSettings();
  assert.equal(slowHero.classes.has('shop-hero-pending'), true, 'hide the placeholder before settings arrive');
  assert.equal(slowHero.nodes.size, 0, 'a pending request cannot write a default advertisement');
  const configuredTitle = '讓 保 養 回 歸 簡 單，讓 選 擇 更 有 方 向。';
  resolveHero(snap({ heroTitle: configuredTitle }));
  await heroRequest;
  assert.equal(slowHero.nodes.get('#hero-title').textContent, configuredTitle, 'preserve the exact configured spacing');
  assert.equal(slowHero.classes.has('shop-hero-pending'), false);
  slowHero.timers[0]();
  assert.equal(slowHero.nodes.get('#hero-title').textContent, configuredTitle, 'late fallback timer cannot overwrite settings');
  for (const value of [null, {}, { heroTitle: '' }, { heroTitle: '   ' }, { heroTitle: 123 }]) {
    const state = makeHero(async () => snap(value));
    await state.context.loadSettings();
    assert.equal(state.nodes.get('#hero-title').textContent, '77select', 'missing or invalid title falls back to brand');
    assert.equal(state.classes.has('shop-hero-pending'), false);
  }
  const failedHero = makeHero(async () => { throw Error('offline'); });
  await failedHero.context.loadSettings();
  assert.equal(failedHero.nodes.get('#hero-title').textContent, '77select');
  assert.equal(failedHero.classes.has('shop-hero-pending'), false);
  const blockedModule = makeHero(async () => snap(null));
  blockedModule.timers[0]();
  assert.equal(blockedModule.classes.has('shop-hero-pending'), false, 'unavailable module cannot leave heading hidden forever');

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
export async function getDocs(ref){
  if(ref.col==='shopProducts'){
    s.catalogReads++;
    if(s.catalogFixture==='slow') await new Promise(resolve=>{s.releaseCatalog=resolve;});
    if(s.catalogFixture==='failed') throw new Error('Fixture network unavailable');
  }
  return {docs:docs(ref)};
}
export async function getDocsFromServer(ref){await new Promise(r=>setTimeout(r,40));return getDocs(ref);}
export function onSnapshot(ref,cb,error){const sub={ref,cb,error,active:true};s.subscriptions.push(sub);queueMicrotask(()=>cb(ref.id?wrap(s.settings,ref.id):{docs:docs(ref)}));return()=>{sub.active=false;};}
export async function setDoc(ref,data){s.writes.push({ref,data});await new Promise(r=>setTimeout(r,80));if(ref.col==='shopOrders'){s.orders[ref.id]=data;s.emit('shopOrders');}s.persist();}
export const addDoc=async()=>({id:'qa'});
`;

async function browserTests() {
  const { chromium } = require('playwright');
  const baseDirectory = path.resolve(root, '..');
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://test').pathname;
    const file = path.resolve(baseDirectory, '.' + pathname, ...(pathname.endsWith('/') ? ['index.html'] : []));
    if (!file.startsWith(baseDirectory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const entry of ['/77-waxing-site/shop/index.html', '/77select/index.html']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const saved = JSON.parse(sessionStorage.getItem('shop-regression-fixture') || 'null');
        const state = window.__shop = {
          catalogFixture: new URLSearchParams(location.search).get('fixtureCatalog'), catalogReads: 0, showedLoadingPanel: false,
          auth: { currentUser: null }, authCallbacks: [], subscriptions: [], writes: [],
          products: { p: { active: true, name: '測試商品', category: '黑瓶♾️修護系列', stock: 10,
            imageUrl: '/77-waxing-site/shop/select-series-repair.jpg', media: [
              { url: '/77-waxing-site/shop/select-series-repair.jpg' },
              { url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="tan"/></svg>') },
            ], slogan: '保養標語', precautions: '商品注意事項', addOnProductIds: ['other'],
            variants: [{ id: 'v', name: '一般', capacity: '100ml', priceTWD: 100, priceHKD: 30, stock: 10 }, { id: 'v-alt', name: '加大', capacity: '200ml', priceTWD: 140, priceHKD: 40, stock: 10 }] },
            other: { active: true, name: '另一件商品', category: '保養', stock: 10, variants: [{ id: 'v2', name: '一般', capacity: '50ml', priceTWD: 80, priceHKD: 25, stock: 10 }] } },
          settings: { enablePickup: true, enableCashPickup: true, enableTransfer: true, promotions: [], homeContent: { about: '首頁品牌介紹', featuredProductIds: ['p', '', 'other'], seriesSlogans: { 'black-bottle': '店家標語 <日常保養>\n\n第二段說明 https://example.invalid' } } },
          orders: { 'A-old': { orderNo: 'A-old', ownerUid: 'A', items: [], total: 111, status: 'pending' }, 'B-old': { orderNo: 'B-old', ownerUid: 'B', items: [], total: 222, status: 'pending' } },
          ...(saved ? { writes: saved.writes, settings: saved.settings, orders: saved.orders } : {}),
        };
        localStorage.setItem('77select_market_v1', JSON.stringify({ code: 'TW', expires: Date.now() + 600000 }));
        if (!saved) localStorage.setItem('77select_cart_v4', '[]');
        state.emit = col => state.subscriptions.filter(sub => sub.active && sub.ref.col === col).forEach(sub => {
          if (col === 'shopSettings') return sub.cb({ exists: () => true, data: () => state.settings });
          const source = col === 'shopOrders' ? state.orders : state.products;
          const docs = Object.entries(source).filter(([, row]) => (sub.ref.filters || []).every(filter => row[filter.key] === filter.value)).map(([id, row]) => ({ id, data: () => row }));
          sub.cb({ docs });
        });
        state.switchUser = uid => {
          state.auth.currentUser = uid ? { uid, isAnonymous: false, getIdToken: async () => 'test-token' } : null;
          state.authCallbacks.forEach(callback => callback(state.auth.currentUser));
          state.persist();
        };
        state.persist = () => sessionStorage.setItem('shop-regression-fixture', JSON.stringify({ uid: state.auth.currentUser?.uid ?? null, writes: state.writes, settings: state.settings, orders: state.orders }));
        state.switchUser(saved ? saved.uid : 'A');
        new MutationObserver(() => {
          if ([...document.querySelectorAll('[data-product-load-panel]:not([hidden])')].some(panel => panel.getClientRects().length)) {
            state.showedLoadingPanel = true;
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
      });
      const toFirestoreValue = (value) => {
        if (typeof value === 'string') return { stringValue: value };
        if (typeof value === 'boolean') return { booleanValue: value };
        if (typeof value === 'number') return { integerValue: String(value) };
        if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
        return { mapValue: { fields: toFirestoreFields(value) } };
      };
      const toFirestoreFields = (fields) => Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, toFirestoreValue(value)])
      );
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const headers = { 'access-control-allow-origin': '*' };
        if (url.hostname === 'firestore.googleapis.com' && url.pathname.includes('/documents/shopProducts/')) {
          const id = decodeURIComponent(url.pathname.split('/').pop());
          const product = await page.evaluate(id => window.__shop.products[id], id);
          return route.fulfill(product
            ? { json: { fields: toFirestoreFields(product) }, headers }
            : { status: 403, json: { error: { status: 'PERMISSION_DENIED' } }, headers });
        }
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
      await page.locator('.select-featured-product').first().waitFor({ state: 'visible' });
      assert.match(await page.locator('.select-about-content').innerText(), /首頁品牌介紹/);
      const seriesLabel = '黑瓶\u267E\uFE0E修護系列';
      const blackBottle = page.getByRole('link', { name: seriesLabel, exact: true });
      const description = '店家標語 <日常保養>\n\n第二段說明 https://example.invalid';
      const homeDescription = page.locator('#series-slogan-black-bottle');
      assert.equal(await homeDescription.innerText(), description, 'series descriptions retain paragraph breaks on the homepage');
      assert.equal(await homeDescription.evaluate(el => el.closest('a') === null && !el.querySelector('a')), true, 'description is text outside the series link');
      assert.equal((await page.locator('[data-series-slogan]').allTextContents()).filter(Boolean).length, 4, 'all home series use custom or default slogans');
      const marketBadge = page.getByLabel('目前地區：台灣', { exact: true });
      await marketBadge.waitFor({ state: 'visible' });
      assert.ok(await marketBadge.evaluate(el => el.previousElementSibling?.dataset.tab === 'contact'), 'market badge follows contact in the header');
      assert.ok(await page.locator('.select-hero').evaluate(hero => hero.getBoundingClientRect().bottom >= innerHeight - 1), 'hero fills the first screen under the header');
      assert.ok(await page.locator('#cart-count').evaluate(badge => {
        badge.textContent = '10';
        const bounds = badge.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(badge);
        const text = range.getBoundingClientRect();
        return text.top >= bounds.top && text.bottom <= bounds.bottom && text.left >= bounds.left && text.right <= bounds.right;
      }), 'the badge frames both digits vertically and horizontally');
      assert.equal(await page.locator('.select-featured-product').count(), 2, 'homepage reads the featured product settings without occupying every slot');
      for (const grid of ['.select-featured-grid', '.select-collection-grid']) {
        assert.equal((await page.locator(grid).evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ').length, 1, `${grid}: one card per phone row`);
      }
      assert.match(await page.getByRole('link', { name: '隱私權政策' }).getAttribute('href'), /\/privacy\//);
      await blackBottle.click();
      await page.waitForURL(/\?collection=black-bottle$/);
      await page.locator('[data-catalog-slogan]').filter({ hasText: '店家標語 <日常保養>' }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('#shop-catalog-title').innerText(), seriesLabel);
      assert.equal(await page.locator('[data-catalog-slogan]').innerText(), description, 'the series page displays the same paragraphs');
      await page.locator('[data-regional-detail="p"]').waitFor({ state: 'visible' }).catch(async (error) => {
        const state = await page.locator('main').count() ? await page.locator('main').innerText() : await page.locator('body').innerText();
        throw new Error(`Could not open the collection at ${page.url()}\n${state}\n${errors.join('\n')}`, { cause: error });
      });
      assert.deepEqual(await page.evaluate(() => [window.__shop.catalogReads, window.__shop.showedLoadingPanel]), [1, false], 'fast catalog shares one query and paints without showing the loading panel');
      assert.ok(await page.locator('[data-regional-detail="p"] .select-catalog-photo').evaluate(photo => {
        const dimensions = photo.getBoundingClientRect();
        return Math.abs(dimensions.width - dimensions.height) <= 1;
      }), 'phone product tiles use a large square photo');
      assert.equal(await page.locator('[data-regional-detail="other"]').count(), 0, 'legacy category remains searchable under the new series name');
      await page.evaluate(() => { window.__shop.sameDocument = true; });
      await context.setOffline(true);
      await page.locator('[data-regional-detail="p"]').click();
      await page.waitForURL(url => url.searchParams.get('product') === 'p');
      await page.locator('#product-detail-add').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#product-page-title').innerText(), '測試商品');
      assert.deepEqual(await page.evaluate(() => [window.__shop.sameDocument, window.__shop.catalogReads, window.__shop.showedLoadingPanel]), [true, 1, false]);
      assert.match(await page.locator('link[rel="canonical"]').getAttribute('href'), /[?]product=p$/);
      await page.goBack();
      await page.locator('[data-regional-detail="p"]').waitFor({ state: 'visible' });
      await page.goForward();
      await page.locator('#product-detail-add').waitFor({ state: 'visible' });
      await context.setOffline(false);
      await page.goBack();
      await page.reload();
      await page.locator('[data-regional-detail="p"]').waitFor({ state: 'visible' });
      await page.getByRole('link', { name: '更多商品', exact: true }).click();
      await page.waitForURL(/\?collection=all$/);
      await page.waitForFunction(() => document.querySelector('[data-regional-detail]') && window.__shop.authCallbacks.length >= 4);
      assert.equal((await page.locator('#product-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns)).split(' ').length, 1, 'catalog also shows one item per phone row');
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
        if (!(await page.locator('#shop-catalog').isVisible())) {
          await page.getByRole('link', { name: '更多商品', exact: true }).click();
        }
        await page.locator(`[data-regional-detail="${productId}"]`).click();
        await page.waitForURL(url => url.searchParams.get('product') === productId);
        await page.locator('#shop-product-page').waitFor({ state: 'visible' });
        await page.locator('#product-detail-add').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#product-modal-wrap').count(), 0);
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
        window.__shop.persist();
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
      await page.getByRole('link', { name: '更多商品', exact: true }).click();
      await page.locator('[data-regional-detail="p"]').click();
      await page.locator('#product-add-ons-title').waitFor({ state: 'visible' });
      assert.ok(await page.evaluate(() => {
        const positions = ['.select-product-gallery', '#product-page-title', '.select-product-slogan', '#product-precautions-title', '#product-detail-price', '#product-detail-qty-picker', '#product-add-ons-title']
          .map(selector => document.querySelector(selector).getBoundingClientRect().top);
        return positions.every((position, index) => index === 0 || position > positions[index - 1]);
      }), 'product details follow the intended reading order on a phone');
      const addOn = page.getByRole('combobox', { name: '加購 另一件商品' });
      assert.match(await addOn.innerText(), /NT\$80/);
      await addOn.selectOption('v2');
      await page.locator('[data-regional-variant="v-alt"]').click();
      assert.equal(await addOn.inputValue(), 'v2', 'changing the main variant keeps the selected add-on');
      await page.locator('#product-detail-add').click();
      const bundledCart = await page.evaluate(() => JSON.parse(localStorage.getItem('77select_cart_v4')));
      assert.deepEqual(bundledCart.map(row => [row.productId, row.variantId, row.qty, row.price]), [['other', 'v2', 2, 80], ['p', 'v-alt', 1, 140]], 'configured extras and main variant join the same cart using live prices');
      // Cart totals synchronize in animation frames after the click.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const mutations = await page.evaluate(() => new Promise(resolve => {
        let count = 0;
        const observer = new MutationObserver(records => { count += records.length; });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
        setTimeout(() => { observer.disconnect(); resolve(count); }, 220);
      }));
      assert.equal(mutations, 0, 'storefront observers must settle instead of changing the DOM every frame');
      assert.deepEqual(errors, [], entry + ': no runtime exceptions');
      await page.goto(origin + entry + '?product=p');
      await page.locator('#product-detail-add').waitFor({ state: 'visible' });
      assert.deepEqual(await page.evaluate(() => [window.__shop.catalogReads, window.__shop.showedLoadingPanel]), [1, false], 'fast detail skips the loading panel');
      const gutter = page.locator('.product-gallery-main > .select-photo-fill');
      await gutter.waitFor({ state: 'visible' });
      const imageFit = await page.locator('[data-gallery-main]').evaluate((image) => ({
        fit: getComputedStyle(image).objectFit,
        portrait: image.naturalHeight > image.naturalWidth,
        square: Math.abs(image.clientWidth - image.clientHeight) <= 1,
      }));
      assert.deepEqual(imageFit, { fit: 'contain', portrait: true, square: true }, 'portrait retains its full image inside a filled square');
      assert.equal(await gutter.getAttribute('aria-hidden'), 'true');
      await page.getByRole('button', { name: '檢視商品圖片 2', exact: true }).click();
      await gutter.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: '檢視商品圖片 1', exact: true }).click();
      await gutter.waitFor({ state: 'visible' });
      await page.goto(origin + entry + '?product=p&fixtureCatalog=slow');
      await page.getByRole('heading', { name: '測試商品', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('#product-detail-price').count(), 0, 'early product content cannot show a provisional price');
      assert.equal(await page.locator('[data-gallery-main]').count(), 1, 'the photo can load independently of the full catalog');
      assert.doesNotMatch(await page.locator('main').innerText(), /正在載入商品/);
      await page.waitForFunction(() => typeof window.__shop.releaseCatalog === 'function');
      await page.evaluate(() => window.__shop.releaseCatalog());
      await page.locator('#product-detail-add').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-product-load-panel]:visible').count(), 0);

      await page.goto(origin + entry + '?collection=black-bottle&fixtureCatalog=slow');
      await page.waitForFunction(() => typeof window.__shop.releaseCatalog === 'function');
      await page.waitForTimeout(650);
      assert.equal(await page.locator('[data-product-load-panel]:visible').count(), 0, 'slow catalog does not show loading copy');
      await page.evaluate(() => window.__shop.releaseCatalog());
      await page.locator('[data-regional-detail="p"]').waitFor({ state: 'visible' });

      await page.goto(origin + entry + '?collection=black-bottle&fixtureCatalog=failed');
      await page.getByRole('button', { name: '重新整理', exact: true }).waitFor({ state: 'visible' });
      assert.match(await page.locator('[data-product-load-panel]:visible [role=status]').innerText(), /暫時無法載入/);
      await page.goto(origin + entry + '?product=unlisted');
      await page.getByRole('heading', { name: '找不到這項商品', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-product-load-panel]:visible').count(), 0, 'an unlisted product shows the actual result');
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
