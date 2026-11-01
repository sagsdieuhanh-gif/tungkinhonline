const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const { createTempleRoom } = require('./temple-room');
const { createLuckyPool } = require('./temple-loc');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. BỘ 18 QUẺ LINH XĂM SAGS CXR TAM BẢO (FORTUNE STICKS DECK)
// ============================================================================
const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Nhật Xuất Đông Phương — Mặt Trời Mọc Phương Đông',
    poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
    meaning: 'Mọi sự mưu cầu đều đại cát đại lợi. Công việc hanh thông, quý nhân phù trợ, gia đình hòa thuận ấm êm.',
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Nhật Xuất Đông Phương. Mọi sự mưu cầu đều đại cát đại lợi, công danh tài lộc viên mãn, quý nhân phù trợ.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Kim Liên Khai Nở — Sen Vàng Tỏa Ngát',
    poem: 'Sen vàng nở rộ giữa hồ trong\nHương thơm lan tỏa khắp non sông\nLòng thành thắp nén nhang cầu nguyện\nTrời Phật chứng tri thỏa ước mong.',
    meaning: 'Tâm thiện lành ắt gặp phước báu. Cầu tài đắc tài, cầu bình an đắc bình an, bệnh tật tiêu trừ.',
    ttsSummary: 'Quẻ số 8, Thượng Cát, Kim Liên Khai Nở. Tâm thiện lành ắt gặp phước báu, cầu tài đắc tài, cầu bình an đắc bình an.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nThí chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Xuân Phong Đắc Ý — Gió Xuân Thuận Buồm',
    poem: 'Thuận buồm xuôi gió vượt trùng khơi\nBến giác bình yên nắng rạng ngời\nTài lộc dồi dào nhân duyên tốt\nBốn mùa hưng thịnh rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán thuận lợi, tình duyên êm đẹp, người thân mạnh khỏe.',
    ttsSummary: 'Quẻ số 18, Thượng Cát, Xuân Phong Đắc Ý. Thuận buồm xuôi gió, tài lộc dồi dào, nhân duyên tốt đẹp.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Phúc Tinh Cao Chiếu — Sao Phúc Chiếu Mệnh',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nTừ bi Phật độ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Phúc Tinh Cao Chiếu. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 52,
    rank: 'Thượng Cát',
    title: 'Ngọc Xuất Côn Sơn — Ngọc Quý Phát Sáng',
    poem: 'Ngọc quý Côn Sơn tỏa ánh ngời\nBấy lâu rèn giũa nay gặp thời\nTri âm tương ngộ cùng nâng đỡ\nSự nghiệp thăng hoa rạng rỡ đời.',
    meaning: 'Nỗ lực bấy lâu nay sắp được đền đáp xứng đáng. Có người tốt nâng đỡ trong công việc và cuộc sống.',
    ttsSummary: 'Quẻ số 52, Thượng Cát, Ngọc Xuất Côn Sơn. Nỗ lực bấy lâu sắp được đền đáp xứng đáng, sự nghiệp thăng hoa.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Mã Đồng Hương — Lộc Tài Cùng Tới',
    poem: 'Lộc Mã song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành bố thí thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Mã Đồng Hương. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 81,
    rank: 'Thượng Cát',
    title: 'Nguyệt Nhập Trung Thiên — Trăng Rằm Giữa Đỉnh',
    poem: 'Trăng tròn vằng vặc giữa trời thu\nSoi sáng muôn phương sạch mây mù\nTình duyên viên mãn gia đình thuận\nTâm an vạn sự chẳng ưu tư.',
    meaning: 'Tình duyên và gia đạo vô cùng tốt đẹp. Người độc thân dễ gặp ý trung nhân, gia đình thêm tin vui.',
    ttsSummary: 'Quẻ số 81, Thượng Cát, Nguyệt Nhập Trung Thiên. Tình duyên viên mãn, gia đình hòa thuận, tâm an vạn sự lành.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Vạn Sự Viên Thành — Cửu Cửu Đại Cát',
    poem: 'Chín tầng mây trắng ánh hào quang\nTừ bi Phật Tổ độ nhân gian\nThí chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Vạn Sự Viên Thành. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

