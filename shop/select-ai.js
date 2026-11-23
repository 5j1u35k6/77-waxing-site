import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getPublicFirebase } from "../assets/public-firebase.js?v=20261026-audit1";
import { blackBottleSeries } from "./series.js?v=20261124-series1";

const topics = [
  {
    label: "臉部保養",
    questions: [
      { title: "你想先從哪件事開始？", options: ["加強日常保濕", "了解保養品的使用順序", "精簡保養步驟"] },
      { title: "你想把保養安排在哪個時段？", options: ["早上出門前", "晚上洗澡後", "早晚都想安排"] },
    ],
    followUps: [
      { label: "把步驟再精簡", question: "依照剛才的建議，如果我只想先做兩個步驟，該怎麼安排？" },
      { label: "看看怎麼挑商品", question: "依照剛才的建議，挑選配合這些步驟的商品時，我可以從哪些分類找起？" },
    ],
  },
  {
    label: "熱蠟後保養",
    questions: [
      { title: "你目前想了解哪個階段？", options: ["剛做完熱蠟", "熱蠟後這幾天", "兩次熱蠟之間"] },
      { title: "你最想知道哪一方面？", options: ["日常清潔", "日常保濕", "什麼時候可以恢復平常保養"] },
    ],
    followUps: [
      { label: "洗澡後的保養順序", question: "按剛才的階段和需求，洗澡後有哪些簡單的日常保養步驟？" },
      { label: "挑選保濕品時的注意事項", question: "依照剛才的情境，挑選日常保濕品時可以留意包裝上的哪些資訊？" },
    ],
  },
  {
    label: "身體保養",
    questions: [
      { title: "你想先了解哪個項目？", options: ["保濕", "清潔", "日常拋光"] },
      { title: "你比較需要哪一種建議？", options: ["洗澡後的保養順序", "簡單快速的日常步驟", "適合從哪類商品開始看"] },
    ],
    followUps: [
      { label: "可以簡化哪些步驟？", question: "依照剛才的建議，平常時間比較少時，可以怎麼簡化步驟？" },
      { label: "去哪些商品分類看看？", question: "依照剛才的身體保養需求，可以先看看 77 Select 的哪些商品分類？" },
    ],
  },
  {
    label: "挑選商品",
    questions: [
      { title: "你想了解哪個系列？", options: [blackBottleSeries, "25+系列", "身體拋光系列", "5分鐘出門系列", "還不確定，想先看看分類"] },
      { title: "挑選時，你最想先知道什麼？", options: ["系列裡有哪些商品", "清潔和保養的商品怎麼分", "怎麼安排簡單的日常保養"] },
    ],
    followUps: [
      { label: "先買一樣要怎麼選？", question: "依照剛才的系列與需求，如果只想先挑一件商品，怎麼從商品類別做選擇？" },
      { label: "看商品頁要留意什麼？", question: "依照剛才的選擇，到商品頁比較商品時可以先留意哪些資訊？" },
    ],
  },
];

const panel = document.querySelector(".select-ai[data-ai-endpoint]");
if (panel) {
  try {
    const endpoint = new URL(panel.dataset.aiEndpoint);
    if (endpoint.protocol !== "https:") throw new Error("Invalid AI endpoint");
    initGuide(panel, endpoint, getPublicFirebase().auth);
  } catch {
    panel.querySelector("[data-ai-auth-status]").textContent = "AI 問答暫時無法載入，請稍後再試。";
  }
}

