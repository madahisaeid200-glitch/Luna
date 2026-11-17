// Security regression: persisted episode text must never be parsed as HTML.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function render(){');
const end = html.indexOf('\nconst storyIdeas=', start);
assert.ok(start >= 0 && end > start, 'Dashboard render function must exist');
const renderSource = html.slice(start, end);
assert.doesNotMatch(renderSource, /\\.innerHTML\\s*=|insertAdjacentHTML|outerHTML\\s*=|document\\.write/,
  'Dashboard render must not use HTML parsing or insertion sinks');
assert.match(renderSource, /heading\\.textContent=fa\\?e\\.fa:e\\.en/);
assert.match(renderSource, /summary\\.textContent=fa\\?e\\.storyFa\\[0\\]:e\\.storyEn\\[0\\]/);
assert.match(renderSource, /paragraph\\.textContent=line/);
assert.match(renderSource, /box\\.replaceChildren\\(\\)/);
assert.match(renderSource, /story\\.replaceChildren\\(\\)/);

class Element {
  constructor(tag='div') {
    this.tagName = tag;
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.onclick = null;
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}
const elements = Object.fromEntries(
  ['episodes','story','title','lang','translate','sub','headline','intro'].map(id => [id, new Element(id)])
);
const document = { createElement: tag => new Element(tag) };
const payloadTitle = '<img src=x onerror=alert(1)> LUNA';
const payloadStory = '<svg onload=alert(2)>Injected story</svg>';
const episodes = [{
  id: 1, fa: payloadTitle, en: 'Safe English title',
  storyFa: [payloadStory, '<script>alert(3)</script>'],
  storyEn: ['Safe English story']
}];
const context = {
  document, episodes, selected: 0, fa: true,
  $: id => elements[id],
  String
};
vm.runInNewContext(renderSource + '\nrender();', context);

const card = elements.episodes.children[0];
assert.ok(card, 'Episode card should render');
assert.equal(card.children.length, 4, 'Card should contain number, title, summary and status');
assert.equal(card.children[1].tagName, 'h3');
assert.equal(card.children[1].textContent, payloadTitle, 'Malicious title must remain literal text');
assert.equal(card.children[2].textContent, payloadStory, 'Malicious summary must remain literal text');
assert.equal(elements.story.children.length, 2, 'Every story line should render as a paragraph');
assert.equal(elements.story.children[0].tagName, 'p');
assert.equal(elements.story.children[0].textContent, payloadStory, 'Malicious story must remain literal text');
assert.ok(![card, ...card.children, ...elements.story.children].some(node => ['img','svg','script'].includes(node.tagName)),
  'Untrusted episode data must not create executable or embedded elements');

card.onclick();
assert.equal(elements.episodes.children.length, 1, 'Selecting an episode should keep the card list intact');
assert.equal(elements.title.textContent, 'قسمت 1: ' + payloadTitle, 'Selected title should remain text');
console.log('LUNA dashboard rendering security: inert saved text and selection behavior PASS');
