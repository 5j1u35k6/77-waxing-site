const FORM_SELECTOR = "#product-form";
const ADMIN_MESSAGE_SELECTOR = "#admin-message";
const ERROR_COLOR = "#a64b43";

function isProductFormTarget(target) {
  return Boolean(target?.closest?.(FORM_SELECTOR));
}

function shouldAllowEnter(target) {
  if (!target) return false;
  if (target.closest?.("textarea")) return true;
  if (target.isContentEditable) return true;
  return false;
}

function popup(message) {
  const text = String(message || "").trim();
  if (!text) return;
  window.alert(text);
}

function showAdminMessage(message, type = "error") {
  if (type === "error") {
    popup(message);
    const el = document.querySelector(ADMIN_MESSAGE_SELECTOR);
    if (el) el.textContent = "";
    return;
  }
  const el = document.querySelector(ADMIN_MESSAGE_SELECTOR);
  if (!el) return;
  el.textContent = message;
  el.style.color = "#55745b";
}

function prepareProductForm(form) {
  if (!form || form.dataset.submitGuard === "1") return;
  form.noValidate = true;
  form.setAttribute("novalidate", "");
  form.dataset.submitGuard = "1";
}

function installAdminMessagePopup() {
  const el = document.querySelector(ADMIN_MESSAGE_SELECTOR);
  if (!el || el.dataset.popupGuard === "1") return;
  el.dataset.popupGuard = "1";
  let lastText = "";

  const observer = new MutationObserver(() => {
    const text = el.textContent.trim();
    const color = String(el.style.color || "").toLowerCase();
    const isError = color === ERROR_COLOR || color.includes("166") || color.includes("75") || color.includes("67");
    if (!text || !isError || text === lastText) return;
    lastText = text;
    el.textContent = "";
    popup(text);
    setTimeout(() => { lastText = ""; }, 600);
  });

  observer.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["style"] });
}

function refresh() {
  prepareProductForm(document.querySelector(FORM_SELECTOR));
  installAdminMessagePopup();
}

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true });
refresh();

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) return;
  if (!isProductFormTarget(event.target)) return;
  if (shouldAllowEnter(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest?.(`${FORM_SELECTOR} button[type="submit"]`);
  if (!button) return;
  const form = button.form;
  prepareProductForm(form);

  if (!form?.querySelector("[data-variant-row]")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showAdminMessage("商品規格仍在載入，請等畫面出現規格欄位後再按一次儲存。", "error");
  }
}, true);