// ============================================================================
// 2. ZEROTTS PYTHON WORKER MANAGER (VOICE: MAI CHI)
// ============================================================================
class ZeroTTSManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.reqCounter = 0;
    this.buffer = '';
    this.startWorker();
  }

  resolvePythonBin() {
    const venvPy = path.join(__dirname, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPy)) return venvPy;
    return 'python3';
  }

  startWorker() {
    const pyBin = this.resolvePythonBin();
    const scriptPath = path.join(__dirname, 'tts_worker.py');
    console.log(`[ZeroTTS] Khởi chạy worker với ${pyBin} (Giọng mặc định: Mai Chi)...`);

    this.status = 'loading';
    this.proc = spawn(pyBin, [scriptPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[ZeroTTS stderr] ${msg}`);
    });

    this.proc.on('exit', (code) => {
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.ready = false;
      this.status = 'stopped';
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker exited' });
      }
      this.pending.clear();
    });
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'status') {
        this.status = msg.status;
        this.model = msg.model || this.model;
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.voices = msg.voices || ['maichi'];
        this.model = msg.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'result' && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          entry.resolve(msg);
        }
      } else if (msg.type === 'error') {
        console.error('[ZeroTTS Error]', msg.error);
        this.status = 'error';
        broadcastNotification('tts.status', this.getStatus());
      }
    } catch (err) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)',
      voice: state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model
    };
  }

  synthesize(text, voiceOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || state.settings.ttsVoice || 'maichi').toLowerCase();
    const dedupKey = `${voice}::${cleanText}`;

    if (this.inflight.has(dedupKey)) {
      return this.inflight.get(dedupKey);
    }

    const promise = new Promise((resolve) => {
      if (!this.proc || !this.ready) {
        return resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}` });
      }
      const id = ++this.reqCounter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
      }, 30000);

      this.pending.set(id, { resolve, timer });
      const payload = JSON.stringify({ id, text: cleanText, voice }) + '\n';
      this.proc.stdin.write(payload);
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

// ============================================================================
// 3. TRẠNG THÁI SAGS CXR TAM BẢO & BẢNG VÀNG CÔNG ĐỨC
// ============================================================================
const DEFAULT_STATE = {
  totalIncense: 0,
  totalMerit: 0,
  woodenFishHits: 0,
  bellRings: 0,
  lanternCount: 0,
  fortuneCount: 0,
  activeIncenseSticks: 0,
  haloIntensity: 0.45,
  offerings: {
    lotus: 0,
    fruit: 0,
    lamp: 0,
    dragon: 0
  },
  devotees: {},
  approvedDharmaNames: [],
  manualDisplayName: '',
  manualDisplayWish: '',
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    bgMusicEnabled: true,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        approvedDharmaNames: Array.isArray(saved.approvedDharmaNames)?saved.approvedDharmaNames:[],
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_STATE.tiktok }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();
// The actual room is ephemeral: an approved person must be physically present in this session.
state.settings.autoSim=false; // never create fake followers.
const room=createTempleRoom({approvedNames:state.approvedDharmaNames,onRegistryChange:list=>{state.approvedDharmaNames=list;saveState()},notify:(method,params)=>{
  broadcastNotification(method,params);
  if(method==='temple.chat')broadcastNotification('chat.message',{
    id:params.id,name:params.name,text:params.text,source:params.source,
    role:params.role||null,automated:Boolean(params.automated),timestamp:params.at
  });
  if(method==='temple.chat-sync')broadcastNotification('chat.sync',(params.messages||[]).map(m=>({
    id:m.id,name:m.name,text:m.text,source:m.source,timestamp:m.at
  })));
}});

const locPool=createLuckyPool();

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      approvedDharmaNames: state.approvedDharmaNames,
      manualDisplayName: state.manualDisplayName || '',
      manualDisplayWish: state.manualDisplayWish || '',
      settings: state.settings
    };
    fs.promises.writeFile(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

function getLeaderboard(limit = 6) {
  // Only individuals explicitly approved by the Trụ trì may occupy a seat.
  return room.list().map(p=>{
    const key=(p.id.startsWith('tt:')?p.id.slice(3):p.id).slice(0,40);
    const d=state.devotees[key]||{};
    return {name:p.name,uniqueId:key,avatar:d.avatar||p.avatar||'',merit:d.merit||0,incense:d.incense||0,lastWish:d.lastWish||'',group:p.group,joinedAt:p.joinedAt};
  }).sort((a,b)=>b.merit-a.merit||a.joinedAt-b.joinedAt).slice(0,limit).map((d,index)=>({...d,rank:index+1}));
}
// Bộ lọc chặn ký tự lạ (Cuneiform 𒐫, Zalgo, Braille, ký tự spam) & từ ngữ phản cảm
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const BAD_WORDS_RE = /(đá dái|địt|lồn|cặc|đm|vcl|vl|yamate|i cư|lừa đảo|lừa à|te-le gram|telegram|bố là trùm)/i;

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw);
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (BAD_WORDS_RE.test(s)) return true;
  return false;
}

function sanitizeUserName(rawName) {
  const normalized = String(rawName || '')
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || BAD_WORDS_RE.test(normalized)) {
    return 'Thí Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return 'Thí Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const cleaned = String(rawWish)
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 120);

  if (!cleaned || BAD_WORDS_RE.test(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const key = (uniqueId || displayName).slice(0, 40);
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: uniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      gifts: 0,
      lastWish: ''
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;

  state.totalMerit += meritDelta;
  state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
  return dev;
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    haloIntensity: state.haloIntensity,
    offerings: state.offerings,
    leaderboard: getLeaderboard(100),
    attendance: room.publicRoom(),
    manualDisplayName: state.manualDisplayName || '',
    manualDisplayWish: state.manualDisplayWish || '',
    recentEvents: state.recentEvents.slice(0, 15),
    settings: state.settings,
    tiktok: state.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
  };
}

