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
 let root=await get('/');assert.equal(root.status,200);
 const rootMarkup=await root.text();
 assert.match(rootMarkup,/VÀO CHÁNH ĐIỆN NGAY/);
 assert.match(rootMarkup,/buddha-cinema.css/,'bottom cinema stylesheet');
 assert.match(rootMarkup,/buddha-cinema.js/,'bottom cinema player');
 assert.match(rootMarkup,/data-theater-role="visitor"/);
 assert.match(rootMarkup,/SAGS CXR Tam Bảo/);
 assert.match(rootMarkup,/TRỤ TRÌ · ĐĂNG NHẬP/);
 assert.match(rootMarkup,/href="\/trutri"/);
 assert.match(rootMarkup,/id="luckyEnvelopeRain"/,'visitor screen has envelope animation layer');
 assert.match(rootMarkup,/id="luckyEnvelopePrompt"/,'visitor gets one-tap claim notice');
 assert.match(rootMarkup,/prefers-reduced-motion:reduce/,'respect reduced motion accessibility');
 assert.match(rootMarkup,/!Boolean\(alreadyClaimed\)/,'effect requires unclaimed personal status');
 assert.match(rootMarkup,/!document.hidden/,'animation does not run in background');
 assert.match(rootMarkup,/locallyClaimedRounds.add\(luckyRound\)/,'claim hides rain immediately');
 assert.ok(rootMarkup.includes("document.createElement('button')"),'envelopes are clickable buttons');
 assert.ok(rootMarkup.includes("envelope.addEventListener('click',claimLuckyEnvelope"),'tap any envelope to claim');
 assert.ok(rootMarkup.includes("function claimLuckyEnvelope()"),'envelope delegates to server claim');
 for(const ritual of ['bow','woodenFish','incense','bell','lantern','fortune','lotus','fruit','lamp']){
   assert.ok(rootMarkup.includes('data-loc-ritual="'+ritual+'"'),'Missing guest ritual '+ritual);
 }
 const stageScript=await get('/js/live.js');
 assert.equal(stageScript.status,200);
 const stageSource=await stageScript.text();
 assert.ok(stageSource.includes('animateExactlyThisDevotee(ev)'),'Visitor must animate by identity');
 assert.ok(stageSource.includes('Đảnh lễ Tam Bái'),'Visitors use full three-bow ceremony');
 assert.ok(!stageSource.includes("const person = congregationHall?.querySelector('.hall-seat')"),'Never bow unrelated first seat');


 assert.equal((await get('/index.html')).status,302);
 assert.equal((await get('/chandien')).status,302);
 assert.equal((await get('/trutri')).status,302);
 const obs=await get('/obs');
 assert.equal(obs.status,200);
 const obsHtml=await obs.text();
 assert.doesNotMatch(obsHtml,/id="luckyEnvelopePrompt"/,'OBS must not display personal unclaimed gifts');
 assert.match(obsHtml,/id="templeWelcomeBanner"/);
 assert.match(obsHtml,/id="stageChatMessages"/);
 let me=await get('/api/temple/me');assert.equal(me.status,200);const cookie=me.headers.get('set-cookie').split(';')[0];
 assert.ok(cookie.startsWith('temple_guest='));
 let wrongOrigin=await post('/api/temple/join',{name:'Phật tử A',comment:'Nam mô'},cookie,'https://evil.example');assert.equal(wrongOrigin.status,403);
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,302);
 assert.equal((await get('/api/temple/chat',{headers:{Cookie:cookie}})).status,403);
 assert.equal((await get('/api/temple/loc/status',{headers:{Cookie:cookie}})).status,403);
 assert.equal((await post('/api/temple/loc/claim',{},cookie)).status,403);
 assert.equal((await post('/api/temple/meditation/start',{},cookie)).status,403);
 assert.equal((await post('/api/temple/meditation/pulse',{},cookie)).status,403);
 let sent=await post('/api/temple/join',{name:'Phật tử A',comment:''},cookie);
 assert.equal(sent.status,200);
 assert.equal((await sent.json()).status,'approved','Visitors are admitted immediately');
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await get('/api/temple/chat',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await get('/api/temple/loc/status',{headers:{Cookie:cookie}})).status,200);
 const greeting=await get('/api/state');
 const pub=await greeting.json();
 assert.ok(pub.lastWelcome);
 assert.equal(pub.lastWelcome.name,'Phật tử A');
 assert.match(pub.lastWelcome.wish,/^Chúc con /);
 const medStart=await post('/api/temple/meditation/start',{},cookie);
 assert.equal(medStart.status,200);
 assert.equal((await medStart.json()).active,true);
 const immediatePulse=await post('/api/temple/meditation/pulse',{},cookie);
 assert.equal(immediatePulse.status,200);
 assert.equal((await immediatePulse.json()).justEarned,0,'No credit for rapid pulses');
 const medStop=await post('/api/temple/meditation/stop',{},cookie);
 assert.equal(medStop.status,200);
 assert.equal((await medStop.json()).active,false);
 assert.equal((await post('/api/temple/meditation/pulse',{},cookie)).status,409);
  assert.equal((await get('/api/trutri/loc')).status,401);
 assert.equal((await post('/api/trutri/chat/send',{text:'Tôi là Trụ trì giả'})).status,401);
 let admin=await post('/auth/login',{password:pw});assert.equal(admin.status,200);
 const adminCookie=admin.headers.get('set-cookie').split(';')[0];
 const abbot=await get('/trutri',{headers:{Cookie:adminCookie}});
 assert.equal(abbot.status,200);
 const abbotMarkup=await abbot.text();
 assert.match(abbotMarkup,/SAGS CXR Tam Bảo/);
 assert.match(abbotMarkup,/id="abbotTemplePreview"/);
 assert.match(abbotMarkup,/data-theater-role="abbot"/);
 assert.match(abbotMarkup,/buddha-cinema.js/);
 assert.match(abbotMarkup,/src="\/obs"/);
 assert.match(abbotMarkup,/TRUNG TÂM ĐIỀU HÀNH TRỤ TRÌ/);
 assert.match(abbotMarkup,/id="abbotPanelChat"/);
 assert.match(abbotMarkup,/id="abbotPanelPeople"/);
 assert.match(abbotMarkup,/id="abbotPanelLoc"/);
 assert.match(abbotMarkup,/id="abbotPanelControls"/);
 assert.match(abbotMarkup,/PHÁT LỘC MAY MẮN/);
 assert.match(abbotMarkup,/Chat chung/);
 assert.match(abbotMarkup,/TRỤ TRÌ/);
 assert.match(abbotMarkup,/Trụ Trì Trung Kiên/);
 assert.doesNotMatch(abbotMarkup,/ĐÃ XÁC THỰC/);
 assert.match(abbotMarkup,/id="abbotChatForm"/);
 let queue=await get('/api/trutri/room',{headers:{Cookie:adminCookie}});
 const q=await queue.json();
 assert.equal(q.pending.length,0,'No moderation queue in open-door mode');
 assert.equal(q.inside.length,1);
 const id=q.inside[0].id;
 const status=await get('/api/temple/me',{headers:{Cookie:cookie}});
 assert.equal((await status.json()).status,'approved');
 let opened=await post('/api/trutri/loc/open',{total:100},adminCookie);assert.equal(opened.status,200);
 assert.equal((await post('/api/trutri/loc/open',{total:100},adminCookie)).status,409);
 const locClaim=await post('/api/temple/loc/claim',{},cookie);assert.equal(locClaim.status,200);
 const award=await locClaim.json();assert.ok(award.amount>=1&&award.amount<=30);
 assert.equal((await post('/api/temple/loc/claim',{},cookie)).status,409);
 const locState=await get('/api/temple/loc/status',{headers:{Cookie:cookie}});
 const locData=await locState.json();assert.equal(locData.balance,award.amount);assert.equal(locData.claimed,true);
 const locBow=await post('/api/temple/loc/ritual',{action:'bow'},cookie);assert.equal(locBow.status,200);
 assert.equal((await locBow.json()).balance,award.amount);
 assert.equal((await post('/api/temple/loc/ritual',{action:'nonsense'},cookie)).status,409);
 await sleep(1500);
 const locLotus=await post('/api/temple/loc/ritual',{action:'lotus'},cookie);
 if(award.amount>=20){assert.equal(locLotus.status,200);assert.equal((await locLotus.json()).balance,award.amount-20)}
 else assert.equal(locLotus.status,409);
 assert.equal((await post('/api/trutri/loc/close',{},adminCookie)).status,200);
 assert.equal((await post('/api/trutri/loc/open',{total:20},adminCookie)).status,200);
 assert.equal((await post('/api/temple/loc/claim',{},cookie)).status,200);
 // Grant enough random virtual lộc across fresh rounds to cover all offerings.
 let balance=(await (await get('/api/temple/loc/status',{headers:{Cookie:cookie}})).json()).balance;
 let rounds=0;
 while(balance<120 && rounds++<50){
   assert.equal((await post('/api/trutri/loc/close',{},adminCookie)).status,200);
   assert.equal((await post('/api/trutri/loc/open',{total:100000},adminCookie)).status,200);
   const awarded=await post('/api/temple/loc/claim',{},cookie);
   assert.equal(awarded.status,200);
   balance=(await awarded.json()).balance;
 }
 assert.ok(balance>=120,'Could not fund all virtual ritual tests');
 const rituals=[
   ['bow',0,'bowToBuddha'],['woodenFish',1,'strikeWoodenFish'],
   ['incense',5,'burnIncense'],['bell',10,'ringBell'],
   ['lantern',10,'sendPrayer'],['fortune',15,'drawFortune'],
   ['lotus',20,'offerGift'],['fruit',25,'offerGift'],['lamp',15,'offerGift']
 ];
 for(const [action,cost,eventType] of rituals){
   await sleep(1500); // server limits rapid multi-ritual actions
   const result=await post('/api/temple/loc/ritual',{action,wish:'Gia đình an vui'},cookie);
   assert.equal(result.status,200,'Visitor ritual '+action+' failed');
   const payload=await result.json();
   assert.equal(payload.action,action);
   assert.equal(payload.cost,cost);
   assert.equal(payload.balance,balance-cost,'Unexpected debit on '+action);
   balance=payload.balance;
   const state=(await (await get('/api/state')).json());
   const latest=state.recentEvents[0];
   assert.equal(latest.type,eventType,'Wrong stage event for '+action);
   assert.equal(latest.user,'Phật tử A','Guest action must use visitor name');
   const matchingActor=state.leaderboard.find(a=>a.name==='Phật tử A');
   assert.ok(matchingActor,'Guest has a visible seat');
   assert.match(latest.uniqueId,/^actor_[a-f0-9]{24}$/,'Stage handle uses a pseudonym');
   assert.equal(latest.uniqueId,matchingActor.uniqueId,'Guest action must animate their own seat');
   assert.notEqual(latest.uniqueId,id,'Never expose the private session identifier');
   if(['lotus','fruit','lamp'].includes(action)){
     assert.equal(latest.giftType,action);
     assert.equal(latest.coins,0,'Do not generate real TikTok coins');
   }
 }
 assert.ok(balance>=0,'Wallet cannot become negative');
 let chat=await post('/api/temple/chat',{text:'Chào mọi người 🙏'},cookie);assert.equal(chat.status,200);
 let state=await get('/api/temple/chat',{headers:{Cookie:cookie}});
 let messages=(await state.json()).messages;
 assert.equal(messages.length,2,'Guest chat must produce a named blessing');
 assert.equal(messages[0].text,'Chào mọi người 🙏');
 assert.equal(messages[0].source,'web');
 assert.equal(messages[1].role,'abbot');
 assert.equal(messages[1].source,'abbot');
 assert.equal(messages[1].automated,true);
 assert.ok(messages[1].text.startsWith('Chào con Phật tử A. Chúc con '));
 assert.ok(messages.every(m=>!('senderId' in m)));
 const abbotSend=await post('/api/trutri/chat/send',{text:'Nam mô A Di Đà Phật, chào các Phật tử.'},adminCookie);
 assert.equal(abbotSend.status,200);
 state=await get('/api/temple/chat',{headers:{Cookie:cookie}});messages=(await state.json()).messages;
 assert.equal(messages.length,3,'Manual abbot post should not cause automatic reply');
 assert.equal(messages[2].source,'abbot');
 assert.equal(messages[2].role,'abbot');
 assert.equal(messages[2].automated,undefined);
 assert.equal(messages[2].name,'Trụ Trì Trung Kiên');
 const muted=await post('/api/trutri/mute',{id,muted:true},adminCookie);assert.equal(muted.status,200);
 const blocked=await post('/api/temple/chat',{text:'Thử lần 2'},cookie);assert.equal(blocked.status,403);
 state=await get('/api/temple/chat',{headers:{Cookie:cookie}});assert.equal((await state.json()).messages.length,3,'Muted users cannot trigger blessings');
 await post('/api/trutri/chat/delete',{id:messages[0].id},adminCookie);
 state=await get('/api/temple/chat',{headers:{Cookie:cookie}});assert.equal((await state.json()).messages.length,2);
 await post('/api/trutri/chat/clear',{},adminCookie);
 state=await get('/api/temple/chat',{headers:{Cookie:cookie}});assert.equal((await state.json()).messages.length,0);
 let leave=await post('/api/temple/leave',{},cookie);assert.equal(leave.status,200);
 assert.equal((await get('/chandien',{headers:{Cookie:cookie}})).status,302);
 console.log('PASS: SAGS CXR Tam Bảo live welcome, chat, meditation routes, lộc and protected abbot');
}finally{child.kill('SIGTERM');await sleep(200);if(child.exitCode&&child.exitCode!==null)console.log('Server exited',child.exitCode)}})().catch(e=>{console.error(e);process.exitCode=1})
