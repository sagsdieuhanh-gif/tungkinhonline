/**
 * TempleAudioEngine
 * - Nhạc nền: hai bản gốc từ DiChuaOnline (music1.mp3, music2.mp3), tự chuyển bài.
 *   Âm lượng tự hạ khi có giọng đọc; không dùng nhạc synth/nhạc cũ.
 * - Pháp khí: giữ tổng hợp tiếng mõ, đại hồng chung, ống xăm và chuông dâng lễ.
 * - Giọng đọc: giữ cơ chế phát Neural TTS tiếng Việt.
 */
class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';
    // Keep server ZeroTTS off on Render Free (512 MB). Use device TTS.
    this.serverTtsAvailable = false;
    this.onlineVoice = 'vi-VN-HoaiMyNeural';
    try { this.onlineVoice = localStorage.getItem('temple_online_voice') || this.onlineVoice; } catch (_) {}
    this.browserSpeechSupported = typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance === 'function';
    try { this.browserVoiceURI = localStorage.getItem('temple_browser_voice') || ''; }
    catch (_) { this.browserVoiceURI = ''; }

    // Hai bản nhạc gốc được sao chép chính xác từ DiChuaOnline.
    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.48;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.95;
    this.bgTracks = [
      { src: '/assets/music/music1.mp3', title: 'Trăng trên rừng trúc' },
      { src: '/assets/music/music2.mp3', title: 'Hơi thở ban mai' }
    ];
    this.bgTrackIndex = 0;
    this.bgTrackFailures = 0;
    this.bgMusicError = '';
    this.onBgTrackChange = null;
    this.bgAudio = new Audio(this.bgTracks[0].src);
    this.bgAudio.loop = false; // Bản 1 kết thúc → bản 2 → bản 1...
    this.bgAudio.preload = 'metadata';
    this.bgAudio.volume = this.bgBaseVolume;
    this.bgAudio.onended = () => {
      this.bgTrackFailures = 0;
      this.nextBackgroundTrack();
    };
    this.bgAudio.onerror = () => {
      if (!this.bgMusicEnabled) return;
      this.bgTrackFailures += 1;
      if (this.bgTrackFailures < this.bgTracks.length) {
        this.nextBackgroundTrack();
      } else {
        this.bgMusicError = 'Không tải được nhạc DiChuaOnline; hãy kiểm tra kết nối và tải lại trang.';
        console.warn('[Temple Music]', this.bgMusicError);
        this.onBgTrackChange?.(this.getCurrentMusicTitle(), this.bgMusicError);
      }
    };
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.onTtsStateChange = null;
    this.lastSpeechError = '';
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC THIỀN DI CHUA ONLINE: HAI FILE MP3, PHÁT TUẦN TỰ
  // --------------------------------------------------------------------------
  getCurrentMusicTitle() {
    return this.bgTracks[this.bgTrackIndex]?.title || 'Nhạc thiền';
  }

  getDuckedVolume() {
    return Math.max(0, Math.min(1, +(this.bgBaseVolume * 0.35).toFixed(2)));
  }

  setMusicVolume(vol) {
    const v = Number(vol);
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('temple_music_vol', String(this.bgBaseVolume)); } catch (_) {}
    if (this.bgAudio) {
      this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
    }
  }

  setTtsVolume(vol) {
    const v = Number(vol);
    if (!Number.isFinite(v)) return;
    this.ttsVolume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('temple_tts_vol', String(this.ttsVolume)); } catch (_) {}
    if (this.currentAudio) this.currentAudio.volume = this.ttsVolume;
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled || !this.unlocked || this.bgTrackFailures >= this.bgTracks.length) return;
    this.bgAudio.volume = this.ttsPlaying ? this.getDuckedVolume() : this.bgBaseVolume;
    if (this.bgAudio.paused) {
      try {
        const playback = this.bgAudio.play();
        playback?.catch?.(error => {
          // Autoplay restrictions require the user to tap the unlock button.
          if (error?.name !== 'NotAllowedError' && this.bgAudio.error) {
            console.warn('[Temple Music] Cannot play', this.getCurrentMusicTitle(), error);
          }
        });
      } catch (error) {
        console.warn('[Temple Music] Playback failed:', error);
      }
    }
  }

  nextBackgroundTrack() {
    this.bgTrackIndex = (this.bgTrackIndex + 1) % this.bgTracks.length;
    this.bgMusicError = '';
    this.bgAudio.pause();
    this.bgAudio.src = this.bgTracks[this.bgTrackIndex].src;
    this.bgAudio.load();
    if (this.bgMusicEnabled) this.startZenAmbience();
    this.onBgTrackChange?.(this.getCurrentMusicTitle(), '');
    return this.getCurrentMusicTitle();
  }

  stopZenAmbience() {
    try { this.bgAudio.pause(); } catch (_) {}
  }

  setBgDucking(ducked) {
    if (!this.bgAudio) return;
    this.bgAudio.volume = ducked ? this.getDuckedVolume() : this.bgBaseVolume;
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ TỤNG KINH (WOODEN FISH PERCUSSION SYNTH)
  // --------------------------------------------------------------------------
  playWoodenFish(pitchMultiplier = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 620 * pitchMultiplier * (0.98 + Math.random() * 0.04);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, now + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, now);
      filter.Q.setValueAtTime(4.0, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const base = 174;
      const partials = [
        { ratio: 0.5, amp: 0.22, decay: 4.2 },
        { ratio: 1.0, amp: 0.35, decay: 3.6 },
        { ratio: 1.506, amp: 0.16, decay: 2.4 },
        { ratio: 2.0, amp: 0.18, decay: 1.9 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * Math.min(1.0, intensity), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE (FORTUNE STICK SHAKER)
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playWoodenFish(1.32 + (i % 2) * 0.16);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG NGỌC DÂNG LỄ / THẮP HƯƠNG (SINGING CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const notes = [528, 660];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.10, now + idx * 0.1 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.15);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. ZEROTTS VOICE QUEUE & PREFETCHER
  // --------------------------------------------------------------------------

  setServerTtsAvailable(ready) {
    this.serverTtsAvailable = Boolean(ready);
  }

  setOnlineVoice(voice) {
    this.onlineVoice = voice === 'vi-VN-NamMinhNeural' ? voice : 'vi-VN-HoaiMyNeural';
    try { localStorage.setItem('temple_online_voice', this.onlineVoice); } catch (_) {}
  }

  getVietnameseVoices() {
    if (!this.browserSpeechSupported) return [];
    try {
      return window.speechSynthesis.getVoices().filter(v => /^vi([_-]|$)/i.test(v.lang || ''));
    } catch (_) {
      return [];
    }
  }

  setBrowserVoice(uri) {
    this.browserVoiceURI = String(uri || '');
    try { localStorage.setItem('temple_browser_voice', this.browserVoiceURI); } catch (_) {}
  }

  chooseBrowserVoice() {
    const voices = this.getVietnameseVoices();
    if (!voices.length) return null;
    return voices.find(v => v.voiceURI === this.browserVoiceURI) ||
      voices.find(v => /hoài|hoai|linh|my|mai|female|nữ/i.test(v.name)) ||
      voices.find(v => v.default) || voices[0];
  }

  // Web Speech uses the OS voice instead of the Python ZeroTTS model.
  // It needs an unlocked/foreground browser and a Vietnamese voice installed.
  speakWithBrowser(item) {
    return new Promise(resolve => {
      let started = false;
      let finished = false;
      let watchdog;
      const start = () => {
        if (started) return;
        started = true;
        try { item.onStart?.(); } catch (_) {}
        try { this.onTtsStateChange?.({ speaking: true, text: item.text, engine: 'browser' }); } catch (_) {}
      };
      const end = (ok, message = '') => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        if (!ok) this.lastSpeechError = message || 'Không thể phát giọng đọc';
        start(); // Preserve the fortune visual even when speech is blocked.
        try { item.onEnd?.(); } catch (_) {}
        resolve(ok);
      };
      if (!this.browserSpeechSupported) {
        end(false, 'Trình duyệt không hỗ trợ giọng đọc hệ thống');
        return;
      }
      try {
        const u = new window.SpeechSynthesisUtterance(item.text);
        u.lang = 'vi-VN';
        u.rate = 0.93;
        u.pitch = 1;
        u.volume = Math.max(0, Math.min(1, this.ttsVolume));
        const voice = this.chooseBrowserVoice();
        if (voice) u.voice = voice;
        u.onstart = start;
        u.onend = () => end(true);
        u.onerror = event => end(false, event?.error || 'Trình duyệt chặn giọng đọc');
        window.speechSynthesis.speak(u);
        watchdog = setTimeout(() => {
          try { window.speechSynthesis.cancel(); } catch (_) {}
          end(false, 'Giọng đọc bị dừng hoặc không hoạt động');
        }, Math.max(20000, Math.min(90000, item.text.length * 400)));
      } catch (error) {
        end(false, error?.message || 'Không thể mở giọng đọc');
      }
    });
  }

  enqueueTts(text, options = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    if (!this.ttsEnabled) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 5500);
      return;
    }

    if (this.ttsQueue.length >= 6) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    this.lastSpeechError = '';
    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || (this.serverTtsAvailable && options.eventId
        ? '/api/tts/event/' + encodeURIComponent(options.eventId) + '?voice=' + encodeURIComponent(this.onlineVoice)
        : null),
      onStart,
      onEnd,
      fetchPromise: null
    };

    if (!item.url && this.serverTtsAvailable) {
      // Only administrator preview can synthesize arbitrary text.
      // Public Live stage uses the event-restricted audio URL above.
      item.fetchPromise = null;
    }

    this.ttsQueue.push(item);
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text, voice = 'maichi') {
    try {
      if (!this.serverTtsAvailable) {
        return { ok: false, error: 'ZeroTTS tắt trên Render Free; dùng giọng hệ thống' };
      }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      const data = await res.json();
      if (data && data.ok && data.url) {
        return data;
      }
      return { ok: false, error: data?.error || 'ZeroTTS unavailable' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;
    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();

    try {
      let audioUrl = item.url;
      if (!audioUrl && item.fetchPromise) {
        const res = await item.fetchPromise;
        if (res && res.ok && res.url) {
          audioUrl = res.url;
        }
      }

      if (audioUrl) {
        this.setBgDucking(true);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: true, synthesizing: false, text: item.text });
        }
        if (item.onStart) item.onStart();
        await this.playWavUrl(audioUrl);
        if (item.onEnd) item.onEnd();
      } else {
        // Never automatically substitute a robotic OS voice for Neural TTS.
        if (this.serverTtsAvailable) {
          this.lastSpeechError = 'Không có tệp giọng Neural. Kiểm tra kết nối mạng.';
          try { item.onStart?.(); } catch (_) {}
          try { item.onEnd?.(); } catch (_) {}
        } else {
          this.setBgDucking(true);
          await this.speakWithBrowser(item);
        }
      }
    } catch (err) {
      console.warn('[Voice Playback Warning]', err);
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      this.ttsPlaying = false;
      if (this.lastSpeechError) {
        try {
          this.onTtsStateChange?.({ speaking: false, text: '', error: this.lastSpeechError, engine: 'browser' });
        } catch (_) {}
      }
      if (this.ttsQueue.length === 0) {
        this.setBgDucking(false);
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: false, synthesizing: false, text: '' });
        }
      } else {
        setTimeout(() => this.processTtsQueue(), 250);
      }
    }
  }

  playWavUrl(url) {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        this.currentAudio = audio;
        audio.volume = this.ttsVolume;
        audio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.lastSpeechError = 'Giọng Neural chưa tải được từ máy chủ. Hãy kiểm tra trạng thái TTS.';
          this.currentAudio = null;
          resolve();
        };
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((error) => {
            this.lastSpeechError = 'Trình duyệt chặn phát âm thanh. Hãy bấm BẬT ÂM THANH rồi thử lại.';
            this.currentAudio = null;
            resolve();
          });
        }
      } catch (_) {
        resolve();
      }
    });
  }
}

window.TempleAudioEngine = TempleAudioEngine;
