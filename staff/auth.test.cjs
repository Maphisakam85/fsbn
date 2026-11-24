const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('staff/staff.js', 'utf8');
async function run(role) {
  const nodes = {};
  const roles = [{dataset:{roles:'admin'},hidden:false},{dataset:{roles:'admin'},hidden:false}];
  for (const id of ['message','login','recovery','reset','portal','identity','role-description','login-form','show-recovery','back-login','recovery-form','reset-form','logout','staff-form']) nodes[id] = {hidden:false,textContent:'',addEventListener(type, fn){this[type]=fn;}};
  let authListener;
  const client = {auth:{getUser:async()=>({data:{user:{id:'user',email:'staff@example.test'}}}),onAuthStateChange:fn=>{authListener=fn;}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:role?{role}:null})})};
  const context = {document:{getElementById:id=>nodes[id],querySelectorAll:()=>roles},window:{addEventListener(){},FSBN_SUPABASE:{url:'https://example.test',publishableKey:'key'},supabase:{createClient:()=>client}},URL,location:{href:'https://example.test/staff/index.html'}};
  vm.runInNewContext(code, context);
  await new Promise(resolve=>setImmediate(resolve));
  if (role) { assert.equal(nodes.portal.hidden,false); assert.equal(roles[0].hidden,role!=='admin'); }
  else { assert.equal(nodes.login.hidden,false); assert.match(nodes.message.textContent,/not authorised/); }
  if (role) { authListener('SIGNED_OUT'); assert.equal(nodes.portal.hidden,true); assert.match(nodes.message.textContent,/expired or was signed out/); }
}
(async()=>{for(const role of ['admin','editor','author',null]) await run(role); console.log('Staff UI: role navigation, nonstaff denial and signed-out state passed.');})().catch(error=>{console.error(error);process.exit(1)});

