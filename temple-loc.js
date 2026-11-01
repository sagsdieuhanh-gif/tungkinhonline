'use strict';
// Lộc may mắn: points for in-temple rituals only. Never currency or TikTok coins.
// Ephemeral per room process; approved visitor identity is verified by server.
const crypto = require('crypto');
const PRICES = Object.freeze({
  bow: 0, woodenFish: 1, incense: 5, bell: 10,
  lantern: 10, fortune: 15, lotus: 20, fruit: 25, lamp: 15
});
function createLuckyPool({randomInt=crypto.randomInt, now=()=>Date.now()}={}) {
  let current = null, nextId = 0;
  const balances = new Map(), lastAction = new Map(), meditation = new Map();
  const MEDITATION_COIN_PER_MINUTE = 10;
  const MEDITATION_PULSE_MAX_MS = 35000;
  function meditationView(id) {
    const rec=meditation.get(id);
    if(!rec)return {active:false,elapsedSeconds:0,totalMinutes:0,earned:0,ratePerMinute:MEDITATION_COIN_PER_MINUTE};
    if(rec.active && now()-rec.lastPulse>MEDITATION_PULSE_MAX_MS) rec.active=false;
    return {active:rec.active,elapsedSeconds:Math.floor(rec.totalElapsed/1000),
      totalMinutes:Math.floor(rec.totalElapsed/60000),
      earned:rec.earned,ratePerMinute:MEDITATION_COIN_PER_MINUTE};
  }
  function meditationStart(id) {
    if(!id)return {ok:false,error:'Hãy vào chánh điện trước khi ngồi thiền'};
    const t=now(),previous=meditation.get(id);
    if(previous?.active && t-previous.lastPulse<=MEDITATION_PULSE_MAX_MS)
      return {ok:true,...meditationView(id),balance:balance(id)};
    const rec={active:true,lastPulse:t,totalElapsed:previous?.totalElapsed||0,
      earned:previous?.earned||0};
    // New sessions restart the partial minute, not previously awarded coins.
    rec.totalElapsed=Math.floor(rec.totalElapsed/60000)*60000;
    meditation.set(id,rec);
    return {ok:true,...meditationView(id),balance:balance(id)};
  }
  function meditationPulse(id) {
    const rec=meditation.get(id);
    if(!rec?.active)return {ok:false,error:'Bạn chưa bắt đầu ngồi thiền hoặc phiên đã dừng'};
    const time=now(),delta=time-rec.lastPulse;
    if(delta<0||delta>MEDITATION_PULSE_MAX_MS){
      rec.active=false;
      return {ok:false,error:'Phiên thiền đã tạm dừng vì mất kết nối hoặc trang không hoạt động'};
    }
    rec.lastPulse=time;
    rec.totalElapsed+=delta;
    // Each complete, continuously-verified minute adds 10 internal coins.
    const expected=Math.floor(rec.totalElapsed/60000)*MEDITATION_COIN_PER_MINUTE;
    const awarded=Math.max(0,expected-rec.earned);
    const next=balance(id)+awarded;
    if(!Number.isSafeInteger(next)){
      rec.active=false;
      return {ok:false,error:'Số dư đạt giới hạn'};
    }
    if(awarded)balances.set(id,next);
    rec.earned=expected;
    return {ok:true,...meditationView(id),justEarned:awarded,balance:next};
  }
  function meditationStop(id) {
    const rec=meditation.get(id);
    if(rec) rec.active=false;
    return {ok:true,...meditationView(id),balance:balance(id)};
  }
  function view() {
    if(!current)return null;
    return {id:current.id,total:current.total,remaining:current.remaining,
      active:current.active && current.remaining>0,claimed:current.claims.size,
      startedAt:current.startedAt};
  }
  function balance(id) {return balances.get(id)||0;}
  function status(id) {return {ok:true,envelope:view(),balance:balance(id),
    claimed:!!current?.claims.has(id),prices:PRICES,meditation:meditationView(id)};}
  function open(amount) {
    const total=Number(amount);
    if(!Number.isSafeInteger(total)||total<1||total>100000)
      return {ok:false,error:'Nhập quỹ từ 1 đến 100.000 lộc ảo'};
    if(current?.active && current.remaining>0)
      return {ok:false,error:'Đợt lộc đang mở. Kết thúc đợt này trước khi mở đợt mới.'};
    current={id:'loc_'+now()+'_'+(++nextId),total,remaining:total,active:true,
      startedAt:new Date(now()).toISOString(),claims:new Map()};
    return {ok:true,envelope:view()};
  }
  function close() {
    if(!current)return {ok:false,error:'Chưa có đợt tặng lộc'};
    current.active=false;return {ok:true,envelope:view()};
  }
  function claim(id) {
    if(!id)return {ok:false,error:'Chưa được Trụ trì duyệt vào chùa'};
    if(!current?.active || current.remaining<1)return {ok:false,error:'Chưa có lộc hoặc quỹ đã hết'};
    if(current.claims.has(id))return {ok:false,error:'Bạn đã mở lộc trong đợt này'};
    const cap=Math.min(current.remaining,Math.max(1,Math.ceil(current.total*.3)),1000);
    const amount=randomInt(1,cap+1);
    const newBalance=balance(id)+amount;
    if(!Number.isSafeInteger(newBalance))return {ok:false,error:'Số dư vượt giới hạn'};
    current.remaining-=amount;
    current.claims.set(id,amount);
    if(current.remaining===0)current.active=false;
    balances.set(id,newBalance);
    return {ok:true,amount,balance:newBalance,envelope:view()};
  }
  function spend(id,action,callback) {
    if(!id||!Object.hasOwn(PRICES,action))return {ok:false,error:'Nghi thức không hợp lệ'};
    const cost=PRICES[action],have=balance(id);
    if(have<cost)return {ok:false,error:'Không đủ lộc ảo, cần '+cost+' lộc'};
    const stamp=now();
    const last=lastAction.get(id)||0;
    if(stamp-last<1400)return {ok:false,error:'Hãy chờ một chút giữa các nghi thức'};
    lastAction.set(id,stamp);
    balances.set(id,have-cost);
    try {
      const result=callback();
      return {ok:true,action,cost,balance:have-cost,result};
    } catch(e) {
      balances.set(id,have);
      return {ok:false,error:'Không hoàn thành nghi thức. Lộc chưa bị trừ.'};
    }
  }
  return {view,balance,status,open,close,claim,spend,prices:PRICES,
    meditationView,meditationStart,meditationPulse,meditationStop};
}
module.exports={createLuckyPool,PRICES};