// File-read percentages are real FileReader events. Network/server work is indeterminate.
export function showUploadQueue(host, files) {
  host.replaceChildren();host.hidden=false;
  const rows=files.map(file=>{
    const row=document.createElement('li'),name=document.createElement('strong'),detail=document.createElement('span'),bar=document.createElement('progress');
    name.textContent=file.name;detail.textContent='已選取，準備上傳';bar.max=100;bar.removeAttribute('value');bar.setAttribute('aria-label',file.name+' 處理進度');
    row.className='record-upload-item';detail.className='record-upload-detail';row.append(name,detail,bar);host.append(row);return {row,detail,bar};
  });
  const text={connecting:'正在連接上傳服務…',reading:'正在讀取檔案',optimizing:'正在建立辨識用圖片；原檔保留不變…',original:'使用原始檔案辨識',ready:'檔案已讀取，等待連線…',sending:'檔案上傳中，請稍候…',retrying:'連線暫時中斷，正在重新傳送同一份檔案…',accepted:'上傳完成',failed:'上傳未完成'};
  return {update(index,state,extra='',loaded,total){
    const item=rows[index];if(!item)return;
    item.row.dataset.state=state;item.detail.textContent=(text[state]||state)+(extra?' '+extra:'');
    if(state==='reading'&&total){item.bar.value=Math.round(loaded/total*100);item.detail.textContent+=' '+item.bar.value+'%；尚未上傳完成';}
    else if(state==='accepted')item.bar.value=100;
    else item.bar.removeAttribute('value');
  }};
}
