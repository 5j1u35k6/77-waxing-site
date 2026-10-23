// Same flight-calendar/calbar/calgrid/calday classes and stylesheet as booking.
export function mountBirthdayCalendar(host,onChange){
  const input=host.querySelector('[name="birthday"]'),trigger=host.querySelector('[data-birthday-trigger]'),panel=host.querySelector('[data-birthday-calendar]');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date()),maxYear=Number(today.slice(0,4));
  let year=maxYear,month=Number(today.slice(5,7))-1;
  const pad=v=>String(v).padStart(2,'0');
  const close=()=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false');};
  function render(){
    year=Math.max(1900,Math.min(maxYear,year));if(year===maxYear&&month>Number(today.slice(5,7))-1)month=Number(today.slice(5,7))-1;
    panel.querySelector('[data-calendar-label]').textContent=`${year} 年 ${month+1} 月`;
    panel.querySelector('[data-calendar-year]').value=String(year);panel.querySelector('[data-calendar-month]').value=String(month);
    panel.querySelector('[data-calendar-prev]').disabled=year===1900&&month===0;
    panel.querySelector('[data-calendar-next]').disabled=year===maxYear&&month===Number(today.slice(5,7))-1;
    const offset=new Date(Date.UTC(year,month,1)).getUTCDay(),count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    const grid=panel.querySelector('.calgrid');grid.replaceChildren();
    for(let i=0;i<offset;i++)grid.appendChild(document.createElement('span'));
    for(let day=1;day<=count;day++){
      const date=`${year}-${pad(month+1)}-${pad(day)}`,button=document.createElement('button');button.type='button';button.className='calday'+(date===input.value?' on':'')+(date===today?' today':'');button.textContent=day;button.disabled=date>today;button.dataset.calendarDate=date;button.setAttribute('aria-label',`${year}年${month+1}月${day}日`);button.setAttribute('aria-pressed',String(date===input.value));
      button.onclick=()=>{input.value=date;input.dispatchEvent(new Event('input',{bubbles:true}));onChange?.();sync();close();trigger.focus();};grid.appendChild(button);
    }
  }
  const move=amount=>{const d=new Date(Date.UTC(year,month+amount,1));year=d.getUTCFullYear();month=d.getUTCMonth();render();};
  const sync=()=>{const p=input.value.split('-');trigger.textContent=input.value?`民國 ${Number(p[0])-1911} 年 ${Number(p[1])} 月 ${Number(p[2])} 日　▦`:'選擇生日　▦';};
  panel.querySelector('[data-calendar-year]').innerHTML=Array.from({length:maxYear-1899},(_,i)=>{const y=maxYear-i;return `<option value="${y}">民國 ${y-1911} 年（${y}）</option>`;}).join('');
  panel.querySelector('[data-calendar-month]').innerHTML=Array.from({length:12},(_,i)=>`<option value="${i}">${i+1} 月</option>`).join('');
  trigger.onclick=()=>{if(!panel.hidden){close();return;}const p=(input.value||today).split('-');year=Number(p[0]);month=Number(p[1])-1;render();panel.hidden=false;trigger.setAttribute('aria-expanded','true');};
  panel.querySelector('[data-calendar-prev]').onclick=()=>move(-1);panel.querySelector('[data-calendar-next]').onclick=()=>move(1);
  panel.querySelector('[data-calendar-year]').onchange=e=>{year=Number(e.target.value);render();};panel.querySelector('[data-calendar-month]').onchange=e=>{month=Number(e.target.value);render();};
  panel.querySelector('[data-calendar-clear]').onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));onChange?.();sync();close();trigger.focus();};
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();trigger.focus();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&e.target.dataset.calendarDate){e.preventDefault();const buttons=Array.from(panel.querySelectorAll('[data-calendar-date]')),index=buttons.indexOf(e.target),delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];buttons[Math.max(0,Math.min(buttons.length-1,index+delta))]?.focus();}});
  document.addEventListener('click',e=>{if(!host.contains(e.target))close();});sync();return {sync,close};
}
