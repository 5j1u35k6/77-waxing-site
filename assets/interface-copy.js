// Use only for error messages, never for customer input or OCR content.
export function operationErrorText(value, fallback = "目前無法完成操作，請稍後再試。") {
  const text = String(typeof value === "string" ? value : value?.message || "").trim();
  if (!text || !/[\u3400-\u9fff]/.test(text)
      || /^(?:Firebase(?:Error)?:|TypeError:|NetworkError:)|Missing or insufficient permissions|permission-denied|(?:auth|firestore)\/[a-z-]+/i.test(text)) return fallback;
  return text;
}

