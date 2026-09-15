import {
  browserLocalPersistence,
  setPersistence,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getPublicFirebase } from "./public-firebase.js?v=20260912-1330";

const { auth, db } = getPublicFirebase();
const PROXY_URL = "https://77waxing-line-auth-proxy.max19450.workers.dev/";
const PENDING_TARGET_KEY = "77waxing_member_pending_target";
const HOME = "https://5j1u35k6.github.io/77-waxing-site/";
const VERSION = "20260915-whatsapp-ui1";

const COUNTRIES = [
  { name: "Taiwan", dial: "+886", placeholder: "0912345678", min: 10, max: 10 },
  { name: "Hong Kong", dial: "+852", placeholder: "91234567", min: 8, max: 8 },
  { name: "Japan", dial: "+81", placeholder: "09012345678", min: 10, max: 11 },
  { name: "South Korea", dial: "+82", placeholder: "01012345678", min: 10, max: 11 },
  { name: "Singapore", dial: "+65", placeholder: "81234567", min: 8, max: 8 },
  { name: "Malaysia", dial: "+60", placeholder: "0123456789", min: 9, max: 11 },
  { name: "Thailand", dial: "+66", placeholder: "0812345678", min: 9, max: 10 },
  { name: "Australia", dial: "+61", placeholder: "0412345678", min: 9, max: 10 },
  { name: "United Kingdom", dial: "+44", placeholder: "07123456789", min: 10, max: 11 },
  { name: "United States / Canada", dial: "+1", placeholder: "4155550123", min: 10, max: 10 },
];

function injectStyles() {
  if (document.querySelector('style[data-whatsapp-auth-ui="1"]')) return;
  const style = document.createElement("style");
  style.dataset.whatsappAuthUi = "1";
  style.textContent = `
    .member-whatsapp-panel[hidden]{display:none!important}
    .member-whatsapp-panel{display:grid;gap:14px;margin-top:4px}
    .member-whatsapp-back{justify-self:start;border:0;background:none;padding:0;color:#7d705d;font:inherit;font-size:12px;cursor:pointer}
    .member-whatsapp-field{display:grid;gap:7px;font-size:12px;font-weight:700;color:#554c45}
    .member-whatsapp-phone{display:grid;grid-template-columns:minmax(150px,42%) minmax(0,1fr);border:1px solid #e5ddd2;border-radius:14px;overflow:hidden;background:#fff}
    .member-whatsapp-phone select,.member-whatsapp-phone input{width:100%;height:52px;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;outline:0;padding:0 13px;color:#342f2b}
    .member-whatsapp-phone select{border-right:1px solid #eee5da!important;font-size:12px;font-weight:650}
    .member-whatsapp-phone:focus-within{border-color:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.10)}
    .member-whatsapp-primary{width:100%;min-height:52px;border:0;border-radius:14px;background:#25d366;color:#fff;font:inherit;font-weight:750;cursor:pointer}
    .member-whatsapp-primary:disabled{opacity:.48;cursor:wait}
    .member-whatsapp-code[hidden]{display:none!important}
    .member-whatsapp-code{display:grid;gap:12px;padding-top:4px}
    .member-whatsapp-code input{width:100%;height:54px;border:1px solid #e5ddd2;border-radius:14px;background:#fff;padding:0 15px;text-align:center;font-size:22px;font-weight:750;letter-spacing:.28em;font-variant-numeric:tabular-nums;outline:0}
    .member-whatsapp-code input:focus{border-color:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.10)}
    .member-whatsapp-hint{margin:0;color:#85786d;font-size:11px;line-height:1.65}
    @media(max-width:520px){.member-whatsapp-phone{grid-template-columns:145px minmax(0,1fr)}.member-whatsapp-phone select,.member-whatsapp-phone input{height:50px;padding:0 10px}}
  `;
  document.head.appendChild(style);
}

