const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const nodemailer = require('nodemailer');

initializeApp();
const db = getFirestore();
const smtpPassword = defineSecret('SMTP_PASSWORD');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const addMinutes = (time, amount) => {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = h * 60 + m + Number(amount || 0);
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};
const serviceRange = (b) => `${b.preferredTime || '—'}–${addMinutes(b.preferredTime, b.durationMinutes || 0) || '—'}`;
const line = (label, value) => `<tr><td style="padding:6px 12px 6px 0;color:#777">${esc(label)}</td><td style="padding:6px 0;font-weight:600">${esc(value)}</td></tr>`;
const shell = (title, body) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3a3836;max-width:620px;margin:auto;padding:28px"><div style="font-family:Georgia,serif;font-size:28px;margin-bottom:20px"><b style="color:#c5a070">77</b>waxing</div><h2 style="font-size:21px">${esc(title)}</h2>${body}<p style="margin-top:26px;color:#777;font-size:12px">77美學工作室</p></div>`;

async function settings() {
  const snap = await db.doc('settings/general').get();
  return snap.exists ? snap.data() : {};
}
function bookingTable(b) {
  return `<table style="border-collapse:collapse;margin:16px 0">${line('日期', b.preferredDate || '—')}${line('時間', serviceRange(b))}${line('服務', b.serviceName || '—')}${line('姓名', b.customerName || '—')}</table>`;
}
function rejectionText(b) {
  const code = b.rejectionReasonCode || 'other';
  if (code === 'conflict') return '目前該時段已有安排，這次無法接受此預約。';
  if (code === 'reschedule') return '目前需要調整預約時間，請重新選擇其他可預約時段。';
  if (code === 'safety_or_fit') return '很抱歉，本次預約目前無法受理。如有需要，請直接與店家聯繫。';
  return b.rejectionPublicReason || '很抱歉，本次預約目前無法受理。';
}
async function transporterAndSender() {
  const s = await settings();
  const email = String(s.storeEmail || '').trim();
  if (!email) throw new Error('STORE_EMAIL_NOT_CONFIGURED');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email, pass: smtpPassword.value() },
  });
  return { transporter, from: `77美學工作室 <${email}>`, storeEmail: email, settings: s };
}
async function sendMail(to, subject, html) {
  if (!to) return;
  const { transporter, from } = await transporterAndSender();
  await transporter.sendMail({ from, to, subject, html });
}

exports.bookingCreatedEmail = onDocumentCreated({
  document: 'bookings/{bookingId}',
  secrets: [smtpPassword],
  region: 'asia-east1',
}, async (event) => {
  const b = event.data?.data();
  if (!b) return;
  const s = await settings();
  const storeEmail = String(s.storeEmail || '').trim();
  const customerEmail = String(b.customerEmail || '').trim();
  const jobs = [];
  if (customerEmail) {
    jobs.push(sendMail(customerEmail, '77美學工作室｜已收到你的預約需求', shell('已收到你的預約需求', `<p>你的預約需求已送出，目前正在等待店家確認。</p>${bookingTable(b)}<p>確認完成後，我們會再寄一封 Email 通知你。</p>`)));
  }
  if (storeEmail) {
    jobs.push(sendMail(storeEmail, `新預約待確認｜${b.customerName || '未命名'}｜${b.preferredDate || ''} ${b.preferredTime || ''}`, shell('有新的預約需求', `${bookingTable(b)}<table style="border-collapse:collapse;margin:16px 0">${line('手機', b.customerPhone || '—')}${line('Email', customerEmail || '—')}</table><p>請至管理後台確認預約。</p>`)));
  }
  await Promise.all(jobs);
});

exports.bookingUpdatedEmail = onDocumentUpdated({
  document: 'bookings/{bookingId}',
  secrets: [smtpPassword],
  region: 'asia-east1',
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;
  const customerEmail = String(after.customerEmail || '').trim();
  if (!customerEmail) return;
  const s = await settings();

  if (after.status === 'pending_payment' || after.status === 'confirmed') {
    const needsDeposit = after.depositRequired === true && after.status === 'pending_payment';
    const qr = needsDeposit && s.depositQrUrl ? `<div style="margin:18px 0"><p><b>請完成訂金：</b>${after.depositAmount ? ` NT$${esc(after.depositAmount)}` : ''}</p><img src="${esc(s.depositQrUrl)}" alt="訂金 QR Code" style="max-width:240px;width:100%;height:auto;border-radius:12px"></div>` : '';
    const body = needsDeposit
      ? `<p>店家已確認可以安排這次預約，請依下方資訊完成訂金。完成後店家會再確認付款狀態。</p>${bookingTable(after)}${qr}`
      : `<p>店家已確認可以安排這次預約。</p>${bookingTable(after)}<p>期待見到你。</p>`;
    await sendMail(customerEmail, needsDeposit ? '77美學工作室｜預約已確認，請完成訂金' : '77美學工作室｜預約已確認', shell(needsDeposit ? '預約可安排｜等待訂金' : '預約已確認', body));
  }

  if (after.status === 'cancelled' && after.rejectionReasonCode) {
    await sendMail(customerEmail, '77美學工作室｜預約安排通知', shell('這次預約無法安排', `<p>${esc(rejectionText(after))}</p>${bookingTable(after)}<p>謝謝你的理解。</p>`));
  }
});
