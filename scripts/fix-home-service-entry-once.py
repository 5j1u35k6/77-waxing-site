from pathlib import Path
import re

VERSION = '20260912-1524'

pages = Path('assets/pages.js')
text = pages.read_text()

old_buttons = '<div class="btns"><a class="btn dark" href="${B}/booking/">預約時段讓自己更好</a><a class="btn" data-link href="${B}/services/">77waxing提供的服務</a></div>'
new_buttons = '<div class="btns"><a class="btn dark" href="${B}/booking/">預約時段讓自己更好</a><a class="btn" data-link href="${B}/services/">77waxing提供的服務</a><a class="btn" data-link href="${B}/beginner/">第一次熱蠟，可能也會想問...</a></div>'
if old_buttons not in text:
    raise SystemExit('home hero buttons pattern not found')
text = text.replace(old_buttons, new_buttons, 1)

pattern = re.compile(r'\n  <section class="section home-faq-section">.*?</section>', re.S)
replacement = '''
  <section class="section home-video-section"><div class="wrap"><div class="home-feature-head"><h2>7777waxing video</h2></div><div class="home-video-shell" data-home-video-slot aria-label="7777waxing video"><span class="home-video-play" aria-hidden="true"></span></div></div></section>
  <section class="section home-recommend-section"><div class="wrap narrow"><div class="home-feature-head"><h2>為什麼大家都推薦77waxing？</h2></div><div class="home-recommend-slot" data-home-recommend-slot></div></div></section>'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'home faq section replacement count={count}')
pages.write_text(text)

catalog = Path('assets/catalog-dynamic.js')
ctext = catalog.read_text()
old_click = '''  event.preventDefault();
  history.pushState(null, "", url.pathname + url.search + url.hash);
  renderCurrent(true);
}, true);'''
new_click = '''  event.preventDefault();
  history.pushState(null, "", url.pathname + url.search + url.hash);
  renderCurrent(true);
  if (!url.hash) requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}, true);'''
if old_click not in ctext:
    raise SystemExit('catalog click handler pattern not found')
ctext = ctext.replace(old_click, new_click, 1)
catalog.write_text(ctext)

css = Path('assets/pages.css')
c = css.read_text()
marker = '/* home bottom media + recommendation blocks */'
if marker not in c:
    c += '''\n/* home bottom media + recommendation blocks */\n.home-video-section{background:#efe8d9;padding-bottom:76px}.home-feature-head{text-align:center;margin-bottom:30px}.home-feature-head h2{margin:0;font-size:clamp(30px,4vw,48px)}.home-video-shell{width:min(920px,100%);aspect-ratio:16/9;margin:0 auto;border:1px solid #3a38361a;border-radius:28px;background:linear-gradient(145deg,#e7decd,#d3c3a8);position:relative;overflow:hidden;box-shadow:0 24px 70px #3a383610}.home-video-shell:before{content:"77";position:absolute;right:5%;bottom:-12%;font:clamp(120px,22vw,270px)/1 Georgia,serif;color:#f9f6f038}.home-video-play{position:absolute;left:50%;top:50%;width:68px;height:68px;transform:translate(-50%,-50%);border:1px solid #f9f6f0aa;border-radius:50%;background:#3a38362b;backdrop-filter:blur(4px)}.home-video-play:after{content:"";position:absolute;left:28px;top:22px;border-left:16px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent}.home-recommend-section{padding-top:82px;padding-bottom:86px}.home-recommend-slot{height:1px;background:#3a38361a;margin-top:22px}@media(max-width:640px){.home-video-section{padding:58px 0}.home-video-shell{border-radius:20px}.home-video-play{width:58px;height:58px}.home-video-play:after{left:24px;top:18px}.home-recommend-section{padding:58px 0}.home-feature-head{margin-bottom:22px}}\n'''
css.write_text(c)

state = Path('PROJECT_STATE.md')
s = state.read_text()
anchor = '- 首頁底部 FAQ 使用小白小白專區內容的精簡版，共 6 題，以摺疊問答顯示；完整說明仍保留在 `/beginner/`。'
replacement_state = '''- 首頁原本底部的「第一次熱蠟，可能也會想問...」FAQ 區塊已移除；完整內容只保留在 `/beginner/`。
- 首頁 Hero 的 `77waxing提供的服務` 右側固定新增 `第一次熱蠟，可能也會想問...` 按鈕，連到 `/beginner/`。
- 首頁底部固定改為兩個區塊，順序為 `7777waxing video` → `為什麼大家都推薦77waxing？`；在使用者提供影片或推薦內容前，不自行杜撰可見文案。
- 首頁「第一次，不需要一次懂全部。」中的任一服務連結，以及其他無 hash 的服務連結，切換到服務頁後必須回到該服務頁頂部／服務標題，不得保留首頁原本的捲動位置而落在服務頁中段。'''
if anchor in s:
    s = s.replace(anchor, replacement_state, 1)
elif replacement_state not in s:
    s += '\n' + replacement_state + '\n'
state.write_text(s)

index = Path('index.html')
i = index.read_text()
i = re.sub(r'assets/pages\.css\?v=[^"\']+', f'assets/pages.css?v={VERSION}', i)
i = re.sub(r'assets/pages\.js\?v=[^"\']+', f'assets/pages.js?v={VERSION}', i)
i = re.sub(r'assets/catalog-dynamic\.js\?v=[^"\']+', f'assets/catalog-dynamic.js?v={VERSION}', i)
index.write_text(i)
