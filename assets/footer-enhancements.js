(()=>{
  const footer=document.querySelector('.site-footer');
  if(!footer||footer.dataset.footerV2==='1')return;

  const B=location.hostname.endsWith('github.io')?'/77-waxing-site':'';
  const assetBase=new URL('.',import.meta.url);

  if(!document.querySelector('link[data-footer-v2-style="1"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=new URL('./footer.css?v=20260915-footer3-coral',assetBase).href;
    link.dataset.footerV2Style='1';
    document.head.appendChild(link);
  }

  const oldSocials=[...footer.querySelectorAll('.footer-socials a[href]')].map((a)=>a.cloneNode(true));
  const socialFallback=[
    ['Instagram','https://www.instagram.com/77waxing/'],
    ['LINE','https://line.me/R/ti/p/@517qsogs?oat_content=url&ts=03111856'],
  ];

  const linkList=(title,items)=>`
    <section class="footer-v2-group">
      <h3>${title}</h3>
      <div class="footer-v2-links">
        ${items.map(([label,href,attrs=''])=>`<a href="${href}" ${attrs}>${label}</a>`).join('')}
      </div>
    </section>`;

  footer.dataset.footerV2='1';
  footer.innerHTML=`
    <div class="footer-v2-main">
      <section class="footer-v2-brand" aria-label="77waxing 品牌資訊">
        <a class="footer-v2-wordmark" href="${B}/" aria-label="回到 77waxing 首頁">
          <img src="${B}/assets/77waxing-wordmark.svg" alt="77 WAXING">
        </a>
        <p>77美學工作室</p>
        <div class="footer-v2-socials" aria-label="社群連結"></div>
      </section>

      <div class="footer-v2-directory" aria-label="網站導覽">
        ${linkList('探索 77',[
          ['關於我們',`${B}/about/`],
          ['首次來店',`${B}/about/#first-visit`],
          ['價目',`${B}/menu/`],
          ['空間',`${B}/space/`],
          ['教學',`${B}/courses/`],
        ])}
        ${linkList('服務項目',[
          ['女性熱蠟',`${B}/services/women-waxing/`],
          ['男士熱蠟',`${B}/services/men-waxing/`],
          ['肌膚管理',`${B}/services/skin-care/`],
          ['美胸保養',`${B}/services/bust-care/`],
        ])}
        ${linkList('預約與購物',[
          ['立即預約',`${B}/booking/`],
          ['產品訂購',`${B}/shop/`,'target="_blank" rel="noopener noreferrer"'],
          ['會員中心','#member','data-member-trigger="1"'],
        ])}
        ${linkList('聯絡我們',[
          ['Instagram','https://www.instagram.com/77waxing/','target="_blank" rel="noopener noreferrer"'],
          ['LINE 官方帳號','https://line.me/R/ti/p/@517qsogs?oat_content=url&ts=03111856','target="_blank" rel="noopener noreferrer"'],
          ['Google Maps','https://www.google.com/maps/search/?api=1&query=77%E7%BE%8E%E5%AD%B8%E5%B7%A5%E4%BD%9C%E5%AE%A4','target="_blank" rel="noopener noreferrer"'],
          ['隱私權政策',`${B}/privacy/`],
        ])}
      </div>
    </div>

    <div class="footer-v2-bottom">
      <div>
        <strong>77美學工作室</strong>
        <span>安心躺好，剩下的交給 77。</span>
      </div>
      <div class="footer-v2-legal">
        <span>© 2026 77waxing. All Rights Reserved.</span>
        <span>網站內容、服務項目與圖片版權皆屬 77waxing 所有。</span>
        <span>Power by豆腐Arno</span>
      </div>
    </div>`;

  const socialWrap=footer.querySelector('.footer-v2-socials');
  if(oldSocials.length){
    oldSocials.forEach((a)=>{
      a.removeAttribute('style');
      socialWrap.appendChild(a);
    });
  }else{
    socialFallback.forEach(([label,href])=>{
      const a=document.createElement('a');
      a.href=href;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.textContent=label;
      socialWrap.appendChild(a);
    });
  }
})();
