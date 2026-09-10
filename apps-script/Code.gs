const PROJECT_ID = 'waxing-86909';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const STORE_EMAIL = '77waxing.mail@gmail.com';
const SCRIPT_VERSION = '2026-09-10-email-v14';
const WEBSITE_URL = 'https://5j1u35k6.github.io/77-waxing-site/';
const EMAIL_FOOTER_IMAGE = 'https://5j1u35k6.github.io/77-waxing-site/assets/email-footer-77waxing.jpg?v=20260910-1555';

function senderStatus_() {
  const effectiveEmail = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  let aliases = [];
  try {
    aliases = GmailApp.getAliases().map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  } catch (err) {
    aliases = [];
  }
  const target = STORE_EMAIL.toLowerCase();
  return {
    effectiveEmail,
    aliases,
    canSendAsStore: !effectiveEmail || effectiveEmail === target || aliases.includes(target),
  };
}

function senderOptions_() {
  const status = senderStatus_();
  const target = STORE_EMAIL.toLowerCase();
  if (status.effectiveEmail && status.effectiveEmail !== target && !status.aliases.includes(target)) {
    throw new Error(`WRONG_GAS_SENDER:${status.effectiveEmail}. Please deploy/authorize this Apps Script as ${STORE_EMAIL}.`);
  }
  const options = {
    name: '77waxing',
    replyTo: STORE_EMAIL,
  };
  if (status.effectiveEmail !== target && status.aliases.includes(target)) {
    options.from = STORE_EMAIL;
  }
  return options;
}

function doGet() {
  const sender = senderStatus_();
  return json_({
    ok: true,
    service: '77waxing-email',
    version: SCRIPT_VERSION,
    storeEmail: STORE_EMAIL,
    effectiveSender: sender.effectiveEmail || null,
    canSendAsStore: sender.canSendAsStore,
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
  });
}

function testSelfEmail() {
  send_(
    STORE_EMAIL,
    '77waxing｜Email 系統測試成功',
    shell_('Email 系統測試成功', '<p>如果你收到這封信，代表 Google Apps Script 已使用 77waxing 店家信箱寄信。</p>')
  );
  return `sent:${STORE_EMAIL}`;
}

function testFooterInline() {
  send_(
    STORE_EMAIL,
    '77waxing｜Footer 手機文字放大測試',
    shell_('Footer 手機文字放大測試', '<p>請用手機 Gmail 檢視最下方：山海畫面保留，但 Logo、品牌標語與地址已改成獨立 HTML 文字，因此手機可單獨放大而不需要把整張圖片一起放大。</p>')
  );
  return `footer-mobile-html-copy-sent:${STORE_EMAIL}`;
}

