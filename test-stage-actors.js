'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const live=fs.readFileSync('public/js/live.js','utf8');
const server=fs.readFileSync('server.js','utf8');
const viewer=fs.readFileSync('public/vao-chua.html','utf8');
const admin=fs.readFileSync('public/trutri.html','utf8');
const theater=fs.readFileSync('public/js/buddha-cinema.js','utf8');
const styles=fs.readFileSync('public/css/buddha-cinema.css','utf8');
const helperStart=live.indexOf('  function normalizeDevoteeName(value)');
const helperEnd=live.indexOf('  function animateExactlyThisDevotee(ev)',helperStart);
assert.ok(helperStart>0&&helperEnd>helperStart,'actor lookup helper exists');
const {findRitualDevoteeSeat}=new Function(live.slice(helperStart,helperEnd)+'\nreturn {findRitualDevoteeSeat};')();
const makeSeat=(id,name)=>({dataset:{devoteeId:id,devoteeName:name}});
const vip=makeSeat('actor_vip123','Minh Tâm');
const other=makeSeat('actor_other','Diệu An');
const hall=makeSeat('actor_hall999','Thiện Đức');
const seats=[vip,other,hall];
assert.equal(findRitualDevoteeSeat({uniqueId:'actor_hall999',user:'Thiện Đức'},seats),hall);
assert.equal(findRitualDevoteeSeat({uniqueId:'actor_vip123',user:'Đặt Tên Khác'},seats),vip,'identity overrides display name');
assert.equal(findRitualDevoteeSeat({uniqueId:'',user:'  MINH   TÂM '},seats),vip,'manual name matches case/spaces');
assert.equal(findRitualDevoteeSeat({uniqueId:'actor_wrong',user:'Không tồn tại'},seats),null,'never bow an arbitrary seat');
assert.equal(findRitualDevoteeSeat({user:'Minh Tâm'},[vip,makeSeat('actor_second','Minh Tâm')]),null,'duplicate names are ambiguous');
assert.ok(live.includes("window.location.pathname === '/obs'"),'/obs must directly activate the LIVE-only 9:16 view');
assert.ok(live.includes("isBroadcastSource) sanctuaryImage.src = primary"),'LIVE selects full-resolution PNG');
assert.ok(live.includes("isBroadcastSource\n      ? '/assets/amitabha_stage.png'"),'LIVE uses original PNG rather than 810x1440 JPEG');
const png=fs.readFileSync('public/assets/amitabha_stage.png');
assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a','original background is a PNG');
const originalW=png.readUInt32BE(16),originalH=png.readUInt32BE(20);
// Original PNG (941x1672) is clearer than the compressed 810x1440 JPEG,
// but it is still below native 1080x1920. Output settings cannot recreate
// detail absent from the source image: keep this test honest about the limit.
assert.ok(originalW>=900&&originalH>=1600,'LIVE PNG must be higher resolution than the 810x1440 JPG, got '+originalW+'x'+originalH);
assert.ok(Math.abs(originalW/originalH-9/16)<0.01,'LIVE PNG must retain near-9:16 aspect ratio');
assert.ok(live.includes('if (signature === lastVipActorSignature) return;'),'VIP sprites persist between unrelated updates');
assert.ok(live.includes('hallViewers.map((d) =>'),'hall signature includes identity');
assert.ok(live.includes("case 'setStageName': {\n        displayManualName(ev.user, ev.wish);"),'manual names are displayed');
assert.ok(live.includes("animateWalkerOnCarpet(ev.user, ev.avatar, '🙏 Chắp tay · Đảnh lễ Tam Bái'"),'manual stage name starts the same bow ceremony');
assert.ok(live.includes("stageActor.style.display = ''"),'manually named actor is visible');
assert.ok(server.includes('leaderboard: getLeaderboard(100)'),'100 seats are represented, not just VIPs');
assert.ok(server.includes('stageActorId(identity)'),'public IDs use anonymous stage handles');
assert.ok(server.includes('recentEvents: state.recentEvents.slice(0, 15).map(stagePublicEvent)'),'event history hides session IDs');
assert.ok(server.includes("method === 'temple.event' && params?.event"),'live event broadcasts hide session IDs');
for(const markup of [viewer,admin]){
  assert.ok(markup.includes('/css/buddha-cinema.css'));
  assert.ok(markup.includes('/js/buddha-cinema.js'));
}
assert.ok(!fs.readFileSync('public/index.html','utf8').includes('buddha-cinema.js'),'theater does not appear on shared OBS stage');
assert.ok(theater.includes('https://www.youtube-nocookie.com/embed/'),'native YouTube embedding only');
assert.ok(theater.includes("VIDEO_ID = 'O0xHLS6Qw1w'"),'verified first film episode');
assert.ok(theater.includes('player.remove()'),'minimize stops playback');
assert.ok(theater.includes('const role = document.body.dataset.theaterRole'),'only viewer/abbot');
assert.ok(styles.includes('.buddha-cinema.is-minimized'),'minimize styles');
assert.ok(styles.includes('body[data-theater-role="visitor"]:not(.sanctuary-fullscreen)'),'hidden before joining');
console.log('PASS: named/VIP/ordinary actor matching, no random bow, anonymous public IDs, mini cinema controls');
