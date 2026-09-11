import { getApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { collection, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dateKey(new Date());
const addDays=(date,amount)=>{const d=new Date(date);d.setDate(d.getDate()+amount);return d};
const addMinutes=(time,amount)=>{const [h,m]=String(time||'').split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return '';const total=h*60+m+amount;return `${pad(Math.floor(total/60)%24)}:${pad(total%60)}`};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const statusLabel=status=>({pending_confirmation:'待確認',pending_payment:'待付款',confirmed:'已確認',completed:'已完成',cancelled:'已取消',no_show:'未到店'}[status]||status||'—');
const SERVICE_CATEGORIES=['女性熱蠟','男士熱蠟','肌膚管理','美胸保養'];
let rows=[];
let lastSignature='';

function root(){return document.querySelector('body.admin-page #admin-preview .dash')}
function ensure(){const host=root();if(!host)return null;let el=host.querySelector('[data-dashboard-v3]');if(!el){el=document.createElement('section');el.className='admin-dashboard-v3';el.dataset.dashboardV3='1';host.prepend(el);}return el;}
function range(r){const start=String(r.preferredTime||'').slice(0,5);const duration=Number(r.actualDurationMinutes??r.durationMinutes??0);const lockTimes=Array.isArray(r.lockTimes)?r.lockTimes:[];const fallback=lockTimes.length?addMinutes(lockTimes[lockTimes.length-1],30):String(r.slotEnd||'').slice(0,5);const end=start&&duration?addMinutes(start,duration):fallback;return end?`${start}–${end}`:(start||'—')}
function currentView(){return (location.hash||'#dashboard').slice(1)||'dashboard'}
function monthPrefix(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}`}
function dayLabel(date){return `週${'日一二三四五六'[date.getDay()]}`}
function activeRows(){return rows.filter(r=>!['cancelled','no_show'].includes(r.status))}
function sidebarLink(label){return [...document.querySelectorAll('.sidebar a')].find(a=>(a.textContent||'').trim()===label)}
function customerKey(row){const phone=String(row.customerPhone||'').replace(/[^0-9+]/g,'');return phone||`${String(row.customerName||'').trim()}|${String(row.customerEmail||'').trim()}`}
function goto(label){
  const link=sidebarLink(label);
  if(!link)return;
  link.click();
  setTimeout(syncAfterNavigation,0);
}

function render(force=false){
  const host=root();const panel=ensure();if(!host||!panel)return;
  const isDashboard=currentView()==='dashboard';panel.hidden=!isDashboard;if(!isDashboard)return;
  const metrics=host.querySelector('.metrics');
  const original=[...host.querySelectorAll('.panel')].find(x=>!x.matches('.admin-v2-workspace')&&!x.closest('[data-dashboard-v3]'));
  if(metrics)metrics.hidden=true;if(original)original.hidden=true;

  const now=today();
  const active=activeRows();
  const todayRows=active.filter(r=>r.preferredDate===now&&!['completed'].includes(r.status));
  const month=monthPrefix();
  const monthRows=active.filter(r=>String(r.preferredDate||'').startsWith(month));
  const confirmedMonth=monthRows.filter(r=>['confirmed','completed'].includes(r.status)).length;

  const customerMap=new Map();
  monthRows.forEach(r=>{
    const key=customerKey(r);if(!key)return;
    const current=customerMap.get(key)||{isFirstVisit:false};
    current.isFirstVisit=current.isFirstVisit||r.isFirstVisit===true;
    customerMap.set(key,current);
  });
  const monthCustomers=[...customerMap.values()];
  const newMonth=monthCustomers.filter(c=>c.isFirstVisit).length;
  const returningMonth=Math.max(0,monthCustomers.length-newMonth);
  const newRate=monthCustomers.length?Math.round(newMonth/monthCustomers.length*100):0;

  const pending=active.filter(r=>r.status==='pending_confirmation');
  const unpaid=active.filter(r=>r.status==='pending_payment');
  const upcoming=active.filter(r=>!['completed'].includes(r.status)&&`${r.preferredDate||''} ${r.preferredTime||''}`>=`${now} 00:00`).sort((a,b)=>`${a.preferredDate||''} ${a.preferredTime||''}`.localeCompare(`${b.preferredDate||''} ${b.preferredTime||''}`));
  const next=upcoming[0];

  const weekDays=Array.from({length:7},(_,i)=>addDays(new Date(),i));
  const weekCounts=weekDays.map(d=>active.filter(r=>r.preferredDate===dateKey(d)&&!['completed'].includes(r.status)).length);
  const weekTotal=weekCounts.reduce((sum,n)=>sum+n,0);
  const weekMax=Math.max(1,...weekCounts);

  const serviceMap=new Map(SERVICE_CATEGORIES.map(name=>[name,0]));
  monthRows.forEach(r=>{
    const raw=String(r.serviceName||'').split('｜')[0].trim();
    const name=SERVICE_CATEGORIES.includes(raw)?raw:null;
    if(name)serviceMap.set(name,(serviceMap.get(name)||0)+1);
  });
  const services=SERVICE_CATEGORIES.map(name=>[name,serviceMap.get(name)||0]);
  const serviceMax=Math.max(1,...services.map(([,count])=>count));
  const hasMonthData=monthRows.length>0;

  const signature=JSON.stringify({now,todayRows:todayRows.map(r=>[r.id,r.status,r.preferredTime,r.durationMinutes]),monthRows:monthRows.map(r=>[r.id,r.status,r.serviceName,r.isFirstVisit,r.customerPhone]),pending:pending.map(r=>r.id),unpaid:unpaid.map(r=>r.id),next:next?.id||'',weekCounts});
  if(!force&&signature===lastSignature)return;lastSignature=signature;

  panel.innerHTML=`
    <div class="admin-view-head dashboard-overview-head">
      <div><span class="tag">BUSINESS PULSE</span><h3>營運總覽</h3></div>
      <div class="dashboard-overview-actions"><button type="button" data-overview-calendar>看行事曆</button><button type="button" data-overview-customers>看顧客</button></div>
    </div>

    <div class="dashboard-v3-metrics">
      <article><small>今日預約</small><b>${todayRows.length}</b><span>今天尚未完成的行程</span></article>
      <article><small>未來 7 天</small><b>${weekTotal}</b><span>接下來一週預約量</span></article>
      <article><small>本月有效預約</small><b>${monthRows.length}</b><span>其中 ${confirmedMonth} 筆已確認／完成</span></article>
      <article><small>本月新客比例</small><b>${newRate}%</b><span>${newMonth} 新客 · ${returningMonth} 回訪</span></article>
    </div>

    <div class="dashboard-overview-grid">
      <section class="dashboard-next-card">
        <div class="dashboard-v3-title"><div><small>NEXT</small><h4>下一位顧客</h4></div></div>
        ${next?`<div class="dashboard-next-main"><time>${esc(next.preferredDate||'')}<strong>${esc(range(next))}</strong></time><div><b>${esc(next.customerName||'未命名')}</b><span>${esc(next.serviceName||'—')}</span><small>${statusLabel(next.status)}</small></div></div>`:`<div class="dashboard-panel-empty"><b>目前沒有下一筆預約</b><span>之後有預約時，這裡會直接顯示下一位顧客。</span></div>`}
      </section>

      <section class="dashboard-attention-summary">
        <div class="dashboard-v3-title"><div><small>ACTION</small><h4>待處理</h4></div><button type="button" data-overview-bookings>前往處理</button></div>
        <div class="dashboard-attention-counts"><article><b>${pending.length}</b><span>待確認</span></article><article><b>${unpaid.length}</b><span>待收訂金</span></article></div>
      </section>

      <section class="dashboard-week-panel ${weekTotal===0?'is-empty':''}">
        <div class="dashboard-v3-title"><div><small>7 DAYS</small><h4>未來 7 天預約量</h4></div><b>${weekTotal} 筆</b></div>
        <div class="dashboard-week-bars">${weekDays.map((d,i)=>`<div><span>${dayLabel(d)}</span><i><em style="height:${weekCounts[i]===0?0:Math.max(8,Math.round(weekCounts[i]/weekMax*100))}%"></em></i><b>${weekCounts[i]}</b><small>${d.getMonth()+1}/${d.getDate()}</small></div>`).join('')}</div>
      </section>

      <section class="dashboard-service-panel ${!hasMonthData?'is-empty':''}">
        <div class="dashboard-v3-title"><div><small>MIX</small><h4>本月服務分布</h4></div></div>
        <div class="dashboard-service-bars">${services.map(([name,count])=>`<div><span><b>${esc(name)}</b><small>${count} 筆</small></span><i><em style="width:${count===0?0:Math.max(4,Math.round(count/serviceMax*100))}%"></em></i></div>`).join('')}</div>
        ${!hasMonthData?`<p class="dashboard-inline-empty">本月尚無預約資料，服務分類仍固定顯示。</p>`:''}
      </section>

      <section class="dashboard-customer-panel ${monthCustomers.length===0?'is-empty':''}">
        <div class="dashboard-v3-title"><div><small>CUSTOMERS</small><h4>本月顧客結構</h4></div></div>
        <div class="dashboard-customer-ratio"><div><span style="width:${newRate}%"></span></div><p><b>${newRate}%</b> 新客</p>${monthCustomers.length===0?`<small class="dashboard-inline-empty">尚無顧客資料，之後會在同一位置顯示比例。</small>`:''}</div>
        <div class="dashboard-customer-counts"><span><b>${newMonth}</b><small>新客</small></span><span><b>${returningMonth}</b><small>回訪</small></span></div>
      </section>
    </div>`;

  panel.querySelector('[data-overview-bookings]')?.addEventListener('click',()=>goto('預約管理'));
  panel.querySelector('[data-overview-calendar]')?.addEventListener('click',()=>goto('預約行事曆'));
  panel.querySelector('[data-overview-customers]')?.addEventListener('click',()=>goto('顧客資料'));
}

function syncAfterNavigation(){lastSignature='';requestAnimationFrame(()=>render(true));}
function start(){
  if(!getApps().length)return setTimeout(start,80);
  const db=getFirestore(getApp());
  onSnapshot(collection(db,'bookings'),snap=>{rows=snap.docs.map(d=>({id:d.id,...d.data()}));render();});
  document.addEventListener('click',event=>{if(event.target.closest?.('.sidebar a'))setTimeout(syncAfterNavigation,0);},true);
  addEventListener('hashchange',syncAfterNavigation);
  addEventListener('popstate',syncAfterNavigation);
  syncAfterNavigation();
}
start();