function debugFooterAsset() {
  const result = {
    mode: 'external-artwork-html-copy-footer',
    hasInlineImage: false,
    imageUrl: EMAIL_FOOTER_IMAGE,
    version: SCRIPT_VERSION,
  };
  console.log(JSON.stringify(result));
  return result;
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
  const storeEmail = String(s.storeEmail || STORE_EMAIL).trim() || STORE_EMAIL;
  const status = String(b.status || '');
  const customerName = String(b.customerName || '顧客').trim() || '顧客';
  let sent = false;

  if (status === 'pending_confirmation') {
    if (customerEmail) {
      const title = `您好 ${customerName}，已收到你的預約`;
      const body = `<p>你的預約需求已送出，這是您這次的預約明細。</p>
        ${bookingInfo_(b)}
        <p>77waxing確認完成後，我們會再寄一封 Email 通知你。</p>
        <p>若預約資訊需要調整，也可以直接與 77waxing 聯繫。</p>`;
      send_(customerEmail, '77waxing｜已收到你的預約需求', shell_(title, body));
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
    const amount = b.depositAmount ? `NT$${esc_(b.depositAmount)}` : 'NT$—';
    const qr = s.depositQrUrl
      ? `<div style="margin:20px 0"><p style="margin:0 0 12px"><b>請完成訂金：${amount}</b></p><img src="${esc_(s.depositQrUrl)}" alt="訂金 QR Code" style="display:block;max-width:240px;width:100%;height:auto;border-radius:12px"></div>`
      : `<p><b>請完成訂金：${amount}</b></p>`;
    const title = `您好 ${customerName}，你的預約可安排｜等待支付定金`;
    const body = `<p>77waxing已確認可以安排這次預約，請依下方資訊完成定金。</p>
      ${bookingInfo_(b)}
      ${qr}`;
    send_(customerEmail, '77waxing｜預約已確認，請支付定金', shell_(title, body));
    return true;
  }

  if (status === 'confirmed') {
    const title = `您好 ${customerName}，預約已確認`;
    const body = `<p>77waxing已確認可以安排這次預約，無需支付定金。</p>
      ${bookingInfo_(b)}
      <p>好期待到時見到你呀 ♡</p>`;
    send_(customerEmail, '77waxing｜預約已確認', shell_(title, body));
    return true;
  }

  if (status === 'cancelled' && b.rejectionReasonCode) {
    const title = `您好 ${customerName}，這次預約無法安排`;
    const body = `<p>${esc_(rejectionText_(b))}</p>
      ${bookingInfo_(b)}
      <p>多謝你嘅理解。</p>`;
    send_(customerEmail, '77waxing｜預約安排通知', shell_(title, body));
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

function footerHtml_() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-footer-frame" style="width:100%;height:146px;border-collapse:separate;border-spacing:0;margin:0;padding:0;background:#2f2a28;border-radius:14px;overflow:hidden">
    <tr>
      <td class="email-footer-copy" width="58%" valign="middle" style="width:58%;height:146px;padding:16px 12px 14px 20px;margin:0;border:0;background:#2f2a28;color:#f7f0e6;vertical-align:middle">
        <a href="${WEBSITE_URL}" target="_blank" aria-label="前往 77waxing 官方網站" style="display:block;color:#f7f0e6;text-decoration:none;border:0">
          <div class="email-footer-logo" style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.05;white-space:nowrap;margin:0 0 8px"><span style="color:#c5a070">77</span><span style="color:#f7f0e6">waxing</span></div>
          <div class="email-footer-studio" style="font-size:9px;line-height:1.35;letter-spacing:.18em;color:#d8cbbb;margin:0 0 9px">77美學工作室</div>
          <div class="email-footer-tagline" style="font-family:Georgia,'Noto Serif TC','PingFang TC',serif;font-size:15px;line-height:1.45;color:#dfc6a5;margin:0 0 9px">把第一次的緊張，<br>交給77的細心與溫柔。</div>
          <div class="email-footer-address" style="font-size:10px;line-height:1.45;color:#e8dfd4">● 基隆市中正區義一路56號2樓</div>
        </a>
      </td>
      <td class="email-footer-art" width="42%" height="146" valign="middle" style="width:42%;height:146px;padding:0;margin:0;border:0;line-height:0;font-size:0;background:#2f2a28;overflow:hidden;vertical-align:middle">
        <a href="${WEBSITE_URL}" target="_blank" aria-label="前往 77waxing 官方網站" style="display:block;width:100%;height:146px;padding:0;margin:0;text-decoration:none;border:0;line-height:0;font-size:0;overflow:hidden;background:#2f2a28">
          <img class="email-footer-art-image" src="${EMAIL_FOOTER_IMAGE}" width="286" height="146" alt="" style="display:block;width:100%;height:146px;object-fit:cover;object-position:82% center;border:0;margin:0;padding:0;line-height:0;font-size:0;background:#2f2a28">
        </a>
      </td>
    </tr>
  </table>`;
}

function send_(to, subject, html) {
  const options = senderOptions_();
  options.htmlBody = html;
  GmailApp.sendEmail(to, subject, htmlToText_(html), options);
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

function displayDate_(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.replace(/-/g, '/') : (raw || '—');
}

function bookingInfo_(b) {
  return `<div style="margin:22px 0;padding:18px 20px;background:#f9f6f0;border-radius:14px">
    <div style="font-size:13px;font-weight:700;letter-spacing:.08em;margin-bottom:12px">預約資訊</div>
    ${infoLine_('日期', displayDate_(b.preferredDate))}
    ${infoLine_('時間', serviceRange_(b))}
    ${infoLine_('項目', b.serviceName || '—')}
    ${infoLine_('姓名', b.customerName || '—')}
  </div>`;
}

function infoLine_(label, value) {
  return `<div style="margin:7px 0;line-height:1.7"><span style="display:inline-block;min-width:52px;color:#777">${esc_(label)}｜</span><span>${esc_(value)}</span></div>`;
}

function bookingTable_(b) {
  return `<table style="border-collapse:collapse;margin:16px 0">${line_('日期', b.preferredDate || '—')}${line_('時間', serviceRange_(b))}${line_('服務', b.serviceName || '—')}${line_('姓名', b.customerName || '—')}</table>`;
}

function rejectionText_(b) {
  const code = b.rejectionReasonCode || 'other';
  if (code === 'conflict') return '目前該時段已有安排，這次無法接受此預約。';
  if (code === 'reschedule') return '目前需要調整預約時間，請重新選擇其他可預約時段。';
  if (code === 'safety_or_fit') return '很抱歉，本次預約目前無法受理。如有需要，請直接與77waxing聯繫。';
  return b.rejectionPublicReason || '很抱歉，本次預約目前無法受理。';
}

function line_(label, value) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#777">${esc_(label)}</td><td style="padding:6px 0;font-weight:600">${esc_(value)}</td></tr>`;
}

function shell_(title, body) {
  return `<style type="text/css">
    @media screen and (max-width:480px) {
      .email-footer-frame,
      .email-footer-copy,
      .email-footer-art,
      .email-footer-art a,
      .email-footer-art-image { height:168px !important; }
      .email-footer-copy { width:61% !important; padding:16px 8px 14px 16px !important; }
      .email-footer-art { width:39% !important; }
      .email-footer-logo { font-size:30px !important; margin-bottom:9px !important; }
      .email-footer-studio { font-size:10px !important; margin-bottom:10px !important; }
      .email-footer-tagline { font-size:17px !important; line-height:1.42 !important; margin-bottom:10px !important; }
      .email-footer-address { font-size:11px !important; line-height:1.4 !important; }
      .email-footer-art-image { object-position:82% center !important; }
    }
  </style>
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang TC',sans-serif;color:#3a3836;max-width:680px;margin:auto;line-height:1.75">
    <div style="padding:30px 24px 0">
      <div style="font-family:Georgia,serif;font-size:28px;margin-bottom:22px"><b style="color:#c5a070">77</b>waxing</div>
      <h2 style="font-size:20px;line-height:1.5;margin:0 0 18px">${esc_(title)}</h2>
      ${body}
    </div>
    <div style="margin:18px 0 0;padding:0;line-height:0;font-size:0">${footerHtml_()}</div>
  </div>`;
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function esc_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