// ============================================================================
// 4. NGHI THỨC TƯƠNG TÁC (RITUAL HANDLERS)
// ============================================================================
const Rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const devotee = recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Nam mô A Di Đà Phật. Cảm tạ thí chủ ${devotee.name} đã thành tâm thắp ${count} nén hương thơm. ${wish}.`;

    const event = pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0);

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      ttsText: params.ttsText || ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const ttsText = params.readTts
      ? `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`
      : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : (coins >= 100 ? 'dragon' : coins >= 20 ? 'fruit' : coins >= 5 ? 'lamp' : 'lotus');

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const merit = Math.max(20, coins * multiplier);

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);

    const ttsText = params.readTts === false
      ? ''
      : `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}, tích thêm ${merit} điểm công đức. Nguyện cầu chư Phật gia hộ cho thí chủ vạn sự cát tường như ý.`;

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftName,
      coins,
      merit,
      wish,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const fortune = FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];
    const merit = 10;

    state.fortuneCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`);

    const ttsText = params.readTts === false
      ? ''
      : `Thí chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  updateSettings(params = {}) {
    state.settings = {
      ...state.settings,
      ...params
    };
    if (typeof params.autoSim === 'boolean') {
      configureAutoSim(params.autoSim);
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER
// ============================================================================
let tiktokConn = null;

const commentCooldownMap = new Map();

function parseViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw || isBlockedSpamOrToxic(raw)) {
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) {
    return null;
  }

  // Chống 1 người spam bình luận liên tục làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeUserName(user);
  const lower = cleanWish.toLowerCase();

  // 1. Xin xăm / Gieo quẻ
  if (
    lower.includes('xin xăm') ||
    lower.includes('xin xam') ||
    lower.includes('gieo quẻ') ||
    lower.includes('gieo que') ||
    lower.includes('rút quẻ') ||
    lower.includes('rut que') ||
    lower.includes('quẻ') ||
    lower.includes('que')
  ) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 2. Thỉnh chuông
  if (lower.includes('chuông') || lower.includes('chuong') || lower.includes('thỉnh chuông')) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 3. Gõ mõ
  if (lower.includes('gõ mõ') || lower.includes('go mo') || lower.includes('tụng kinh')) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
  }

  // 4. Thắp hương / Bái Phật
  if (
    lower.includes('thắp hương') ||
    lower.includes('thap huong') ||
    lower.includes('dâng hương') ||
    lower.includes('dang huong') ||
    lower.includes('bái phật') ||
    lower.includes('bai phat') ||
    lower.includes('lạy phật') ||
    lower.includes('lay phat')
  ) {
    return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
  }

  // 5. Cầu nguyện / Thả đèn hoa đăng
  if (
    lower.includes('cầu') ||
    lower.includes('cau ') ||
    lower.includes('nguyện') ||
    lower.includes('nguyen') ||
    lower.includes('nam mô') ||
    lower.includes('nam mo') ||
    lower.includes('mô phật') ||
    lower.includes('mo phat') ||
    lower.includes('a di đà') ||
    lower.includes('a di da') ||
    lower.includes('bình an') ||
    lower.includes('tài lộc') ||
    lower.includes('chúc')
  ) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish });
}

const giftComboTracker = new Map();

async function resolveTikTokUsername(rawInput) {
  let input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    try {
      const resp = await fetch(urlToFetch, { redirect: 'follow' });
      const finalUrl = resp.url || '';
      const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
      if (resolvedMatch && resolvedMatch[1]) {
        return resolvedMatch[1];
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  tiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  tiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.DISCONNECTED, () => {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    console.log(`[TikTok Live] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.ERROR, (err) => {
    state.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount > 0) {
      state.tiktok.viewerCount = viewerCount;
      broadcastNotification('temple.viewerCount', { viewerCount });
    }
  });

  tiktokConn.on(WebcastEvent.MEMBER, () => {
    // Watching TikTok LIVE is not the same as being admitted to the temple.
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat] ${user}: ${commentText}`);
    const entrance=room.tiktokComment(uniqueId,user,commentText);
    if(!entrance.approved)return; // Only genuine TikTok commenters participate; no fake spectators.
    const publicText=cleanChatMessage(commentText);
    if(publicText)room.submit(entrance.id,user,publicText,'tiktok');
    parseViewerComment(commentText,user,uniqueId,avatar);
  });

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
  });

  const handleSocialEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  tiktokConn.on(WebcastEvent.FOLLOW, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SHARE, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleSocialEvent(data);
    }
  });

  tiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    const prevCount = giftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount && data?.repeatEnd) {
      giftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = Math.max(1, repeatCount - prevCount);
    giftComboTracker.set(groupId, repeatCount);
    if (giftComboTracker.size > 500) {
      const firstKey = giftComboTracker.keys().next().value;
      giftComboTracker.delete(firstKey);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
    const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`[TikTok Gift] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

    Rituals.offerGift({
      user,
      uniqueId,
      avatar,
      coins: totalCoins,
      giftName: displayGiftName,
      wish: `Thành tâm dâng ${displayGiftName} kính lễ Đức Phật A Di Đà`
    });
  });

  try {
    const roomState = await tiktokConn.connect();
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.lastError = err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    broadcastNotification('temple.state', getPublicState());
    throw new Error(state.tiktok.lastError);
  }
}

