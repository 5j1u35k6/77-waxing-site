from pathlib import Path


def require_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, count)


# --- pages.js ---
p = Path("assets/pages.js")
text = p.read_text()

# Remove every emoji currently used by the beginner-page copy.
for emoji in ("🥰", "🥹", "🤍"):
    text = text.replace(emoji, "")

text = require_replace(
    text,
    "第一次熱蠟，妳可能也會想問..",
    "第一次熱蠟，可能也會想問...",
    "beginner title",
)
text = require_replace(
    text,
    "希望在來之前，先把妳最在意的事情說清楚，讓第一次也可以安心一點。",
    "希望在來之前，先把最在意的事情說清楚，讓第一次也可以安心一點。",
    "beginner subtitle",
)

highlights = [
    (
        "毛髮建議保留約 0.5–1 公分，大約至少一粒米的長度，不用自己先刮短。",
        '<mark class="beginner-highlight">毛髮建議保留約 0.5–1 公分</mark>，大約至少一粒米的長度，不用自己先刮短。',
        "Q2 highlight",
    ),
    (
        "77比較在意操作的細節和肌膚狀況，不會單純追求速度。",
        '77比較在意操作的<mark class="beginner-highlight">細節和肌膚狀況</mark>，不會單純追求速度。',
        "Q3 highlight",
    ),
    (
        "所以之後還是會慢慢長回來。",
        '所以之後還是<mark class="beginner-highlight">會慢慢長回來。</mark>',
        "Q4 short highlight",
    ),
    (
        "之後再依照每個人的毛髮生長速度，大約4-6週安排適合自己的保養時間就可以了。",
        '<mark class="beginner-highlight beginner-highlight-long">之後再依照每個人的毛髮生長速度，大約4-6週安排適合自己的保養時間就可以了。</mark>',
        "Q4 long highlight",
    ),
    (
        "但不是每一種肌膚狀態都一定適合當下操作。",
        '但<mark class="beginner-highlight">不是每一種肌膚狀態都一定適合當下操作</mark>。',
        "Q5 highlight",
    ),
    (
        "妳只需要安心躺好，剩下的交給77就可以了。",
        '<mark class="beginner-highlight beginner-highlight-long">妳只需要安心躺好，剩下的交給77就可以了。</mark>',
        "Q6 highlight",
    ),
]
for old, new, label in highlights:
    text = require_replace(text, old, new, label)

home_faq = """const HOME_FAQ=[
  ['熱蠟除毛會很痛嗎？','每個人的疼痛感受都不一樣。第一次因為毛髮通常比較粗、毛量也比較多，感覺會相對明顯一些；77會依照部位、毛髮方向及肌膚狀況調整手法。'],
  ['第一次熱蠟，需要先做什麼準備嗎？','毛髮建議保留約 0.5–1 公分，大約至少一粒米的長度，不用自己先刮短。當天保持肌膚乾爽，並先暫停去角質、酸類或較刺激性的保養。'],
  ['一次大約需要多久？','會依照不同部位、毛量，以及第一次或固定保養而有所不同。以女士私密處熱蠟為例，77會預留約 1.5 小時，包含簡單諮詢、確認肌膚狀況及完整操作時間。'],
  ['做一次之後，就不會再長了嗎？','還是會長喔！熱蠟將毛髮從根部帶走，但毛髮有不同的生長週期，之後會慢慢長回來；可依每個人的生長速度，大約 4–6 週安排保養。'],
  ['我的皮膚比較敏感，也適合做熱蠟嗎？','大部分情況都可以先評估，但不是每一種肌膚狀態都一定適合當下操作。若有破皮、發炎、感染、曬傷，或近期使用較刺激性的酸類、藥物，會先確認肌膚狀況。'],
  ['第一次做私密處熱蠟，會不會很尷尬？','不用擔心毛量、膚色，或者身體狀態是不是「很奇怪」。過程中會一步一步說明，也會盡量減少不必要的暴露；妳只需要安心躺好，剩下的交給77就可以了。']
];
"""
if "const HOME_FAQ=[" not in text:
    text = require_replace(text, "const FLOW_SCENES={", home_faq + "const FLOW_SCENES={", "HOME_FAQ insertion")

button = '<a class="btn home-safe-button" data-link href="${B}/beginner/">第一次熱蠟｜小白小白專區 →</a>'
text = require_replace(text, button, "", "homepage beginner button")

home_start = text.index("function home(){")
home_end = text.index("\nfunction beginner(){", home_start)
home = text[home_start:home_end]
if "home-faq-section" not in home:
    faq_section = '''
  <section class="section home-faq-section"><div class="wrap narrow"><div class="home-faq-head"><span class="tag">FIRST WAX FAQ</span><h2>第一次熱蠟，可能也會想問...</h2></div><div class="home-faq">${HOME_FAQ.map(([q,a],i)=>`<details><summary><span>Q${i+1}</span>${q}</summary><p>${a}</p></details>`).join('')}</div></div></section>'''
    close_marker = "`\n}"
    if close_marker not in home:
        # Current home() ends with backtick + semicolon + newline + brace.
        close_marker = "`;\n}"
    if close_marker not in home:
        raise SystemExit("missing home() closing marker")
    replacement = faq_section + ("`\n}" if close_marker == "`\n}" else "`;\n}")
    home = home.replace(close_marker, replacement, 1)
    text = text[:home_start] + home + text[home_end:]

