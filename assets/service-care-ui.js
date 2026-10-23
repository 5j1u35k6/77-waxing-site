import './service-care-content.js?v=20261023-care2';

const care = globalThis.WaxingServiceCare;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = new URL('./service-care.css?v=20261023-care-header1', import.meta.url).href;
document.head.append(style);
let modal;
let opener;
const list = items => `<ul>${items.map(text => `<li>${escape(text)}</li>`).join('')}</ul>`;
function groupsFor(category, item, addons = []) {
  const group = category?.groups?.find(entry => entry.items?.some(value => value.id === item?.id)) || {};
  return care.forSelection(category, item, group, addons);
}
export function beforeCareMarkup(category, item, addons = []) {
  if (!item) return '';
  return `<section class="care-reminder" data-care-version="${care.version}" aria-label="施作前注意事項"><span class="care-eyebrow">BEFORE YOUR VISIT</span><h3>施作前注意事項</h3><p class="care-selection">${escape(category.name)}｜${escape(item.name)}</p>${groupsFor(category,item,addons).map(guide=>`<h4>${escape(guide.title)}</h4>${list(guide.before)}`).join('')}<p class="care-safety">${escape(care.safety)}</p></section>`;
}
export function showServiceCare(category, item, {beforeOnly = false, addons = []} = {}) {
  if (!item) return;
  if (!modal?.open) opener = document.activeElement;
  if (!modal) {
    modal = document.createElement('dialog');
    modal.className = 'service-care-dialog';
    modal.setAttribute('aria-labelledby','service-care-title');
    modal.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});});
    modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
    document.body.append(modal);
  }
  const guides = groupsFor(category,item,addons);
  modal.innerHTML = `<div class="care-dialog-head"><div><span class="care-eyebrow">77WAXING · SERVICE CARE</span><h2 id="service-care-title">${beforeOnly?'預約前，請先閱讀':'服務注意事項'}</h2><p>${escape(category.name)}｜${escape(item.name)}</p></div><button type="button" class="care-close" aria-label="關閉注意事項">×</button></div><div class="care-dialog-body">${guides.map(guide=>`<section class="care-guide"><h3>${escape(guide.title)}</h3>${['before','during','after'].map((stage,index)=>`<details ${beforeOnly ? (index===0?'open':'') : 'open'}><summary>${['施作前','施作中','施作後'][index]}注意事項</summary>${list(guide[stage])}</details>`).join('')}${guide.extra?`<details><summary>${escape(guide.extraTitle)}</summary>${list(guide.extra)}</details>`:''}</section>`).join('')}<p class="care-safety">${escape(care.safety)}</p></div><div class="care-dialog-actions"><button type="button" class="btn dark" data-care-done>關閉提醒，繼續${beforeOnly?'預約':'瀏覽'}</button></div>`;
  modal.querySelector('.care-close').onclick=()=>modal.close();
  modal.querySelector('[data-care-done]').onclick=()=>modal.close();
  if (!modal.open) modal.showModal();
  modal.scrollTop=0;
  modal.querySelector('.care-close').focus({preventScroll:true});
}
export function bindServiceCareCards(root, category) {
  root.querySelectorAll('[data-service-item-id]').forEach(card=>{
    const item = category.groups.flatMap(group=>group.items).find(entry=>entry.id===card.dataset.serviceItemId);
    if (!item) return;
    const button = document.createElement('button');
    button.type='button'; button.className='service-care-trigger';
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-label',`${item.name}：檢視施作前、中、後注意事項`);
    button.textContent='檢視施作前・中・後注意事項 →';
    button.onclick=()=>showServiceCare(category,item);
    card.append(button);
    card.addEventListener('click',event=>{if(!event.target.closest('button,a'))showServiceCare(category,item);});
  });
}
