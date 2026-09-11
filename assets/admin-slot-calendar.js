(()=>{
  const pad=n=>String(n).padStart(2,'0');
  const parse=value=>{const [y,m,d]=String(value||'').split('-').map(Number);return new Date(Date.UTC(y,m-1,d||1));};
  const format=date=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
  const monthStart=value=>`${String(value||'').slice(0,7)}-01`;
  const moveMonth=(value,amount)=>{const d=parse(monthStart(value));d.setUTCMonth(d.getUTCMonth()+amount);return format(d);};
  const monthLabel=value=>{const d=parse(value);return `${d.getUTCFullYear()} 年 ${d.getUTCMonth()+1} 月`;};
  const cells=value=>{
    const first=parse(monthStart(value));
    const start=first.getUTCDay();
    const next=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,1));
    const count=Math.round((next-first)/86400000);
    const list=Array(start).fill(null);
    for(let day=1;day<=count;day++)list.push(`${first.getUTCFullYear()}-${pad(first.getUTCMonth()+1)}-${pad(day)}`);
    while(list.length%7)list.push(null);
    return list;
  };
  let queued=false;

  function mount(){
    queued=false;
    const view=document.querySelector('[data-admin-slot-view]');
    const input=view?.querySelector('[data-slot-date]');
    if(!view||!input)return;
    const originalLabel=input.closest('label');
    if(originalLabel)originalLabel.hidden=true;

    let panel=view.querySelector('[data-admin-slot-calendar]');
    if(panel?.dataset.bound==='1')return;
    if(!panel){
      panel=document.createElement('section');
      panel.className='admin-slot-calendar';
      panel.dataset.adminSlotCalendar='1';
      const controls=view.querySelector('.admin-slot-controls');
      controls?.insertAdjacentElement('beforebegin',panel);
    }
    panel.dataset.bound='1';
    let month=monthStart(input.value||new Date().toISOString().slice(0,10));
    panel.dataset.month=month;

    const draw=()=>{
      const selected=input.value;
      panel.dataset.month=month;
      panel.innerHTML=`<div class="admin-slot-calendar-bar"><button type="button" data-slot-cal-prev aria-label="上個月">←</button><b>${monthLabel(month)}</b><button type="button" data-slot-cal-next aria-label="下個月">→</button></div><div class="admin-slot-calendar-week">${'日一二三四五六'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="admin-slot-calendar-grid">${cells(month).map(date=>date?`<button type="button" class="${date===selected?'on':''}" data-slot-cal-date="${date}">${parse(date).getUTCDate()}</button>`:'<span></span>').join('')}</div>`;
      panel.querySelector('[data-slot-cal-prev]').onclick=()=>{month=moveMonth(month,-1);draw();};
      panel.querySelector('[data-slot-cal-next]').onclick=()=>{month=moveMonth(month,1);draw();};
      panel.querySelectorAll('[data-slot-cal-date]').forEach(button=>button.onclick=()=>{
        input.value=button.dataset.slotCalDate;
        month=monthStart(input.value);
        input.dispatchEvent(new Event('change',{bubbles:true}));
        draw();
      });
    };
    input.addEventListener('change',()=>{month=monthStart(input.value||month);draw();});
    draw();
  }
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(mount);};
  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(schedule,0));
  schedule();
})();