old_sync = "const on=path==='/'?href===`${B}/`:path.startsWith('/services/')?href===`${B}/services/`:href===`${B}${path}`;"
new_sync = "const on=path==='/'?href===`${B}/`:path==='/beginner/'?href===`${B}/about/`:path.startsWith('/services/')?href===`${B}/services/`:href===`${B}${path}`;"
text = require_replace(text, old_sync, new_sync, "beginner About active state")

p.write_text(text)


# --- beginner.css ---
p = Path("assets/beginner.css")
css = p.read_text()
if ".beginner-highlight{" not in css:
    css += '.beginner-highlight{display:inline;padding:2px 5px;border-radius:7px;background:linear-gradient(180deg,transparent 18%,#efe0c7 18%,#efe0c7 92%,transparent 92%);color:#6f5438;font-weight:700;box-decoration-break:clone;-webkit-box-decoration-break:clone}.beginner-highlight-long{line-height:2.05}'
p.write_text(css)


# --- pages.css homepage FAQ ---
p = Path("assets/pages.css")
css = p.read_text()
if ".home-faq-section{" not in css:
    css += '.home-faq-section{background:#efe8d9}.home-faq-head{margin-bottom:28px}.home-faq-head h2{font-size:clamp(28px,4vw,44px);margin-bottom:0}.home-faq{border-top:1px solid #3a38361b}.home-faq details{border-bottom:1px solid #3a38361b}.home-faq summary{display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;align-items:center;padding:20px 0;cursor:pointer;font-weight:700;list-style:none}.home-faq summary::-webkit-details-marker{display:none}.home-faq summary span{color:#9a7851;font:600 14px/1 Georgia,serif}.home-faq p{margin:0 0 22px;padding-left:58px;line-height:1.85;opacity:.72}.home-faq details[open] summary{color:#765d43}@media(max-width:640px){.home-faq summary{grid-template-columns:40px minmax(0,1fr);padding:18px 0;font-size:15px}.home-faq p{padding-left:50px;font-size:14px}}'
p.write_text(css)


# --- nav.js About flyout ---
p = Path("assets/nav.js")
nav = p.read_text()
if "About submenu: About -> 小白小白" not in nav:
    nav += r'''

// About submenu: About -> 小白小白
(()=>{
  const header=document.querySelector('.header');
  const nav=header?.querySelector('nav');
  if(!header||!nav||nav.querySelector('.about-flyout'))return;
  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const aboutLink=[...nav.children].find(el=>{
    if(!el.matches?.('a'))return false;
    try{return new URL(el.href,location.href).pathname.replace(/\/$/,'').endsWith('/about')}catch{return false}
  });
  if(!aboutLink)return;
  const flyout=document.createElement('div');
  flyout.className='about-flyout';
  flyout.setAttribute('aria-label','關於選單');
  flyout.innerHTML=`<a href="${B}/about/" data-link><span>關於77waxing</span><small>ABOUT 77WAXING</small></a><a href="${B}/beginner/" data-link><span>小白小白</span><small>FIRST WAX</small></a>`;
  aboutLink.after(flyout);
  aboutLink.dataset.aboutTrigger='1';
  aboutLink.setAttribute('aria-haspopup','true');
  aboutLink.setAttribute('aria-expanded','false');
  const isDesktop=()=>innerWidth>850;
  let timer=0;
  const position=()=>{
    if(!isDesktop())return;
    const nr=nav.getBoundingClientRect(),r=aboutLink.getBoundingClientRect();
    flyout.style.left=`${r.left-nr.left+r.width/2}px`;
    flyout.style.top=`${r.bottom-nr.top+16}px`;
  };
  const show=()=>{clearTimeout(timer);position();flyout.classList.add('on');aboutLink.classList.add('about-open');aboutLink.setAttribute('aria-expanded','true')};
  const hide=()=>{clearTimeout(timer);flyout.classList.remove('on');aboutLink.classList.remove('about-open');aboutLink.setAttribute('aria-expanded','false')};
  const schedule=()=>{if(isDesktop()){clearTimeout(timer);timer=setTimeout(hide,130)}};
  aboutLink.addEventListener('mouseenter',()=>{if(isDesktop())show()});
  aboutLink.addEventListener('mouseleave',schedule);
  aboutLink.addEventListener('focus',()=>{if(isDesktop())show()});
  flyout.addEventListener('mouseenter',()=>clearTimeout(timer));
  flyout.addEventListener('mouseleave',schedule);
  flyout.addEventListener('focusin',()=>clearTimeout(timer));
  flyout.addEventListener('focusout',e=>{if(isDesktop()&&!flyout.contains(e.relatedTarget))schedule()});
  aboutLink.addEventListener('click',event=>{
    if(isDesktop())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    flyout.classList.contains('on')?hide():show();
  },true);
  flyout.addEventListener('click',hide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  addEventListener('resize',hide);
})();
'''
p.write_text(nav)


