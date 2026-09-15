(()=>{
  if(document.querySelector('style[data-desktop-rail-collapse-polish="1"]'))return;
  const style=document.createElement('style');
  style.dataset.desktopRailCollapsePolish='1';
  style.textContent=`
@media (min-width:851px){
  .desktop-side-nav{overflow:hidden}
  .desktop-side-nav__inner{opacity:1;visibility:visible;transform:translateX(0);transition:opacity .14s ease,transform .28s cubic-bezier(.22,.78,.2,1),visibility 0s linear 0s}
  .desktop-side-nav.is-collapsed{transform:translateX(78px)!important}
  .desktop-side-nav.is-collapsed .desktop-side-nav__inner{opacity:0;visibility:hidden;pointer-events:none;transform:translateX(12px);transition:opacity .12s ease,transform .24s cubic-bezier(.22,.78,.2,1),visibility 0s linear .12s}
  .desktop-side-nav.is-collapsed::after{left:2px;width:3px;opacity:1}
}
@media(prefers-reduced-motion:reduce){
  .desktop-side-nav__inner{transition:none!important}
}
`;
  document.head.appendChild(style);
})();
