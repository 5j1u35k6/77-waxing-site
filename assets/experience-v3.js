(()=>{
const STORE='77waxing-preview-bookings-v2';
const SERVICES=['女性熱蠟','男士熱蠟','肌膚管理','美胸保養'];
const TIMES=[];for(let m=600;m<=1200;m+=30)TIMES.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);
const pad=n=>String(n).padStart(2,'0');
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))};
const fmt=d=>`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
const addDays=(s,n)=>{const d=parse(s);d.setUTCDate(d.getUTCDate()+n);return fmt(d)};
const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}`};
const monthStart=s=>s.slice(0,7)+'-01';
const moveMonth=(s,n)=>{const d=parse(monthStart(s));d.setUTCMonth(d.getUTCMonth()+n);return fmt(d)};
const monthLabel=s=>{const d=parse(s);return `${d.getUTCFullYear()} 年 ${d.getUTCMonth()+1} 月`};
const short=s=>{const d=parse(s);return {w:'週'+'日一二三四五六'[d.getUTCDay()],m:d.getUTCMonth()+1,n:d.getUTCDate(),full:`${d.getUTCMonth()+1}/${d.getUTCDate()}`}};
const cells=s=>{const d=parse(monthStart(s)),start=d.getUTCDay(),next=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)),count=Math.round((next-d)/86400000),a=Array(start).fill(null);for(let i=1;i<=count;i++)a.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(i)}`);while(a.length%7)a.push(null);return a};
const blockTimes=t=>{const [h,m]=t.split(':').map(Number),start=h*60+m;return [0,30,60,90].map(n=>`${pad(Math.floor((start+n)/60)%24)}:${pad((start+n)%60)}`)};
function readBookings(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}}
function writeBookings(rows){localStorage.setItem(STORE,JSON.stringify(rows))}
function ensurePreviewData(){let rows=readBookings();if(rows.length)return rows;const base=addDays(today(),1);rows=[{id:'DEMO-PENDING',date:base,time:'13:00',service:'女性熱蠟',name:'示範顧客',phone:'09xx-xxx-xxx',first:true,status:'pending_confirmation'},{id:'DEMO-CONFIRMED',date:addDays(base,1),time:'16:00',service:'肌膚管理',name:'示範回訪客',phone:'09xx-xxx-xxx',first:false,status:'confirmed'}];writeBookings(rows);return rows}
function slotState(date,time){const rows=ensurePreviewData().filter(r=>r.date===date&&!['cancelled','completed','no_show'].includes(r.status));let held=false,hidden=false;rows.forEach(r=>{if(blockTimes(r.time).includes(time)){if(r.status==='pending_confirmation')held=true;else if(['pending_payment','confirmed'].includes(r.status))hidden=true}});return hidden?'hidden':held?'held':'available'}
function windowDates(anchor){const earliest=addDays(today(),1);let start=addDays(anchor,-3);if(start<earliest)start=earliest;return Array.from({length:7},(_,i)=>addDays(start,i))}

function initNav(){
 const nav=document.querySelector('.header nav');if(!nav)return;
 let indicator=nav.querySelector('.nav-cursor');if(!indicator){indicator=document.createElement('span');indicator.className='nav-cursor';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator)}
 const links=[...nav.querySelectorAll('a')];
 const move=el=>{if(!el||!indicator)return indicator.style.opacity='0';const nr=nav.getBoundingClientRect(),r=el.getBoundingClientRect();indicator.style.width=`${r.width}px`;indicator.style.height=`${r.height}px`;indicator.style.transform=`translate3d(${r.left-nr.left}px,${r.top-nr.top}px,0)`;indicator.style.opacity='1'};
 const current=()=>nav.querySelector('a.on')||null;
 links.forEach(a=>{if(a.dataset.cursorBound)return;a.dataset.cursorBound='1';a.addEventListener('mouseenter',()=>move(a));a.addEventListener('focus',()=>move(a))});
 if(!nav.dataset.cursorLeave){nav.dataset.cursorLeave='1';nav.addEventListener('mouseleave',()=>move(current()))}
 const sync=()=>{if(innerWidth>850||nav.classList.contains('open'))move(current());else if(indicator)indicator.style.opacity='0'};
 requestAnimationFrame(sync);
 if(!window.__waxNavResize){window.__waxNavResize=true;addEventListener('resize',sync)}
 const hamb=document.querySelector('.hamb');if(hamb&&!hamb.dataset.cursorBound){hamb.dataset.cursorBound='1';hamb.addEventListener('click',()=>requestAnimationFrame(sync))}
}

function initBooking(){
 const root=document.querySelector('#booking');if(!root||root.dataset.v3==='1')return;root.dataset.v3='1';ensurePreviewData();
 const earliest=addDays(today(),1);
 const state={step:1,service:'',date:earliest,time:'',month:monthStart(earliest),name:'',phone:'',line:'',first:'yes',note:'',ok:false};
 root.innerHTML=`<div class="steps"><span class="on">1 服務</span><span>2 日期時段</span><span>3 資料</span><span>4 確認</span></div><div data-v3-body></div>`;
 const body=root.querySelector('[data-v3-body]');
 const stepMarks=[...root.querySelectorAll('.steps span')];
 const setStep=n=>{state.step=n;stepMarks.forEach((x,i)=>x.classList.toggle('on',i===n-1));render()};
 const chooseDate=d=>{if(d<earliest)return;state.date=d;state.time='';state.month=monthStart(d);render()};
 const chooseSlot=(d,t)=>{state.date=d;state.time=t;state.month=monthStart(d);render()};
 function calendar(){return `<div class="xv3-calendar"><div class="xv3-calbar"><button data-v3-prevmonth>←</button><b>${monthLabel(state.month)}</b><button data-v3-nextmonth>→</button></div><div class="xv3-calweek">${'日一二三四五六'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="xv3-calgrid">${cells(state.month).map(d=>d?`<button class="xv3-calday ${d===today()?'today':''} ${d===state.date?'on':''}" data-v3-date="${d}" ${d<earliest?'disabled':''}>${parse(d).getUTCDate()}</button>`:'<span></span>').join('')}</div><p class="xv3-min">今天不開放當日預約，最早可選 ${short(earliest).full}。</p></div>`}
 function slotsHtml(d,cls='xv3-times'){const rows=TIMES.map(t=>({t,s:slotState(d,t)})).filter(x=>x.s!=='hidden');return `<div class="${cls}">${rows.map(x=>`<button class="xv3-slot ${x.s==='held'?'held':''} ${d===state.date&&x.t===state.time?'pick':''}" data-v3-slot-date="${d}" data-v3-slot-time="${x.t}" ${x.s==='held'?'disabled':''}><b>${x.t}</b>${x.s==='held'?'<small>保留中</small>':''}</button>`).join('')}</div>`}
 function bookingStep(){const dates=windowDates(state.date);const current=dates.includes(state.date)?state.date:dates[0];if(current!==state.date){state.date=current;state.time=''}return `<section><h2>先選想來的日期，再看前後空檔</h2><p class="muted">最早只能預約明天。手機版會先選 7 天日期，再顯示該日的半小時時段。</p>${calendar()}<div class="xv3-legend"><span><i class="free"></i>可選</span><span><i class="hold"></i>其他顧客預約中</span><span><i class="pick"></i>你的選擇</span></div><div class="xv3-desktop"><div class="xv3-dayrail">${dates.map(d=>{const l=short(d);return `<article class="xv3-daycol ${d===state.date?'on':''}"><button class="xv3-dayhead" data-v3-rail-date="${d}"><small>${l.w}</small><b>${l.full}</b>${d===state.date?'<em>想去這天</em>':''}</button>${slotsHtml(d)}</article>`}).join('')}</div></div><div class="xv3-mobile"><div class="xv3-date-strip">${dates.map(d=>{const l=short(d);return `<button class="xv3-date-chip ${d===state.date?'on':''}" data-v3-chip-date="${d}"><small>${l.w}</small><b>${l.n}</b><span>${l.m}月</span></button>`}).join('')}</div><div class="xv3-mobile-panel"><div class="xv3-mobile-head"><div><small>已選日期</small><b>${short(state.date).full} ${short(state.date).w}</b></div><span>請選時段</span></div>${slotsHtml(state.date,'xv3-mobile-times')}</div></div><div class="notice xv3-rule"><b>目前時段規則</b><p>每 30 分鐘一格。服務暫定 90 分鐘，另加 30 分鐘整理緩衝；例如選 13:00，13:00／13:30／14:00／14:30 四格先反灰。77 後台確認後，四格會從可預約清單移除。</p></div><div class="actions"><button class="btn" data-v3-back>上一步</button><button class="btn dark" data-v3-next>下一步</button></div></section>`}
 function render(){
  if(state.step===1)body.innerHTML=`<section><h2>想預約什麼？</h2><p class="muted">目前所有項目先設定 90 分鐘服務時間。</p><div class="choices">${SERVICES.map(x=>`<button class="choice ${state.service===x?'on':''}" data-v3-service="${x}"><b>${x}</b><small>目前預估 90 分鐘</small></button>`).join('')}</div><div class="actions"><button class="btn dark" data-v3-next ${state.service?'':'disabled'}>下一步</button></div></section>`;
  if(state.step===2)body.innerHTML=bookingStep();
  if(state.step===3)body.innerHTML=`<section><h2>留下聯絡方式</h2><p class="muted">不用登入，也不用先建立會員。</p><div class="fields"><label>姓名<input name="v3-name" value="${state.name.replaceAll('"','&quot;')}"></label><label>手機<input name="v3-phone" value="${state.phone.replaceAll('"','&quot;')}"></label><label>LINE ID<input name="v3-line" value="${state.line.replaceAll('"','&quot;')}"></label><label>第一次來店？<select name="v3-first"><option value="yes" ${state.first==='yes'?'selected':''}>是</option><option value="no" ${state.first==='no'?'selected':''}>曾經來過</option></select></label></div><label class="full">備註<textarea name="v3-note" rows="3">${state.note}</textarea></label><p><label><input style="width:auto" type="checkbox" name="v3-ok" ${state.ok?'checked':''}> 同意為預約聯繫目的提供資料（展示版只存於本機瀏覽器）</label></p><div class="actions"><button class="btn" data-v3-back>上一步</button><button class="btn dark" data-v3-next>確認內容</button></div></section>`;
  if(state.step===4)body.innerHTML=`<section><h2>確認預約需求</h2><div class="summary">${Object.entries({服務:state.service,日期:state.date,開始時間:state.time,預留:'90 分鐘服務＋30 分鐘整理',姓名:state.name,手機:state.phone,來店:state.first==='yes'?'第一次':'回訪'}).map(v=>`<div><small>${v[0]}</small><b>${v[1]}</b></div>`).join('')}</div><div class="notice"><b>送出後先保留</b><p>展示版送出後，對應四個半小時格會顯示灰色「保留中」；到後台預覽按確認後，這些時段就會消失。</p></div><div class="actions"><button class="btn" data-v3-back>上一步</button><button class="btn dark" data-v3-submit>完成展示預約</button></div></section>`;
  bind();
 }
 function saveFields(){const n=body.querySelector('[name=v3-name]'),p=body.querySelector('[name=v3-phone]'),l=body.querySelector('[name=v3-line]'),f=body.querySelector('[name=v3-first]'),note=body.querySelector('[name=v3-note]'),ok=body.querySelector('[name=v3-ok]');if(n)state.name=n.value;if(p)state.phone=p.value;if(l)state.line=l.value;if(f)state.first=f.value;if(note)state.note=note.value;if(ok)state.ok=ok.checked}
 function bind(){
  body.querySelectorAll('[data-v3-service]').forEach(x=>x.onclick=()=>{state.service=x.dataset.v3Service;render()});
  body.querySelector('[data-v3-prevmonth]')?.addEventListener('click',()=>{state.month=moveMonth(state.month,-1);render()});
  body.querySelector('[data-v3-nextmonth]')?.addEventListener('click',()=>{state.month=moveMonth(state.month,1);render()});
  body.querySelectorAll('[data-v3-date]').forEach(x=>x.onclick=()=>chooseDate(x.dataset.v3Date));
  body.querySelectorAll('[data-v3-rail-date]').forEach(x=>x.onclick=()=>chooseDate(x.dataset.v3RailDate));
  body.querySelectorAll('[data-v3-chip-date]').forEach(x=>x.onclick=()=>chooseDate(x.dataset.v3ChipDate));
  body.querySelectorAll('[data-v3-slot-time]').forEach(x=>x.onclick=()=>chooseSlot(x.dataset.v3SlotDate,x.dataset.v3SlotTime));
  body.querySelector('[data-v3-back]')?.addEventListener('click',()=>{saveFields();setStep(Math.max(1,state.step-1))});
  body.querySelector('[data-v3-next]')?.addEventListener('click',()=>{saveFields();if(state.step===1&&!state.service)return;if(state.step===2&&!state.time)return alert('請先選擇日期與半小時時段');if(state.step===3&&(!state.name||!state.phone||!state.ok))return alert('請填姓名、手機並勾選同意');setStep(Math.min(4,state.step+1))});
  body.querySelector('[data-v3-submit]')?.addEventListener('click',()=>{const rows=readBookings();rows.push({id:'P-'+Date.now(),date:state.date,time:state.time,service:state.service,name:state.name,phone:state.phone,first:state.first==='yes',status:'pending_confirmation'});writeBookings(rows);root.querySelector('.steps').style.display='none';body.innerHTML='<section class="success on"><h2>預約需求已建立</h2><p>這筆展示預約現在是「待確認」，回到預約頁會看到對應時段反灰。</p><div class="actions" style="justify-content:center"><button class="btn" data-v3-again>再看時段</button></div></section>';body.querySelector('[data-v3-again]').onclick=()=>{root.querySelector('.steps').style.display='grid';state.step=2;state.time='';render()}})
 }
 render();
}

function enhance(){initNav();initBooking()}
enhance();
const app=document.querySelector('#app');if(app)new MutationObserver(()=>requestAnimationFrame(enhance)).observe(app,{childList:true});
})();