function modal() {
  return document.querySelector("#member-auth-wrap");
}

function statusElement() {
  return modal()?.querySelector("[data-member-auth-status]") || null;
}

function setStatus(message = "", state = "") {
  const el = statusElement();
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}

function safeTarget(value) {
  const text = String(value || "").trim();
  return text.startsWith(HOME) ? text : location.href;
}

function pendingTarget() {
  try { return safeTarget(sessionStorage.getItem(PENDING_TARGET_KEY) || location.href); } catch { return location.href; }
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function selectedCountry(panel) {
  const dial = panel.querySelector("[data-whatsapp-country]")?.value || "+886";
  return COUNTRIES.find((entry) => entry.dial === dial) || COUNTRIES[0];
}

function syncPhoneInput(panel) {
  const country = selectedCountry(panel);
  const input = panel.querySelector("[data-whatsapp-phone]");
  if (!input) return;
  input.placeholder = country.placeholder;
  input.maxLength = country.max;
  input.value = digits(input.value).slice(0, country.max);
}

function ensurePanel() {
  injectStyles();
  const wrap = modal();
  const card = wrap?.querySelector(".member-auth-card");
  if (!card) return null;
  let panel = card.querySelector("[data-whatsapp-panel]");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.className = "member-whatsapp-panel";
  panel.dataset.whatsappPanel = "1";
  panel.hidden = true;
  panel.innerHTML = `
    <button type="button" class="member-whatsapp-back" data-whatsapp-back>← 其他登入方式</button>
    <label class="member-whatsapp-field">WhatsApp 手機號碼
      <div class="member-whatsapp-phone">
        <select data-whatsapp-country aria-label="國際冠碼">
          ${COUNTRIES.map((country) => `<option value="${country.dial}" ${country.dial === "+886" ? "selected" : ""}>${country.name} (${country.dial})</option>`).join("")}
        </select>
        <input data-whatsapp-phone inputmode="numeric" autocomplete="tel-national" placeholder="0912345678" aria-label="WhatsApp 手機號碼">
      </div>
    </label>
    <button type="button" class="member-whatsapp-primary" data-whatsapp-send>傳送 WhatsApp 驗證碼</button>
    <p class="member-whatsapp-hint">驗證碼會傳到你輸入的 WhatsApp 帳號。完成驗證後會直接建立或登入 77waxing 會員。</p>
    <div class="member-whatsapp-code" data-whatsapp-code-wrap hidden>
      <label class="member-whatsapp-field">6 位數驗證碼
        <input data-whatsapp-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="WhatsApp 驗證碼">
      </label>
      <button type="button" class="member-whatsapp-primary" data-whatsapp-verify>驗證並登入</button>
    </div>`;

  const actions = card.querySelector(".member-auth-actions");
  actions?.insertAdjacentElement("afterend", panel);
  panel.querySelector("[data-whatsapp-country]")?.addEventListener("change", () => syncPhoneInput(panel));
  panel.querySelector("[data-whatsapp-phone]")?.addEventListener("input", () => syncPhoneInput(panel));
  panel.querySelector("[data-whatsapp-code]")?.addEventListener("input", (event) => {
    event.target.value = digits(event.target.value).slice(0, 6);
  });
  return panel;
}

function openWhatsAppPanel() {
  const wrap = modal();
  const panel = ensurePanel();
  if (!wrap || !panel) return;
  const card = wrap.querySelector(".member-auth-card");
  const title = card?.querySelector("#member-auth-title");
  const copy = card?.querySelector("[data-member-auth-copy]");
  const actions = card?.querySelector(".member-auth-actions");
  if (card && !card.dataset.whatsappOriginalTitle) card.dataset.whatsappOriginalTitle = title?.textContent || "登入 / 註冊";
  if (card && !card.dataset.whatsappOriginalCopy) card.dataset.whatsappOriginalCopy = copy?.textContent || "";
  if (title) title.textContent = "WhatsApp 登入";
  if (copy) copy.textContent = "輸入 WhatsApp 綁定的手機號碼，我們會傳送一次性驗證碼。";
  if (actions) actions.hidden = true;
  panel.hidden = false;
  setStatus("");
  setTimeout(() => panel.querySelector("[data-whatsapp-phone]")?.focus(), 0);
}

function resetWhatsAppPanel() {
  const wrap = modal();
  const card = wrap?.querySelector(".member-auth-card");
  const panel = card?.querySelector("[data-whatsapp-panel]");
  const actions = card?.querySelector(".member-auth-actions");
  const title = card?.querySelector("#member-auth-title");
  const copy = card?.querySelector("[data-member-auth-copy]");
  if (panel) {
    panel.hidden = true;
    panel.dataset.challengeId = "";
    panel.dataset.phone = "";
    panel.dataset.countryName = "";
    const codeWrap = panel.querySelector("[data-whatsapp-code-wrap]");
    if (codeWrap) codeWrap.hidden = true;
    const code = panel.querySelector("[data-whatsapp-code]");
    if (code) code.value = "";
  }
  if (actions) actions.hidden = false;
  if (title && card?.dataset.whatsappOriginalTitle) title.textContent = card.dataset.whatsappOriginalTitle;
  if (copy && card?.dataset.whatsappOriginalCopy) copy.textContent = card.dataset.whatsappOriginalCopy;
  if (card) {
    delete card.dataset.whatsappOriginalTitle;
    delete card.dataset.whatsappOriginalCopy;
  }
  setStatus("");
}

async function proxyRequest(payload) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    const code = String(result?.error || `proxy_http_${response.status}`);
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return result;
}