function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM)
// ============================================================================
let autoSimTimer = null;
const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Nguyễn', uniqueId: 'ngocanh.98', wish: 'Con thành tâm cầu cho bố mẹ luôn mạnh khỏe, bình an' },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', wish: 'Cầu tháng mới công việc thuận buồm xuôi gió, tài lộc hanh thông' },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', wish: 'Nam Mô A Di Đà Phật, nguyện cầu thế giới hòa bình chúng sinh an lạc' },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', wish: 'Cầu thi cử đỗ đạt điểm cao, sự nghiệp rộng mở' },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.lotus', wish: 'Cầu gia đạo êm ấm, con cái ngoan ngoãn học giỏi' },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', wish: 'Con xin gieo một quẻ cầu tài lộc đầu năm' }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[Math.floor(Math.random() * SIM_DEVOTEES.length)];
  const roll = Math.random();
  if (roll < 0.30) {
    Rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.55) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.75) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    Rituals.offerGift({ user: pick.user, uniqueId: pick.uniqueId, giftType: 'lotus', coins: 15, giftName: 'Hoa Sen Vàng Tinh Khiết' });
  } else {
    Rituals.ringBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureAutoSim(_enabled) {
  // The temple contains only real, Trụ trì-approved participants.
  state.settings.autoSim=false;
  if(autoSimTimer){clearInterval(autoSimTimer);autoSimTimer=null}
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.setStageName': {
      const raw = String(params.name || '').trim();
      if (raw.length < 2 || raw.length > 26) {
        throw new Error('Tên thí chủ cần có từ 2 đến 26 ký tự');
      }
      const name = sanitizeUserName(raw);
      if (name === 'Thí Chủ Hữu Duyên' && raw !== name) {
        throw new Error('Tên không hợp lệ. Hãy dùng chữ tiếng Việt hoặc chữ cái, không chỉ nhập biểu tượng');
      }
      const wish = sanitizeWishText(params.wish) || 'Cầu gia đình bình an, vạn sự cát tường';
      state.manualDisplayName = name;
      state.manualDisplayWish = wish;
      saveState();
      const result = getPublicState();
      broadcastNotification('temple.event', {
        event: { type: 'setStageName', user: name, wish },
        state: result
      });
      return { name, wish, state: result };
    }
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.speak': {
      const res = await zeroTts.synthesize(params.text, params.voice || 'maichi');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: params.text,
          voice: res.voice,
          url: res.url
        });
      }
      return res;
    }
    case 'temple.ttsStatus':
      return zeroTts.getStatus();
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}


// The online voice is synthesized remotely; the 512 MB Render process keeps
// only a bounded number of temporary MP3s, and never loads a TTS model.
const EDGE_VOICES = {
  female: 'vi-VN-HoaiMyNeural',
  male: 'vi-VN-NamMinhNeural'
};
const edgeInflight = new Map();
const EDGE_MAX_LENGTH = 700;
let edgeRunning = 0;

