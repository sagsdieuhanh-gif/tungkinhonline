/**
 * Live 9:16 Client Controller — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Hiển thị 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Công Đức)
 * - Hiển thị 40 Phật Tử mặc áo lam quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng người xem bước dọc thảm đỏ lên trước Lư Hương Đồng dâng hương
 * - Giọng đọc ZeroTTS (Mai Chi) + Pháp khí Web Audio
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  // /obs is the dedicated 9:16 stream source. Earlier versions only enabled
  // OBS layout with ?obs=1, leaving /obs in an ordinary app layout and causing
  // a tiny canvas to be magnified by TikTok LIVE Studio.
  const isBroadcastSource = window.location.pathname === '/obs' || params.get('obs') === '1';
  if (isBroadcastSource) {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    // Content width excludes the mobile stage border; resize on reflow.
    const width = stageWrapper.clientWidth || stageWrapper.getBoundingClientRect().width;
    if (!width || !Number.isFinite(width)) return;
    stage9x16.style.transform = `scale(${width / 1080})`;
  }
  window.addEventListener('resize', fitStage, { passive: true });
  window.addEventListener('orientationchange', () => requestAnimationFrame(fitStage), { passive: true });
  if (typeof ResizeObserver !== 'undefined' && stageWrapper) {
    new ResizeObserver(fitStage).observe(stageWrapper);
  }
  requestAnimationFrame(fitStage);

  // High-definition LIVE uses the original lossless PNG. The JPEG is only
  // 810x1440, below the 1080x1920 native stream canvas: enlarging it blurs
  // edges, small text/art and golden ornamental details.
  // Lightweight JPEG is retained for mobile/small-screen temple viewers.
  const sanctuaryImage = document.querySelector('.sanctuary-bg-img');
  if (sanctuaryImage) {
    const primary = isBroadcastSource
      ? '/assets/amitabha_stage.png'
      : '/assets/amitabha_stage.jpg';
    const fallback = isBroadcastSource
      ? '/assets/amitabha_stage.jpg'
      : '/assets/amitabha_stage.png';
    let fallbackUsed = false;
    sanctuaryImage.addEventListener('error', () => {
      if (!fallbackUsed) {
        fallbackUsed = true;
        sanctuaryImage.src = fallback;
      }
    });
    sanctuaryImage.decoding = 'async';
    sanctuaryImage.fetchPriority = 'high';
    if (isBroadcastSource) sanctuaryImage.src = primary;
  }

  // 2. Khởi tạo Particle Engine & Audio Engine (ZeroTTS Mai Chi)
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();
  // Only the local containing theater can quiet this iframe's background MP3.
  // A visitor's private movie never changes OBS or another viewer's audio.
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== window.parent) return;
    if (event.data?.type !== 'sags-theater-audio') return;
    if (event.data.suspend === true) {
      audio.stopZenAmbience();
    } else if (audio.bgMusicEnabled && audio.unlocked) {
      audio.startZenAmbience();
    }
  });

  const voiceSelect = document.getElementById('neuralVoiceSelect');
  const voiceStatus = document.getElementById('browserVoiceStatus');

  function updateVoiceStatus(message, danger = false) {
    if (!voiceStatus) return;
    voiceStatus.textContent = message;
    voiceStatus.style.color = danger ? '#ffab9f' : '#d8f3ca';
  }
  if (voiceSelect) {
    voiceSelect.value = audio.onlineVoice;
    voiceSelect.addEventListener('change', event => {
      audio.setOnlineVoice(event.target.value);
      updateVoiceStatus('Đã chọn giọng ' + (audio.onlineVoice.includes('HoaiMy') ? 'Hoài Mỹ' : 'Nam Minh') + '. Bấm NGHE THỬ.');
    });
  }

  audio.onTtsStateChange = ({ speaking, error, engine }) => {
    if (error) updateVoiceStatus('❌ ' + error, true);
    else if (speaking) updateVoiceStatus('🔊 Đang phát giọng Neural tiếng Việt...');
  };

  document.getElementById('btnTestBrowserVoice')?.addEventListener('click', () => {
    audio.ensureContext();
    if (!audio.ttsEnabled) {
      audio.ttsEnabled = true;
      const button = document.getElementById('btnToggleTts');
      if (button) {
        button.textContent = '🎙️ Giọng Đọc: BẬT';
        button.classList.add('active-toggle');
      }
    }
    updateVoiceStatus('⏳ Đang yêu cầu giọng Neural online, vui lòng kiểm tra âm thanh...');
    audio.enqueueTts('Nam mô A Di Đà Phật. SAGS CXR Tam Bảo kính chào quý thí chủ.', {
      url: '/api/tts/demo?voice=' + encodeURIComponent(audio.onlineVoice)
    });
  });

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '✅ Âm Thanh Chùa Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // 3. Vẽ các nén nhang đang cháy trong Lư Hương Đỉnh Đồng (x=540, y=895)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  let renderedStickCount = 0;

  function renderIncenseSticks(count) {
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 65 + spread * 28 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 12 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 76 + (i % 3) * 6;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember';
      ember.style.animationDelay = `${(i * 0.15) % 1.1}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 540 + (leftPx - 65) + Math.sin(rad) * heightPx;
      const tipY = 895 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  // 4. Dựng Hàng 6 Đệm Quỳ VIP (Top 6 Thí Chủ trên bục gỗ y=1188)
  const VIP_CUSHION_COORDS = [
    { x: 140, y: 1188, rank: 1 },
    { x: 268, y: 1188, rank: 2 },
    { x: 392, y: 1188, rank: 3 },
    { x: 688, y: 1188, rank: 4 },
    { x: 812, y: 1188, rank: 5 },
    { x: 940, y: 1188, rank: 6 }
  ];

  let lastVipActorSignature = '';
  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;
    // Preserve existing named actor sprites while unrelated state messages arrive.
    const signature = JSON.stringify(leaderboard.slice(0, 6).map(d => [d.uniqueId, d.name, d.merit]));
    if (signature === lastVipActorSignature) return;
    lastVipActorSignature = signature;

    layer.innerHTML = VIP_CUSHION_COORDS.map((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return '';
      return `
        <div class="vip-devotee-slot" data-devotee-id="${escapeHtml(String(dev.uniqueId || ''))}" data-devotee-name="${escapeHtml(String(dev.name || ''))}" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${12 + idx};">
          <img src="/assets/devotee.png" alt="VIP Devotee" class="devotee-sprite" />
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 12))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Chỉ dựng nhân vật đã được Trụ trì duyệt. 6 VIP + 94 ghế là 100 người thật tối đa.
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  (function buildHallGrid() {
    const rows = 10;
    const colsPerSide = 5;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa) -> 1 (gần)
      const y = Math.round(1260 + progress * 405); // 1260 -> 1665
      const scale = +(0.54 + progress * 0.28).toFixed(2);

      // Cánh trái thảm đỏ
      const leftInnerX = Math.round(335 - progress * 48); // mép thảm mở rộng dần
      const leftOuterX = 48;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x, y, scale });
      }

      // Cánh phải thảm đỏ
      const rightInnerX = Math.round(745 + progress * 48);
      const rightOuterX = 1032;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x, y, scale });
      }
    }
  })();

  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    // Những người xếp từ hạng 7 trở đi ngồi ở các vị trí đầu tiên cạnh thảm đỏ
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => `${d.uniqueId}:${d.name}:${d.merit}`));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    // Ưu tiên gắn thẻ tên vào các ghế gần thảm đỏ dễ nhìn nhất
    const labeledSeatIndices = HALL_SEAT_COORDS.map((_,i)=>i);
    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < labeledSeatIndices.length) {
        seatViewerMap.set(labeledSeatIndices[idx], viewer);
      }
    });

    congregationHall.innerHTML = HALL_SEAT_COORDS.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      const badgeHtml = viewer
        ? `
          <div class="seat-badge">
            <span class="seat-avatar">${
              viewer.avatar
                ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                : escapeHtml(String(viewer.name || 'P').charAt(0).toUpperCase())
            }</span>
            <span class="seat-username">${escapeHtml(shortenName(viewer.name, 11))}</span>
          </div>
        `
        : '';

      if (!viewer) return ''; // Never render a fake devotee in an unoccupied seat.
      return `
        <div
          class="hall-seat"
          data-devotee-id="${escapeHtml(String(viewer.uniqueId || ''))}"
          data-devotee-name="${escapeHtml(String(viewer.name || ''))}"
          data-seat-idx="${idx}"
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${20 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale});"
        >
          <img
            src="/assets/devotee.png"
            alt="Phật tử"
            class="devotee-sprite"
            style="animation-delay: ${((idx * 0.27) % 3.5).toFixed(2)}s;"
          />
          ${badgeHtml}
        </div>
      `;
    }).join('');
  }

  // Preload toàn bộ 8 frame nhân vật vào bộ nhớ để chuyển frame mượt 0ms
  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 4 !== 0) return;
      const img = el.querySelector('.devotee-sprite');
      if (!img) return;
      const delay = (i % 4) * 80;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, delay);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 140);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrateDeep; }, delay + 300);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 620);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, delay + 780);
    });
  }

  function normalizeDevoteeName(value) {
    return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi');
  }

  // Person in the seat is identified by their server-issued participant key.
  // Legacy seat IDs contain only the first 40 characters of web session IDs,
  // while actual ceremony events contain the full key. Match that prefix
  // only for web identities, otherwise use an unambiguous normalized name.
  function findRitualDevoteeSeat(ev, seats) {
    const all = Array.from(seats || []);
    const id = String(ev?.uniqueId || '').replace(/^tt:/, '').trim();
    if (id) {
      const identified = all.filter(node => {
        const seatId = String(node.dataset?.devoteeId || '').trim();
        return !!seatId && (
          seatId === id || (
            id.startsWith('web:') &&
            seatId.startsWith('web:') &&
            id.startsWith(seatId) &&
            seatId.length >= 20
          )
        );
      });
      if (identified.length === 1) return identified[0];
      if (identified.length > 1) return null;
    }
    const name = normalizeDevoteeName(ev?.user);
    if (!name) return null;
    const named = all.filter(node =>
      normalizeDevoteeName(node.dataset?.devoteeName) === name);
    return named.length === 1 ? named[0] : null;
  }

  function animateExactlyThisDevotee(ev) {
    // Named VIP and ordinary seats have the same sprites/animation rights.
    // Never animate an unrelated/first seat as fallback.
    const seats = document.querySelectorAll('.vip-devotee-slot, .hall-seat');
    const slot = findRitualDevoteeSeat(ev, seats);
    const img = slot?.querySelector('.devotee-sprite');
    if (!img) return false;
    const token = String(Date.now()) + Math.random().toString(36).slice(2);
    img.dataset.ritualToken = token;
    const poses = [];
    if (ev.type === 'bowToBuddha') {
      // Three bows: hands together, bow, prostrate, rise, repeat.
      poses.push([0,'kneelDown']);
      for (let n = 0; n < 3; n++) {
        const offset = 180 + n * 1420;
        poses.push([offset,'forehead'],[offset+200,'bowMid'],
          [offset+410,'prostrate'],[offset+620,'prostrateDeep'],
          [offset+990,'prostrate'],[offset+1180,'kneel']);
      }
    } else {
      poses.push([0,'forehead'],[230,'bowMid'],[510,'prostrate'],
        [730,'prostrateDeep'],[1180,'prostrate'],
        [1450,'bowMid'],[1690,'kneel']);
    }
    for (const [ms,pose] of poses) {
      setTimeout(() => {
        if (img.isConnected && img.dataset.ritualToken === token) img.src = SPRITE_FRAMES[pose];
      }, ms);
    }
    return true;
  }

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  // Chuyển đổi tức thời giữa 8 khung hình đã giải mã sẵn trên GPU (KHÔNG BAO GIỜ BỊ MẤT HÌNH)
  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  // Chuỗi 8 khung hình Đảnh lễ Tam Bái mượt mà (Hạ gối -> Chắp tay ngực -> Đưa lên trán -> Nghiêng 45° -> Chống tay -> Lạy sát đất -> Ngẩng lên)
  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');            // 1. Chắp tay đưa lên trán
      schedulePose(t0 + 170, 'bowMid');        // 2. Cúi gập lưng 45°
      schedulePose(t0 + 330, 'prostrate');     // 3. Vươn hai tay chống xuống đệm
      schedulePose(t0 + 490, 'prostrateDeep'); // 4. Lạy sát đất (Ngũ thể đầu địa)
      schedulePose(t0 + 860, 'prostrate');     // 5. Bắt đầu nâng đầu lên
      schedulePose(t0 + 1020, 'bowMid');       // 6. Nâng lưng lên góc 45°
      schedulePose(t0 + 1180, 'kneel');        // 7. Ngồi quỳ thẳng lưng
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  // Hiệu ứng thí chủ ĐỨNG ĐI BỘ từng bước dọc thảm đỏ rồi Hạ gối Quỳ Đảnh Lễ (trên cùng 1 nhân vật, không bao giờ mất hình)
  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    // Khởi động bước đi từ cuối thảm đỏ lên chính điện
    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 10; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    // Khi bước tới trước Lư Hương (2.05s): dừng bước, hạ gối quỳ xuống đệm và bắt đầu Đảnh lễ 3 lạy
    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 2100)
    );
    playThreeBowsSequence(2050);
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || '✨ Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(user || '🙏').trim().charAt(0).toUpperCase();
      }
    }

    const performing=document.getElementById('centralWorshipper');
    if(performing && user)performing.style.display='';
    if (doThreeBows) {
      clearProstrationTimers();
      const centralEl = document.getElementById('centralWorshipper');
      if (centralEl) centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    particles.spawnBellWave(540, 260, 2);

    // Cập nhật dòng thông báo dưới thanh HUD
    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
  }

  // Tên đặt thủ công hiển thị trên cả màn hình Live và nguồn OBS,
  // nhưng không làm tăng công đức hoặc thay đổi tên người xem TikTok thật.
  function displayManualName(name, wish) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    // A character explicitly named by Trụ trì should not be hidden merely
    // because that name was not created through guest admission.
    const stageActor = document.getElementById('centralWorshipper');
    if (stageActor) stageActor.style.display = '';
    const displayWish = wish || 'Cầu bình an, vạn sự cát tường';
    const fields = {
      centralName: cleanName,
      devoteeNameLine: cleanName,
      centralAction: '🙏 Đã đặt tên thí chủ',
      devoteeActionTag: 'Cầu bình an',
      centralWishBubble: '“' + displayWish + '”',
      centralAvatar: cleanName.charAt(0).toUpperCase()
    };
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (id === 'centralAvatar') el.textContent = value;
      else el.textContent = value;
    }
  }

  const nameInput = document.getElementById('inputDevoteeName');
  const wishInput = document.getElementById('inputDevoteeWish');
  const nameStatus = document.getElementById('nameSaveStatus');
  const setNameStatus = (message, isError = false) => {
    if (!nameStatus) return;
    nameStatus.textContent = message;
    nameStatus.style.color = isError ? '#ffab9f' : '#a7f1be';
  };
  try {
    const storedName = localStorage.getItem('temple_manual_devotee_name');
    if (storedName && nameInput && !nameInput.value) nameInput.value = storedName.slice(0, 26);
  } catch (_) {}

  document.getElementById('btnSaveDevoteeName')?.addEventListener('click', async event => {
    const name = nameInput?.value.trim() || '';
    const wish = wishInput?.value.trim() || '';
    if (name.length < 2 || name.length > 26 || !/[A-Za-zÀ-ỹ].*[A-Za-zÀ-ỹ]/u.test(name)) {
      setNameStatus('❌ Tên cần 2–26 ký tự, có ít nhất hai chữ cái. Không dùng riêng số hoặc biểu tượng.', true);
      nameInput?.focus();
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    setNameStatus('⏳ Đang lưu tên và cập nhật màn hình Live / OBS...');
    try {
      const response = await callRpc('temple.setStageName', { name, wish });
      if (response?.error || !response?.result?.name) {
        setNameStatus('❌ ' + (response?.error?.message || 'Không lưu được tên. Hãy đăng nhập quản trị trước.'), true);
        return;
      }
      const savedName = response.result.name;
      if (nameInput) nameInput.value = savedName;
      try { localStorage.setItem('temple_manual_devotee_name', savedName); } catch (_) {}
      displayManualName(savedName, response.result.wish);
      setNameStatus('✅ Đã đặt tên “' + savedName + '” trên sân khấu; màn hình OBS đã được gửi cập nhật.');
    } finally {
      button.disabled = false;
    }
  });

  // 6. Cập nhật toàn bộ giao diện theo State từ Server
  let hasInitializedRealLeader = false;

  function updateUIState(st) {
    if (!st) return;
    // TTS service remains disabled on Render Free, but OS voices work locally.
    audio.setServerTtsAvailable(Boolean(st.tts?.ready));
    document.getElementById('statIncense').textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    renderIncenseSticks(Number(st.activeIncenseSticks) || 0);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    const central=document.getElementById('centralWorshipper');
    if(central)central.style.display=(lb.length || st.manualDisplayName)?'':'none'; // show explicitly named stage actor, but do not add fake attendees
    renderVipCushions(lb);
    renderCongregationHall(lb);

    // Tên đặt thủ công được ưu tiên lúc mở sân khấu; sự kiện Live thật vẫn
    // tự cập nhật tên người tương tác sau đó.
    if (!hasInitializedRealLeader && lb.some(p=>p.name===st.manualDisplayName)) {
      hasInitializedRealLeader = true;
      displayManualName(st.manualDisplayName, st.manualDisplayWish);
      if (nameInput && !nameInput.value.trim()) nameInput.value = st.manualDisplayName;
    }
    // Đồng bộ tên Chủ Lễ mặc định theo người dẫn đầu thực tế nếu chưa có sự kiện mới
    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `✨ Công đức: ${Number(topDev.merit).toLocaleString('vi-VN')} CĐ`,
        topDev.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    // Cập nhật Bảng TẤM LÒNG THÀNH ở góc dưới phải (Top 4)
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('');
    }

    // Trạng thái kết nối TikTok Live: luôn hiển thị cả lỗi của connector.
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    if (st.tiktok?.connected) {
      liveDot?.classList.add('connected');
      if (liveText) liveText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} mắt`;
      setTikTokConnectStatus(`✅ Đã kết nối @${st.tiktok.username}. Đang nhận bình luận, tim và quà tặng.`, 'success');
    } else if (st.tiktok?.connecting) {
      liveDot?.classList.remove('connected');
      if (liveText) liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
      setTikTokConnectStatus(`⏳ Đang kết nối tới @${st.tiktok.username}...`, 'pending');
    } else {
      liveDot?.classList.remove('connected');
      if (liveText) liveText.textContent = st.settings?.autoSim
        ? 'SAGS CXR TAM BẢO • TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI'
        : 'SAGS CXR TAM BẢO • ĐỨC PHẬT A DI ĐÀ';
      if (st.tiktok?.lastError) {
        setTikTokConnectStatus(`❌ Kết nối TikTok thất bại: ${st.tiktok.lastError}`, 'error');
      } else if (st.tiktok?.username) {
        setTikTokConnectStatus(`⚪ Chưa kết nối @${st.tiktok.username}. Hãy kiểm tra tài khoản đang LIVE.`, 'idle');
      }
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? '🤖 Tự động Giả lập Người Xem: ĐANG BẬT'
        : '🤖 Tự động Giả lập Người Xem: TẮT';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }
    if (st.settings) {
      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol');
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol');
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
    }


    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      feed.innerHTML = st.recentEvents
        .slice(0, 8)
        .map((ev) => `<div class="event-feed-item">${formatEventSummary(ev)}</div>`)
        .join('');
    }
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'bowToBuddha':
        return `🙏 <strong>${escapeHtml(ev.user)}</strong> thành tâm lễ Phật`;
      case 'burnIncense':
        return `🔥 <strong>${escapeHtml(ev.user)}</strong> dâng ${ev.count} nén nhang (+${ev.merit} CĐ)`;
      case 'strikeWoodenFish':
        return `🪵 <strong>${escapeHtml(ev.user)}</strong> gõ mõ ${ev.count} nhịp (+${ev.merit} CĐ)`;
      case 'ringBell':
        return `🔔 <strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`;
      case 'sendPrayer':
        return `🏮 <strong>${escapeHtml(ev.user)}</strong> cầu phúc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `🪷 <strong>${escapeHtml(ev.user)}</strong> dâng <em>${escapeHtml(ev.giftName)}</em> (+${ev.merit} CĐ)`;
      case 'drawFortune':
        return `🎋 <strong>${escapeHtml(ev.user)}</strong> gieo được Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `✨ <strong>${escapeHtml(ev.user || 'Thí chủ')}</strong> tương tác`;
    }
  }

  // 7. Xử lý hiệu ứng khi có Nghi Thức mới
  let fortuneTimer = null;
  let grandTimer = null;

  function triggerRitualVisuals(ev) {
    if (!ev) return;

    if (ev.ttsText && ev.type !== 'drawFortune') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi', eventId: ev.id });
    }

    switch (ev.type) {
      case 'bowToBuddha': {
        animateExactlyThisDevotee(ev);
        // Use the same eight-frame walk/kneel/three-prostration ceremony as
        // Trụ trì controls. The acting name is the authenticated visitor's.
        animateWalkerOnCarpet(ev.user, ev.avatar, '🙏 Lễ Phật · Đảnh lễ Tam Bái', ev.wish);
        break;
      }
      case 'setStageName': {
        displayManualName(ev.user, ev.wish);
        // Previously this route only changed lettering; now the explicitly
        // named central worshipper walks up and performs three bows.
        animateWalkerOnCarpet(ev.user, ev.avatar, '🙏 Chắp tay · Đảnh lễ Tam Bái', ev.wish);
        setNameStatus('✅ Đã đặt tên và hành lễ trên sân khấu: ' + ev.user);
        break;
      }
      case 'burnIncense': {
        animateExactlyThisDevotee(ev);
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 860, '#ffe082');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🔥 Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'strikeWoodenFish': {
        audio.playWoodenFish();
        const seatedWoodenFish = animateExactlyThisDevotee(ev);
        if (!seatedWoodenFish && !ev.uniqueId) {
          animateWalkerOnCarpet(ev.user, ev.avatar, '🪵 Gõ mõ · Chắp tay lễ Phật', ev.wish);
        }
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        break;
      }

      case 'ringBell': {
        animateExactlyThisDevotee(ev);
        audio.playTempleBell(1.0);
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        animateExactlyThisDevotee(ev);
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 920, '#ffb74d');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🏮 Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'offerGift': {
        audio.playIncenseChime();
        audio.playTempleBell(0.85);
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 840, '#fff3b0');
        animateExactlyThisDevotee(ev);
        const emoji=ev.giftType==='fruit'?'🍎':ev.giftType==='lamp'?'🪔':'🪷';
        animateWalkerOnCarpet(ev.user, ev.avatar, `${emoji} Dâng ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        animateExactlyThisDevotee(ev);
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `🐉 ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
        animateExactlyThisDevotee(ev);
        audio.playFortuneShake();
        updateCentralWorshipper(
          ev.user,
          ev.avatar,
          `🎋 Đang xin xăm...`,
          `Thí chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        // Chỉ hiển thị tờ Quẻ Xăm đúng thời điểm giọng đọc bắt đầu vang lên!
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          eventId: ev.id,
          onStart: () => {
            audio.playIncenseChime();
            showFortuneModal(ev.user, ev.fortune);
            updateCentralWorshipper(
              ev.user,
              ev.avatar,
              `🎋 Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`,
              ev.fortune?.meaning || '',
              true
            );
          },
          onEnd: () => {
            clearTimeout(fortuneTimer);
            fortuneTimer = setTimeout(() => {
              document.getElementById('fortuneModal')?.classList.remove('visible');
            }, 1800);
          }
        });
        break;
      }
    }
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">🙏 ${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    const modal = document.getElementById('fortuneModal');
    document.getElementById('fortuneRankBadge').textContent = fortune.rank.toUpperCase();
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Thí chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn: ${fortune.meaning}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  document.getElementById('fortuneModal')?.addEventListener('click', () => {
    document.getElementById('fortuneModal').classList.remove('visible');
  });

  function showGrandCeremonyBanner(user, giftName, merit) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = `🐉 ${giftName.toUpperCase()} 🐉`;
    document.getElementById('grandSub').textContent = `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // Stage is view-only: show verified Trụ trì posts in the same shared chat
  // as public web and TikTok visitors, without giving viewers admin controls.
  const stageChatLines = document.getElementById('stageChatMessages');
  const welcomeBanner = document.getElementById('templeWelcomeBanner');
  const welcomeTitle = document.getElementById('templeWelcomeTitle');
  const welcomeWish = document.getElementById('templeWelcomeWish');
  let stageChatHistory = [];
  let lastStageWelcomeId = '';
  let stageWelcomeTimer = null;
  function stageAddChat(message) {
    if (!message?.id || stageChatHistory.some(m => m.id === message.id)) return;
    stageChatHistory.push(message);
    if (stageChatHistory.length > 60) stageChatHistory.shift();
    stageRenderChat();
  }
  function stageRenderChat() {
    if (!stageChatLines) return;
    stageChatLines.replaceChildren();
    const recent = stageChatHistory.slice(-3);
    if (!recent.length) {
      const empty = document.createElement('div');
      empty.className = 'stage-chat-placeholder';
      empty.textContent = 'Chưa có lời nhắn. Nam mô A Di Đà Phật 🙏';
      stageChatLines.append(empty);
      return;
    }
    for (const m of recent) {
      const verified = m.role === 'abbot' && m.source === 'abbot';
      const line = document.createElement('div');
      line.className = 'live-chat-overlay-line' + (verified ? ' abbot-chat' : '');
      const author = document.createElement('strong');
      author.textContent = verified ? '👑 Trụ Trì Trung Kiên' + (m.automated ? ' · CHÚC TỰ ĐỘNG: ' : ': ')
        : ((m.source === 'tiktok' ? '♪ ' : '') + String(m.name || 'Phật tử').slice(0, 20) + ': ');
      const txt = document.createElement('span');
      txt.textContent = String(m.text || '').slice(0, 180);
      line.append(author, txt);
      stageChatLines.append(line);
    }
  }
  function showStageWelcome(data) {
    if (!welcomeBanner || !data?.id || data.id === lastStageWelcomeId) return;
    const when = Number(data.timestamp);
    if (!Number.isFinite(when) || Date.now() - when > 8500 || when - Date.now() > 10000) return;
    lastStageWelcomeId = data.id;
    welcomeTitle.textContent = '🙏 Chào con ' + String(data.name || 'Phật tử').slice(0, 32);
    welcomeWish.textContent = String(data.wish || 'Chúc con thân tâm an lạc, gia đình bình an.').slice(0, 210);
    welcomeBanner.setAttribute('aria-hidden', 'false');
    welcomeBanner.classList.add('is-visible');
    clearTimeout(stageWelcomeTimer);
    stageWelcomeTimer = setTimeout(() => {
      welcomeBanner.classList.remove('is-visible');
      welcomeBanner.setAttribute('aria-hidden', 'true');
    }, 6500);
  }

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
          if (msg.params?.lastWelcome) showStageWelcome(msg.params.lastWelcome);
        } else if (msg.method === 'chat.sync') {
          stageChatHistory = Array.isArray(msg.params) ? msg.params.slice(-60) : [];
          stageRenderChat();
        } else if (msg.method === 'chat.message') {
          stageAddChat(msg.params);
        } else if (msg.method === 'temple.joined') {
          showStageWelcome(msg.params);
        } else if (msg.method === 'temple.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) triggerRitualVisuals(msg.params.event);
        } else if (msg.method === 'tts.play') {
          if (msg.params?.url) {
            audio.enqueueTts(msg.params.text || 'Nam mô A Di Đà Phật', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url
            });
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  function setTikTokConnectStatus(message, kind = 'idle') {
    const el = document.getElementById('tiktokConnectStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.status = kind;
    el.style.color = kind === 'error' ? '#ff998c' : kind === 'success' ? '#9bebbe' : '#e6d4ad';
  }

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    // Lệnh điều khiển dùng HTTP để nhận được phản hồi và lỗi xác thực rõ ràng.
    // WebSocket chỉ nhận broadcast state và event từ server.
    const payload = { jsonrpc: '2.0', id: rpcId++, method, params };
    try {
      const res = await fetch('/rpc', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        const message = res.status === 401
          ? 'Chưa đăng nhập quản trị. Nhấn "Đăng nhập điều khiển TikTok" bên dưới rồi thử lại.'
          : (data?.error?.message || `Máy chủ phản hồi HTTP ${res.status}`);
        setTikTokConnectStatus('❌ ' + message, 'error');
        return { error: { message, status: res.status } };
      }
      if (data?.result?.state) updateUIState(data.result.state);
      if (data?.result?.event) triggerRitualVisuals(data.result.event);
      return data;
    } catch (err) {
      const message = err?.message || 'Không thể truy cập máy chủ.';
      setTikTokConnectStatus('❌ Lỗi mạng: ' + message, 'error');
      return { error: { message } };
    }
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Thí Chủ Hữu Duyên';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Cầu cho gia đình bình an, tài lộc hanh thông';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 1 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 5 });
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  document.getElementById('btnRpcGiftLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.grandCeremony', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Kim Long Chầu Phật',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', async (event) => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) {
      setTikTokConnectStatus('⚠️ Hãy nhập @username của tài khoản đang phát TikTok LIVE.', 'error');
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Đang kết nối...';
    setTikTokConnectStatus(`⏳ Đang kiểm tra phòng TikTok LIVE ${username}...`, 'pending');
    try {
      const reply = await callRpc('live.connect', { username });
      if (reply?.error) return;
      const live = reply?.result;
      if (live?.connected) {
        setTikTokConnectStatus(`✅ Đã kết nối @${live.username}. Chờ sự kiện từ người xem LIVE.`, 'success');
      } else {
        setTikTokConnectStatus('⚠️ Kết nối chưa được xác nhận. Vui lòng xem trạng thái phía trên.', 'pending');
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Kết Nối';
    }
  });

  let autoSimState = false;
  document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
    autoSimState = !autoSimState;
    callRpc('live.setAutoSim', { enabled: autoSimState });
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
    updateVoiceStatus(audio.ttsEnabled
      ? 'Giọng Neural đã bật. Bấm NGHE THỬ để kiểm tra.'
      : 'Giọng đọc đã tắt trên thiết bị này.');
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.startZenAmbience();
    } else {
      audio.stopZenAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `🎵 Nhạc Nền: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
  });

  // Khởi tạo và gắn sự kiện thanh trượt chỉnh âm lượng Nhạc nền & Giọng đọc
  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
