(()=>{
  const pad=n=>String(n).padStart(2,'0');
  const parse=value=>{const [y,m,d]=String(value||'').split('-').map(Number);return new Date(Date.UTC(y,m-1,d||1));};
  const format=date=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
  const addDays=(value,amount)=>{const d=parse(value);d.setUTCDate(d.getUTCDate()+amount);return format(d);};
  const taipeiToday=()=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const earliestDate=()=>addDays(taipeiToday(),1);
  const monthStart=value=>`${String(value||'').slice(0,7)}-01`;
  const moveMonth=(value,amount)=>{const d=parse(monthStart(value));d.setUTCMonth(d.getUTCMonth()+amount);return format(d);};
  const monthLabel=value=>{const d=parse(value);return `${d.getUTCFullYear()} 年 ${d.getUTCMonth()+1} 月`;};
  const dateLabel=value=>{const d=parse(value);return `${d.getUTCFullYear()}/${pad(d.getUTCMonth()+1)}/${pad(d.getUTCDate())}（週${'日一二三四五六'[d.getUTCDay()]}）`;};
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

  function setOpen(modal,trigger,open){
    modal.hidden=!open;
    trigger.setAttribute('aria-expanded',open?'true':'false');
    document.body.classList.toggle('admin-slot-calendar-open',open);
  }

  function mount(){
    queued=false;
    const view=document.querySelector('[data-admin-slot-view]');
    const input=view?.querySelector('[data-slot-date]');
    if(!view||!input)return;
    const minimum=earliestDate();
    input.min=minimum;
    const originalLabel=input.closest('label');
    if(originalLabel){
      originalLabel.hidden=true;
      originalLabel.style.setProperty('display','none','important');
      originalLabel.setAttribute('aria-hidden','true');
    }
    input.setAttribute('tabindex','-1');
    if(!input.value||input.value<minimum){
      input.value=minimum;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const controls=view.querySelector('.admin-slot-controls');
    if(!controls)return;

    let picker=view.querySelector('[data-admin-slot-date-picker]');
    if(!picker){
      picker=document.createElement('div');
      picker.className='admin-slot-date-picker';
      picker.dataset.adminSlotDatePicker='1';
      picker.innerHTML='<small>日期</small><button type="button" class="admin-slot-date-trigger" data-slot-date-trigger aria-haspopup="dialog" aria-expanded="false"><b data-slot-date-label></b><span>選擇日期</span></button>';
      controls.insertBefore(picker,controls.firstElementChild);
    }

    let panel=view.querySelector('[data-admin-slot-calendar]');
    if(!panel){
      panel=document.createElement('section');
      panel.className='admin-slot-calendar';
      panel.dataset.adminSlotCalendar='1';
    }

    let modal=view.querySelector('[data-admin-slot-calendar-modal]');
    if(!modal){
      modal=document.createElement('div');
      modal.className='admin-slot-calendar-modal';
      modal.dataset.adminSlotCalendarModal='1';
      modal.hidden=true;
      modal.innerHTML='<section class="admin-slot-calendar-dialog" role="dialog" aria-modal="true" aria-label="選擇時段功能日期"><header><div><small>DATE</small><h4>選擇日期</h4></div><button type="button" data-slot-cal-close aria-label="關閉">×</button></header><div class="admin-slot-calendar-dialog-body" data-slot-cal-dialog-body></div></section>';
      view.appendChild(modal);
    }
    const body=modal.querySelector('[data-slot-cal-dialog-body]');
    if(panel.parentElement!==body)body.appendChild(panel);

    const trigger=picker.querySelector('[data-slot-date-trigger]');
    const label=picker.querySelector('[data-slot-date-label]');
    const close=modal.querySelector('[data-slot-cal-close]');
    let month=monthStart(input.value||minimum);

    const syncTrigger=()=>{label.textContent=dateLabel(input.value||minimum);};
    const closeDialog=(focusTrigger=false)=>{setOpen(modal,trigger,false);if(focusTrigger)trigger.focus();};
    const draw=()=>{
      const selected=input.value;
      const minDate=earliestDate();
      const minMonth=monthStart(minDate);
      if(month<minMonth)month=minMonth;
      panel.dataset.month=month;
      panel.innerHTML=`<div class="admin-slot-calendar-bar"><button type="button" data-slot-cal-prev aria-label="上個月" ${month<=minMonth?'disabled':''}>←</button><b>${monthLabel(month)}</b><button type="button" data-slot-cal-next aria-label="下個月">→</button></div><div class="admin-slot-calendar-week">${'日一二三四五六'.split('').map(x=>`<span>${x}</span>`).join('')}</div><div class="admin-slot-calendar-grid">${cells(month).map(date=>{
        if(!date)return '<span></span>';
        const expired=date<minDate;
        return `<button type="button" class="${date===selected?'on ':''}${expired?'expired':''}" data-slot-cal-date="${date}" ${expired?'disabled aria-disabled="true"':''}>${parse(date).getUTCDate()}</button>`;
      }).join('')}</div>`;
      panel.querySelector('[data-slot-cal-prev]').onclick=()=>{if(month<=minMonth)return;month=moveMonth(month,-1);draw();};
      panel.querySelector('[data-slot-cal-next]').onclick=()=>{month=moveMonth(month,1);draw();};
      panel.querySelectorAll('[data-slot-cal-date]:not(:disabled)').forEach(button=>button.onclick=()=>{
        const value=button.dataset.slotCalDate;
        if(value<earliestDate())return;
        input.value=value;
        month=monthStart(input.value);
        input.dispatchEvent(new Event('change',{bubbles:true}));
        syncTrigger();
        draw();
        closeDialog(true);
      });
    };

    syncTrigger();
    if(picker.dataset.bound==='1')return;
    picker.dataset.bound='1';
    trigger.onclick=()=>{
      const minDate=earliestDate();
      if(!input.value||input.value<minDate){
        input.value=minDate;
        input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      month=monthStart(input.value||minDate);
      draw();
      setOpen(modal,trigger,true);
      close.focus();
    };
    close.onclick=()=>closeDialog(true);
    modal.addEventListener('click',event=>{if(event.target===modal)closeDialog(true);});
    input.addEventListener('change',()=>{
      const minDate=earliestDate();
      if(!input.value||input.value<minDate)input.value=minDate;
      month=monthStart(input.value||minDate);
      syncTrigger();
      draw();
    });
    draw();
  }

  if(!document.documentElement.dataset.adminSlotCalendarEscapeBound){
    document.documentElement.dataset.adminSlotCalendarEscapeBound='1';
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      const modal=document.querySelector('[data-admin-slot-calendar-modal]:not([hidden])');
      if(!modal)return;
      modal.hidden=true;
      document.body.classList.remove('admin-slot-calendar-open');
      const trigger=document.querySelector('[data-slot-date-trigger]');
      trigger?.setAttribute('aria-expanded','false');
      trigger?.focus();
    });
  }

  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(mount);};
  new MutationObserver(schedule).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(schedule,0));
  schedule();
})();