function normalizedNeuralVoice(input) {
  return input === EDGE_VOICES.male || input === 'male'
    ? EDGE_VOICES.male : EDGE_VOICES.female;
}
function trimNeuralCache() {
  try {
    const items = fs.readdirSync(TTS_CACHE_DIR)
      .filter(name => /^edge-[a-f0-9]{64}\.mp3$/.test(name))
      .map(name => ({ name, time: fs.statSync(path.join(TTS_CACHE_DIR, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (const item of items.slice(32)) {
      try { fs.unlinkSync(path.join(TTS_CACHE_DIR, item.name)); } catch (_) {}
    }
  } catch (_) {}
}

const onlineTts = {
  getStatus: () => ({
    ready: true,
    status: 'edge_online_configured',
    engine: 'Edge Neural TTS (unofficial, requires external network)',
    voice: EDGE_VOICES.female,
    voices: [EDGE_VOICES.female, EDGE_VOICES.male],
    external: true
  }),
  async synthesize(rawText, requestedVoice) {
    const text = String(rawText || '').trim();
    if (!text || text.length > EDGE_MAX_LENGTH) {
      return { ok: false, error: 'Nội dung đọc phải từ 1 đến 700 ký tự' };
    }
    const voice = normalizedNeuralVoice(requestedVoice);
    const digest = crypto.createHash('sha256').update(voice + '\n' + text).digest('hex');
    const filename = 'edge-' + digest + '.mp3';
    const filepath = path.join(TTS_CACHE_DIR, filename);
    const url = '/tts-cache/' + filename;
    try {
      if (fs.existsSync(filepath) && fs.statSync(filepath).size > 300) {
        return { ok: true, url, voice, engine: 'edge_online' };
      }
    } catch (_) {}
    if (edgeInflight.has(digest)) return edgeInflight.get(digest);
    if (edgeRunning >= 2) return { ok: false, error: 'Giọng đọc đang bận. Hãy thử lại.' };
    edgeRunning++;
    const task = (async () => {
      try {
        // Lazily require the client: a provider failure must not stop TikTok Live.
        const { EdgeTTS } = require('node-edge-tts');
        const engine = new EdgeTTS({
          voice,
          lang: 'vi-VN',
          rate: '-8%',
          pitch: '0Hz',
          volume: 'default',
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          timeout: 15000
        });
        await engine.ttsPromise(text, filepath);
        const stats = fs.statSync(filepath);
        if (stats.size <= 300 || stats.size > 1_800_000) throw new Error('Tệp âm thanh không hợp lệ');
        trimNeuralCache();
        return { ok: true, url, voice, engine: 'edge_online' };
      } catch (err) {
        try { fs.unlinkSync(filepath); } catch (_) {}
        const error = String(err?.message || err).slice(0,180);
        console.warn('[Edge Neural TTS]', error);
        return { ok: false, error: 'Giọng Neural online hiện không khả dụng: ' + error };
      } finally {
        edgeRunning--;
        edgeInflight.delete(digest);
      }
    })();
    edgeInflight.set(digest, task);
    return task;
  }
};


// Phòng chat chung: người xem trang web và bình luận TikTok chung một luồng.
// Giữ tối đa 80 tin trong RAM (Render Free không có ổ đĩa lưu trữ bền vững).
const sharedChat = [];
const chatRate = new Map();
const tiktokChatRate = new Map();
let chatSequence = 0;

function appendSharedChat(name, text, source = 'web') {
  const message = {
    id: 'chat_' + Date.now() + '_' + (++chatSequence),
    name: sanitizeUserName(name),
    text: String(text).trim().slice(0, 180),
    source: source === 'tiktok' ? 'tiktok' : 'web',
    timestamp: new Date().toISOString()
  };
  sharedChat.push(message);
  if (sharedChat.length > 80) sharedChat.shift();
  broadcastNotification('chat.message', message);
  return message;
}
function cleanChatMessage(raw) {
  const value = String(raw || '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value || value.length > 180) return null;
  if (isBlockedSpamOrToxic(value)) return null;
  if (/https?:\/\/|www\.|t\.me\/|discord\.gg\/|(?:\S+@[\w.-]+\.[a-z]{2,})/i.test(value)) return null;
  // Avoid long repeated-character spam.
  if (/(.)\1{8,}/u.test(value)) return null;
  return value;
}

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
// Render uses one reverse proxy hop; use the actual visitor IP for rate limits.
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const failedLogins = new Map();

function authorized(req) {
  if (!ADMIN_PASSWORD) return false;
  const cookies = (req.headers.cookie || '').split(';').map(x => x.trim());
  const raw = cookies.find(x => x.startsWith('tko_admin='));
  if (!raw) return false;
  const value = raw.substring('tko_admin='.length);
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const expiry = Number(match[1]);
  if (!Number.isSafeInteger(expiry) || expiry < Date.now() || expiry > Date.now() + SESSION_TTL_MS) return false;
  const expected = crypto.createHmac('sha256', ADMIN_PASSWORD).update(match[1]).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(expected, 'hex'));
}

function matchesPassword(value) {
  if (!ADMIN_PASSWORD || typeof value !== 'string' || value.length > 256) return false;
  const supplied = crypto.createHash('sha256').update(value).digest();
  const expected = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(supplied, expected);
}

function requireAdmin(req, res, next) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Yêu cầu đăng nhập quản trị tại /login' });
  next();
}

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/auth/status', (req, res) => {
  res.json({ authenticated: authorized(req), configured: Boolean(ADMIN_PASSWORD) });
});
app.post('/auth/login', (req, res) => {
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = failedLogins.get(address) || { count: 0, start: now };
  if (now - record.start > 15 * 60 * 1000) { record.count = 0; record.start = now; }
  if (record.count >= 10) return res.status(429).json({ ok: false, error: 'Thử lại sau 15 phút' });
  if (!matchesPassword(req.body?.password)) {
    record.count += 1;
    failedLogins.set(address, record);
    return res.status(401).json({ ok: false, error: 'Mật khẩu không đúng' });
  }
  failedLogins.delete(address);
  const expiry = String(now + SESSION_TTL_MS);
  const signature = crypto.createHmac('sha256', ADMIN_PASSWORD).update(expiry).digest('hex');
  res.setHeader('Set-Cookie', 'tko_admin=' + expiry + '.' + signature +
    '; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax');
  res.json({ ok: true });
});
app.post('/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'tko_admin=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  res.json({ ok: true });
});
app.get('/trutri', (req,res)=>{
  if(!authorized(req))return res.redirect(302,'/login?next=%2Ftrutri');
  res.sendFile(path.join(__dirname,'public','trutri.html'));
});
app.get(['/admin', '/admin.html'], (req, res) => {
  if (!authorized(req)) return res.redirect(302, '/login');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Root is the invitation gate, never direct entry to the prayer hall.
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','vao-chua.html')));
app.get('/index.html',(req,res)=>res.redirect(302,'/'));
app.get('/chandien',(req,res)=>{
  const ses=room.identity(req,res);
  if(!authorized(req)&&!room.isApproved(ses.id))return res.redirect(302,'/');
  return res.sendFile(path.join(__dirname,'public','index.html'));
});
app.get('/obs',(_req,res)=>{
  // Read-only broadcast display. Streaming audiences do not gain a prayer seat.
  return res.sendFile(path.join(__dirname,'public','index.html'));
});
// Do not allow direct access to the public files that bypass middleware.
app.get(['/vao-chua.html','/trutri.html'],(req,res)=>res.redirect(302,'/'));
app.use(express.static(path.join(__dirname,'public'),{index:false}));


// HTTP JSON-RPC 2.0 Endpoint
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!authorized(req) && method !== 'temple.getState' && method !== 'temple.ttsStatus') {
    return res.status(401).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32001, message: 'Đăng nhập quản trị tại /login' } });
  }
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

