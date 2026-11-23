import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20261026-audit1";

const panel = document.querySelector(".select-ai[data-ai-endpoint]");
if (panel) {
  try {
    const endpoint = new URL(panel.dataset.aiEndpoint);
    if (endpoint.protocol !== "https:") throw new Error("Invalid AI endpoint");
    initChat(panel, endpoint, getPublicFirebase().auth);
  } catch {
    panel.querySelector("[data-ai-auth-status]").textContent = "AI 問答暫時無法載入，請稍後再試。";
  }
}

function initChat(panel, endpoint, auth) {
  const gate = panel.querySelector(".select-ai-gate");
  const authStatus = panel.querySelector("[data-ai-auth-status]");
  const signIn = panel.querySelector("[data-ai-sign-in]");
  const retry = panel.querySelector("[data-ai-retry]");
  const conversation = panel.querySelector("[data-ai-conversation]");
  const log = panel.querySelector("[data-ai-log]");
  const form = panel.querySelector(".select-ai-form");
  const question = form.elements.question;
  const send = form.querySelector('[type="submit"]');
  const clear = form.querySelector("[data-ai-clear]");
  const status = form.querySelector("[data-ai-status]");
  let history = [];
  let memberUid = null;
  let request = null;
  let healthVersion = 0;

  function setStatus(message) {
    status.hidden = !message;
    status.textContent = message;
  }

  function setPending(pending) {
    send.disabled = pending;
    send.textContent = pending ? "等待回覆…" : "送出問題";
    question.readOnly = pending;
  }

  function resetConversation() {
    request?.abort();
    request = null;
    history = [];
    log.replaceChildren();
    log.hidden = true;
    clear.hidden = true;
    question.value = "";
    setPending(false);
    setStatus("");
  }

  function showMessage(role, content) {
    const message = document.createElement("div");
    message.className = "select-ai-message";
    message.dataset.role = role;
    const speaker = document.createElement("strong");
    speaker.textContent = role === "user" ? "你" : "AI 保養助手";
    const body = document.createElement("p");
    body.textContent = content;
    message.append(speaker, body);
    log.hidden = false;
    log.append(message);
    while (log.childElementCount > 8) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
    clear.hidden = false;
    return message;
  }

  signIn.addEventListener("click", () => {
    document.querySelector(".select-header [data-member-trigger]")?.click();
  });

  clear.addEventListener("click", () => {
    resetConversation();
    question.focus();
  });

  async function checkService() {
    const version = ++healthVersion;
    gate.hidden = false;
    conversation.hidden = true;
    retry.hidden = true;
    signIn.hidden = true;
    authStatus.textContent = "正在連線至 AI 保養問答…";
    let ready = false;
    try {
      const response = await fetch(new URL("/health", endpoint), {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      ready = response.ok && (await response.json()).ready === true;
    } catch {
      // The member can retry when the service becomes available.
    }
    if (version !== healthVersion) return;
    gate.hidden = ready;
    conversation.hidden = !ready;
    retry.hidden = ready;
    authStatus.textContent = ready ? "" : "AI 保養問答目前無法連線，請稍後再試。";
  }
  retry.addEventListener("click", () => { void checkService(); });

  onAuthStateChanged(auth, (user) => {
    const uid = user && !user.isAnonymous ? user.uid : null;
    if (memberUid !== uid) resetConversation();
    memberUid = uid;
    if (uid) {
      void checkService();
    } else {
      healthVersion += 1;
      gate.hidden = false;
      conversation.hidden = true;
      retry.hidden = true;
      signIn.hidden = false;
      authStatus.textContent = "登入 77select 會員後，即可在這裡提問。";
    }
  }, () => {
    resetConversation();
    healthVersion += 1;
    memberUid = null;
    gate.hidden = false;
    conversation.hidden = true;
    retry.hidden = true;
    signIn.hidden = false;
    authStatus.textContent = "暫時無法確認會員狀態，請重新登入後再試。";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (request) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous || user.uid !== memberUid) return;
    const content = question.value.trim();
    if (!content) {
      setStatus("請先輸入你的問題。");
      question.focus();
      return;
    }

    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    const messages = [...history.slice(-6), { role: "user", content }];
    const pendingMessage = showMessage("user", content);
    question.value = "";
    setPending(true);
    setStatus("正在準備回覆…");

    try {
      const token = await user.getIdToken();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const { answer } = await response.json();
      if (typeof answer !== "string" || !answer.trim()) throw new Error("Invalid AI reply");
      if (request !== controller || auth.currentUser?.uid !== user.uid) return;

      const reply = answer.trim().slice(0, 1800);
      history = [...messages, { role: "assistant", content: reply }].slice(-6);
      showMessage("assistant", reply);
      setStatus("");
    } catch (error) {
      if (request !== controller || auth.currentUser?.uid !== user.uid) return;
      pendingMessage.remove();
      log.hidden = !log.childElementCount;
      clear.hidden = log.hidden;
      question.value = content;
      const errorText = {
        401: "請重新登入 77select 會員後再試。",
        422: "請移除電話或電子郵件，再送出問題。",
        429: "目前提問較多，請稍後再試。",
        503: "AI 問答暫時無法使用，請稍後再試。",
      };
      setStatus(errorText[error.message] || (controller.signal.aborted
        ? "等待回覆逾時，請再送出一次。"
        : "沒有收到回覆，請再送出一次。"));
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null;
        setPending(false);
        if (panel.contains(document.activeElement)) question.focus({ preventScroll: true });
      }
    }
  });
}
