from pathlib import Path
import re

VERSION = '20260912-1425'

pages = Path('assets/pages.js')
text = pages.read_text()
replacement = r'''function about(){
  return `<section class="pagehero about-story-hero"><div class="wrap narrow"><h1>品牌故事</h1><p class="lead">保養不只是技術，更是一場好好對待自己的儀式。</p></div></section>
  <section class="section about-story-section"><div class="wrap about-story-wrap">
    <article class="about-story-block about-story-opening"><div class="about-story-art" aria-hidden="true"><svg viewBox="0 0 560 390"><path class="about-art-haze" d="M42 316c86-67 169-84 252-52 80 31 147 23 224-44v132H42Z"/><g class="about-art-line"><path d="M38 313h484"/><path d="M58 275h105l-14-28h-78Z"/><path d="M81 247v-78m27 78v-104m28 104v-65"/><path d="M70 170h76M92 143h35"/><path d="M188 295c36-25 70-34 104-24 27 8 49 6 70-5"/><path d="M369 251c27-53 57-81 91-84 33 3 55 26 67 69"/><path d="M418 223c13-11 27-16 42-16 21 0 39 10 53 29"/><path d="M275 157c45 0 78 22 101 66" stroke-dasharray="7 12"/><path d="M269 157l16-8-5 17Z"/><circle cx="241" cy="158" r="6"/><path d="M225 184c8-10 19-15 31-15 13 0 24 5 32 15"/><path d="M452 168v-57m-18 57h36m-28-56 10-19 10 19m-21 31h22"/></g></svg></div><div class="about-story-copy"><p>從香港到台灣，跨越海峽的不只是距離，還有對理想生活的堅持。</p><p>還記得初訪台灣旅遊，就被這邊的人文深深吸引，喜歡這裡的溫暖與步調，最後決定在這裡落腳扎根。</p></div></article>

    <article class="about-story-block about-story-main"><div class="about-story-copy"><p>因為我自己本身也有毛髮上面的困擾，過去也曾長年受臉部肌膚問題影響，甚至連心情與自信都受到牽連。<br>對我來說，熱蠟與肌膚保養不只是一項技術，更是一場關於『好好對待自己』的儀式。<br>每次當毛髮再一次被整理乾淨，好好檢查和保養自己的皮膚後，就好像獲得了一個全新的自己一樣。<br>創業過程中有過不安，但每當看到顧客帶著放鬆的笑容離開，<br>就更加確定這是我想一輩子用心做的事。<br>讓來到這裡的每一個人，都能變得更好 。</p></div><div class="about-story-art about-story-art-soft" aria-hidden="true"><svg viewBox="0 0 520 430"><path class="about-art-haze" d="M68 348c31-126 104-205 219-235 77-19 137 8 179 82v173H68Z"/><g class="about-art-line"><path d="M193 279c-21-39-17-91 13-127 30-37 80-49 122-28 43 22 62 68 49 112-8 28-26 50-51 65"/><path d="M231 133c14-24 35-36 63-36 31 0 53 14 67 42"/><path d="M240 203c17 18 34 27 52 27 20 0 39-10 56-30"/><path d="M219 283c21 30 51 47 89 50 39 3 73-9 101-36"/><path d="M174 361c13-49 45-77 95-84m127 84c-14-47-44-74-90-83"/><path d="M104 267c31 3 57 15 78 36m-79-21c-18 19-28 40-31 64"/><path d="M409 245c20-8 38-7 54 3m-47 13c23 0 41 7 54 22"/><path d="M121 156l5 12 12 5-12 5-5 12-5-12-12-5 12-5Zm333 27 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/></g></svg></div></article>

    <article class="about-story-block about-story-reflection"><div class="about-story-art about-story-art-reflection" aria-hidden="true"><svg viewBox="0 0 540 400"><path class="about-art-haze" d="M46 344c38-121 120-189 245-203 87-9 155 26 203 105v112H46Z"/><g class="about-art-line"><path d="M173 310c14-44 43-70 86-78 49-9 91 12 126 63"/><circle cx="274" cy="143" r="43"/><path d="M236 136c9-34 50-51 78-29 11 9 17 21 18 36"/><path d="M247 173c10 10 20 15 31 15 13 0 25-6 37-18"/><path d="M236 216c12 23 30 36 53 39 25 3 47-5 66-25"/><path d="M219 320c6-39 25-68 58-86m105 85c-10-37-31-64-64-81"/><path d="M116 190c18-15 37-22 58-22 20 0 39 7 57 21"/><path d="M102 211c27 1 50 10 69 28m-73-9c-16 18-25 39-27 64"/><path d="M393 173c20-11 41-14 62-8m-54 24c24-3 45 2 63 15"/><path d="M129 113l5 12 12 5-12 5-5 12-5-12-12-5 12-5Zm331 87 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z"/></g></svg></div><div class="about-story-copy"><p>很多時候，我們習慣了把照顧別人的優先順序放在最前面，卻忘了停下來好好看看自己。</p><p>當你因為肌膚或毛髮問題感到不自信時，那種藏在心裡的卡卡感，我也曾經深深體會過。</p></div></article>

    <article class="about-story-block about-story-space"><div class="about-story-art" aria-hidden="true"><svg viewBox="0 0 560 390"><path class="about-art-haze" d="M31 345V87c0-22 18-40 40-40h418c22 0 40 18 40 40v258Z"/><g class="about-art-line"><path d="M53 332h454M90 332V173h134v159M123 173V98h68v75M109 217h95M344 332V207h115v125M365 207v-54h73v54"/><path d="M258 328c0-53 34-91 82-91 50 0 83 38 83 91"/><path d="M269 289c24-17 47-24 71-23 26 1 50 10 72 28"/><path d="M289 235c11-20 28-31 51-31 24 0 43 12 55 35"/><path d="M77 150c18-12 35-17 53-16m340 12c-17-10-35-14-53-12"/><path d="M247 112l5 11 11 5-11 5-5 11-5-11-11-5 11-5Z"/></g></svg></div><div class="about-story-copy"><p>所以我把這個空間打造成一個可以讓你安心歇腳的角落。在這裡沒有尷尬與壓力，<br>只有最溫柔的照顧與細緻的堅持。</p></div></article>

    <article class="about-story-block about-story-ending"><div class="about-story-copy"><p>對我來說，「變得更好」不一定要完美無瑕，而是透過一次次的細心整理，<br>讓你重新找回對自己的喜歡與自信。當你做完保養、帶著一身輕鬆與滿意的笑容跨出大門時的那一刻，<br>就是這份工作帶給我最大的幸福。<br>無論你是第一次嘗試，還是想給肌膚一次喘息的機會，都歡迎你來到這裡，<br>把肌膚與心情都安心地交給我。</p></div></article>
  </div></section>`;
}
function firstVisit()'''