// Administrator may synthesize arbitrary sanitized text; public clients can
// synthesize only server-generated event texts or the fixed demonstration line.
app.post('/api/tts', requireAdmin, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > EDGE_MAX_LENGTH) {
    return res.status(400).json({ ok: false, error: 'Nội dung không hợp lệ' });
  }
  const result = await zeroTts.synthesize(text, req.body?.voice);
  res.status(result.ok ? 200 : 503).json(result);
});

app.get('/api/tts/event/:id', async (req, res) => {
  const evt = state.recentEvents.find(x => x.id === req.params.id);
  if (!evt || !evt.ttsText) return res.status(404).send('Không tìm thấy câu đọc');
  const result = await zeroTts.synthesize(evt.ttsText, req.query.voice);
  if (!result.ok) return res.status(503).json(result);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(TTS_CACHE_DIR, path.basename(result.url)));
});

const demoVoiceLimit = new Map();
app.get('/api/tts/demo', async (req, res) => {
  const source = req.ip || 'unknown';
  const now = Date.now();
  const record = demoVoiceLimit.get(source) || { count: 0, starts: now };
  if (now - record.starts > 3600000) { record.count = 0; record.starts = now; }
  if (record.count >= 8) return res.status(429).send('Đã vượt số lượt đọc thử trong một giờ');
  record.count++;
  demoVoiceLimit.set(source, record);
  const demo = 'Nam mô A Di Đà Phật. SAGS CXR Tam Bảo kính chào quý thí chủ thập phương. Nguyện cầu bình an và hạnh phúc.';
  const result = await zeroTts.synthesize(demo, req.query.voice);
  if (!result.ok) return res.status(503).json(result);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(TTS_CACHE_DIR, path.basename(result.url)));
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});


