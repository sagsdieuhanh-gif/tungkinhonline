'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const port=43000+Math.floor(Math.random()*1000);
const base='http://127.0.0.1:'+port;
const pw='temporary-secure-test-secret';
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(port),ADMIN_PASSWORD:pw,ENABLE_TTS:'0',TIKTOK_USER:''},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
async function get(url,opts={}){return fetch(base+url,{redirect:'manual',...opts})}
async function post(url,body,cookie,origin=base){return get(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
(async()=>{try{
 let ready=false;for(let i=0;i<50;i++){try{const r=await get('/api/state');if(r.ok){ready=true;break}}catch{}await sleep(250)}
 assert.equal(ready,true,'Server must boot: '+logs.slice(-1500));
 let root=await get('/');assert.equal(root.status,200);assert.match(await root.text(),/Xin vào chánh điện/);
 assert.equal((await get('/index.html')).status,302);
 assert.equal((await get('/chandien')).status,302);
 assert.equal((await get('/trutri')).status,302);
 assert.equal((await get('/obs')).status,200);
 let me=await get('/api/temple/me');assert.equal(me.status,200);const cookie=me.headers.get('set-cookie').split(';')[0];
 assert.ok(cookie.startsWith('temple_guest='));
 let wrongOrigin=await post('/api/temple/join',{name:'Phật tử A',comment:'Nam mô'},cookie,'https://evil.example');assert.equal(wrongOrigin.status,403);
 let empty=await post('/api/temple/join',{name:'Phật tử A',comment:'   '},cookie);assert.equal(empty.status,400);
 let sent=await post('/api/temple/join',{name:'Phật tử A',comment:'Nam mô A Di Đà Phật'},cookie);assert.equal(sent.status,200);assert.equal((await sent.json()).status,'pending');
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,302);
 assert.equal((await get('/api/temple/chat',{headers:{Cookie:cookie}})).status,403);
 let admin=await post('/auth/login',{password:pw});assert.equal(admin.status,200);
 const adminCookie=admin.headers.get('set-cookie').split(';')[0];
 assert.equal((await get('/trutri',{headers:{Cookie:adminCookie}})).status,200);
 let queue=await get('/api/trutri/room',{headers:{Cookie:adminCookie}});const q=await queue.json();assert.equal(q.pending.length,1);
 const id=q.pending[0].id;
 const decision=await post('/api/trutri/decide',{id,allow:true,group:'internal'},adminCookie);assert.equal(decision.status,200);
 const status=await get('/api/temple/me',{headers:{Cookie:cookie}});assert.equal((await status.json()).status,'approved');
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await get('/api/temple/chat',{headers:{Cookie:cookie}})).status,200);
 let chat=await post('/api/temple/chat',{text:'Chào mọi người 🙏'},cookie);assert.equal(chat.status,200);
 let state=await get('/api/temple/chat',{headers:{Cookie:cookie}});let msg=(await state.json()).messages[0];assert.equal(msg.text,'Chào mọi người 🙏');
 assert.ok(!('senderId' in msg));
 let muted=await post('/api/trutri/mute',{id,muted:true},adminCookie);assert.equal(muted.status,200);
 let blocked=await post('/api/temple/chat',{text:'Thử lần 2'},cookie);assert.equal(blocked.status,403);
 await post('/api/trutri/chat/delete',{id:msg.id},adminCookie);
 state=await get('/api/temple/chat',{headers:{Cookie:cookie}});assert.equal((await state.json()).messages.length,0);
 let leave=await post('/api/temple/leave',{},cookie);assert.equal(leave.status,200);
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,302);
 console.log('PASS: Linh Ung HTTP login, comment pending, real Trụ trì approval, hall gate, chat+mute+delete, protected routes');
}finally{child.kill('SIGTERM');await sleep(200);if(child.exitCode&&child.exitCode!==null)console.log('Server exited',child.exitCode)}})().catch(e=>{console.error(e);process.exitCode=1})
