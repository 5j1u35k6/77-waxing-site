import { customerRecordKey } from './customer-record-list.js?v=20261026-audit1';

const serviceText = value => String(value || '').replace(/\u64a5筋/g, '鬆筋');
const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false; const date = new Date(value + 'T12:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value; };
export function analyzeCustomers(bookings, records, profiles, { days = 90, today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()) } = {}) {
  const start = days ? new Date(new Date(today+'T12:00:00Z').getTime() - (days-1)*86400000).toISOString().slice(0,10) : '';
  const map = new Map(), services = new Map(), months = new Map();
  const ensure = row => {
    const key = customerRecordKey(row); if (!key || key === '|') return null;
    if (!map.has(key)) map.set(key, { key, count:0, totalBookings:0, paper:false, period:0, birthday:'', gender:'', email:'', phone:'', line:false, latest:'' });
    return map.get(key);
  };
  for (const row of records) {
    const customer = ensure(row); if (!customer) continue; customer.paper = true;
    for (const key of ['birthday','email','phone']) if (row[key]) customer[key] = row[key];
  }
  let appointments = 0, completed = 0, cancelled = 0, upcoming = 0;
  for (const row of [...bookings].sort((a,b)=>String(a.preferredDate||'').localeCompare(String(b.preferredDate||'')))) {
    const date = String(row.preferredDate || ''); if (!validDate(date)) continue;
    const inPeriod = date <= today && (!start || date >= start);
    const customer = ensure(row); if (!customer) continue; customer.totalBookings++;
    if (row.status === 'cancelled') { if (inPeriod) cancelled++; continue; }
    if (date > today) { upcoming++; continue; }
    const profile = profiles.get?.(row.ownerUid) || profiles[row.ownerUid] || {};
    customer.count++;
    customer.latest = date;
    customer.birthday = row.customerBirthday || profile.birthday || customer.birthday;
    customer.gender = row.customerGender || row.gender || profile.gender || customer.gender;
    customer.email = row.customerEmail || profile.email || customer.email;
    customer.phone = row.customerPhone || profile.phone || customer.phone;
    customer.line ||= Boolean(profile.lineUserId || profile.lineId || row.customerLineId);
    if (!inPeriod) continue;
    appointments++; customer.period++;
    if (row.status === 'completed') completed++;
    const service = serviceText(row.serviceName || '未填服務'); services.set(service,(services.get(service)||0)+1);
    const month = date.slice(0,7); months.set(month,(months.get(month)||0)+1);
  }
  const customers = [...map.values()].filter(row=>row.period > 0), genders = { '生理女':0, '生理男':0, '未填寫／其他舊資料':0 };
  const ages = { '未滿 20 歲':0, '20–29 歲':0, '30–39 歲':0, '40–49 歲':0, '50 歲以上':0, '未填寫／日期無效':0 };
  let multiple=0, withPhone=0, withEmail=0, withLine=0;
  for (const customer of customers) {
    if (customer.count >= 2) multiple++;
    if (customer.phone) withPhone++; if (customer.email) withEmail++; if (customer.line) withLine++;
    const gender = String(customer.gender).toLowerCase();
    genders[/^(female|女|女性|生理女)$/.test(gender)?'生理女':/^(male|男|男性|生理男)$/.test(gender)?'生理男':'未填寫／其他舊資料']++;
    let age = NaN;
    if (validDate(customer.birthday) && customer.birthday <= today) {
      age=Number(today.slice(0,4))-Number(customer.birthday.slice(0,4))-(today.slice(5)<customer.birthday.slice(5)?1:0);
    }
    ages[!Number.isFinite(age)||age<0||age>120?'未填寫／日期無效':age<20?'未滿 20 歲':age<30?'20–29 歲':age<40?'30–39 歲':age<50?'40–49 歲':'50 歲以上']++;
  }
  return { today,start,days,totalKnown:map.size,customers:customers.length,appointments,completed,cancelled,upcoming,
    first:customers.length-multiple,multiple,genders,ages,withPhone,withEmail,withLine,
    paperOnly:[...map.values()].filter(row=>row.paper && row.totalBookings===0).length,
    services:[...services].sort((a,b)=>b[1]-a[1]),months:[...months].sort((a,b)=>a[0].localeCompare(b[0])) };
}

