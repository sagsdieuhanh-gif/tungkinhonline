'use strict';
/* Local mini cinema: the movie does not stream to the common OBS stage. */
(function () {
  const VIDEO_ID = 'O0xHLS6Qw1w'; // Verified YouTube opening episode from TRẠM DỪNG 1080
  const SERIES_PAGE = 'https://ph.tinhtong.vn/Home/Video/phim-buddha-cuoc-doi-duc-phat-thich-ca_00005m';
  const WATCH_URL = 'https://www.youtube.com/watch?v=' + VIDEO_ID;
  const EMBED_URL = 'https://www.youtube-nocookie.com/embed/' + VIDEO_ID + '?playsinline=1&rel=0&autoplay=1';
  const role = document.body.dataset.theaterRole;
  if (role !== 'visitor' && role !== 'abbot') return;

  const cinema = document.createElement('section');
  cinema.id = 'buddhaCinema';
  cinema.className = 'buddha-cinema';
  cinema.setAttribute('aria-label', 'Rạp phim mini SAGS CXR Tam Bảo');
  cinema.innerHTML = [
    '<div class="buddha-cinema-panel">',
    '<header class="buddha-cinema-header">',
    '<strong>🎬 RẠP PHIM · CUỘC ĐỜI ĐỨC PHẬT</strong>',
    '<div class="buddha-cinema-header-actions">',
    '<button class="buddha-cinema-icon-btn" id="buddhaCinemaLarge" type="button" title="Phóng to / thu nhỏ màn phim" aria-label="Phóng to phim">⛶</button>',
    '<button class="buddha-cinema-icon-btn" id="buddhaCinemaMinimize" type="button" title="Thu gọn và dừng phim" aria-label="Thu gọn rạp phim">−</button>',
    '</div></header>',
    '<div class="buddha-cinema-screen" id="buddhaCinemaScreen">',
    '<div class="buddha-cinema-poster" id="buddhaCinemaPoster">',
    '<span aria-hidden="true">🎞️</span>',
    '<button class="buddha-cinema-play" id="buddhaCinemaPlay" type="button">▶ XEM PHIM · PHẦN 01</button>',
    '</div></div>',
    '<div class="buddha-cinema-info">Phim Cuộc Đời Đức Phật có 55 tập. Bấm ▶ để xem trên máy này; thu gọn sẽ dừng phim và không che chánh điện.</div>',
    '<div class="buddha-cinema-footer">',
    '<a id="buddhaCinemaYoutube" target="_blank" rel="noopener noreferrer">Mở trên YouTube</a>',
    '<a id="buddhaCinemaSeries" target="_blank" rel="noopener noreferrer">Danh mục 55 tập</a>',
    '</div></div>',
    '<button class="buddha-cinema-show" id="buddhaCinemaRestore" type="button" aria-label="Mở rạp phim mini">🎬 Rạp phim</button>'
  ].join('');
  document.body.appendChild(cinema);
  const $ = id => cinema.querySelector('#' + id);
  $('buddhaCinemaYoutube').href = WATCH_URL;
  $('buddhaCinemaSeries').href = SERIES_PAGE;
  const poster = $('buddhaCinemaPoster');
  const screen = $('buddhaCinemaScreen');
  let playing = false, large = false;
  const storageKey = 'sags_buddha_cinema_state_' + role;

  function setStageBackgroundMusic(suspend) {
    const ids = ['templeFrame', 'abbotTemplePreview'];
    for (const id of ids) {
      const frame = document.getElementById(id);
      try {
        frame?.contentWindow?.postMessage({type: 'sags-theater-audio', suspend}, window.location.origin);
      } catch (_) {}
    }
  }
  function stopPlayback() {
    const player = screen.querySelector('iframe');
    if (player) player.remove();
    poster.hidden = false;
    if (playing) setStageBackgroundMusic(false);
    playing = false;
  }
  function play() {
    if (playing) return;
    const player = document.createElement('iframe');
    player.title = 'Cuộc Đời Đức Phật · Phần 01 trên YouTube';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.loading = 'eager';
    player.src = EMBED_URL;
    poster.hidden = true;
    screen.appendChild(player);
    playing = true;
    setStageBackgroundMusic(true);
  }
  function minimize() {
    stopPlayback();
    cinema.classList.add('is-minimized');
    cinema.classList.remove('is-large');
    large = false;
    $('buddhaCinemaLarge').textContent = '⛶';
    try { localStorage.setItem(storageKey, 'minimized'); } catch (_) {}
  }
  function restore() {
    cinema.classList.remove('is-minimized');
    try { localStorage.setItem(storageKey, 'open'); } catch (_) {}
  }
  $('buddhaCinemaPlay').addEventListener('click', play);
  $('buddhaCinemaMinimize').addEventListener('click', minimize);
  $('buddhaCinemaRestore').addEventListener('click', restore);
  $('buddhaCinemaLarge').addEventListener('click', () => {
    large = !large;
    cinema.classList.toggle('is-large', large);
    $('buddhaCinemaLarge').textContent = large ? '↙' : '⛶';
    $('buddhaCinemaLarge').setAttribute('aria-label', large ? 'Thu nhỏ màn chiếu' : 'Phóng to màn chiếu');
  });
  let saved = role === 'abbot' ? 'minimized' : 'open';
  try { saved = localStorage.getItem(storageKey) || saved; } catch (_) {}
  if (saved === 'minimized') minimize();
  if (role === 'visitor') {
    // The same user can leave the sanctuary without leaving this page.
    const observer = new MutationObserver(() => {
      if (!document.body.classList.contains('sanctuary-fullscreen')) stopPlayback();
    });
    observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  }
  window.addEventListener('pagehide', stopPlayback);
})();
