// Controlled fixtures only: no live identities, bookings, settings or writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(process.env.PUBLIC_BUG_TEST_ROOT || path.join(__dirname, '..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function part(file, start, end) {
  const source = read(file), a = source.indexOf(start), b = end ? source.indexOf(end, a + start.length) : source.length;
  assert.ok(a >= 0 && b > a, file + ': extraction boundaries');
  return source.slice(a, b);
}
const silent = { error() {}, warn() {}, log() {} };
function context(code, values = {}) {
  const state = vm.createContext({ console: silent, Promise, Map, Set, Date, Intl, URL, URLSearchParams, Error, setTimeout, clearTimeout, ...values });
  vm.runInContext(code, state); return state;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const snapshot = value => ({ exists: () => value != null, data: () => value });
const escaped = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('Booking mounts once while catalog is pending and retries only when requested', async () => {
  const code = part('assets/booking-core.js', 'async function mount(root) {', '  const earliestDate =') + '\n}';
  let calls = 0, writes = 0; const pending = deferred(), retry = {};
  const node = { isConnected: true, dataset: {}, querySelector: () => retry, set innerHTML(value) { writes++; } };
  const state = context(code, { firebaseConfigured: true, dynamicCatalog: () => { calls++; return pending.promise; }, bookingMarkup: () => 'fixture' });
  const first = state.mount(node), duplicate = state.mount(node);
  assert.equal(calls, 1); pending.resolve([]); await Promise.all([first, duplicate]); assert.equal(writes, 1);
  const disconnected = { isConnected: false, dataset: {}, set innerHTML(value) { throw Error('Detached booking rewritten'); } };
  await state.mount(disconnected);
  delete node.dataset.bookingV3Mounted; state.dynamicCatalog = async () => { calls++; throw Error('offline'); };
  await state.mount(node); const failedCalls = calls; await state.mount(node); assert.equal(calls, failedCalls, 'DOM observation must not repeatedly retry a failed read');
  assert.equal(typeof retry.onclick, 'function'); state.dynamicCatalog = async () => { calls++; return []; }; retry.onclick(); await tick(); assert.equal(calls, failedCalls + 1);
});

test('Latest availability request wins and old slots cannot be selected while reading', async () => {
  const reads = new Map(), sync = { textContent: '', classList: { add() {}, remove() {} } }; let cleared = 0;
  const state = context('let selectedItem={},availability={},availabilityRequest=0,anchorDate="2026-11-01";'
    + part('assets/booking-core.js', '  async function refreshAvailability()', '\n  root.querySelector("[data-month-prev]")')
    + ';this.setAnchor=value=>{anchorDate=value};this.getAvailability=()=>availability;', {
    root: { isConnected: true, querySelector: selector => selector === '[data-dayrail]' ? { replaceChildren() { cleared++; } } : sync },
    loadLocks: date => { const pending = deferred(); reads.set(date, pending); return pending.promise; }, drawCalendar() {}, drawRail() {}, shortDate: date => ({ label: date }),
  });
  const first = state.refreshAvailability(); state.setAnchor('2026-11-08'); const latest = state.refreshAvailability();
  const data = date => ({ windowDates: Array(7).fill(date), locksByDate: new Map() });
  reads.get('2026-11-08').resolve(data('2026-11-08')); await latest;
  reads.get('2026-11-01').resolve(data('2026-11-01')); await first;
  assert.equal(state.getAvailability().windowDates[0], '2026-11-08');
  assert.equal(cleared, 2);
});

function bookingTransaction(general = {}, manual = {}, locks = {}) {
  const writes = [], reads = [];
  const addDays = (date, count) => { const next = new Date(date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + count); return next.toISOString().slice(0, 10); };
  const state = context(part('assets/booking-core.js', '      const writeBooking = async', '\n      try {\n        await writeBooking') + ';this.writeBooking=writeBooking;', {
    db: {}, user: { uid: 'fixture-member' }, name: '虛構測試', phone: { local: '0900000000', international: '+886900000000', country: { name: 'Taiwan', dial: '+886' } }, email: 'fixture@example.invalid', lineId: '', gender: 'male', birthday: '2000-01-02', note: '', compatibilityNote: '', firstVisit: true,
    bookedCategory: { name: '熱蠟' }, selectedCategory: { name: '熱蠟' }, bookedItem: { name: '測試', durationMinutes: 90, blockMinutes: 90 }, selectedItem: { name: '測試', durationMinutes: 90, blockMinutes: 90 },
    bookedDate: '2026-10-27', selectedDate: '2026-10-27', bookedTime: '20:00', selectedTime: '20:00', lockTimes: ['20:00', '20:30', '21:00'], lockIds: ['d_2000', 'd_2030', 'd_2100'], lockRefs: ['2000', '2030', '2100'].map(id => ({ collection: 'availabilityLocks', id })), bookingRef: { collection: 'bookings', id: 'fixture' },
    doc: (_db, collection, id) => ({ collection, id }), serverTimestamp: () => 1, taipeiToday: () => '2026-10-26', addDays,
    runTransaction: async (_db, operation) => operation({
      get: async ref => { assert.equal(writes.length, 0, 'All reads must precede writes'); reads.push(ref); return snapshot(ref.collection === 'settings' ? ref.id === 'general' ? general : manual : locks[ref.id]); },
      set: (ref, data) => writes.push({ ref, data }),
    }),
  });
  return { state, writes, reads };
}

test('Booking transaction rechecks closure, manual overlap, date and opening-time limits', async () => {
  for (const [settings, manual, message] of [
    [{ bookingEnabled: false }, {}, /BOOKING_CLOSED/],
    [{}, { blockedTimes: ['20:30'] }, /SLOT_CONFLICT/],
    [{ maxAdvanceDays: 0.5 }, {}, /SLOT_CONFLICT/],
    [{ bookingEndTime: '19:30' }, {}, /SLOT_CONFLICT/],
  ]) {
    const state = bookingTransaction(settings, manual); await assert.rejects(state.state.writeBooking(true), message); assert.equal(state.writes.length, 0);
  }
  const held = bookingTransaction({}, {}, { '2030': { state: 'held' } }); await assert.rejects(held.state.writeBooking(true), /SLOT_CONFLICT/); assert.equal(held.writes.length, 0);
  const past = bookingTransaction(); past.state.bookedDate = past.state.selectedDate = '2026-10-26'; await assert.rejects(past.state.writeBooking(true), /SLOT_CONFLICT/);
  const future = bookingTransaction({ maxAdvanceDays: 1 }); future.state.bookedDate = future.state.selectedDate = '2026-10-28'; await assert.rejects(future.state.writeBooking(true), /SLOT_CONFLICT/);
  const valid = bookingTransaction({}, { blockedTimes: ['19:30', '21:30'] }); await valid.state.writeBooking(true);
  assert.equal(valid.reads.length, 5); assert.equal(valid.writes.length, 4);
  assert.equal(valid.writes[0].data.customerBirthday, '2000-01-02'); assert.equal(valid.writes[0].data.customerPhoneInternational, '+886900000000');
  const compatible = bookingTransaction(); await compatible.state.writeBooking(false); assert.equal('customerPhoneInternational' in compatible.writes[0].data, false);
});

test('Submission persists the clicked selection even if the UI changes during the transaction', async () => {
  const valid = bookingTransaction(); valid.state.selectedDate = '2026-11-10'; valid.state.selectedTime = '09:00'; valid.state.selectedItem = { name: '其他服務', durationMinutes: 30, blockMinutes: 30 };
  await valid.state.writeBooking(true);
  assert.equal(valid.writes[0].data.preferredDate, '2026-10-27'); assert.equal(valid.writes[0].data.preferredTime, '20:00'); assert.equal(valid.writes[0].data.durationMinutes, 90);
  assert.equal(valid.writes[1].data.date, '2026-10-27');
});

function settingsContext() {
  const realDate = Date;
  class FixedDate extends realDate { constructor(...args) { super(...(args.length ? args : ['2026-10-25T18:00:00Z'])); } }
  const button = disabled => ({ dataset: {}, disabled });
  const actions = [button(false), button(true)], anchors = ['2026-10-26', '2026-10-27', '2026-10-28'].map(date => ({ dataset: { anchorDate: date }, disabled: false }));
  const columns = [{}, {}], heads = ['2026-10-27', '2026-10-28'].map((date, i) => ({ dataset: { visibleDate: date }, closest: () => columns[i] }));
  const slots = ['2026-10-27', '2026-10-28'].map(date => ({ dataset: { slotDate: date, slotTime: '20:00' }, hidden: false }));
  let textWrites = 0, notice = ''; const banner = { get textContent() { return notice; }, set textContent(value) { textWrites++; notice = value; } };
  const root = { classList: { toggle() {} }, querySelector: () => banner, querySelectorAll: selector => selector.includes('data-booking-item') ? actions : selector === '[data-anchor-date]' ? anchors : selector === '[data-visible-date]' ? heads : selector === '[data-slot-time]' ? slots : [] };
  const source = read('assets/runtime-settings.js').replace(/^import .*;\n/gm, '').replace(/\ninit\(\);\s*$/, '');
  const state = context(source + ';this.setSettings=value=>{settings=value};', { Date: FixedDate, document: { querySelector: () => root } });
  return { state, actions, anchors, columns, slots, textWrites: () => textWrites };
}

test('Booking dates follow Taipei timezone and the actual seven-day rail respects maxAdvanceDays', () => {
  const previousTZ = process.env.TZ; process.env.TZ = 'America/Los_Angeles';
  try {
    const fixture = settingsContext(); fixture.state.setSettings({ maxAdvanceDays: 1 }); fixture.state.applyBookingSettings();
    assert.equal(fixture.anchors[1].disabled, false, 'Taipei tomorrow must remain available');
    assert.equal(fixture.anchors[0].disabled, true); assert.equal(fixture.slots[1].hidden, true); assert.equal(fixture.columns[1].hidden, true);
  } finally { if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ; }
});

test('Reopening booking restores controls without enabling unselected actions', () => {
  const fixture = settingsContext(); fixture.state.setSettings({ bookingEnabled: false }); fixture.state.applyBookingSettings(); assert.equal(fixture.actions[0].disabled, true);
  fixture.state.setSettings({ bookingEnabled: true }); fixture.state.applyBookingSettings(); assert.equal(fixture.actions[0].disabled, false); assert.equal(fixture.actions[1].disabled, true);
});

test('An unchanged booking notice does not cause another DOM mutation', () => {
  const fixture = settingsContext(); fixture.state.setSettings({ bookingNotice: '虛構測試公告' }); fixture.state.applyBookingSettings(); fixture.state.applyBookingSettings(); assert.equal(fixture.textWrites(), 1);
});

test('Member history recognizes current and legacy gender fields', () => {
  const state = context(part('assets/member-auth.js', 'function parseGender(', '\nfunction cleanBookingNote('));
  assert.equal(state.parseGender('[性別] 生理男'), 'male'); assert.equal(state.parseGender('[性別] 生理女'), 'female'); assert.equal(state.parseGender('[性別] 女性'), 'female');
  const choice = part('assets/member-auth.js', '      const gender =', '      const note =');
  const row = context(choice + ';this.gender=gender;', { booking: { customerGender: 'male', note: '[性別] 女性' }, profile: { gender: 'female' }, parseGender: state.parseGender }); assert.equal(row.gender, 'male');
});

test('Switching members clears the previous prefilled contact and hidden LINE subject', async () => {
  const fields = Object.fromEntries(['name', 'email', 'phoneCountry', 'phone', 'gender', 'birthday', 'line'].map(name => [name, { name, value: '', dataset: name === 'line' ? { memberHidden: '1' } : {}, dispatchEvent() {} }]));
  const root = { querySelector: selector => { const match = selector.match(/name="([^"]+)"/); return match ? fields[match[1]] : null; } };
  const document = { querySelector: selector => selector === '#booking' ? root : null, querySelectorAll: selector => selector.includes('data-member-prefilled') ? Object.values(fields).filter(field => field.dataset.memberPrefilled === '1') : [fields.line] };
  const callback = part('assets/member-auth.js', 'onAuthStateChanged(auth, async (user) => {', '  authReady = true;').replace('onAuthStateChanged(auth, async (user) => {', 'async function changedUser(user) {') + '\n}';
  const state = context(part('assets/member-auth.js', 'function fillFieldOnce(', '\nasync function saveBookingProfile(') + callback, { document, Event: class {}, isMember: user => user ? !user.isAnonymous : true, closeMemberCenter() {}, currentUser: { uid: 'A', displayName: 'A' }, currentProfile: { displayName: 'A', phone: '0900000001', email: 'a@example.invalid', lineId: 'line-A' } });
  state.applyProfileToBooking(); assert.equal(fields.phone.value, '0900000001'); assert.equal(fields.line.value, 'line-A');
  await state.changedUser({ uid: 'B' }); state.currentUser = { uid: 'B' }; state.currentProfile = { displayName: 'B', phone: '0900000002', email: 'b@example.invalid', lineId: '' }; state.applyProfileToBooking();
  assert.equal(fields.phone.value, '0900000002'); assert.equal(fields.name.value, 'B'); assert.equal(fields.line.value, '');
});

test('LINE return preserves the price-table preselected service hash', async () => {
  const tasks = [], destination = 'https://5j1u35k6.github.io/77-waxing-site/booking/#category=men&item=fixture'; let replaced = '';
  const state = context(part('assets/member-auth-popup-fix.js', 'async function consumeLineCallback()', '\nasync function beginLineLogin()'), {
    location: { origin: 'https://5j1u35k6.github.io', href: 'https://5j1u35k6.github.io/77-waxing-site/booking/', hash: '#77line_token=fixture&77line_state=valid', reload() {}, replace: value => { replaced = value; } },
    getExpectedState: () => 'valid', getPendingTarget: () => destination, clearExpectedState() {}, clearPendingTarget() {}, cleanAuthFragment() {}, rememberDebug() {}, decodeCustomClaims: () => ({}), auth: {}, db: {}, browserLocalPersistence: {},
    setPersistence: async () => {}, signInWithCustomToken: async () => ({ user: { uid: 'fixture-member', isAnonymous: false, getIdToken: async () => 'fixture' } }), setStatus() {}, doc: () => ({}), setDoc: async () => {}, serverTimestamp: () => 1,
    window: { dispatchEvent() {} }, CustomEvent: class {}, setTimeout: callback => tasks.push(callback), showLoginError() {},
  });
  await state.consumeLineCallback(); tasks.forEach(callback => callback()); assert.equal(replaced, destination);
});

test('Fresh catalog data replaces cached homepage cards immediately', () => {
  const grid = { dataset: { dynamicCatalog: '1' }, innerHTML: 'cached' };
  const state = context(part('assets/catalog-dynamic.js', 'function syncHomeCards(', '\nfunction renderCurrent('), { normalizedPath: () => '/', document: { querySelector: () => ({ querySelector: () => grid }) }, catalog: [{ key: 'men', name: '男士', slug: 'men', intro: '目前目錄嘅介紹' }], esc: escaped, servicePath: service => '/services/' + service.slug });
  state.syncHomeCards(true); assert.match(grid.innerHTML, /目前目錄嘅介紹/);
});

test('Empty catalog and failed initial reads replace the loading placeholder', () => {
  const shown = [];
  const state = context(part('assets/catalog-dynamic.js', 'function renderCurrent(', '\nfunction schedule()'), {
    rendering: false, catalog: [], catalogLoaded: true, catalogError: false,
    renderCatalogMessage: kind => shown.push(kind), renderLoading: () => shown.push('loading'),
  });
  state.renderCurrent(); assert.equal(shown.at(-1), 'empty');
  state.catalogError = true; state.renderCurrent(); assert.equal(shown.at(-1), 'error');
});

test('Removed service URLs finish with an unavailable-service view instead of an endless spinner', () => {
  const shown = [];
  const state = context(part('assets/catalog-dynamic.js', 'function renderCurrent(', '\nfunction schedule()'), {
    rendering: false, catalog: [{ key: 'men', slug: 'men' }], catalogLoaded: true, catalogError: false,
    syncServiceMenus() {}, syncHomeCards() {}, app: () => ({ dataset: {} }), normalizedPath: () => '/services/removed/', serviceByPath: () => null,
    renderCatalogMessage: kind => shown.push(kind), renderLoading: () => shown.push('loading'),
  });
  state.renderCurrent(); assert.equal(shown.at(-1), 'missing');
  state.catalogLoaded = false; state.renderCurrent(); assert.equal(shown.at(-1), 'loading');
  state.catalogError = true; state.renderCurrent(); assert.equal(shown.at(-1), 'error');
});

test('Catalog failure view is stable under DOM observation and its retry starts a new read', async () => {
  let writes = 0, retried = 0; const retry = { addEventListener: (_name, callback) => { retry.click = callback; } };
  const root = { dataset: {}, querySelector: selector => selector === '[data-catalog-message]' ? writes ? {} : null : retry, set innerHTML(value) { writes++; } };
  const state = context(part('assets/catalog-dynamic.js', 'function renderCatalogMessage(', '\nfunction catalogFailed('), {
    app: () => root, normalizedPath: () => '/menu/', B: '/77-waxing-site', catalogError: true,
    serviceSwitcher: () => '', renderLoading() {}, start: async () => { retried++; }, catalogFailed() {},
  });
  state.renderCatalogMessage('error'); state.renderCatalogMessage('error'); assert.equal(writes, 1);
  retry.click(); await tick(); assert.equal(retried, 1); assert.equal(state.catalogError, false);
});

test('Account-link status reads are coalesced and stale identity results are discarded', async () => {
  let calls = 0; const pending = deferred(), auth = { currentUser: { uid: 'A', getIdToken: async () => 'fixture' } };
  const state = context('let statusCache=null,statusForUid="",statusRequest=null;' + part('assets/account-linking.js', 'async function loadStatus(', '\nfunction inferLocalProviders('), { auth, proxyRequest: () => { calls++; return pending.promise; } });
  const first = state.loadStatus(true), second = state.loadStatus(true); await tick(); assert.equal(calls, 1);
  auth.currentUser = { uid: 'B' }; pending.resolve({ providers: { line: true, google: false } }); assert.equal(await first, null); assert.equal(await second, null);
});

test('Painting an unchanged account-link status creates no new text nodes', () => {
  let writes = 0; const nodes = new Map(); const node = () => { let value = ''; return { dataset: {}, get textContent() { return value; }, set textContent(next) { value = next; writes++; } }; };
  const section = { querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); } };
  const state = context(part('assets/account-linking.js', 'function paintStatus(', '\nfunction statusReadErrorText('), { ensureSection: () => section, busy: '' });
  state.paintStatus({ line: true, google: false }); const firstWrites = writes; state.paintStatus({ line: true, google: false }); assert.equal(writes, firstWrites);
});

test('Addon names, prices and summary values remain escaped catalog text', () => {
  const panel = { dataset: {}, querySelectorAll: () => [], innerHTML: '' }, step = { querySelector: () => panel };
  const config = { key: 'men', label: '測試', items: [{ id: 'fixture', name: '<img src=x onerror=alert(1)> & "測試"', price: '<b>價格</b>' }] };
  const state = context(part('assets/booking-addons.js', '  function ensureAddonPanel()', '\n  function selectedAddons()'), { booking: () => ({ querySelector: () => step }), currentConfig: () => config, esc: escaped });
  state.ensureAddonPanel(); assert.doesNotMatch(panel.innerHTML, /<img|<b>價格/); assert.match(panel.innerHTML, /&lt;img/); assert.match(panel.innerHTML, /&quot;測試&quot;/);
});

(async () => {
  let failed = 0;
  for (const item of tests) {
    try { await item.run(); console.log('PASS:', item.name); }
    catch (error) { failed++; console.error('FAIL:', item.name, '\n ', error.message); }
  }
  console.log(`${tests.length - failed}/${tests.length} public regressions passed; no live data changed.`);
  if (failed) process.exitCode = 1;
})();