function backendErrorText(code) {
  if (["invalid_action", "whatsapp_not_configured", "whatsapp_backend_not_ready"].includes(code)) {
    return "WhatsApp 驗證服務正在設定中，請稍後再試。";
  }
  if (code === "rate_limited") return "驗證碼傳送次數過多，請稍後再試。";
  if (code === "invalid_phone") return "請確認 WhatsApp 手機號碼是否正確。";
  if (code === "invalid_code" || code === "code_mismatch") return "驗證碼不正確，請重新輸入。";
  if (code === "code_expired") return "驗證碼已過期，請重新傳送。";
  return `WhatsApp 驗證目前無法使用（${code}）。`;
}

async function sendWhatsAppCode(panel) {
  const country = selectedCountry(panel);
  const phone = digits(panel.querySelector("[data-whatsapp-phone]")?.value);
  if (phone.length < country.min || phone.length > country.max) {
    setStatus(`請輸入正確的 ${country.name} 手機號碼。`, "error");
    return;
  }
  const button = panel.querySelector("[data-whatsapp-send]");
  button.disabled = true;
  setStatus("正在傳送 WhatsApp 驗證碼…");
  try {
    const result = await proxyRequest({
      action: "whatsapp_start",
      countryCode: country.dial,
      countryName: country.name,
      phone,
      target: pendingTarget(),
    });
    const challengeId = String(result.challengeId || "").trim();
    if (!challengeId) throw Object.assign(new Error("challenge_missing"), { code: "challenge_missing" });
    panel.dataset.challengeId = challengeId;
    panel.dataset.phone = phone;
    panel.dataset.countryName = country.name;
    panel.dataset.countryDial = country.dial;
    const codeWrap = panel.querySelector("[data-whatsapp-code-wrap]");
    if (codeWrap) codeWrap.hidden = false;
    setStatus("驗證碼已傳送到 WhatsApp，請輸入 6 位數驗證碼。", "success");
    setTimeout(() => panel.querySelector("[data-whatsapp-code]")?.focus(), 0);
  } catch (error) {
    const code = String(error?.code || error?.message || "send_failed");
    console.error("WhatsApp verification start failed", error);
    setStatus(backendErrorText(code), "error");
  } finally {
    button.disabled = false;
  }
}

