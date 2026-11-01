/**
 * Live 9:16 Client Controller — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Hiển thị 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Công Đức)
 * - Hiển thị 40 Phật Tử mặc áo lam quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng người xem bước dọc thảm đỏ lên trước Lư Hương Đồng dâng hương
 * - Giọng đọc ZeroTTS (Mai Chi) + Pháp khí Web Audio
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('obs') === '1') {
    document.body.classList.add('obs-mode');
  }

  // Keep public display clean. Only a signed administrator session can
  // enable the Live controller, and only through the explicit admin URL.
  const adminRequested = params.get('admin') === '1' && params.get('obs') !== '1';
  const adminLoginUrl = '/login?next=%2F%3Fadmin%3D1';
  if (adminRequested) document.body.classList.add('admin-requested');

  fetch('/auth/status', { credentials: 'same-origin', cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Không đọc được trạng thái đăng nhập');
      return response.json();
    })
    .then(status => {
      const authenticated = Boolean(status.authenticated);
      const link = document.getElementById('adminLoginLink');
      const logout = document.getElementById('adminLogoutBtn');
      if (adminRequested && !authenticated) {
        window.location.replace(adminLoginUrl);
        return;
      }
      if (adminRequested && authenticated) {
        document.body.classList.add('admin-mode');
        if (link) {
          link.textContent = '🎛️ Bảng điều khiển LIVE';
          link.href = '/admin';
        }
        if (logout) logout.hidden = false;
      } else if (authenticated && link) {
        // The normal URL remains a public sanctuary, even for an admin.
        link.textContent = '🎛️ Mở quản trị';
        link.href = '/?admin=1';
      }
    })
    .catch(() => {
      if (adminRequested) window.location.replace(adminLoginUrl);
    });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { window.location.replace('/'); }
  });

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

  // The mobile-friendly JPG loads faster. Fall back to the original PNG if
  // needed rather than leaving a solid dark stage on a failed image request.
  const sanctuaryImage = document.querySelector('.sanctuary-bg-img');
  sanctuaryImage?.addEventListener('error', () => {
    if (!sanctuaryImage.src.endsWith('/assets/amitabha_stage.png')) {
      sanctuaryImage.src = '/assets/amitabha_stage.png';
    }
  });

  // 2. Khởi tạo Particle Engine & Audio Engine (ZeroTTS Mai Chi)
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();
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
    audio.enqueueTts('Nam mô A Di Đà Phật. Chùa Linh Ứng Online kính chào quý thí chủ.', {
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

  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = VIP_CUSHION_COORDS.map((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return '';
      return `
        <div class="vip-devotee-slot" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${12 + idx};">
          <img src="/assets/devotee.png" alt="VIP Devotee" class="devotee-sprite" />
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 12))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Dựng Đạo Tràng 40 Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (5 Hàng x 4 Cột mỗi bên)
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  (function buildHallGrid() {
    const rows = 5;
    const colsPerSide = 4;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa) -> 1 (gần)
      const y = Math.round(1290 + progress * 355); // 1290 -> 1645
      const scale = +(0.76 + progress * 0.28).toFixed(2);

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

  let lastRenderedParticipantSignature = null;
  let currentParticipantsCount = 0;

  // Do not create a single person unless the server reports an actual
  // web visitor entering the sanctuary or a real TikTok join/interaction.
  function renderCongregationHall(participants = []) {
    if (!congregationHall) return;
    const attendees = Array.isArray(participants) ? participants.slice(-40) : [];
    currentParticipantsCount = attendees.length;
    const sig = JSON.stringify(attendees.map(v => [v.id, v.name, v.avatar]));
    if (sig === lastRenderedParticipantSignature) return;
    lastRenderedParticipantSignature = sig;
    const seatOrder = [
      3,4,2,5,11,12,10,13,19,20,18,21,27,28,26,29,
      35,36,34,37,1,6,9,14,17,22,25,30,33,38,0,7,
      8,15,16,23,24,31,32,39
    ];
    congregationHall.replaceChildren();
    attendees.forEach((visitor, idx) => {
      const seat = HALL_SEAT_COORDS[seatOrder[idx]];
      if (!seat) return;
      const el = document.createElement('div');
      el.className = 'hall-seat';
      el.dataset.visitorId = visitor.id;
      el.style.left = seat.x + 'px';
      el.style.top = seat.y + 'px';
      el.style.zIndex = String(20 + seat.row * 2);
      el.style.transform = 'translate(-50%, -100%) scale(' + seat.scale + ')';
      const img = document.createElement('img');
      img.src = '/assets/devotee.png';
      img.alt = 'Người tham gia: ' + visitor.name;
      img.className = 'devotee-sprite';
      img.style.animationDelay = ((idx * .27) % 3.5).toFixed(2) + 's';
      el.append(img);
      const badge = document.createElement('div');
      badge.className = 'seat-badge';
      const avatar = document.createElement('span');
      avatar.className = 'seat-avatar';
      avatar.textContent = String(visitor.name || 'P').charAt(0).toUpperCase();
      const name = document.createElement('span');
      name.className = 'seat-username';
      name.textContent = shortenName(visitor.name, 12);
      badge.append(avatar, name);
      el.append(badge);
      congregationHall.append(el);
    });
    if (currentParticipantsCount === 0) {
      document.getElementById('centralWorshipper')?.classList.remove('real-participant-active');
    }
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

    const centralActor = document.getElementById('centralWorshipper');
    if (centralActor && currentParticipantsCount > 0) {
      centralActor.classList.add('real-participant-active');
    }
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

    renderIncenseSticks(st.activeIncenseSticks || 9);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    const realVisitors = Array.isArray(st.sanctuaryParticipants) ? st.sanctuaryParticipants : [];
    // VIP cushions must not be filled from stale merit records or simulated users.
    // Every real visitor gets exactly one seat in the sanctuary.
    renderVipCushions([]);
    renderCongregationHall(realVisitors);

    // Tên đặt thủ công được ưu tiên lúc mở sân khấu; sự kiện Live thật vẫn
    // tự cập nhật tên người tương tác sau đó.
    if (!hasInitializedRealLeader && realVisitors.length && st.manualDisplayName) {
      hasInitializedRealLeader = true;
      displayManualName(st.manualDisplayName, st.manualDisplayWish);
      if (nameInput && !nameInput.value.trim()) nameInput.value = st.manualDisplayName;
    }
    // Đồng bộ tên Chủ Lễ mặc định theo người dẫn đầu thực tế nếu chưa có sự kiện mới
    if (!hasInitializedRealLeader && realVisitors.length && lb.length > 0) {
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
        ? 'CHÙA LINH ỨNG • TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI'
        : 'CHÙA LINH ỨNG • ĐỨC PHẬT A DI ĐÀ';
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
      case 'setStageName': {
        displayManualName(ev.user, ev.wish);
        setNameStatus('✅ Tên sân khấu đã cập nhật: ' + ev.user);
        break;
      }
      case 'burnIncense': {
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 860, '#ffe082');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🔥 Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'strikeWoodenFish': {
        audio.playWoodenFish();
        pulseHallBowing();
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        pulseHallBowing();
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
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
        animateWalkerOnCarpet(ev.user, ev.avatar, `🪷 Dâng ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandCeremonyBanner(ev.user, ev.giftName, ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `🐉 ${ev.giftName} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
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


  // --- Join at the entrance, then use the chosen nickname across all chat messages.
  const entryOverlay = document.getElementById('visitorEntryOverlay');
  const entryForm = document.getElementById('visitorEntryForm');
  const entryInput = document.getElementById('visitorEntryName');
  const entryError = document.getElementById('visitorEntryError');
  const entrySubmit = document.getElementById('visitorEntrySubmit');
  const chatPanel = document.getElementById('sharedChatMessages');
  const stageChat = document.getElementById('stageChatMessages');
  const chatForm = document.getElementById('sharedChatForm');
  const chatName = document.getElementById('sharedChatName');
  const chatText = document.getElementById('sharedChatText');
  const chatStatus = document.getElementById('sharedChatStatus');
  const chatSend = document.getElementById('sharedChatSend');
  const quickChatForm = document.getElementById('quickChatForm');
  const quickChatText = document.getElementById('quickChatText');
  const quickChatSend = document.getElementById('quickChatSend');
  const quickChatStatus = document.getElementById('quickChatStatus');
  const quickChatNickname = document.getElementById('quickChatNickname');
  let publicChat = [];
  let joinedVisitorName = '';
  let sessionId = '';

  try {
    const savedName = localStorage.getItem('temple_shared_chat_name') || '';
    if (entryInput) entryInput.value = savedName.slice(0, 26);
    sessionId = localStorage.getItem('temple_visitor_session_id') || '';
  } catch (_) {}
  function generateSessionId() {
    if (sessionId && /^[a-z0-9_-]{12,64}$/i.test(sessionId)) return sessionId;
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    sessionId = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('temple_visitor_session_id', sessionId); } catch (_) {}
    return sessionId;
  }
  const isObs = document.body.classList.contains('obs-mode');
  if (isObs) entryOverlay?.classList.add('is-hidden');

  async function joinRoom(name) {
    const resp = await fetch('/api/visitors/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sessionId: generateSessionId() })
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Không thể vào phòng chùa');
    return data.visitor;
  }
  entryForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (isObs) return;
    const name = String(entryInput?.value || '').trim();
    if (name.length < 2 || name.length > 26 || !/[a-zA-ZÀ-ỹ].*[a-zA-ZÀ-ỹ]/u.test(name)) {
      if (entryError) entryError.textContent = 'Hãy nhập tên từ 2–26 ký tự, có ít nhất hai chữ cái.';
      return;
    }
    if (entrySubmit) entrySubmit.disabled = true;
    if (entryError) entryError.textContent = 'Đang đưa bạn vào chánh điện...';
    try {
      const visitor = await joinRoom(name);
      joinedVisitorName = visitor.name;
      if (chatName) chatName.value = joinedVisitorName;
      if (quickChatNickname) quickChatNickname.textContent = '👤 ' + joinedVisitorName;
      if (quickChatForm) quickChatForm.hidden = false;
      const manualInput = document.getElementById('inputDevoteeName');
      if (manualInput && !manualInput.value) manualInput.value = joinedVisitorName;
      try { localStorage.setItem('temple_shared_chat_name', joinedVisitorName); } catch (_) {}
      entryOverlay?.classList.add('is-hidden');
      if (entryError) entryError.textContent = '';
      setChatFeedback('🙏 Chào mừng ' + joinedVisitorName + ' vào chánh điện! Bạn có thể trò chuyện với mọi người.');
    } catch (error) {
      if (entryError) entryError.textContent = error.message || 'Không thể vào chùa. Vui lòng thử lại.';
    } finally {
      if (entrySubmit) entrySubmit.disabled = false;
    }
  });
  document.getElementById('btnChangeChatName')?.addEventListener('click', () => {
    if (isObs) return;
    if (entryInput) entryInput.value = joinedVisitorName || entryInput.value;
    entryOverlay?.classList.remove('is-hidden');
    entryInput?.focus();
  });

  function setChatFeedback(text, isError = false) {
    if (chatStatus) {
      chatStatus.textContent = text;
      chatStatus.style.color = isError ? '#ffaba0' : '#aaf1c0';
    }
    if (quickChatStatus) {
      quickChatStatus.textContent = text;
      quickChatStatus.style.color = isError ? '#ffaba0' : '#aaf1c0';
    }
  }
  function chatTime(time) {
    try { return new Date(time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
  }
  function renderSharedChat() {
    if (chatPanel) {
      const nearBottom = chatPanel.scrollTop + chatPanel.clientHeight >= chatPanel.scrollHeight - 60;
      chatPanel.replaceChildren();
      if (!publicChat.length) {
        const empty = document.createElement('p');
        empty.className = 'shared-chat-empty';
        empty.textContent = 'Phòng chat đang trống. Hãy gửi lời chào đầu tiên! 🙏';
        chatPanel.append(empty);
      }
      for (const message of publicChat.slice(-60)) {
        const item = document.createElement('article');
        item.className = 'shared-chat-line';
        const meta = document.createElement('div');
        meta.className = 'shared-chat-meta';
        const author = document.createElement('strong');
        author.className = 'shared-chat-author' + (message.source === 'tiktok' ? ' tiktok' : '');
        author.textContent = message.name || 'Thí chủ';
        const source = document.createElement('span');
        source.className = 'shared-chat-source';
        source.textContent = (message.source === 'tiktok' ? 'TikTok LIVE' : 'Web') + ' · ' + chatTime(message.timestamp);
        meta.append(author, source);
        const body = document.createElement('p');
        body.className = 'shared-chat-body';
        body.textContent = message.text || '';
        item.append(meta, body);
        chatPanel.append(item);
      }
      if (nearBottom) chatPanel.scrollTop = chatPanel.scrollHeight;
    }
    if (stageChat) {
      stageChat.replaceChildren();
      const last = publicChat.slice(-3);
      if (!last.length) {
        const empty = document.createElement('div');
        empty.className = 'stage-chat-placeholder';
        empty.textContent = 'Chưa có lời nhắn. Nam mô A Di Đà Phật 🙏';
        stageChat.append(empty);
      }
      for (const m of last) {
        const row = document.createElement('div');
        row.className = 'live-chat-overlay-line' + (m.source === 'tiktok' ? ' tiktok' : '');
        const name = document.createElement('strong');
        name.textContent = (m.source === 'tiktok' ? '♪ ' : '') + shortenName(m.name, 13) + ':';
        const body = document.createElement('span');
        body.textContent = String(m.text || '').slice(0, 90);
        row.append(name, body);
        stageChat.append(row);
      }
    }
  }
  function setChatHistory(messages) {
    publicChat = Array.isArray(messages) ? messages.slice(-60) : [];
    renderSharedChat();
  }
  function appendChatMessage(message) {
    if (!message || !message.id || publicChat.some(m => m.id === message.id)) return;
    publicChat.push(message);
    if (publicChat.length > 60) publicChat.shift();
    renderSharedChat();
  }
  // Shared send logic for the visible floating composer and full chat panel.
  async function sendPublicChat(input, sendButton) {
    if (!joinedVisitorName || !sessionId) {
      setChatFeedback('Hãy nhập tên để vào phòng trước khi gửi tin.', true);
      entryOverlay?.classList.remove('is-hidden');
      entryInput?.focus();
      return;
    }
    const text = String(input?.value || '').trim();
    if (!text || text.length > 180) {
      setChatFeedback('Nội dung tin nhắn cần từ 1–180 ký tự.', true);
      return;
    }
    if (sendButton) sendButton.disabled = true;
    setChatFeedback('Đang gửi tin nhắn...');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: joinedVisitorName, text })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Không gửi được tin');
      if (input) input.value = '';
      appendChatMessage(data.message);
      setChatFeedback('✅ Đã gửi tin vào chat chung — mọi người đều thấy');
    } catch (error) {
      setChatFeedback('❌ ' + (error.message || 'Không gửi được tin'), true);
    } finally {
      if (sendButton) sendButton.disabled = false;
    }
  }

  chatForm?.addEventListener('submit', event => {
    event.preventDefault();
    sendPublicChat(chatText, chatSend);
  });
  quickChatForm?.addEventListener('submit', event => {
    event.preventDefault();
    sendPublicChat(quickChatText, quickChatSend);
  });
  document.getElementById('quickChatOpen')?.addEventListener('click', () => {
    const fullChat = document.getElementById('sharedChatPanel');
    fullChat?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  const clearChatBtn = document.getElementById('clearSharedChat');
  fetch('/auth/status').then(r => r.json()).then(auth => {
    if (clearChatBtn) clearChatBtn.hidden = !auth.authenticated;
  }).catch(() => {});
  clearChatBtn?.addEventListener('click', async () => {
    if (!window.confirm('Xóa toàn bộ tin nhắn của phòng chat hiện tại?')) return;
    const r = await fetch('/api/chat', { method: 'DELETE' });
    if (r.ok) setChatHistory([]);
  });
  // WebSocket supplies the initial history and subsequent messages. HTTP
  // provides a one-time fallback while a free service is still waking.
  fetch('/api/chat').then(r => r.json()).then(d => {
    if (d.ok && !publicChat.length) setChatHistory(d.messages);
  }).catch(() => {});


  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'chat.sync') {
          setChatHistory(msg.params);
        } else if (msg.method === 'chat.message') {
          appendChatMessage(msg.params);
        } else if (msg.method === 'temple.state') {
          updateUIState(msg.params);
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

  const bgMusicTrackLabel = document.getElementById('bgMusicTrackLabel');
  audio.onBgTrackChange = (title, error) => {
    if (bgMusicTrackLabel) {
      bgMusicTrackLabel.textContent = error ? '⚠️ ' + error : '🎶 Nhạc thiền: ' + title;
      bgMusicTrackLabel.style.color = error ? '#ffaba0' : '#efd7a2';
    }
  };
  document.getElementById('btnNextBgTrack')?.addEventListener('click', () => {
    audio.ensureContext();
    audio.nextBackgroundTrack();
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