// All visitor actions use a cryptographically random HttpOnly session cookie.
// This does NOT prove company employment; the Trụ trì chooses the classification.
const sameOrigin=(req)=>{
 const origin=req.headers.origin;
 if(!origin)return false;
 try{return new URL(origin).host===req.headers.host}catch{return false}
};
const guestOrigin=(req,res,next)=>{
 if(!sameOrigin(req))return res.status(403).json({error:'Yêu cầu phải gửi từ website SAGS CXR Tam Bảo'});
 next();
};
app.get('/api/temple/me',(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const ses=room.identity(req,res);
 res.json(room.status(ses));
});
app.post('/api/temple/join',guestOrigin,(req,res)=>{
 const ses=room.identity(req,res),display=String(req.body?.name||'').trim();
 const body=String(req.body?.comment||'').trim();
 if(display.length<2||display.length>32||body.length>180)return res.status(400).json({error:'Nhập pháp danh từ 2–32 ký tự. Lời nhắn tối đa 180 ký tự'});
 if(ses.lastComment&&Date.now()-ses.lastComment<8000)return res.status(429).json({error:'Hãy chờ 8 giây trước khi gửi lại'});
 ses.lastComment=Date.now();ses.name=sanitizeUserName(display);
 const r=room.request({id:ses.id,displayName:ses.name,comment:body,source:'web'});
 if(!r.ok){
   const reasons={'name-in-use':'Pháp danh đang được người khác sử dụng trong chánh điện. Nếu không phải bạn, hãy liên hệ Trụ trì.','empty-comment':'Hãy nhập lời nhắn hợp lệ.','full':'Chánh điện đã đủ 100 người.'};
   return res.status(r.reason==='name-in-use'?409:429).json({error:reasons[r.reason]||r.reason});
 }
 res.json({...room.status(ses),returning:Boolean(r.returning)});
});
app.post('/api/temple/leave',guestOrigin,(req,res)=>{
 const ses=room.identity(req,res);
 room.remove(ses.id);room.deny(ses.id);ses.lastComment=0;
 res.json(room.status(ses));
});
app.get('/api/temple/chat',(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const ses=room.identity(req,res),data=room.chat(ses.id,authorized(req));
 if(!data)return res.status(403).json({error:'Hãy vào chánh điện trước khi xem và gửi chat'});
 res.json(data);
});
app.post('/api/temple/chat',guestOrigin,(req,res)=>{
 const ses=room.identity(req,res);
 const content=cleanChatMessage(req.body?.text);
 if(!content)return res.status(400).json({error:'Tin nhắn không hợp lệ hoặc chứa liên kết/spam'});
 const result=room.submit(ses.id,ses.name,content,'web');
 if(!result.ok)return res.status(result.reason==='cooldown'?429:403).json({error:result.reason==='muted'?'Trụ trì đã tắt chat của bạn':result.reason==='cooldown'?'Gửi chậm lại, 3,5 giây một tin':'Chưa được Trụ trì duyệt'});
 res.json({ok:true});
});
// Compatibility for the original stage's chat overlay. No guest can bypass approval.
app.get('/api/chat',(req,res)=>{
 const ses=room.identity(req,res),data=room.chat(ses.id,authorized(req));
 if(!data)return res.status(403).json({error:'Chưa được Trụ trì duyệt'});
 res.setHeader('Cache-Control','no-store');
 res.json({ok:true,messages:data.messages.map(m=>({...m,timestamp:m.at}))});
});
app.post('/api/chat',guestOrigin,(req,res)=>{
 const ses=room.identity(req,res),content=cleanChatMessage(req.body?.text);
 if(!content)return res.status(400).json({error:'Nội dung không hợp lệ'});
 const result=room.submit(ses.id,ses.name,content,'web');
 if(!result.ok)return res.status(403).json({error:result.reason});
 res.status(201).json({ok:true,message:result.message});
});
app.delete('/api/chat',requireAdmin,(_req,res)=>{room.clearChat();res.json({ok:true})});

// Lucky envelopes are distinct from real money and TikTok gifts.
// The participant's HttpOnly cookie is validated against the approved room.
function locPerson(req,res){
 const ses=room.identity(req,res);
 return room.inside.get(ses.id)||null;
}
function locNotify(){
 broadcastNotification('temple.loc',{envelope:locPool.view()});
}
function locRitual(person,action,wish){
 const info={user:person.name,uniqueId:person.id,avatar:person.avatar||'',
   wish:sanitizeWishText(wish)||'Cầu gia đình bình an, sức khỏe và may mắn',
   count:1,readTts:true};
 if(action==='bow'){
   const event=pushEventLog({type:'bowToBuddha',user:person.name,
     uniqueId:person.id,avatar:person.avatar||'',wish:info.wish,merit:0,ttsText:''});
   broadcastNotification('temple.event',{event,state:getPublicState()});
   return {event};
 }
 if(action==='woodenFish')return Rituals.strikeWoodenFish(info);
 if(action==='incense')return Rituals.burnIncense(info);
 if(action==='bell')return Rituals.ringBell(info);
 if(action==='lantern')return Rituals.sendPrayer(info);
 if(action==='fortune')return Rituals.drawFortune({...info,topic:info.wish});
 if(action==='lotus'){
   // Genuine virtual flower. Never manufacture or report TikTok coins.
   const dev=recordDevotee(person.name,person.id,person.avatar||'',20,0,1,info.wish);
   state.offerings.lotus=(state.offerings.lotus||0)+1;
   const event=pushEventLog({type:'offerGift',user:dev.name,uniqueId:person.id,
     avatar:dev.avatar,giftType:'lotus',giftName:'Hoa Sen Bình An',
     coins:0,virtualCost:20,merit:20,wish:info.wish,
     ttsText:'Nam mô A Di Đà Phật. Thí chủ '+dev.name+' thành tâm dâng hoa sen cầu bình an.'});
   saveState();
   broadcastNotification('temple.event',{event,state:getPublicState()});
   return {event};
 }
 throw Error('Nghi thức không hợp lệ');
}
app.get('/api/temple/loc/status',(req,res)=>{
 const person=locPerson(req,res);
 res.setHeader('Cache-Control','no-store');
 if(!person)return res.status(403).json({ok:false,error:'Chỉ người đang ở chánh điện mới nhận lộc'});
 res.json(locPool.status(person.id));
});
app.post('/api/temple/loc/claim',guestOrigin,(req,res)=>{
 const person=locPerson(req,res);
 if(!person)return res.status(403).json({ok:false,error:'Hãy vào chánh điện trước khi mở lộc'});
 const r=locPool.claim(person.id);
 if(r.ok)locNotify();
 res.status(r.ok?200:409).json(r);
});
app.post('/api/temple/loc/ritual',guestOrigin,(req,res)=>{
 const person=locPerson(req,res);
 if(!person)return res.status(403).json({ok:false,error:'Chờ Trụ trì duyệt trước khi hành lễ'});
 const action=String(req.body?.action||'');
 const r=locPool.spend(person.id,action,()=>locRitual(person,action,req.body?.wish));
 res.status(r.ok?200:409).json(r);
});
app.get('/api/trutri/loc',requireAdmin,(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json({ok:true,envelope:locPool.view(),prices:locPool.prices});
});
app.post('/api/trutri/loc/open',requireAdmin,guestOrigin,(req,res)=>{
 const r=locPool.open(req.body?.total);
 if(r.ok)locNotify();
 res.status(r.ok?200:409).json(r);
});
app.post('/api/trutri/loc/close',requireAdmin,guestOrigin,(_req,res)=>{
 const r=locPool.close();
 if(r.ok)locNotify();
 res.status(r.ok?200:409).json(r);
});

