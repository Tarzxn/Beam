'use strict';
(() => {
  const shapes=['circle','square','diamond','triangle','clover','flower','star','heart','house','sparkle'];
  const colors=['#d99b7a','#a5bca2','#9ab5c4','#b4a4cb','#d0a0b1','#c6b679','#bdaca0','#91b8b1'];
  const paths={diamond:'M32 7 57 32 32 57 7 32Z',triangle:'M32 8 58 54H6Z',heart:'M32 54C18 43 7 34 8 22C9 7 25 7 32 19C39 7 55 7 56 22C57 34 46 43 32 54Z',house:'M10 29 32 9 54 29V54H10Z',sparkle:'M32 5 40 24 59 32 40 40 32 59 24 40 5 32 24 24Z'};
  function markup(value){
    const v=value||{},color=/^#[a-f0-9]{6}$/i.test(v.color||'')?v.color:colors[0];
    if(v.kind==='image'&&/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(v.image||''))return `<img alt="" src="${v.image}" class="member-avatar-image">`;
    let body='';const shape=shapes.includes(v.shape)?v.shape:'clover';
    if(shape==='circle')body='<circle cx="32" cy="32" r="24"/>';
    else if(shape==='square')body='<rect x="9" y="9" width="46" height="46" rx="12"/>';
    else if(shape==='clover')body=[ [23,23],[41,23],[23,41],[41,41] ].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="14"/>`).join('');
    else if(shape==='flower')body=Array.from({length:8},(_,i)=>`<circle cx="${32+16*Math.cos(i*Math.PI/4)}" cy="${32+16*Math.sin(i*Math.PI/4)}" r="10"/>`).join('')+'<circle cx="32" cy="32" r="18"/>';
    else if(shape==='star')body='<polygon points="'+Array.from({length:10},(_,i)=>{const r=i%2?16:27,a=i*Math.PI/5-Math.PI/2;return(32+r*Math.cos(a))+','+(32+r*Math.sin(a))}).join(' ')+'"/>';
    else body=`<path d="${paths[shape]}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),ink=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)>115?'#292927':'#f5f2ec',y=shape==='triangle'?33:27;
    const eyes=v.eyes==='round'?`<circle cx="26" cy="${y+5}" r="2.8"/><circle cx="38" cy="${y+5}" r="2.8"/>`:v.eyes==='sleepy'?`<path d="M23 ${y+5}q3-3 6 0M35 ${y+5}q3-3 6 0" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`:`<rect x="24" y="${y}" width="4" height="10" rx="2"/><rect x="36" y="${y}" width="4" height="10" rx="2"/>`;
    return `<svg viewBox="0 0 64 64" class="member-character" aria-hidden="true"><g fill="${color}">${body}</g><g class="avatar-eyes" fill="${ink}">${eyes}</g></svg>`;
  }
  const dialog=document.createElement('dialog');dialog.id='avatar-dialog';dialog.className='avatar-dialog';
  dialog.innerHTML=`<div class="dialog-content"><div class="dialog-heading"><h2>Member picture</h2><button type="button" class="icon-button" id="avatar-close" aria-label="Close picture editor">×</button></div><div class="avatar-tabs"><button type="button" data-avatar-tab="character" class="active">Character</button><button type="button" data-avatar-tab="upload">Upload</button></div><div class="avatar-live" id="avatar-live"></div><div id="avatar-character-panel"><label class="field-label">Shape</label><div class="avatar-shapes" id="avatar-shapes"></div><label class="field-label">Colour</label><div class="avatar-colors" id="avatar-colors"></div><label class="avatar-custom-color">Custom colour <input type="color" id="avatar-custom"></label><div class="avatar-face-row"><label>Face <select id="avatar-eyes"><option value="line">Classic</option><option value="round">Round eyes</option><option value="sleepy">Soft eyes</option></select></label><button type="button" class="text-button" id="avatar-shuffle">Shuffle character</button></div></div><div id="avatar-upload-panel" class="hidden"><label class="avatar-file-label">Choose an image<input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><p class="field-note">Drag the image to frame it. Use the slider to zoom. Uploaded avatars are saved as a still image.</p><canvas id="avatar-crop" width="256" height="256" aria-label="Avatar crop preview"></canvas><label class="avatar-zoom-label">Zoom<input id="avatar-zoom" type="range" min="1" max="3" step="0.01" value="1"></label></div><p id="avatar-error" class="error-text" role="alert"></p><div class="dialog-actions"><button type="button" id="avatar-cancel" class="secondary-button">Cancel</button><button type="button" id="avatar-set" class="primary-button">Set picture</button></div></div>`;
  document.body.appendChild(dialog);
  let draft={},done=null,image=null,zoom=1,offset={x:0,y:0},pointer=null;
  function tab(name){
    draft.kind=name==='upload'?'image':'character';
    $('#avatar-character-panel').classList.toggle('hidden',name!=='character');$('#avatar-upload-panel').classList.toggle('hidden',name!=='upload');
    $$('[data-avatar-tab]').forEach(b=>b.classList.toggle('active',b.dataset.avatarTab===name));render();
  }
  function render(){
    $('#avatar-live').innerHTML=markup(draft.kind==='image'&&image?{kind:'image',image:$('#avatar-crop').toDataURL('image/png')}:draft);
    $('#avatar-shapes').innerHTML=shapes.map(shape=>`<button type="button" data-avatar-shape="${shape}" aria-label="${shape}" aria-pressed="${draft.shape===shape}" class="${draft.shape===shape?'selected':''}">${markup({...draft,kind:'character',shape})}</button>`).join('');
    $$('[data-avatar-shape]').forEach(b=>b.onclick=()=>{draft.shape=b.dataset.avatarShape;render()});
    $('#avatar-colors').innerHTML=colors.map(color=>`<button type="button" data-avatar-color="${color}" style="background:${color}" aria-label="${color}" class="${draft.color===color?'selected':''}"></button>`).join('');
    $$('[data-avatar-color]').forEach(b=>b.onclick=()=>{draft.color=b.dataset.avatarColor;render()});
    $('#avatar-custom').value=draft.color||colors[0];$('#avatar-eyes').value=draft.eyes||'line';$('#avatar-set').disabled=draft.kind==='image'&&!image;
  }
  function crop(){
    if(!image)return;
    const canvas=$('#avatar-crop'),ctx=canvas.getContext('2d'),scale=Math.max(256/image.width,256/image.height)*zoom,w=image.width*scale,h=image.height*scale;
    offset.x=Math.max(-(w-256)/2,Math.min((w-256)/2,offset.x));offset.y=Math.max(-(h-256)/2,Math.min((h-256)/2,offset.y));
    ctx.clearRect(0,0,256,256);ctx.drawImage(image,128-w/2+offset.x,128-h/2+offset.y,w,h);
    $('#avatar-live').innerHTML=markup({kind:'image',image:canvas.toDataURL('image/png')});$('#avatar-set').disabled=false;
  }
  function load(source){
    const candidate=new Image();candidate.onload=()=>{if(candidate.width*candidate.height>20000000){$('#avatar-error').textContent='Choose an image smaller than 20 megapixels.';return}image=candidate;zoom=1;offset={x:0,y:0};$('#avatar-zoom').value='1';crop()};candidate.onerror=()=>$('#avatar-error').textContent='This image could not be opened.';candidate.src=source;
  }
  $('#avatar-file').onchange=()=>{const f=$('#avatar-file').files[0];if(!f)return;if(f.size>25000000){$('#avatar-error').textContent='Choose an image smaller than 25 MB.';return}const reader=new FileReader();reader.onload=()=>load(reader.result);reader.readAsDataURL(f)};
  $('#avatar-custom').oninput=e=>{draft.color=e.target.value;render()};$('#avatar-eyes').onchange=e=>{draft.eyes=e.target.value;render()};
  $('#avatar-shuffle').onclick=()=>{draft={kind:'character',shape:shapes[Math.floor(Math.random()*shapes.length)],color:colors[Math.floor(Math.random()*colors.length)],eyes:['line','round','sleepy'][Math.floor(Math.random()*3)]};render()};
  $$('[data-avatar-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.avatarTab));
  $('#avatar-zoom').oninput=e=>{zoom=Number(e.target.value);crop()};
  $('#avatar-crop').onpointermove=e=>{if(!pointer)return;const scale=256/e.target.getBoundingClientRect().width;offset={x:pointer.ox+(e.clientX-pointer.x)*scale,y:pointer.oy+(e.clientY-pointer.y)*scale};crop()};
  $('#avatar-crop').onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};e.target.setPointerCapture(e.pointerId)};
  $('#avatar-crop').onpointerup=$('#avatar-crop').onpointercancel=()=>pointer=null;
  $('#avatar-close').onclick=$('#avatar-cancel').onclick=()=>dialog.close();
  $('#avatar-set').onclick=()=>{if(draft.kind==='image')draft={kind:'image',image:$('#avatar-crop').toDataURL('image/png')};done?.({...draft});dialog.close()};
  window.beamAvatars={render:markup,edit(value,callback){draft={kind:'character',shape:'clover',color:colors[0],eyes:'line',...value};done=callback;image=null;$('#avatar-error').textContent='';$('#avatar-file').value='';tab(draft.kind==='image'?'upload':'character');if(draft.kind==='image'&&draft.image)load(draft.image);dialog.showModal()}};
})();