# --- nav.css About flyout ---
p = Path("assets/nav.css")
css = p.read_text()
if ".about-flyout{" not in css:
    css += r'''
.about-flyout{position:absolute;z-index:25;width:220px;padding:8px;border:1px solid rgba(58,56,54,.08);border-radius:17px;background:rgba(255,253,249,.98);box-shadow:0 16px 42px rgba(58,56,54,.14);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);opacity:0;visibility:hidden;pointer-events:none;transform:translate(-50%,-6px);transition:opacity .18s ease,transform .22s cubic-bezier(.22,.8,.22,1),visibility 0s linear .22s}.about-flyout::before{content:"";position:absolute;left:0;right:0;top:-12px;height:12px}.about-flyout.on{opacity:1;visibility:visible;pointer-events:auto;transform:translate(-50%,0);transition-delay:0s}.header nav .about-flyout a{min-width:0;width:100%;display:grid;align-content:center;gap:6px;padding:12px 14px;border-radius:12px;text-align:left;line-height:1.16;color:#3a3836}.header nav .about-flyout a:hover,.header nav .about-flyout a:focus-visible{background:#e8deca;color:#765d43}.header nav .about-flyout a span{font-size:15.5px;font-weight:600;letter-spacing:.025em}.header nav .about-flyout a small{font:600 8.5px/1 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#9b9b88;white-space:nowrap}
@media(max-width:850px){.header nav>a.about-open{background:rgba(255,253,249,.62)}.about-flyout{position:static!important;width:100%;padding:0 4px 2px;margin:-4px 0 5px;border:0;border-radius:0;background:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;opacity:0;visibility:hidden;pointer-events:none;transform:none!important;max-height:0;overflow:hidden;transition:max-height .28s ease,opacity .18s ease,visibility 0s linear .28s}.about-flyout::before{display:none}.about-flyout.on{opacity:1;visibility:visible;pointer-events:auto;max-height:180px;overflow:visible;transition-delay:0s}.header nav .about-flyout a{padding:12px 12px 12px 25px;border-radius:12px;background:transparent;gap:5px;min-height:58px}.header nav .about-flyout a span{font-size:16px;font-weight:500;line-height:1.25}.header nav .about-flyout a small{font-size:10px;line-height:1.15}}
@media(prefers-reduced-motion:reduce){.about-flyout{transition:none}}
'''
p.write_text(css)


# --- index cache bust ---
p = Path("index.html")
html = p.read_text()
for old, new, label in [
    ("pages.css?v=20260911-1703", "pages.css?v=20260911-1922", "pages.css cache"),
    ("beginner.css?v=20260911-1905", "beginner.css?v=20260911-1922", "beginner.css cache"),
    ("nav.css?v=20260911-1003", "nav.css?v=20260911-1922", "nav.css cache"),
    ("pages.js?v=20260911-1905", "pages.js?v=20260911-1922", "pages.js cache"),
    ("nav.js?v=20260909-1133", "nav.js?v=20260911-1922", "nav.js cache"),
]:
    html = require_replace(html, old, new, label)
p.write_text(html)


# --- durable project baseline ---
p = Path("PROJECT_STATE.md")
state = p.read_text()
old = """- SAFE SPACE 的首訪按鈕固定連到 `/beginner/`，顯示為「第一次熱蠟｜小白小白專區」。
- `/beginner/` 標題為「第一次熱蠟，妳可能也會想問..」，完整放置第一次熱蠟的 6 題內容：疼痛、事前準備、所需時間、毛髮再生週期、敏感肌評估、私密處尷尬疑慮，以及「第一次不用很勇敢，剩下的交給77就好。」收尾文案。
- 首頁不重複顯示整段第一次熱蠟 FAQ；完整內容集中在小白小白專區。
"""
new = """- SAFE SPACE 區塊不顯示「第一次熱蠟｜小白小白專區」按鈕；小白小白由頂部選單 `關於 → 小白小白` 進入。
- 首頁底部 FAQ 使用小白小白專區內容的精簡版，共 6 題，以摺疊問答顯示；完整說明仍保留在 `/beginner/`。
- `/beginner/` 標題固定為「第一次熱蠟，可能也會想問...」；副標「希望在來之前，先把最在意的事情說清楚，讓第一次也可以安心一點。」不使用「妳」。
- `/beginner/` 全頁不使用表情符號。Q1 的「原來沒有想像中那麼可怕。」維持引用標記；Q2「毛髮建議保留約 0.5–1 公分」、Q3「細節和肌膚狀況」、Q4「會慢慢長回來。」及「之後再依照每個人的毛髮生長速度，大約4-6週安排適合自己的保養時間就可以了。」、Q5「不是每一種肌膚狀態都一定適合當下操作」、Q6「妳只需要安心躺好，剩下的交給77就可以了。」使用同系暖色重點標記。
"""
state = require_replace(state, old, new, "PROJECT_STATE beginner block")
p.write_text(state)