async function verifyWhatsAppCode(panel) {
  const challengeId = String(panel.dataset.challengeId || "").trim();
  const code = digits(panel.querySelector("[data-whatsapp-code]")?.value).slice(0, 6);
  if (!challengeId) {
    setStatus("請先傳送 WhatsApp 驗證碼。", "error");
    return;
  }
  if (code.length !== 6) {
    setStatus("請輸入 6 位數 WhatsApp 驗證碼。", "error");
    return;
  }

  const button = panel.querySelector("[data-whatsapp-verify]");
  button.disabled = true;
  setStatus("正在驗證 WhatsApp…");
  try {
    const target = pendingTarget();
    const result = await proxyRequest({ action: "whatsapp_verify", challengeId, code, target });
    const customToken = String(result.customToken || "").trim();
    if (!customToken) throw Object.assign(new Error("custom_token_missing"), { code: "custom_token_missing" });

    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithCustomToken(auth, customToken);
    if (!credential?.user || credential.user.isAnonymous) throw new Error("WHATSAPP_CUSTOM_SIGNIN_EMPTY");
    await credential.user.getIdToken(true);

    const phone = String(panel.dataset.phone || "").trim();
    const countryName = String(panel.dataset.countryName || "Taiwan").trim();
    const countryDial = String(panel.dataset.countryDial || "+886").trim();
    const phoneE164 = String(result.phoneE164 || result.phone || "").trim();
    try {
      await setDoc(doc(db, "memberProfiles", credential.user.uid), {
        uid: credential.user.uid,
        provider: "WhatsApp",
        ...(phone ? { phone } : {}),
        phoneCountry: countryName,
        ...(phoneE164 ? { whatsappPhone: phoneE164 } : { whatsappPhone: `${countryDial}${phone}` }),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (profileError) {
      console.warn("WhatsApp member profile write unavailable", profileError);
    }

    try { sessionStorage.removeItem(PENDING_TARGET_KEY); } catch {}
    setStatus("WhatsApp 登入成功，正在載入會員資料…", "success");
    window.dispatchEvent(new CustomEvent("77waxing:whatsapp-login-complete", { detail: { user: credential.user } }));
    setTimeout(() => {
      const destination = safeTarget(target);
      if (destination === location.href) location.reload();
      else location.assign(destination);
    }, 180);
  } catch (error) {
    const code = String(error?.code || error?.message || "verify_failed");
    console.error("WhatsApp verification failed", error);
    if (code.startsWith("auth/") || code === "WHATSAPP_CUSTOM_SIGNIN_EMPTY") {
      setStatus(`WhatsApp 已驗證，但 Firebase 會員登入失敗（${code}）。`, "error");
    } else {
      setStatus(backendErrorText(code), "error");
    }
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("click", (event) => {
  const provider = event.target.closest?.('[data-member-provider="whatsapp"]');
  if (provider) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openWhatsAppPanel();
    return;
  }

  const back = event.target.closest?.("[data-whatsapp-back]");
  if (back) {
    event.preventDefault();
    event.stopImmediatePropagation();
    resetWhatsAppPanel();
    return;
  }

  const send = event.target.closest?.("[data-whatsapp-send]");
  if (send) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const panel = send.closest("[data-whatsapp-panel]");
    if (panel) sendWhatsAppCode(panel);
    return;
  }

  const verify = event.target.closest?.("[data-whatsapp-verify]");
  if (verify) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const panel = verify.closest("[data-whatsapp-panel]");
    if (panel) verifyWhatsAppCode(panel);
    return;
  }

  if (event.target.closest?.("[data-member-auth-close]")) resetWhatsAppPanel();
}, true);

window.__77_WHATSAPP_AUTH_UI__ = {
  version: VERSION,
  open: openWhatsAppPanel,
  reset: resetWhatsAppPanel,
};