app.get('/api/trutri/room',requireAdmin,(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json(room.moderation())});
app.post('/api/trutri/decide',requireAdmin,guestOrigin,(req,res)=>{
 const id=String(req.body?.id||''),r=req.body?.allow?room.approve(id,req.body?.group):{ok:room.deny(id)};
 if(!r.ok)return res.status(409).json({error:r.reason||'Yêu cầu không tồn tại hoặc đã được xử lý'});
 broadcastNotification('temple.state',getPublicState());res.json({ok:true});
});
app.post('/api/trutri/remove',requireAdmin,guestOrigin,(req,res)=>{
 const ok=room.remove(req.body?.id);broadcastNotification('temple.state',getPublicState());res.json({ok});
});
app.post('/api/trutri/approved/revoke',requireAdmin,guestOrigin,(req,res)=>{
 const name=String(req.body?.name||'').trim();
 const ok=room.revokeApprovedName(name);
 if(ok)broadcastNotification('temple.state',getPublicState());
 res.json({ok});
});
app.post('/api/trutri/mute',requireAdmin,guestOrigin,(req,res)=>res.json({ok:room.setMute(req.body?.id,Boolean(req.body?.muted))}));
app.post('/api/trutri/chat/send',requireAdmin,guestOrigin,(req,res)=>{
 const content=cleanChatMessage(req.body?.text);
 if(!content)return res.status(400).json({ok:false,error:'Tin nhắn không hợp lệ hoặc chứa đường link/spam'});
 const result=room.submitAbbot(content);
 if(!result.ok)return res.status(result.reason==='cooldown'?429:400).json({ok:false,error:result.reason==='cooldown'?'Vui lòng chờ một chút giữa các tin nhắn':'Tin nhắn không hợp lệ'});
 res.json(result);
});
app.post('/api/trutri/chat/delete',requireAdmin,guestOrigin,(req,res)=>res.json({ok:room.deleteMessage(req.body?.id)}));
app.post('/api/trutri/chat/clear',requireAdmin,guestOrigin,(_req,res)=>{room.clearChat();res.json({ok:true})});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', verifyClient: ({ req, origin }, done) => {
  if (!origin) return done(true);
  try {
    const parsed = new URL(origin);
    done((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.host === req.headers.host);
  } catch (_) {
    done(false, 403, 'Invalid Origin');
  }
} });

function broadcastNotification(method, params) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  const isAdmin = authorized(req);
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'temple.state',
      params: getPublicState()
    })
  );
  if(isAdmin)ws.send(JSON.stringify({jsonrpc:'2.0',method:'chat.sync',params:room.chat('',true).messages.map(m=>({...m,timestamp:m.at}))}));

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      if (!isAdmin && msg.method !== 'temple.getState' && msg.method !== 'temple.ttsStatus') {
        throw new Error('Yêu cầu đăng nhập quản trị tại /login');
      }
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
        );
      }
    }
  });
});

const zeroTts = process.env.ENABLE_TTS === '1' ? new ZeroTTSManager() : onlineTts;

server.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🪷 SAGS CXR TAM BẢO TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG`);
  console.log(`📺 Màn hình Live (9:16 OBS): http://localhost:${PORT}`);
  console.log(`🎛️ Bảng điều khiển RPC Admin: http://localhost:${PORT}/admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint   : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  console.log(`============================================================`);

  // Chỉ tự kết nối khi chủ dự án chủ động cấu hình TIKTOK_USER.
  const defaultChannel = process.env.TIKTOK_USER || '';
  if (defaultChannel) {
    connectTikTokLive(defaultChannel).catch((err) => {
      console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, err.message);
    });
  }
});
