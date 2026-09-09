(()=>{
  const root=document.querySelector('#booking');
  if(!root)return;

  let lastView='';
  let scheduled=false;

  const currentView=()=>{
    const activeStep=root.querySelector('.step.on[data-step]');
    if(activeStep)return `step-${activeStep.dataset.step}`;
    if(root.querySelector('.success.on'))return 'success';
    return '';
  };

  const scrollToPageTop=()=>{
    requestAnimationFrame(()=>{
      window.scrollTo({top:0,left:0,behavior:'auto'});
    });
  };

  const sync=()=>{
    scheduled=false;
    const view=currentView();
    if(!view)return;
    if(lastView&&view!==lastView)scrollToPageTop();
    lastView=view;
  };

  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(sync);
  };

  new MutationObserver(schedule).observe(root,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['class']
  });

  document.addEventListener('click',(event)=>{
    if(!event.target.closest?.('#booking [data-next],#booking [data-prev],#booking [data-submit]'))return;
    setTimeout(schedule,0);
  });

  sync();
})();
