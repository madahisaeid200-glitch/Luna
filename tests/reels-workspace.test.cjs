// Behavioral regression coverage for the quota-free Reels workspace.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
  constructor(id='') {
    this.id=id; this.value=''; this.checked=false; this.textContent='';
    this.className=''; this.children=[]; this.handlers={}; this.attributes={};
    this.download=''; this.href=''; this._innerHTML='';
  }
  addEventListener(name, fn) { this.handlers[name]=fn; }
  append(...nodes) { this.children.push(...nodes); }
  set innerHTML(value) { this._innerHTML=value; this.children=[]; }
  get innerHTML() { return this._innerHTML; }
  click() { if (this.onclick) this.onclick(); }
  removeAttribute(name) { delete this.attributes[name]; if(name==='href')this.href=''; }
}
function boot(saved='[]', writable=true) {
  const ids=['title','lane','duration','hook','setup','payoff','caption','hashtags','cover','notes',
    'qa1','qa2','qa3','qa4','qa5','pvHook','pvSetup','pvPayoff','pvDuration','pvLane',
    'durationRead','wordCount','status','save','new','export','download','draftCount','drafts'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const storage=new Map([['lunaReelsDrafts',saved]]);
  const downloads=[];
  const document={
    getElementById:id=>elements[id]||(elements[id]=new Element(id)),
    createElement:tag=>{const el=new Element(tag);el.tagName=tag;el.click=()=>downloads.push({tag,download:el.download,href:el.href});return el;}
  };
  const context={
    document, localStorage:{
      getItem:key=>storage.has(key)?storage.get(key):null,
      setItem:(key,value)=>{if(!writable)throw new Error('storage unavailable');storage.set(key,String(value))}
    },
    confirm:()=>true, Date, JSON, Blob:class Blob{constructor(parts,opts){this.parts=parts;this.type=opts?.type}},
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
    console
  };
  vm.runInNewContext(fs.readFileSync('reels.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {elements,storage,downloads};
}
// The media lab is a local-only capability probe and must not call generation or publishing APIs.
const mediaLab=fs.readFileSync('media-lab.html','utf8');
assert.match(mediaLab,/window\.VideoEncoder/);
assert.match(mediaLab,/window\.AudioEncoder/);
assert.match(mediaLab,/avc1\.42001f/);
assert.match(mediaLab,/mp4a\.40\.2/);
assert.match(mediaLab,/exportApproved=false/);
assert.match(mediaLab,/new Output\\(\\{format:new Mp4OutputFormat\\(\\),target:new BufferTarget\\(\\)\\}\\)/);
assert.match(mediaLab,/new CanvasSource\\(canvas,\\{codec:'avc'/);
assert.match(mediaLab,/new AudioBufferSource\\(\\{codec:'aac'/);
assert.match(mediaLab,/getCodecParameterString\\(\\)/);
assert.match(mediaLab,/videoTrack\\.canDecode\\(\\)/);
assert.match(mediaLab,/audioTrack\\.canDecode\\(\\)/);
assert.match(mediaLab,/duration<1\\.8\\|\\|duration>2\\.2/);
assert.match(mediaLab,/input\\.dispose\\(\\)/);
assert.match(mediaLab,/URL\\.revokeObjectURL\\(lastMp4ObjectUrl\\)/);
assert.match(mediaLab,/هیچ (تصویر|ویدئو)|هیچ API هوش مصنوعی یا سهمیه‌ای مصرف نمی‌شود/);
assert.doesNotMatch(mediaLab,/fetch\s*\(|XMLHttpRequest|instagram_business_content_publish|mode:\s*['"]video['"]/,
  'Media compatibility probe must not call network, AI generation, or Instagram publishing');
const mediaScripts=[...mediaLab.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
mediaScripts.forEach((source,index)=>{try{new Function(source)}catch(error){throw new Error('Media lab script '+(index+1)+' syntax error: '+error.message)}});
assert.match(fs.readFileSync('index.html','utf8'),/href="\.\/reels\.html"/);
assert.match(fs.readFileSync('index.html','utf8'),/href="\.\/media-lab\.html"/);
assert.match(mediaLab,/href="\.\/reels\.html"/);
const app=boot();
const e=app.elements;
assert.equal(e.draftCount.textContent,'0 drafts');
e.title.value='The Wrong VIP Table';
e.hook.value='Why is that tiny chair reserved?';
e.setup.value='LUNA and LEO arrive at an exclusive restaurant.';
e.payoff.value='The VIP chair belongs to the restaurant cat.';
e.duration.value='20';
e.qa1.checked=true;
e.save.click();
let saved=JSON.parse(app.storage.get('lunaReelsDrafts'));
assert.equal(saved.length,1,'save should persist one complete draft');
assert.equal(saved[0].title,'The Wrong VIP Table');
assert.equal(saved[0].qa.qa1,true,'QA checklist should persist with the draft');
assert.equal(e.status.textContent.includes('ذخیره شد'),true);
assert.equal(e.drafts.children.length,1,'saved draft should appear in the library');

// Reboot with persisted storage to verify reload persistence and open/delete controls.
const reloaded=boot(app.storage.get('lunaReelsDrafts'));
assert.equal(reloaded.elements.draftCount.textContent,'1 drafts');
const card=reloaded.elements.drafts.children[0];
assert.equal(card.children.length,4,'draft card should expose title, metadata, open and delete');
const openButton=card.children.find(child=>child.textContent==='باز کردن');
assert.ok(openButton && typeof openButton.onclick==='function','draft card should expose a working open action');
openButton.onclick();
assert.equal(reloaded.elements.title.value,'The Wrong VIP Table','open should restore the selected draft');
assert.equal(reloaded.elements.qa1.checked,true,'open should restore QA checks');
const deleteButton=card.children.find(child=>child.textContent==='حذف');
assert.ok(deleteButton && typeof deleteButton.onclick==='function','draft card should expose a working delete action');
deleteButton.onclick();
assert.equal(JSON.parse(reloaded.storage.get('lunaReelsDrafts')).length,0,'delete should remove the saved draft');
assert.equal(reloaded.elements.draftCount.textContent,'0 drafts');

// Required-field validation must block incomplete drafts.
const invalid=boot();
invalid.elements.title.value='Incomplete';
invalid.elements.hook.value='Hook';
invalid.elements.save.click();
assert.equal(JSON.parse(invalid.storage.get('lunaReelsDrafts')).length,0);
assert.match(invalid.elements.status.textContent,/ضروری/);

// Storage failures must not claim success or mutate the visible draft library.
const blockedSave=boot('[]',false);
blockedSave.elements.title.value='Storage blocked';
blockedSave.elements.hook.value='Hook';
blockedSave.elements.setup.value='Setup';
blockedSave.elements.payoff.value='Payoff';
blockedSave.elements.save.click();
assert.equal(blockedSave.storage.get('lunaReelsDrafts'),'[]');
assert.match(blockedSave.elements.status.textContent,/ذخیره نشد/);
assert.equal(blockedSave.elements.draftCount.textContent,'0 drafts');

const blockedDelete=boot(JSON.stringify([{id:'keep',title:'Keep me',updatedAt:new Date().toISOString(),lane:'romcom',duration:'20',qa:{}}]),false);
const blockedCard=blockedDelete.elements.drafts.children[0];
blockedCard.children.find(child=>child.textContent==='حذف').onclick();
assert.equal(blockedDelete.elements.draftCount.textContent,'1 drafts','failed deletion must preserve the visible draft');
assert.match(blockedDelete.elements.status.textContent,/حذف نشد/);

// Export controls should create the expected downloadable brief formats.
e.export.click();
e.download.click();
assert.equal(app.downloads.length,2);
assert.equal(app.downloads[0].download,'luna-reel-brief.json');
assert.equal(app.downloads[1].download,'luna-reel-brief.txt');
console.log('LUNA Reels workspace: save/reload/open/delete/validation/QA/export assertions passed.');
