/* First-visit install invitation. Native prompt on supporting Android/desktop,
   manual Share -> Add to Home Screen instructions on iOS Safari. */
(function () {
  'use strict';
  const KEY='kidlite.install.invited.v1';
  let deferred=null;
  let ready=false;
  function installed() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigator.standalone===true;
  }
  const isiOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const isSafari=()=>/Safari/i.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
  function readFlag() {try {return localStorage.getItem(KEY)==='1';}catch(_){return false;}}
  function setFlag() {try {localStorage.setItem(KEY,'1');}catch(_){}}
  function ui() {
    return {
      dialog:document.getElementById('install-dialog'),
      instruction:document.getElementById('install-instructions'),
      button:document.getElementById('install-action'),
      later:document.getElementById('install-later')
    };
  }
  function guidance() {
    const {instruction,button}=ui();
    if(!instruction||!button)return;
    if(isiOS()) {
      instruction.textContent=isSafari()
        ? 'In Safari, tap Share, then Add to Home Screen. Choose Open as Web App when offered.'
        : 'Open this page in Safari. Tap Share, then Add to Home Screen.';
      button.textContent='Show steps';
    } else if(deferred) {
      instruction.textContent='Add KidLite to your home screen for quick access to offline stories and games.';
      button.textContent='Add to Home Screen';
    } else {
      instruction.textContent='Open your browser menu and choose Install app or Add to Home Screen.';
      button.textContent='Show steps';
    }
  }
  function open(force=false) {
    if(installed())return false;
    const {dialog}=ui();
    if(!dialog || dialog.open)return false;
    if(!force && readFlag())return false;
    guidance();
    const {button}=ui();
    if(button)button.onclick=installAction;
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    if(!force)setFlag(); // a one-time invitation, never a persistent startup nag
    return true;
  }
  function close() {
    const {dialog}=ui();
    if(dialog?.open)dialog.close();
  }
  async function installAction() {
    const {instruction,button}=ui();
    if(installed()){close();return;}
    if(deferred) {
      const prompt=deferred;deferred=null;
      try {
        await prompt.prompt();
        await prompt.userChoice;
        close(); // the browser owns the user's choice
      } catch (_) {
        guidance();
      }
      return;
    }
    // iOS does not support a programmatic PWA install prompt. Do not claim installation.
    if(instruction) {
      instruction.textContent=isiOS()
        ? (isSafari()
          ? 'Step 1: Tap the Safari Share icon. Step 2: Select Add to Home Screen. Step 3: Tap Add.'
          : 'Step 1: Open this site in Safari. Step 2: Tap Share. Step 3: Add to Home Screen.')
        : 'Step 1: Open the browser menu (⋮). Step 2: Choose Install app or Add to Home Screen.';
    }
    if(button)button.textContent='Got it';
    button.onclick=close;
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferred=event;
    guidance();
    const button=ui().button;
    if(button)button.onclick=installAction;
  });
  window.addEventListener('appinstalled',()=>{
    deferred=null;setFlag();close();
  });
  function init() {
    if(ready)return;
    ready=true;
    const {button,later}=ui();
    if(button)button.onclick=installAction;
    if(later)later.onclick=close;
    // Wait until the first visible load, while preserving an explicit later Settings entry.
    if(!installed() && !readFlag())setTimeout(()=>open(),700);
  }
  if(document.readyState==='complete')init();
  else window.addEventListener('load',init,{once:true});
  window.KidLiteInstall={open:()=>open(true),get installed(){return installed();}};
})();
