// 77select checkout submit guard.
// Keeps the existing order/promotion submit handlers, but makes the footer button
// reliably dispatch them and surfaces missing-field feedback above the checkout modal.

const form = document.querySelector("#checkout-form");
const submitButton = document.querySelector("#checkout-submit");

if (form && submitButton) {
  // Native browser validation can block the submit event before the existing
  // storefront handlers run, which feels like the button did nothing inside the
  // scrollable modal. We validate explicitly, then dispatch the real submit event.
  form.noValidate = true;

  const emailOk = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());

  function revealField(node) {
    if (!node) return;
    const body = document.querySelector("#checkout-wrap .modal-body");
    const section = node.closest?.(".checkout-section") || node;
    section.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setTimeout(() => node.focus?.({ preventScroll: true }), 220);
    body?.classList?.add("checkout-validation-attention");
    setTimeout(() => body?.classList?.remove("checkout-validation-attention"), 900);
  }

  function stopWith(message, node) {
    window.alert(message);
    revealField(node);
  }

  function validateCheckout() {
    const name = document.querySelector("#checkout-name");
    const phone = document.querySelector("#checkout-phone");
    const email = document.querySelector("#checkout-email");
    const delivery = document.querySelector("input[name='delivery']:checked");
    const payment = document.querySelector("input[name='payment']:checked");
    const terms = document.querySelector("#checkout-terms");

    if (!name?.value.trim()) return { message: "請填寫收件人姓名。", node: name };
    if (!phone?.value.trim()) return { message: "請填寫聯絡電話。", node: phone };
    if (!emailOk(email?.value)) return { message: "請填寫有效的 Email。", node: email };
    if (!delivery) return { message: "請選擇交付方式。", node: document.querySelector("#delivery-options input") };
    if (!payment) return { message: "請選擇付款方式。", node: document.querySelector("#payment-options input") };

    if (delivery.value !== "pickup") {
      const storeName = document.querySelector("#checkout-store-name");
      const storeId = document.querySelector("#checkout-store-id");
      if (!storeName?.value.trim()) return { message: "請填寫超商門市名稱。", node: storeName };
      if (!storeId?.value.trim()) return { message: "請填寫超商門市店號。", node: storeId };
    }

    if (!terms?.checked) return { message: "請先勾選同意訂購、退換貨與隱私說明。", node: terms };
    return null;
  }

  submitButton.addEventListener("click", (event) => {
    if (submitButton.disabled) return;

    // Always take control of the click so browser-native validation or layout
    // overlays cannot swallow it silently. The actual order logic still lives in
    // app.js / promotion-storefront.js and is invoked through a normal submit event.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const invalid = validateCheckout();
    if (invalid) {
      stopWith(invalid.message, invalid.node);
      return;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(submitButton);
    } else {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  }, true);
}
