const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = file => read(file).replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace(/\bexport /g, '');
const snapshot = value => ({ exists: () => value != null, data: () => structuredClone(value) });
const element = () => ({ dataset: {}, hidden: false, disabled: false, textContent: '', innerHTML: '', setAttribute() {} });
const documentStub = () => ({ body: element(), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
function context(code, values = {}) {
  const c = vm.createContext({ console, Promise, Map, Set, JSON, Date, URL, structuredClone,
    location: { hostname: 'localhost', pathname: '/admin/', hash: '', href: 'https://test.invalid/admin/customer-record.html' },
    history: { replaceState() {} }, window: { addEventListener() {}, dispatchEvent() {} },
    addEventListener() {}, setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame() {}, queueMicrotask() {}, document: documentStub(),
    MutationObserver: class { observe() {} }, firebaseConfigured: false, getApps: () => [], ...values });
  vm.runInContext(code, c); return c;
}
function store(initial) {
  const rows = new Map(Object.entries(structuredClone(initial))), writes = [];
  const doc = (_db, collection, id) => ({ id, collection, path: collection + '/' + id });
  const getDoc = async ref => snapshot(rows.get(ref.path));
  const runTransaction = async (_db, callback) => {
    const pending = [];
    await callback({
      get: async ref => { assert.equal(pending.length, 0, 'transaction reads must precede writes'); return getDoc(ref); },
      update: (ref, data) => pending.push({ type: 'update', ref, data }),
      delete: ref => pending.push({ type: 'delete', ref }),
    });
    for (const write of pending) {
      writes.push(write);
      if (write.type === 'delete') rows.delete(write.ref.path);
      else rows.set(write.ref.path, { ...rows.get(write.ref.path), ...structuredClone(write.data) });
    }
  };
  return { rows, writes, doc, getDoc, runTransaction, serverTimestamp: () => 123 };
}
const booking = () => ({ status: 'confirmed', preferredDate: '2026-10-30', preferredTime: '20:00',
  customerName: '同一顧客', customerPhone: '0900000000', serviceName: '保養｜原服務', durationMinutes: 90,
  lockIds: ['2026-10-30_2000', '2026-10-30_2030', '2026-10-30_2100', '2026-10-30_2130'],
  lockTimes: ['20:00', '20:30', '21:00', '21:30'], depositRequired: false, paymentStatus: 'not_requested' });
function bookingStore(overrides = {}) {
  const row = booking(), data = { 'bookings/A': row };
  row.lockIds.forEach(id => { data['availabilityLocks/' + id] = { bookingId: 'A', state: 'confirmed' }; });
  return store({ ...data, ...overrides });
}
const helperCode = source('assets/admin-booking-locks.js');
function helper(s) { return context(helperCode, s); }
function editor(s) {
  const locks = helper(s);
  return context(source('assets/admin-booking-editor.js'), { ...s, readBookingLocks: locks.readBookingLocks,
    getApps: () => [{}], getApp: () => ({}), getFirestore: () => ({}), publicCatalog: value => value,
    loadCatalog: async () => [] });
}

(async () => {
  // Cancellation and deletion of an old booking must preserve a reused time.
  const reassigned = 'availabilityLocks/2026-10-30_2130';
  for (const mode of ['delete', 'cancel', 'complete']) {
    const s = bookingStore({ [reassigned]: { bookingId: 'B', state: 'confirmed' } });
    const locks = helper(s);
    if (mode === 'delete') await locks.deleteBookingWithOwnedLocks({}, 'A');
    else {
      const c = context(source('assets/admin-firebase.js'), { ...s, readBookingLocks: locks.readBookingLocks });
      await c.applyBookingAction('A', mode);
    }
    assert.equal(s.rows.get(reassigned).bookingId, 'B', mode + ' preserved the other booking');
    assert.equal(s.rows.has('availabilityLocks/2026-10-30_2000'), false);
  }
  const conflict = bookingStore({ [reassigned]: { bookingId: 'B' } });
  conflict.rows.get('bookings/A').status = 'pending_confirmation';
  const lockReader = helper(conflict);
  const actions = context(source('assets/admin-firebase.js'), { ...conflict, readBookingLocks: lockReader.readBookingLocks });
  await assert.rejects(actions.applyBookingAction('A', 'deposit'), /BOOKING_LOCK_CONFLICT/);
  assert.equal(conflict.writes.length, 0, 'a stale confirmation cannot steal another booking lock');
  conflict.rows.get('bookings/A').status = 'cancelled';
  await assert.rejects(actions.applyBookingAction('A', 'deposit'), /BOOKING_STATUS_CHANGED/);

  // Exercise the actual editor write path with fresh data, changed data and durations.
  const selection = { keepTimes: ['20:00', '20:30', '21:00'], keepIds: booking().lockIds.slice(0, 3),
    serviceName: '新保養｜新服務', durationMinutes: 70, depositMode: 'keep', amountRaw: '' };
  const valid = bookingStore(), e = editor(valid), original = booking();
  await assert.rejects(e.saveBookingEdit({}, 'A', original, { ...selection, durationMinutes: 150 }), /BOOKING_DURATION_EXCEEDS_LOCKS/);
  await assert.rejects(e.saveBookingEdit({}, 'A', original, { ...selection, amountRaw: '-1' }), /INVALID_DEPOSIT_AMOUNT/);
  await assert.rejects(e.saveBookingEdit({}, 'A', original, { ...selection, amountRaw: '0.5' }), /INVALID_DEPOSIT_AMOUNT/);
  assert.equal(valid.writes.length, 0);
  await e.saveBookingEdit({}, 'A', original, selection);
  assert.equal(valid.rows.get('bookings/A').durationMinutes, 70);
  assert.equal(valid.rows.get('bookings/A').bufferMinutes, 20);
  assert.equal(valid.rows.get('bookings/A').slotEnd, '21:30');
  assert.equal(valid.rows.has(reassigned), false, 'only the released tail is deleted');
  const changed = bookingStore(); changed.rows.get('bookings/A').serviceName = '其他管理者剛改過';
  await assert.rejects(editor(changed).saveBookingEdit({}, 'A', original, selection), /BOOKING_STATUS_CHANGED/);
  assert.equal(changed.writes.length, 0);
  const stolen = bookingStore({ [reassigned]: { bookingId: 'B' } });
  await assert.rejects(editor(stolen).saveBookingEdit({}, 'A', original, selection), /BOOKING_LOCK_CONFLICT/);
  assert.equal(stolen.writes.length, 0);
  for (const depositMode of ['paid', 'no']) {
    const s = bookingStore(); s.rows.get('bookings/A').status = 'pending_payment';
    const before = structuredClone(s.rows.get('bookings/A'));
    await editor(s).saveBookingEdit({}, 'A', before, { ...selection, depositMode });
    assert.equal(s.rows.get('bookings/A').status, 'confirmed', 'resolved payment must leave pending_payment');
  }
  const options = e.serviceOptions('舊分類｜已下架項目', 90, [{ name: '正式新增分類', groups: [
    { kind: 'main', items: [{ name: '正式新增項目', durationMinutes: 45 }] },
    { kind: 'addon', items: [{ name: '只限加購', durationMinutes: 30 }] },
  ] }]);
  assert.match(options, /正式新增分類｜正式新增項目/);
  assert.match(options, /目前：舊分類｜已下架項目/);
  assert.doesNotMatch(options, /只限加購|全腿 \/ 半腿/);

  // Rendering untrusted customer fields must retain text without injecting HTML.
  const rows = element(), metrics = element(), logout = element();
  const adminRoot = { innerHTML: '', querySelector: selector => ({ '[data-admin-rows]': rows, '[data-metrics]': metrics, '[data-admin-logout]': logout }[selector]), querySelectorAll: () => [] };
  const render = context(source('assets/admin-firebase.js'));
  const attack = '<img src=x onerror="alert(1)">';
  render.renderAdminRows(adminRoot, [{ id: 'A" onfocus="alert(1)', preferredDate: attack, preferredTime: attack,
    customerName: attack, customerPhone: attack, serviceName: attack, status: attack }]);
  assert.doesNotMatch(rows.innerHTML, /<img|class="status-<|data-id="A" onfocus=/);
  assert.match(rows.innerHTML, /&lt;img/);
  const cancelStore = bookingStore({ [reassigned]: { bookingId: 'B' } });
  cancelStore.rows.get('bookings/A').customerName = attack;
  const cancelHost = element(), cancelButton = element(), cancelMessage = element(), other = { ...element(), value: '' };
  cancelHost.querySelectorAll = () => [];
  cancelHost.querySelector = selector => ({ '[data-cancel-other]': other, '[data-cancel-confirm]': cancelButton,
    '[data-cancel-message]': cancelMessage, 'input[name="cancelReason"]:checked': { value: 'conflict' } }[selector]);
  const cancelDocument = documentStub();
  cancelDocument.querySelector = selector => selector === '#admin-cancel-reason-style' ? {} : selector === '[data-cancel-reason-modal]' ? cancelHost : null;
  const cancellation = context(source('assets/admin-cancel-reason.js'), { ...cancelStore, document: cancelDocument,
    getApps: () => [{}], getApp: () => ({}), getFirestore: () => ({}), readBookingLocks: helper(cancelStore).readBookingLocks,
    CustomEvent: class {} });
  await cancellation.openCancelDialog('A'); assert.doesNotMatch(cancelHost.innerHTML, /<img/);
  await cancelButton.onclick();
  assert.equal(cancelStore.rows.get(reassigned).bookingId, 'B');
  assert.equal(cancelStore.rows.get('bookings/A').status, 'cancelled');
  assert.equal(cancelStore.rows.get('bookings/A').rejectionReasonCode, 'conflict');
  // The previous ascending limit(300) hid the newest booking after 300 entries.
  const all = Array.from({ length: 301 }, (_, index) => ({ id: 'b' + index, data: () => ({ preferredDate: '2026-10-30', preferredTime: '20:00', customerName: '顧客' + index, status: 'confirmed' }) }));
  const list = context(source('assets/admin-firebase.js'), {
    collection: () => ({}), orderBy: (field, order) => ({ field, order }), limit: count => ({ count }),
    query: (...parts) => parts, onSnapshot: (parts, callback) => { const size = parts.find(p => p.count)?.count || all.length; callback({ docs: all.slice(0, size) }); return () => {}; },
  });
  vm.runInContext('auth={currentUser:{uid:"admin-test"}}',list);
  await list.showAdminDashboard(adminRoot);
  assert.match(rows.innerHTML, /顧客300/);
  // The existing label-renaming observer runs before sidebar binding.
  let click, view;
  const serviceLink = { textContent: '服務管理', dataset: {}, classList: { add() {}, remove() {} }, addEventListener: (_event, handler) => { click = handler; } };
  const sidebar = { querySelectorAll: () => [serviceLink] };
  const navDocument = documentStub(); navDocument.querySelector = selector => selector === 'body.admin-page #admin-preview' ? { querySelector: () => sidebar } : null;
  const navigation = context(source('assets/admin-core.js'), { document: navDocument });
  navigation.renderView = value => { view = value; };
  navigation.bindSidebar(); assert.equal(typeof click, 'function');
  click({ preventDefault() {}, stopImmediatePropagation() {} }); assert.equal(view, 'services');

  // Same customer and start time on different dates must use each booking's ID.
  for (const file of ['assets/admin-time-range.js', 'assets/admin-critical-preserve.js']) {
    const name = '<img src=x onerror=alert(1)>', label = element(); label.textContent = '20:00 ' + name;
    const month = { ...element(), dataset: { bookingId: 'B' }, textContent: label.textContent };
    const bold = { ...element(), textContent: '20:00' };
    const card = { dataset: { bookingId: 'B' }, querySelector: s => ({ b: bold, span: { textContent: name }, small: { textContent: '保養 · 已確認' } }[s]) };
    const doc = documentStub(); doc.querySelectorAll = s => s === '.cal-booking' ? [card] : s === '.month-event' ? [month] : [];
    const c = context(source(file), { document: doc });
    vm.runInContext((file.includes('critical') ? 'bookings' : 'rows') + '=' + JSON.stringify([
      { id: 'A', preferredDate: '2026-10-29', preferredTime: '20:00', customerName: name, serviceName: '保養', durationMinutes: 60 },
      { id: 'B', preferredDate: '2026-10-30', preferredTime: '20:00', customerName: name, serviceName: '保養', durationMinutes: 90 },
    ]), c);
    if (file.includes('critical')) c.preserveTimeRanges(); else c.enhanceCalendar();
    assert.equal(bold.textContent, '20:00–21:30', file);
    assert.match(month.innerHTML, /20:00–21:30/); assert.doesNotMatch(month.innerHTML, /<img/);
  }

  // Delay OCR, attempt save, finish OCR, then delay save and attempt another scan.
  const pageSource = read('assets/customer-record-page.js');
  const scanAndSave = pageSource.slice(pageSource.indexOf('function setScanning('), pageSource.indexOf('async function boot('));
  const saveButton = element(), pageHost = { querySelector: () => saveButton };
  const nodes = new Map(); const doc = { querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, element()); return nodes.get(selector); }, querySelectorAll: () => [] };
  let finishScan, finishSave, calls = 0, persisted, latest, messages = [];
  const scan = context('let scanning=false,saving=false,saved=false,activeFile="",lastFailedFile="",dirty=true,sourceStopped=false,sourcePolling=false,sourceSession="s",sourceFailures=0,pollTimer=null;const recognized=new Map();' + scanAndSave, {
    document: doc, host: pageHost, endpoint: 'test', user: { getIdToken: async () => 'token' }, recordId: 'paper_test', db: {},
    sourceStatus() {}, message: value => messages.push(value), closeSource() {},
    operationErrorText: error => error.message, recordFields: text => ({ name: text }),
    recordRequest: async () => { calls++; return new Promise(resolve => { finishScan = resolve; }); },
    editor: { apply: values => { latest = values; }, data: () => latest, signature: '', setBusy() {}, load() {} },
    saveCustomerRecord: async (_db, _user, _id, data) => { persisted = structuredClone(data); return new Promise(resolve => { finishSave = resolve; }); },
  });
  const scanning = scan.scanSource('one'); await Promise.resolve(); await Promise.resolve();
  assert.equal(saveButton.disabled, true); await scan.save(); assert.equal(persisted, undefined);
  assert.match(messages.at(-1), /正在辨識/);
  finishScan({ text: '辨識結果' }); await scanning; assert.equal(saveButton.disabled, false);
  const saving = scan.save(); await scan.scanSource('two'); assert.equal(calls, 1);
  assert.deepEqual(persisted, { name: '辨識結果' }); finishSave({ id: 'paper_test' }); await saving;
  console.log('PASS: lock ownership and stale actions; editor catalog/duration/payment/concurrency; escaped admin HTML; 301 bookings; calendar identity; OCR/save race.');
})().catch(error => { console.error(error); process.exitCode = 1; });
