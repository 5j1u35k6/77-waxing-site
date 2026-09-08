const PROJECT_ID = 'waxing-86909';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SCRIPT_VERSION = '2026-09-08-email-v2';

function doGet() {
  return json_({
    ok: true,
    service: '77waxing-email',
    version: SCRIPT_VERSION,
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
  });
}

function testSelfEmail() {
  const to = String(Session.getEffectiveUser().getEmail() || '').trim();
  if (!to) throw new Error('Cannot determine the Google account email for this script.');
  MailApp.sendEmail({
    to,
    subject: '77美學工作室｜Email 系統測試成功',
    body: '77waxing Email 系統測試成功。',
    htmlBody: shell_('Email 系統測試成功', '<p>如果你收到這封信，代表 Google Apps Script 的寄信權限與 MailApp 都正常。</p>'),
    name: '77美學工作室',
  });
  return `sent:${to}`;
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const bookingId = String(payload.bookingId || '').trim();
    const idToken = String(payload.idToken || '').trim();
    console.log(JSON.stringify({ event: 'email_request', bookingId, hasToken: Boolean(idToken), version: SCRIPT_VERSION }));
    if (!bookingId || !idToken) return json_({ ok:false, error:'missing_data', version:SCRIPT_VERSION });

    const booking = fetchDoc_(`bookings/${encodeURIComponent(bookingId)}`, idToken, false);
    const settings = fetchDoc_('settings/general', idToken, true) || {};
    if (!booking) return json_({ ok:false, error:'booking_not_found', version:SCRIPT_VERSION });

    const key = dispatchKey_(bookingId, booking.status);
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(key) === '1') return json_({ ok:true, duplicate:true, version:SCRIPT_VERSION });

    const sent = sendForStatus_(booking, settings);
    if (sent) props.setProperty(key, '1');
    console.log(JSON.stringify({ event: 'email_result', bookingId, status: booking.status, sent }));
    return json_({ ok:true, sent, status:booking.status, version:SCRIPT_VERSION });
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    return json_({ ok:false, error:String(err && err.message || err), version:SCRIPT_VERSION });
  }
}

function dispatchKey_(bookingId, status) {
  if (status === 'pending_confirmation') return `sent:${bookingId}:created`;
  if (status === 'pending_payment') return `sent:${bookingId}:pending_payment`;
  if (status === 'confirmed') return `sent:${bookingId}:confirmed`;
  if (status === 'cancelled') return `sent:${bookingId}:cancelled`;
  return `sent:${bookingId}:${status || 'unknown'}`;
}

function sendForStatus_(b, s) {
  const customerEmail = String(b.customerEmail || '').trim();
  const storeEmail = String(s.storeEmail || '').trim();
  const status = String(b.status || '');
  let sent = false;

  if (status === 'pending_confirmation') {
    if (customerEmail) {
      send_(customerEmail, '77美學工作室｜已收到你的預約需求', shell_('已收到你的預約需求', `<p>你的預約需求已送出，目前正在等待店家確認。</p>${bookingTable_(b)}<p>確認完成後，我們會再寄一封 Email 通知你。</p>`));
      sent = true;
    }
    if (storeEmail) {
      send_(storeEmail, `新預約待確認｜${b.customerName || '未命名'}｜${b.preferredDate || ''} ${b.preferredTime || ''}`, shell_('有新的預約需求', `${bookingTable_(b)}<table style="border-collapse:collapse;margin:16px 0">${line_('手機', b.customerPhone || '—')}${line_('Email', customerEmail || '—')}</table><p>請至管理後台確認預約。</p>`));
      sent = true;
    }
    return sent;
  }

  if (!customerEmail) return false;
  if (status === 'pending_payment') {
    const amount = b.depositAmount ? ` NT$${esc_(b.depositAmount)}` : '';
    const qr = s.depositQrUrl ? `<div style="margin:18px 0"><p><b>請完成訂金：</b>${amount}</p><img src="${esc_(s.depositQrUrl)}" alt="訂金 QR Code" style="max-width:240px;width:100%;height:auto;border-radius:12px"></div>` : `<p><b>請完成訂金：</b>${amount}</p>`;
    send_(customerEmail, '77美學工作室｜預約已確認，請完成訂金', shell_('預約可安排｜等待訂金', `<p>店家已確認可以安排這次預約，請依下方資訊完成訂金。</p>${bookingTable_(b)}${qr}`));
    return true;
  }
  if (status === 'confirmed') {
    send_(customerEmail, '77美學工作室｜預約已確認', shell_('預約已確認', `<p>店家已確認可以安排這次預約。</p>${bookingTable_(b)}<p>期待見到你。</p>`));
    return true;
  }
  if (status === 'cancelled' && b.rejectionReasonCode) {
    send_(customerEmail, '77美學工作室｜預約安排通知', shell_('這次預約無法安排', `<p>${esc_(rejectionText_(b))}</p>${bookingTable_(b)}<p>謝謝你的理解。</p>`));
    return true;
  }
  return false;
}

