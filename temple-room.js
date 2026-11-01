'use strict';
// Open-door sanctuary and shared chat. Only real participant arrivals populate seats.
const crypto=require('crypto');
function createTempleRoom({notify=()=>{},now=()=>Date.now(),capacity=100,approvedNames=[],onRegistryChange=()=>{}}={}){
 const pending=new Map(),inside=new Map(),sessions=new Map(),messages=[],muted=new Set(),lastMessage=new Map();
 // A previously approved dharma name can re-enter without another approval.
 // Case and surrounding spaces are ignored; Vietnamese accents are preserved.
 const nameKey=value=>String(value||'').normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
 const approved=new Map();
 for(const entry of Array.isArray(approvedNames)?approvedNames:[]) {
   const approvedName=String(entry?.name||'').normalize('NFC').trim();
   const key=nameKey(approvedName);
   if(key&&approvedName.length>=2&&approvedName.length<=32) approved.set(key,{
     name:approvedName,group:entry.group==='internal'?'internal':'tiktok',
     source:entry.source==='tiktok'?'tiktok':'web',
     approvedAt:entry.approvedAt||new Date(now()).toISOString()
   });
 }
 const approvedList=()=>[...approved.values()].map(v=>({...v}));
 const persistRegistry=()=>onRegistryChange(approvedList());

 const blessingTemplates=[
  'luôn mạnh khỏe, bình an và gặp nhiều điều tốt đẹp trong cuộc sống.',
  'gia đình hòa thuận, an vui, mọi việc thuận buồm xuôi gió.',
  'một ngày mới tràn đầy năng lượng tích cực và niềm vui.',
  'gặp nhiều may mắn, công việc hanh thông và tâm luôn an yên.',
  'thân tâm an lạc, mỗi ngày đều có niềm vui nhỏ đáng quý.',
  'người thân luôn khỏe mạnh, bình yên và đầy ắp yêu thương.',
  'mọi dự định tốt đẹp được tiến triển thuận lợi.',
  'luôn giữ được nụ cười, sự lạc quan và lòng thiện lành.',
  'một năm nhiều thuận lợi, gia đạo ấm êm và sung túc.',
  'đi đâu cũng bình an, về nhà luôn có người thương chờ đợi.',
  'vượt qua khó khăn với lòng vững vàng và nhiều hy vọng.',
  'có nhiều cơ hội tốt trong công việc, học tập và cuộc sống.',
  'sức khỏe dồi dào, tinh thần thư thái, lòng luôn thanh thản.',
  'mọi thành viên trong gia đình luôn gắn bó, vui vẻ và hạnh phúc.',
  'mỗi ngày đều đón nhận những điều tử tế và nhân duyên tốt.',
  'luôn vững tâm, sống thiện lành và gặp những người chân thành.',
  'hạnh phúc từ những điều giản dị, cuộc sống thêm ấm áp.',
  'đủ sức khỏe để làm điều mình yêu thích và giúp đỡ mọi người.',
  'luôn được bình an trên mọi hành trình, công việc nhiều thuận lợi.',
  'đón nhiều niềm vui, gặp chuyện khó vẫn sáng suốt và vững lòng.'
 ];
 let blessingSequence=0;
 let counter=0,version=0;
 const clean=s=>String(s??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim();
 const text=s=>clean(s).slice(0,180);
 const name=s=>clean(s).normalize('NFC').slice(0,32);
 const emit=()=>{version++;notify('temple.room',publicRoom())};
 function identity(req,res){
  const match=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('temple_guest='));
  let token=match?.slice(13),session=token&&/^[0-9a-f]{48}$/.test(token)?sessions.get(token):null;
  if(!session){
   token=crypto.randomBytes(24).toString('hex');
   session={id:'web:'+token,name:'',lastSeen:now(),lastComment:0,chatAt:0};
   sessions.set(token,session);
   const secure=req.secure||req.headers['x-forwarded-proto']==='https';
   res.setHeader('Set-Cookie','temple_guest='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200'+(secure?'; Secure':''));
  }
  session.lastSeen=now();
  const person=inside.get(session.id);
  if(person)person.lastSeen=now();
  return session;
 }
 function tiktokKey(uniqueId){const v=String(uniqueId||'').trim().slice(0,96);return v?'tt:'+v:null}
 function request({id,displayName,comment,source='web'}){
  if(!id||(!id.startsWith('web:')&&!id.startsWith('tt:')))return {ok:false,reason:'invalid-identity'};
  const visitorName=name(displayName),key=nameKey(visitorName);
  const existing=inside.get(id);
  if(existing){existing.lastSeen=now();return {ok:true,status:'approved',person:existing}};
  if(visitorName.length<2)return {ok:false,reason:'invalid-name'};
  if([...inside.values()].some(v=>v.id!==id&&nameKey(v.name)===key))return {ok:false,reason:'name-in-use'};
  if(inside.size>=capacity)return {ok:false,reason:'full'};
  // Open-door sanctuary: no waiting room, no abbot approval, no simulated people.
  const group=source==='tiktok'?'tiktok':(approved.get(key)?.group||'internal');
  const person={id,name:visitorName,source:source==='tiktok'?'tiktok':'web',
    group,joinedAt:now(),lastSeen:now(),avatar:''};
  inside.set(id,person);pending.delete(id);
  if(!approved.has(key)){
    approved.set(key,{name:visitorName,source:person.source,group,
      approvedAt:new Date(now()).toISOString()});
    persistRegistry();
  }
  emit();
  // A real newly joined person gets one welcome announcement. Revisiting or
  // polling an already occupied session never triggers a duplicate greeting.
  const welcomeText='Chúc '+person.name+' '+blessingTemplates[blessingSequence++%blessingTemplates.length];
  notify('temple.joined',{name:person.name,source:person.source,wish:welcomeText});
  return {ok:true,status:'approved',person,returning:Boolean(approved.get(key))};
 }
 function tiktokComment(uniqueId,displayName,comment){
  const id=tiktokKey(uniqueId);if(!id)return {approved:false,status:'no-id'};
  const participant=inside.get(id);
  if(participant){participant.lastSeen=now();return {approved:true,id,person:participant}};
  const result=request({id,displayName,comment,source:'tiktok'});
  return result.ok?{approved:true,id,person:inside.get(id),status:'approved'}:{approved:false,id,status:result.reason};
 }
 function approve(id,group='tiktok'){
  id=String(id||'');const p=pending.get(id);
  if(!p)return {ok:false,reason:'missing-request'};
  if(inside.size>=capacity)return {ok:false,reason:'full'};
  const person={id,name:p.name,source:p.source,group:group==='internal'?'internal':'tiktok',joinedAt:now(),lastSeen:now(),avatar:''};
  inside.set(id,person);pending.delete(id);
  const key=nameKey(person.name);
  if(key&&!approved.has(key)){
    approved.set(key,{name:person.name,group:person.group,source:person.source,
      approvedAt:new Date(now()).toISOString()});
    persistRegistry();
  }
  emit();return {ok:true,person};
 }
 function deny(id){const exists=pending.delete(id);if(exists)emit();return exists}
 function remove(id){const ok=inside.delete(String(id));muted.delete(String(id));if(ok)emit();return ok}
 function list(){return [...inside.values()].map(p=>({...p}))}
 function revokeApprovedName(raw){
  const key=nameKey(raw);if(!approved.has(key))return false;
  approved.delete(key);
  for(const [id,p] of inside)if(nameKey(p.name)===key){
    inside.delete(id);muted.delete(id);
  }
  persistRegistry();emit();return true;
 }
 function publicRoom(){return {count:inside.size,capacity,pendingCount:pending.size,people:list().map(p=>({name:p.name,group:p.group,source:p.source})),version}}
 function moderation(){return {...publicRoom(),approvedNames:approvedList(),pending:[...pending.values()],inside:list().map(p=>({...p,muted:muted.has(p.id)})),messages:messages.map(m=>({...m})),muted:[...muted]}}
 function status(session){const p=inside.get(session.id);return {name:session.name,status:p?'approved':pending.has(session.id)?'pending':session.lastComment?'not-approved':'new',group:p?.group||null,...publicRoom()}}
 function appendChat({senderId,name:senderName,body,source,role=null,automated=false}){
  const entry={id:'m'+(++counter),senderId,name:senderName,text:body,source,
    at:new Date(now()).toISOString(),...(role?{role}:{}),...(automated?{automated:true}:{})};
  messages.push(entry);
  if(messages.length>80)messages.shift();
  version++;
  notify('temple.chat',{...entry,senderId:undefined});
  return entry;
 }
 function submit(id,displayName,raw,source='web'){
  const participant=inside.get(id);if(!participant)return {ok:false,reason:'not-approved'};
  if(muted.has(id))return {ok:false,reason:'muted'};
  const body=text(raw);if(!body)return {ok:false,reason:'empty-comment'};
  const then=lastMessage.get(id)||0;if(now()-then<(source==='tiktok'?1700:3500))return {ok:false,reason:'cooldown'};
  lastMessage.set(id,now());participant.lastSeen=now();
  // Use the already-approved identity, not a caller-supplied nickname.
  const entry=appendChat({senderId:id,name:participant.name,body,source:source==='tiktok'?'tiktok':'web'});
  // Each accepted, non-abbot message receives a varied, visibly automatic blessing.
  // Appending directly (not via submit) prevents reply loops.
  const phrase=blessingTemplates[blessingSequence++%blessingTemplates.length];
  appendChat({senderId:'abbot:auto',name:'Trụ trì',body:'Chúc '+participant.name+' '+phrase,
    source:'abbot',role:'abbot',automated:true});
  return {ok:true,message:entry};
 }
 function submitAbbot(raw){
  const body=text(raw);
  if(!body)return {ok:false,reason:'empty-comment'};
  const stamp=now(),recent=lastMessage.get('abbot:manual')||0;
  if(stamp-recent<900)return {ok:false,reason:'cooldown'};
  lastMessage.set('abbot:manual',stamp);
  const entry=appendChat({senderId:'abbot:manual',name:'Trụ trì',body,
    source:'abbot',role:'abbot',automated:false});
  // Manual admin messages never trigger an automatic blessing.
  return {ok:true,message:entry};
 }
 function chat(id,asAdmin=false){
  if(!asAdmin&&!inside.has(id))return null;
  return {messages:messages.map(({senderId,...m})=>m),version,muted:muted.has(id)};
 }
 function deleteMessage(id){const i=messages.findIndex(m=>m.id===id);if(i<0)return false;messages.splice(i,1);version++;notify('temple.chat-sync',chat('',true));return true}
 function setMute(id,value){if(!inside.has(id))return false;if(value)muted.add(id);else muted.delete(id);emit();return true}
 function clearChat(){messages.splice(0,messages.length);version++;notify('temple.chat-sync',chat('',true))}
 function sweep(){
  const ts=now();let changed=false;
  for(const [id,p] of inside){const lifetime=id.startsWith('tt:')?30*60000:2*60000;if(ts-p.lastSeen>lifetime){inside.delete(id);muted.delete(id);changed=true}}
  for(const [id,p] of pending)if(ts-p.at>30*60000){pending.delete(id);changed=true}
  for(const [token,s] of sessions)if(ts-s.lastSeen>12*3600000)sessions.delete(token);
  if(changed)emit();
 }
 const timer=setInterval(sweep,15000);timer.unref?.();
 return {identity,request,tiktokComment,approve,deny,remove,list,publicRoom,moderation,status,submit,submitAbbot,chat,deleteMessage,setMute,clearChat,sweep,revokeApprovedName,approvedList,isApproved:id=>inside.has(id),tiktokKey,pending,inside};
}
module.exports={createTempleRoom};
