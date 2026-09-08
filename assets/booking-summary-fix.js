(()=>{
  const DURATION_MINUTES=90;

  function addMinutes(time,amount){
    const [hours,minutes]=String(time||'').split(':').map(Number);
    if(!Number.isFinite(hours)||!Number.isFinite(minutes))return '';
    const total=hours*60+minutes+amount;
    const endHours=Math.floor(total/60)%24;
    const endMinutes=total%60;
    return `${String(endHours).padStart(2,'0')}:${String(endMinutes).padStart(2,'0')}`;
  }

  function updateSummary(){
    document.querySelectorAll('.summary').forEach((summary)=>{
      const rows=[...summary.children];
      const startRow=rows.find((row)=>row.querySelector('small')?.textContent.trim()==='開始時間');
      const durationRow=rows.find((row)=>row.querySelector('small')?.textContent.trim()==='預留');
      if(!startRow||!durationRow)return;
      const startTime=startRow.querySelector('b')?.textContent.trim();
      const endTime=addMinutes(startTime,DURATION_MINUTES);
      if(!endTime)return;
      durationRow.querySelector('small').textContent=`結束時間（${DURATION_MINUTES} 分鐘）`;
      durationRow.querySelector('b').textContent=endTime;
    });
  }

  new MutationObserver(()=>queueMicrotask(updateSummary)).observe(document.documentElement,{childList:true,subtree:true});
  updateSummary();
})();
