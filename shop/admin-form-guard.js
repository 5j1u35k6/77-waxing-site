const FORM_SELECTOR = "#product-form";

function showAdminMessage(message, type = "error") {
  const el = document.querySelector("#admin-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = type === "error" ? "#a64b43" : "#55745b";
  if (type === "error") el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function prepareProductForm(form) {
  if (!form || form.dataset.submitGuard === "1") return;
  form.noValidate = true;
  form.setAttribute("novalidate", "");
  form.dataset.submitGuard = "1";
}

function refresh() {
  prepareProductForm(document.querySelector(FORM_SELECTOR));
}

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true });
refresh();

document.addEventListener("click", (event) => {
  const button = event.target.closest?.(`${FORM_SELECTOR} button[type="submit"]`);
  if (!button) return;
  const form = button.form;
  prepareProductForm(form);

  if (!form?.querySelector("[data-variant-row]")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showAdminMessage("商品規格仍在載入，請稍候一下再儲存。", "error");
    setTimeout(() => {
      if (form?.isConnected && form.querySelector("[data-variant-row]") && !button.disabled) {
        form.requestSubmit(button);
      }
    }, 350);
  }
}, true);