export function renderCustomerAnalytics(host, data, onRange) {
  host.replaceChildren();
  const head=document.createElement('div');head.className='admin-view-head';
  const title=document.createElement('div');title.innerHTML='<span class="tag">CUSTOMERS</span><h3>客群分析</h3>';
  const label=document.createElement('label');label.textContent='分析期間 ';
  const select=document.createElement('select');select.setAttribute('aria-label','客群分析期間');
  for(const [value,text] of [[30,'最近 30 天'],[90,'最近 90 天'],[365,'最近一年'],[0,'全部歷史']]) { const option=document.createElement('option'); option.value=String(value);option.textContent=text;option.selected=value===data.days;select.append(option); }
  select.onchange=()=>onRange(Number(select.value));label.append(select);head.append(title,label);host.append(head);
  const note=document.createElement('p');note.className='muted';note.textContent=`依預約日期統計至 ${data.today}，排除已取消預約。預約筆數包含待確認、待付款、已確認、已完成及未到店；不代表實際到店次數。`;host.append(note);
  const metrics=document.createElement('div');metrics.className='audience-metrics';
  for(const [text,count] of [['期間預約顧客',data.customers],['期間預約筆數',data.appointments],['已完成服務',data.completed],['未來預約',data.upcoming]]) {const card=document.createElement('article'),caption=document.createElement('small'),number=document.createElement('b');caption.textContent=text;number.textContent=count;card.append(caption,number);metrics.append(card);}host.append(metrics);
  const grid=document.createElement('div');grid.className='audience-grid';
  const chart=(title,rows,description='')=>{
    const section=document.createElement('section'),heading=document.createElement('h4');heading.textContent=title;section.append(heading);
    if(description){const p=document.createElement('p');p.className='muted';p.textContent=description;section.append(p);}
    const max=Math.max(1,...rows.map(row=>row[1]));
    if(!rows.length||!rows.some(row=>row[1])){const p=document.createElement('p');p.className='muted';p.textContent='這段期間尚無資料。';section.append(p);}
    else for(const [label,value] of rows){const row=document.createElement('div'),name=document.createElement('span'),bar=document.createElement('i'),count=document.createElement('b');row.className='audience-bar';name.textContent=label;bar.style.setProperty('--audience-width',Math.round(value/max*100)+'%');count.textContent=value;row.append(name,bar,count);section.append(row);}
    grid.append(section);
  };
  chart('首次與多次預約',[['首次預約顧客',data.first],['多次預約顧客',data.multiple]],'依截至今日的有效歷史預約筆數區分；多次預約不等於已完成回訪。');
  chart('常預約的服務',data.services.slice(0,10),'顯示期間內最多人預約的前 10 個項目。');
  chart('年齡分布',Object.entries(data.ages),'依已填生日計算今日年齡，未填寫或無效日期獨立列出。');
  chart('生理性別',Object.entries(data.genders));
  chart('聯絡資料完整度',[['已填手機',data.withPhone],['已填 Email',data.withEmail],['已綁定 LINE',data.withLine]],'每一項分開計算，同一位顧客可能同時具備多種聯絡資料。');
  chart('每月預約筆數',data.months);
  host.append(grid);
  const footer=document.createElement('p');footer.className='muted';footer.textContent=`顧客名單共 ${data.totalKnown} 位，其中 ${data.paperOnly} 位目前僅有紙本轉入資料；期間內另有 ${data.cancelled} 筆已取消預約。不同手機／信箱可能被視為不同顧客。`;host.append(footer);
}
