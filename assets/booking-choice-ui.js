(()=>{
  const SELECTORS='select[name="gender"],select[name="first"]';
  const mounted=new WeakSet();
  let openControl=null;

  const closeControl=(control=openControl)=>{
    if(!control)return;
    control.classList.remove('open');
    const trigger=control.querySelector('[data-booking-choice-trigger]');
    trigger?.setAttribute('aria-expanded','false');
    if(openControl===control)openControl=null;
  };

  const optionText=(option)=>String(option?.textContent||'').trim();

  function mountSelect(select){
    if(!select||mounted.has(select))return;
    mounted.add(select);
    select.classList.add('booking-native-select');

    const control=document.createElement('div');
    control.className='booking-choice-control';
    control.dataset.bookingChoice=select.name;

    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='booking-choice-trigger';
    trigger.dataset.bookingChoiceTrigger='1';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');

    const value=document.createElement('span');
    value.className='booking-choice-value';
    const arrow=document.createElement('i');
    arrow.className='booking-choice-arrow';
    arrow.setAttribute('aria-hidden','true');
    trigger.append(value,arrow);

    const menu=document.createElement('div');
    menu.className='booking-choice-menu';
    menu.setAttribute('role','listbox');
    menu.tabIndex=-1;

    [...select.options].forEach((option,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='booking-choice-option';
      button.dataset.bookingChoiceValue=option.value;
      button.dataset.bookingChoiceIndex=String(index);
      button.setAttribute('role','option');
      button.textContent=optionText(option);
      button.addEventListener('click',(event)=>{
        event.preventDefault();
        event.stopPropagation();
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        sync();
        closeControl(control);
        trigger.focus({preventScroll:true});
      });
      menu.appendChild(button);
    });

    const sync=()=>{
      const selected=select.selectedOptions[0]||select.options[0];
      value.textContent=optionText(selected)||'請選擇';
      [...menu.querySelectorAll('[data-booking-choice-value]')].forEach((button)=>{
        const on=button.dataset.bookingChoiceValue===select.value;
        button.classList.toggle('on',on);
        button.setAttribute('aria-selected',String(on));
      });
    };

    const open=()=>{
      if(openControl&&openControl!==control)closeControl(openControl);
      control.classList.add('open');
      trigger.setAttribute('aria-expanded','true');
      openControl=control;
      requestAnimationFrame(()=>menu.querySelector('.booking-choice-option.on')?.focus({preventScroll:true}));
    };

    trigger.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      control.classList.contains('open')?closeControl(control):open();
    });

    control.addEventListener('keydown',(event)=>{
      const buttons=[...menu.querySelectorAll('.booking-choice-option')];
      const current=Math.max(0,buttons.indexOf(document.activeElement));
      if(event.key==='Escape'){
        event.preventDefault();
        closeControl(control);
        trigger.focus({preventScroll:true});
        return;
      }
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        if(!control.classList.contains('open')){open();return;}
        const delta=event.key==='ArrowDown'?1:-1;
        buttons[(current+delta+buttons.length)%buttons.length]?.focus({preventScroll:true});
      }
    });

    select.addEventListener('change',sync);
    control.append(trigger,menu);
    select.insertAdjacentElement('afterend',control);
    sync();
  }

  function apply(){
    document.querySelectorAll(`#booking ${SELECTORS}`).forEach(mountSelect);
  }

  document.addEventListener('click',(event)=>{
    if(openControl&&!event.target.closest('.booking-choice-control'))closeControl(openControl);
  });
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape')closeControl(openControl);
  });

  const root=document.querySelector('#app')||document.body;
  new MutationObserver(()=>queueMicrotask(apply)).observe(root,{childList:true,subtree:true});
  apply();
})();
