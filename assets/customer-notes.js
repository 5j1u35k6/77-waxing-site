import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export async function customerProfileId(key) {
  if (!String(key || '').trim()) throw new Error('找不到顧客識別資料，請重新開啟。');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)));
  return 'profile_' + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}

// Profiles share the existing admin-only customers collection. Paper records
// remain immutable, and registration / booking never replaces these profiles.
export async function saveCustomerNote(db, user, customer, expectedRevision, value) {
  if (!user || user.isAnonymous) throw new Error('請先登入管理員帳號。');
  const text = String(value || '').trim();
  if (text.length > 2000) throw new Error('備註最多可填寫 2,000 字。');
  const ref = doc(db, 'customers', await customerProfileId(customer.key));
  const revision = crypto.randomUUID();
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref), saved = snapshot.exists() ? snapshot.data() : {};
    if (String(saved.storeNote || '') === text) return;
    if (String(saved.noteRevision || '') !== String(expectedRevision || '')) {
      throw new Error('這份備註已由其他管理員更新。請先重新讀取，再核對內容。');
    }
    transaction.set(ref, {
      kind: 'customer_profile', customerKey: customer.key,
      name: customer.name || '', phone: customer.phone || '', email: customer.email || '',
      storeNote: text, noteRevision: revision, updatedAt: serverTimestamp(),
      storeNoteHistory: { [revision]: {
        before: String(saved.storeNote || ''), after: text,
        editorUid: user.uid, editorName: user.displayName || user.email || '管理員',
        editedAt: serverTimestamp(),
      } },
    }, { merge: true });
  });
  const verified = await getDocFromServer(ref);
  if (!verified.exists() && !text) return {};
  if (!verified.exists() || String(verified.data().storeNote || '') !== text) {
    throw new Error('尚未確認儲存結果，請保留內容並再試一次。');
  }
  return verified.data();
}

let openGeneration = 0;
export function clearCustomerNotes() { openGeneration++; }
export async function mountCustomerNotes(host, db, auth, customer) {
  const generation = ++openGeneration, uid = auth.currentUser?.uid;
  const section = document.createElement('section'); section.className = 'customer-notes';
  section.innerHTML = '<h4>店家備註</h4><p class="muted">僅供店家內部使用，會員頁面不會顯示。</p><label>備註內容<textarea maxlength="2000" rows="4" data-store-note disabled></textarea></label><div class="actions"><button type="button" class="btn dark" data-save-note disabled>儲存備註</button><button type="button" class="btn" data-reload-note>重新讀取</button><span role="status" data-note-status>讀取備註中…</span></div><details><summary>備註編輯歷史</summary><div data-note-history></div></details>';
  host.querySelector('.admin-customer-contact')?.after(section);
  if (!section.isConnected) host.append(section);
  const field = section.querySelector('[data-store-note]'), save = section.querySelector('[data-save-note]');
  const reload = section.querySelector('[data-reload-note]'), status = section.querySelector('[data-note-status]');
  let revision = '', ready = false, busy = false;
  const active = () => generation === openGeneration && uid && auth.currentUser?.uid === uid && section.isConnected && !host.closest('[data-customer-history-modal],[data-admin-customer-modal]')?.hidden;
  const paint = data => {
    revision = String(data.noteRevision || ''); field.value = String(data.storeNote || '');section.dataset.savedNote=field.value;
    const history = section.querySelector('[data-note-history]'); history.replaceChildren();
    const rows = Object.values(data.storeNoteHistory || {}).sort((a, b) => (b.editedAt?.seconds || 0) - (a.editedAt?.seconds || 0));
    if (!rows.length) { const empty = document.createElement('p'); empty.textContent = '目前沒有編輯紀錄。'; history.append(empty); }
    for (const row of rows) {
      const article = document.createElement('article'), title = document.createElement('small'), before = document.createElement('p'), after = document.createElement('p');
      const date = row.editedAt?.toDate?.();
      title.textContent = `${date ? new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', dateStyle:'short', timeStyle:'medium' }).format(date) : '時間待確認'} · ${row.editorName || '管理員'}`;
      before.textContent = `修改前：${row.before || '（空白）'}`; after.textContent = `修改後：${row.after || '（空白）'}`;
      article.append(title, before, after); history.append(article);
    }
  };
  const load = async () => {
    if (busy) return; busy = true; save.disabled = field.disabled = reload.disabled = true; status.textContent = '讀取備註中…';
    try {
      const ref = doc(db, 'customers', await customerProfileId(customer.key));
      const snapshot = await getDocFromServer(ref); if (!active()) return;
      paint(snapshot.exists() ? snapshot.data() : {}); ready = true; status.textContent = '';
    } catch (error) { if (active()) { ready = false; status.textContent = '無法讀取備註，請重新讀取。'; } }
    finally { busy = false; if (active()) { save.disabled = field.disabled = !ready; reload.disabled = false; } }
  };
  reload.onclick = () => { if (!ready || field.value.trim() === String(section.dataset.savedNote || '') || confirm('重新讀取會取代尚未儲存的內容，確定要繼續嗎？')) load(); };
  save.onclick = async () => {
    if (!ready || busy || !active()) return; busy = true; save.disabled = field.disabled = reload.disabled = true; status.textContent = '儲存備註中…';
    try {
      const data = await saveCustomerNote(db, auth.currentUser, customer, revision, field.value);
      if (!active()) return; paint(data); section.dataset.savedNote = String(data.storeNote || ''); status.textContent = '備註已儲存。';
    } catch (error) { if (active()) status.textContent = /[\u3400-\u9fff]/.test(error.message || '') ? error.message : '儲存未完成，內容已保留，請稍後再試。'; }
    finally { busy = false; if (active()) save.disabled = field.disabled = reload.disabled = false; }
  };
  await load(); if (active() && ready) section.dataset.savedNote = field.value;
}
