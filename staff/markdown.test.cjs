const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function node(tag) { return {tag, children:[], text:'', append(...items){this.children.push(...items)}, replaceChildren(){this.children=[]}, set textContent(v){this.text=v}, get textContent(){return this.text}}; }
const document={createElement:node,createTextNode: text => ({tag:'#text',text})};
const window={}; vm.runInNewContext(fs.readFileSync('staff/markdown.js','utf8'),{window,document});
const target=node('div'); window.FSBNMarkdown.render(target,'# Heading\n<script>alert(1)</script> **bold**\n- item');
assert.equal(target.children[0].tag,'h2');
assert.equal(target.children[1].children[0].text,'<script>alert(1)</script> ');
assert.equal(target.children[1].children[1].tag,'strong');
assert.equal(target.children[2].tag,'ul');
assert.equal(target.children[2].children[0].tag,'li');
console.log('Markdown preview: markup rendered as text, headings, bold and lists passed.');