function initGuide(panel, endpoint, auth) {
  const gate = panel.querySelector(".select-ai-gate");
  const authStatus = panel.querySelector("[data-ai-auth-status]");
  const signIn = panel.querySelector("[data-ai-sign-in]");
  const retry = panel.querySelector("[data-ai-retry]");
  const conversation = panel.querySelector("[data-ai-conversation]");
  const guide = panel.querySelector("[data-ai-guide]");
  const log = panel.querySelector("[data-ai-log]");
  const status = panel.querySelector("[data-ai-status]");
  const choices = [];
  const history = [];
  const completedFollowUps = new Set();
  let memberUid = null;
  let request = null;
  let healthVersion = 0;

  function setStatus(message) {
    status.hidden = !message;
    status.textContent = message;
  }

  function addButton(container, label, action, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    container.append(button);
    return button;
  }

  function renderGuide(focus = false) {
    const step = choices.length;
    const topic = topics.find(({ label }) => label === choices[0]);
    const heading = document.createElement("h3");
    heading.tabIndex = -1;
    heading.id = "select-ai-current-question";
    const actions = document.createElement("div");
    actions.className = "select-ai-actions";
    guide.replaceChildren();
    if (step < 3) {
      const question = step === 0
        ? { title: "你想了解哪一種保養？", options: topics.map(({ label }) => label) }
        : topic.questions[step - 1];
      const progress = document.createElement("p");
      progress.className = "select-ai-progress";
      progress.textContent = `第 ${step + 1} 題，共 3 題`;
      heading.textContent = question.title;
      const options = document.createElement("div");
      options.className = "select-ai-options";
      options.setAttribute("role", "group");
      options.setAttribute("aria-labelledby", heading.id);
      guide.append(progress, heading, options);
      for (const option of question.options) {
        addButton(options, option, () => {
          choices.push(option);
          setStatus("");
          renderGuide(true);
        }, "select-ai-option");
      }
    } else if (!history.length) {
      heading.textContent = "你的保養方向";
      const answers = document.createElement("ul");
      answers.className = "select-ai-answers";
      for (const choice of choices) {
        const item = document.createElement("li");
        item.textContent = choice;
        answers.append(item);
      }
      guide.append(heading, answers);
      const ask = addButton(actions, "取得保養建議", () => {
        const [topicLabel, focusArea, preference] = choices;
        const question = `我想了解${topicLabel}。我的選擇是「${focusArea}」和「${preference}」。請依這些選擇提供清楚、簡單的日常保養建議。`;
        void sendQuestion(question, choices.join("｜"));
      }, "select-ai-send");
      ask.dataset.aiRequestButton = "";
    } else {
      heading.textContent = "保養建議";
      guide.append(heading, log);
      const remaining = topic.followUps.filter(({ label }) => !completedFollowUps.has(label));
      if (remaining.length) {
        const prompt = document.createElement("h4");
        prompt.id = "select-ai-followup-title";
        prompt.textContent = "還想了解什麼？";
        const followUps = document.createElement("div");
        followUps.className = "select-ai-options";
        followUps.setAttribute("role", "group");
        followUps.setAttribute("aria-labelledby", prompt.id);
        guide.append(prompt, followUps);
        for (const { label, question } of remaining) {
          const button = addButton(followUps, label, () => {
            void sendQuestion(question, label, label);
          }, "select-ai-option");
          button.dataset.aiRequestButton = "";
        }
      }
    }
    if (step && !history.length) {
      addButton(actions, "上一題", () => {
        request?.abort();
        request = null;
        choices.pop();
        setStatus("");
        renderGuide(true);
      }, "select-ai-clear");
    }
    if (step) {
      addButton(actions, "重新開始", () => resetGuide(true), "select-ai-clear");
      guide.append(actions);
    }
    if (focus) heading.focus();
  }

  function resetGuide(focus = false) {
    request?.abort();
    request = null;
    choices.length = 0;
    history.length = 0;
    completedFollowUps.clear();
    log.replaceChildren();
    log.hidden = true;
    setStatus("");
    renderGuide(focus);
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
  }

  signIn.addEventListener("click", () => {
    document.querySelector(".select-header [data-member-trigger]")?.click();
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

  function showSignIn(message) {
    healthVersion += 1;
    gate.hidden = false;
    conversation.hidden = true;
    retry.hidden = true;
    signIn.hidden = false;
    authStatus.textContent = message;
  }

  renderGuide();
  onAuthStateChanged(auth, (user) => {
    const uid = user && !user.isAnonymous ? user.uid : null;
    if (memberUid !== uid) resetGuide();
    memberUid = uid;
    if (uid) void checkService();
    else showSignIn("登入 77select 會員後，即可開始回答保養問題。");
  }, () => {
    resetGuide();
    memberUid = null;
    showSignIn("暫時無法確認會員狀態，請重新登入後再試。");
  });

  async function sendQuestion(question, label, followUp) {
    if (request) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous || user.uid !== memberUid) return;

    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    const messages = [...history.slice(-6), { role: "user", content: question }];
    const requestButtons = guide.querySelectorAll("[data-ai-request-button]");
    requestButtons.forEach(button => { button.disabled = true; });
    setStatus("正在準備保養建議…");

    try {
      const token = await user.getIdToken();
      controller.signal.throwIfAborted();
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

      const reply = answer.trim()
        .replace(/黑瓶\s*(?:無限|[♾∞][\uFE0E\uFE0F]?)\s*修護系列/gu, blackBottleSeries)
        .slice(0, 1800);
      history.push({ role: "user", content: question }, { role: "assistant", content: reply });
      if (followUp) completedFollowUps.add(followUp);
      renderGuide(true);
      showMessage("user", label);
      showMessage("assistant", reply);
      setStatus("");
      log.scrollTop = log.scrollHeight;
    } catch (error) {
      if (request !== controller || auth.currentUser?.uid !== user.uid) return;
      const errorMessages = {
        401: "請重新登入 77select 會員後再試。",
        429: "目前提問較多，請稍後再試。",
        503: "AI 問答暫時無法使用，請稍後再試。",
      };
      setStatus(errorMessages[error.message] || (controller.signal.aborted
        ? "等待回覆逾時，請再試一次。"
        : "沒有收到回覆，請再試一次。"));
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null;
        requestButtons.forEach(button => { button.disabled = false; });
      }
    }
  }
}
