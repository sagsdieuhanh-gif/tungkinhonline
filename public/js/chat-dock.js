'use strict';
/**
 * Reusable movable chat window for visitors and the abbot.
 * The mini bubble always remains visible; floating panel is collapsed by
 * default so a phone-sized prayer hall is never obstructed.
 */
(function(){
  window.setupMovableTempleChat=function(opts){
    const panel=document.getElementById(opts.panelId);
    const header=document.getElementById(opts.headerId);
    const toggle=document.getElementById(opts.toggleId);
    const close=document.getElementById(opts.closeId);
    if(!panel||!header||!toggle)return;
    const key='sags-tam-bao-chat-'+opts.storeKey;
    let stored={};
    try{stored=JSON.parse(localStorage.getItem(key)||'{}')}catch(_){}
    let expanded=stored.expanded===true;
    function screenPosition(x,y) {
      const w=panel.offsetWidth||350,h=panel.offsetHeight||350;
      return {
        x:Math.min(Math.max(5,x),Math.max(5,innerWidth-w-5)),
        y:Math.min(Math.max(5,y),Math.max(5,innerHeight-h-5))
      };
    }
    function save(){
      try{localStorage.setItem(key,JSON.stringify({
        expanded,x:parseFloat(panel.style.left)||null,y:parseFloat(panel.style.top)||null
      }))}catch(_){}
    }
    function applyExpanded(next){
      expanded=Boolean(next);
      panel.classList.toggle('chat-collapsed',!expanded);
      toggle.setAttribute('aria-expanded',String(expanded));
      toggle.textContent=expanded?'✕ Thu gọn chat':'💬 Mở phòng chat';
      if(expanded){
        if(Number.isFinite(Number(stored.x))&&Number.isFinite(Number(stored.y))&&stored.x!==null&&stored.y!==null){
          const p=screenPosition(stored.x,stored.y);
          panel.style.left=p.x+'px';
          panel.style.top=p.y+'px';
          panel.style.right='auto';
          panel.style.bottom='auto';
        }
      }
      save();
    }
    toggle.addEventListener('click',()=>applyExpanded(!expanded));
    close?.addEventListener('click',()=>applyExpanded(false));
    let drag=null;
    header.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,a,input'))return;
      if(!expanded)return;
      const b=panel.getBoundingClientRect();
      drag={x:event.clientX-b.left,y:event.clientY-b.top};
      try{header.setPointerCapture(event.pointerId)}catch(_){}
      header.classList.add('dragging');
      event.preventDefault();
    });
    header.addEventListener('pointermove',event=>{
      if(!drag)return;
      const p=screenPosition(event.clientX-drag.x,event.clientY-drag.y);
      panel.style.left=p.x+'px';
      panel.style.top=p.y+'px';
      panel.style.bottom='auto';
      panel.style.right='auto';
    });
    const end=()=>{if(!drag)return;drag=null;header.classList.remove('dragging');save()};
    header.addEventListener('pointerup',end);
    header.addEventListener('pointercancel',end);
    window.addEventListener('resize',()=>{
      if(!expanded||!panel.style.left)return;
      const p=screenPosition(parseFloat(panel.style.left),parseFloat(panel.style.top));
      panel.style.left=p.x+'px';panel.style.top=p.y+'px';save();
    });
    applyExpanded(expanded);
    return {expand:applyExpanded};
  };
})();
