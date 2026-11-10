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
function boot(saved='[]') {
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
      setItem:(key,value)=>storage.set(key,String(value))
    },
    confirm:()=>true, Date, JSON, Blob:class Blob{constructor(parts,opts){this.parts=parts;this.type=opts?.type}},
    URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
    console
  };
  vm.runInNewContext(fs.readFileSync('reels.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {elements,storage,downloads};
}
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
card.children[2].click();
assert.equal(reloaded.elements.title.value,'The Wrong VIP Table','open should restore the selected draft');
assert.equal(reloaded.elements.qa1.checked,true,'open should restore QA checks');
card.children[3].click();
assert.equal(JSON.parse(reloaded.storage.get('lunaReelsDrafts')).length,0,'delete should remove the saved draft');
assert.equal(reloaded.elements.draftCount.textContent,'0 drafts');

// Required-field validation must block incomplete drafts.
const invalid=boot();
invalid.elements.title.value='Incomplete';
invalid.elements.hook.value='Hook';
invalid.elements.save.click();
assert.equal(JSON.parse(invalid.storage.get('lunaReelsDrafts')).length,0);
assert.match(invalid.elements.status.textContent,/ضروری/);

// Export controls should create the expected downloadable brief formats.
e.export.click();
e.download.click();
assert.equal(app.downloads.length,2);
assert.equal(app.downloads[0].download,'luna-reel-brief.json');
assert.equal(app.downloads[1].download,'luna-reel-brief.txt');
console.log('LUNA Reels workspace: save/reload/open/delete/validation/QA/export assertions passed.');
