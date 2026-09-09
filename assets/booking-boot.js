(()=>{
  const body=document.body;
  const app=document.querySelector('#app');
  if(!body||!app)return;
  let done=false;
  const reveal=()=>{
    if(done)return;
    const booking=document.querySelector('#booking[data-booking-v3-mounted="1"]');
    if(!booking)return;
    done=true;
    body.classList.remove('booking-boot');
    observer.disconnect();
  };
  const observer=new MutationObserver(reveal);
  observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['data-booking-v3-mounted']});
  requestAnimationFrame(reveal);
  setTimeout(()=>{
    if(done)return;
    done=true;
    body.classList.remove('booking-boot');
    observer.disconnect();
  },2500);
})();