function fetchDoc_(path, idToken, allowMissing) {
  const response = UrlFetchApp.fetch(`${FIRESTORE_BASE}/${path}`, {
    method:'get',
    headers:{ Authorization:`Bearer ${idToken}` },
    muteHttpExceptions:true,
  });
  const code = response.getResponseCode();
  if (code === 404 && allowMissing) return null;
  if (code !== 200) {
    const detail = response.getContentText().slice(0, 500);
    throw new Error(`firestore_${code}:${detail}`);
  }
  const body = JSON.parse(response.getContentText());
  return decodeMap_(body.fields || {});
}

function decodeMap_(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(k => out[k] = decodeValue_(fields[k]));
  return out;
}
function decodeValue_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue_);
  if ('mapValue' in v) return decodeMap_(v.mapValue.fields || {});
  return null;
}

function send_(to, subject, html) {
  MailApp.sendEmail({
    to,
    subject,
    body: html.replace(/<[^>]+>/g,' '),
    htmlBody: html,
    name: '77美學工作室',
  });
}
function serviceRange_(b) {
  const start = b.preferredTime || '—';
  const mins = Number(b.actualDurationMinutes || b.durationMinutes || 0);
  return mins ? `${start}–${addMinutes_(start, mins)}` : start;
}
function addMinutes_(time, amount) {
  const p = String(time || '').split(':').map(Number);
  if (p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1])) return '—';
  const total = p[0]*60+p[1]+Number(amount||0);
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
function bookingTable_(b) {
  return `<table style="border-collapse:collapse;margin:16px 0">${line_('日期', b.preferredDate || '—')}${line_('時間', serviceRange_(b))}${line_('服務', b.serviceName || '—')}${line_('姓名', b.customerName || '—')}</table>`;
}
function rejectionText_(b) {
  const code = b.rejectionReasonCode || 'other';
  if (code === 'conflict') return '目前該時段已有安排，這次無法接受此預約。';
  if (code === 'reschedule') return '目前需要調整預約時間，請重新選擇其他可預約時段。';
  if (code === 'safety_or_fit') return '很抱歉，本次預約目前無法受理。如有需要，請直接與店家聯繫。';
  return b.rejectionPublicReason || '很抱歉，本次預約目前無法受理。';
}
function line_(label, value) { return `<tr><td style="padding:6px 12px 6px 0;color:#777">${esc_(label)}</td><td style="padding:6px 0;font-weight:600">${esc_(value)}</td></tr>`; }
function shell_(title, body) { return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3a3836;max-width:620px;margin:auto;padding:28px"><div style="font-family:Georgia,serif;font-size:28px;margin-bottom:20px"><b style="color:#c5a070">77</b>waxing</div><h2 style="font-size:21px">${esc_(title)}</h2>${body}<p style="margin-top:26px;color:#777;font-size:12px">77美學工作室</p></div>`; }
function esc_(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