pattern = re.compile(r'function about\(\)\{.*?\n\}\nfunction firstVisit\(\)', re.S)
next_text, count = pattern.subn(lambda m: replacement, text, count=1)
if count != 1:
    raise SystemExit(f'about replacement count={count}')
pages.write_text(next_text)

css = r'''.about-story-hero{padding-bottom:56px}.about-story-hero .lead{max-width:820px;margin:18px auto 0;font-family:Georgia,'Times New Roman',serif;font-size:clamp(20px,2.35vw,30px);line-height:1.6;color:#6b5c4d}.about-story-section{padding-top:18px;background:linear-gradient(180deg,#f9f6f0 0%,#fffdfa 36%,#f5eee3 100%)}.about-story-wrap{max-width:1080px}.about-story-block{display:grid;grid-template-columns:minmax(320px,.92fr) minmax(0,1.08fr);gap:clamp(34px,6vw,78px);align-items:center;padding:62px 0}.about-story-main{grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr)}.about-story-main .about-story-copy{order:1}.about-story-main .about-story-art{order:2}.about-story-reflection{grid-template-columns:minmax(320px,.92fr) minmax(0,1.08fr)}.about-story-space{grid-template-columns:minmax(320px,.92fr) minmax(0,1.08fr)}.about-story-ending{display:block;max-width:850px;margin:22px auto 0;padding:62px clamp(24px,5vw,58px);border-radius:38px;background:#fffaf3;border:1px solid rgba(158,128,95,.14)}.about-story-copy{max-width:620px}.about-story-copy p{font-size:16px;line-height:2.05;color:#6f675e;margin:0 0 18px}.about-story-copy p:last-child{margin-bottom:0}.about-story-art{border-radius:40px;overflow:hidden;background:rgba(224,204,174,.24);box-shadow:0 26px 70px rgba(86,68,48,.07)}.about-story-art svg{display:block;width:100%;height:auto;color:#ae8357}.about-art-line{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.about-art-haze{fill:#efe3d1}.about-story-art-soft{background:rgba(234,219,198,.32)}.about-story-art-reflection{background:rgba(239,226,207,.34)}.about-story-ending .about-story-copy{max-width:820px;margin:0 auto}@media(max-width:820px){.about-story-hero{padding-bottom:40px}.about-story-hero .lead{font-size:clamp(19px,5.5vw,25px);line-height:1.55}.about-story-block,.about-story-main,.about-story-reflection,.about-story-space{grid-template-columns:1fr;gap:28px;padding:42px 0}.about-story-main .about-story-copy,.about-story-main .about-story-art{order:initial}.about-story-art{border-radius:28px}.about-story-copy{max-width:none}.about-story-copy p{font-size:15px;line-height:1.95}.about-story-ending{padding:46px 22px;border-radius:28px;margin-top:12px}}'''
Path('assets/about-story.css').write_text(css)

index = Path('index.html')
html = index.read_text()
html = re.sub(r'/77-waxing-site/assets/pages\.js\?v=[^"\']+', f'/77-waxing-site/assets/pages.js?v={VERSION}', html, count=1)
html = re.sub(r'/77-waxing-site/assets/about-story\.css\?v=[^"\']+', f'/77-waxing-site/assets/about-story.css?v={VERSION}', html, count=1)
index.write_text(html)

state = Path('PROJECT_STATE.md')
s = state.read_text()
old = '- `/about/` 的 `77waxing故事` 為正式品牌故事頁；可使用圖片／插畫與留白排版，但所有可見品牌故事文字必須完全依照使用者提供的原文與原段落／換行拆解，不得自行新增小標、編號、摘要、CTA、英文字樣，也不得改寫、補字或重組句子。頁面主標使用原文 `品牌故事`。'
new = '- `/about/` 的 `77waxing故事` 為正式品牌故事頁；可使用圖片／插畫與留白排版，但所有可見品牌故事文字必須完全依照使用者提供的原文，不得自行新增小標、編號、摘要、CTA、英文字樣，也不得改寫、補字或重組句子。頁面主標使用 `品牌故事`，主標下小標固定為 `保養不只是技術，更是一場好好對待自己的儀式。`；「從香港到台灣…」與「還記得初訪台灣旅遊…」必須合併於同一圖文區塊並搭配 SVG；「很多時候…」與「當你因為肌膚或毛髮問題…」必須合併於同一圖文區塊並搭配 SVG；不得另外在頁面中重複顯示該小標。'
if old not in s:
    raise SystemExit('about state rule not found')
state.write_text(s.replace(old, new, 1))
