/* =========================================================
   script.js — المشغل الكلاسيكي (مع الأيقونات المخصصة SVG)
   ========================================================= */
(function () {
  "use strict";

  function parseSRT(text) {
    text = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (text.includes("[Events]")) {
       let cues = [];
       let lines = text.split("\n");
       let startParsing = false;
       for (let line of lines) {
           if (line.startsWith("Format:")) startParsing = true;
           else if (startParsing && line.startsWith("Dialogue:")) {
               let parts = line.split(",");
               if(parts.length > 9){
                   let startStr = parts[1].trim(); let endStr = parts[2].trim();
                   let text = parts.slice(9).join(",").replace(/\{.*?\}/g, "").trim();
                   
                   let sArr = startStr.split(":"); let eArr = endStr.split(":");
                   let start = Number(sArr[0])*3600 + Number(sArr[1])*60 + parseFloat(sArr[2]);
                   let end = Number(eArr[0])*3600 + Number(eArr[1])*60 + parseFloat(eArr[2]);
                   cues.push({start, end, text});
               }
           }
       }
       return cues;
    }

    const blocks = text.trim().split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split("\n");
      let i = 0;
      if (/^\d+$/.test(lines[0].trim())) { i = 1; }
      if (!lines[i]) continue;
      const match = lines[i].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
      if (!match) continue;
      const start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
      const end = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
      const cueText = lines.slice(i + 1).join("\n").trim().replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "");
      if (cueText) { cues.push({ start, end, text: cueText }); }
    }
    return cues;
  }

  async function loadSubtitleTrack(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("تعذر تحميل الملف");
    return parseSRT(await response.text());
  }

  function makePlayer(root) {
    const videoSrc = root.dataset.video || "";
    const video = document.createElement("video");
    video.className = "player-video";
    video.preload = "metadata";
    video.playsInline = true;
    video.src = videoSrc;

    const poster = document.createElement("img");
    poster.className = "player-poster";
    poster.src = root.dataset.poster || "";

    const posterOverlay = document.createElement("div");
    posterOverlay.className = "player-poster-overlay";
    posterOverlay.innerHTML = `<button class="player-poster-play" aria-label="تشغيل">▶</button>`;

    const shade = document.createElement("div");
    shade.className = "player-shade";

    const top = document.createElement("div");
    top.className = "player-topbar";
    top.innerHTML = `<div class="player-label">${root.dataset.label || "مشغل فيديو"}</div><div class="player-title">${root.dataset.title || ""}</div>`;

    const center = document.createElement("div");
    center.className = "player-center";
    center.innerHTML = `<button aria-label="تشغيل / إيقاف">▶</button>`;

    const leftIndicator = document.createElement('div'); leftIndicator.className = 'seek-indicator left';
    const rightIndicator = document.createElement('div'); rightIndicator.className = 'seek-indicator right';
    center.appendChild(leftIndicator); center.appendChild(rightIndicator);

    const loader = document.createElement("div"); loader.className = "player-loader";
    const toast = document.createElement("div"); toast.className = "player-toast";

    const controls = document.createElement("div"); controls.className = "player-controls";

    controls.innerHTML = `
      <div class="player-progress-row">
        <input class="player-progress" type="range" min="0" max="100" value="0" step="0.1">
      </div>
      <div class="player-bottom">
        <button class="player-btn" data-action="play">▶</button>
        <button class="player-btn" data-action="back" title="-10 ثواني">↶</button>
        <button class="player-btn" data-action="forward" title="+10 ثواني">↷</button>
        <div class="player-volume">
          <button class="player-btn" data-action="mute">🔊</button>
          <input type="range" min="0" max="1" step="0.01" value="1">
        </div>
        <span class="player-time">00:00 / 00:00</span>
        <div class="player-spacer"></div>
        
        <button class="player-btn" data-action="ccToggle" title="تشغيل/إيقاف الترجمة">
            <span style="font-weight:bold; font-size:12px; border: 1.5px solid currentColor; border-radius: 4px; padding: 0 2px; display:inline-block; line-height:1.2;">CC</span>
        </button>
        <button class="player-btn" data-action="speedMenu" title="السرعة">⏱</button>
        <button class="player-btn" data-action="settingsMenu" title="الإعدادات">⚙</button>
        <button class="player-btn" data-action="fullscreen" title="ملء الشاشة">⛶</button>
      </div>
    `;

    const menu = document.createElement("div");
    menu.className = "player-menu";
    menu.innerHTML = `
      <div class="settings-page" data-page="speed">
        <div class="player-menu-section">سرعة التشغيل</div>
        <button data-speed="0.25">0.25x</button>
        <button data-speed="0.5">0.5x</button>
        <button data-speed="0.75">0.75x</button>
        <button data-speed="1" class="active">طبيعي (1x)</button>
        <button data-speed="1.5">1.5x</button>
        <button data-speed="1.75">1.75x</button>
        <button data-speed="2">2x</button>
      </div>
      
      <div class="settings-page settings-main" data-page="main">
        <button data-open="subtitle-settings">
            <div class="menu-text-wrap"><span class="menu-icon"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-captions"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg></span> إعدادات الترجمة</div><span>‹</span>
        </button>
        <button data-action="lockScreen">
            <div class="menu-text-wrap"><span class="menu-icon"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-keyhole"><circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg></span> قفل الشاشة</div>
        </button>
        <button data-open="sleep-timer">
            <div class="menu-text-wrap"><span class="menu-icon">⏲</span> مؤقت النوم</div><span>‹</span>
        </button>
        <button data-action="cast">
            <div class="menu-text-wrap"><span class="menu-icon"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cast"><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/><line x1="2" x2="2.01" y1="20" y2="20"/></svg></span> بث الفيديو</div>
        </button>
      </div>

      <div class="settings-page" data-page="subtitle-settings">
        <button class="settings-back">‹ عودة</button>
        <div class="player-menu-section">تخصيص الترجمة</div>
        <button data-open="subtitle-size">حجم النص <span>‹</span></button>
        <button data-open="subtitle-position">موضع النص <span>‹</span></button>
        <button data-action="uploadSub">رفع ملف ترجمة (SRT/ASS)</button>
        <input type="file" id="local-sub-file" accept=".srt,.ass" style="display:none">
      </div>

      <div class="settings-page" data-page="sleep-timer">
        <button class="settings-back">‹ عودة</button>
        <div class="player-menu-section">إيقاف التشغيل بعد</div>
        <button data-timer="0" class="active">إيقاف المؤقت</button>
        <button data-timer="15">15 دقيقة</button>
        <button data-timer="30">30 دقيقة</button>
        <button data-timer="60">60 دقيقة</button>
      </div>

      <div class="settings-page" data-page="subtitle-size">
        <button class="settings-back">‹ عودة</button>
        <button data-subtitle-size="small">صغير</button>
        <button data-subtitle-size="medium" class="active">متوسط ✓</button>
        <button data-subtitle-size="large">كبير</button>
      </div>
      <div class="settings-page" data-page="subtitle-position">
        <button class="settings-back">‹ عودة</button>
        <button data-subtitle-position="top">أعلى</button>
        <button data-subtitle-position="bottom" class="active">أسفل ✓</button>
      </div>
    `;

    const lockOverlay = document.createElement("div");
    lockOverlay.className = "player-lock-overlay";
    lockOverlay.innerHTML = `<button class="player-lock-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock-keyhole-open"><circle cx="12" cy="16" r="1"/><rect width="18" height="12" x="3" y="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 9.33-2.5"/></svg> فتح القفل</button>`;

    root.innerHTML = "";
    root.append(video, poster, posterOverlay, shade, top, center, loader, toast, controls, menu, lockOverlay);

    root.classList.add("poster-active");

    const arSrc = root.dataset.ar || "";
    let isCCToggled = false;
    let customSubCues = null; 
    let currentCues = null;
    let currentCue = -1;
    let subtitlePosition = root.dataset.subtitlePosition || "bottom";
    let subtitleSize = root.dataset.subtitleSize || "medium";
    const subtitleSizes = { small: "18px", medium: "clamp(20px, 2.3vw, 30px)", large: "clamp(28px, 3vw, 40px)" };

    let sleepTimerObj = null;

    const progress = controls.querySelector(".player-progress");
    const progressRow = controls.querySelector(".player-progress-row");
    const time = controls.querySelector(".player-time");
    const playBtn = controls.querySelector('[data-action="play"]');
    const centerPlayBtn = center.querySelector("button");
    const muteBtn = controls.querySelector('[data-action="mute"]');
    const volume = controls.querySelector(".player-volume input");
    const ccBtn = controls.querySelector('[data-action="ccToggle"]');

    const previewBox = document.createElement('div');
    previewBox.className = 'player-preview-box';
    previewBox.innerHTML = `<video class="player-preview-video" preload="metadata" muted></video><div class="player-preview-time">00:00</div>`;
    const previewVideo = previewBox.querySelector('video');
    previewVideo.src = videoSrc;
    const previewTime = previewBox.querySelector('.player-preview-time');
    progressRow.appendChild(previewBox);

    function updateVolumeUI() {
        const val = volume.value * 100;
        volume.style.background = `linear-gradient(to left, rgba(255,255,255,0.3) ${100 - val}%, var(--player-blue) ${val}%)`;
    }
    updateVolumeUI();

    progress.addEventListener('mousemove', (e) => {
      const rect = progress.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      let percent = pos * 100; percent = Math.max(0, Math.min(100, percent));
      const previewHoverTime = pos * video.duration;
      previewBox.style.left = `${percent}%`;
      previewBox.style.display = 'block';
      if(isFinite(previewHoverTime) && !isNaN(previewHoverTime)){
          previewVideo.currentTime = previewHoverTime;
          previewTime.textContent = fmt(previewHoverTime);
      }
    });
    progress.addEventListener('mouseleave', () => { previewBox.style.display = 'none'; });

    function fmt(seconds) {
      if (!isFinite(seconds)) return "00:00";
      seconds = Math.floor(seconds);
      const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const secs = seconds % 60;
      if (hours) return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
      return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    }

    function msg(text) {
      toast.textContent = text;
      toast.classList.add("show");
      clearTimeout(root._toastTimer);
      root._toastTimer = setTimeout(() => { toast.classList.remove("show"); }, 2000);
    }

    function controlsShow() {
      if (root.classList.contains('locked') || root.classList.contains('poster-active')) return;
      
      root.classList.add("show-controls");
      clearTimeout(root._hideTimer);
      root._hideTimer = setTimeout(() => { if (!video.paused) root.classList.remove("show-controls"); }, 2600);
    }

    function ui() {
      const playIcon = video.paused ? "▶" : "Ⅱ";
      playBtn.textContent = playIcon;
      centerPlayBtn.textContent = playIcon;
      root.classList.toggle("playing", !video.paused);
      
      if (video.duration) {
        const percentage = (video.currentTime / video.duration) * 100;
        progress.value = percentage;
        progress.style.background = `linear-gradient(to right, #fff 0%, #fff ${percentage}%, rgba(255,255,255,.35) ${percentage}%, rgba(255,255,255,.35) 100%)`;
        time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
      }
      updateSubtitle();
    }

    function togglePlay() { if (video.paused) { video.play().catch(() => msg("خطأ بالتشغيل")); } else { video.pause(); } controlsShow(); }
    function seek(seconds) { video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds)); controlsShow(); }

    function applySubtitleStyle() {
      let element = root.querySelector(".player-subtitle");
      if (!element) { element = document.createElement("div"); element.className = "player-subtitle"; root.appendChild(element); }
      element.style.fontSize = subtitleSizes[subtitleSize] || subtitleSizes.medium;
      element.style.top = ""; element.style.bottom = "";
      if (subtitlePosition === "top") { element.style.top = "70px"; } else { element.style.bottom = "70px"; }
      return element;
    }

    function updateSubtitle() {
      const element = applySubtitleStyle();
      if (!isCCToggled || !currentCues) { element.textContent = ""; return; }
      const currentTime = video.currentTime;
      let index = -1;
      for (let i = 0; i < currentCues.length; i++) {
        if (currentTime >= currentCues[i].start && currentTime <= currentCues[i].end) { index = i; break; }
      }
      if (index !== currentCue) {
        currentCue = index;
        element.textContent = index >= 0 ? currentCues[index].text : "";
      }
    }

    ccBtn.onclick = async () => {
        isCCToggled = !isCCToggled;
        ccBtn.classList.toggle('active', isCCToggled);
        
        if (isCCToggled) {
            msg("الترجمة: مفعلة");
            if (!currentCues) {
                if (customSubCues) { currentCues = customSubCues; } 
                else if (arSrc) {
                    try { currentCues = await loadSubtitleTrack(arSrc); }
                    catch(e) { msg("تعذر جلب ملف الترجمة الأساسي"); isCCToggled = false; ccBtn.classList.remove('active');}
                } else {
                    msg("لا يوجد ملف ترجمة مرفق"); isCCToggled = false; ccBtn.classList.remove('active');
                }
            }
        } else {
            msg("الترجمة: متوقفة");
            const element = root.querySelector(".player-subtitle");
            if (element) element.textContent = "";
        }
        updateSubtitle();
    };

    let clickTimer = null; let lastClickTime = 0; let seekAccumulator = 0; let tapSide = ''; let tapTimer = null;
    video.addEventListener('click', (e) => {
        if (root.classList.contains('locked')) return;
        const currentTime = new Date().getTime();
        if (currentTime - lastClickTime < 300) {
            clearTimeout(clickTimer);
            const rect = video.getBoundingClientRect(); const isRight = (e.clientX - rect.left) > rect.width / 2;
            if (tapSide === (isRight ? 'right' : 'left')) { seekAccumulator += isRight ? 10 : -10; } 
            else { tapSide = isRight ? 'right' : 'left'; seekAccumulator = isRight ? 10 : -10; }
            const indicator = isRight ? rightIndicator : leftIndicator;
            indicator.textContent = (seekAccumulator > 0 ? '↷ +' + seekAccumulator : '↶ ' + seekAccumulator) + ' ث';
            indicator.classList.add('show');
            leftIndicator.classList.toggle('show', !isRight && seekAccumulator !== 0);
            rightIndicator.classList.toggle('show', isRight && seekAccumulator !== 0);
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => {
                seek(seekAccumulator);
                leftIndicator.classList.remove('show'); rightIndicator.classList.remove('show');
                seekAccumulator = 0; tapSide = '';
            }, 600);
        } else { clickTimer = setTimeout(togglePlay, 300); }
        lastClickTime = currentTime;
    });

    playBtn.onclick = togglePlay; centerPlayBtn.onclick = togglePlay;
    
    posterOverlay.onclick = () => { 
        video.play().then(() => {
            controlsShow();
        }).catch(() => msg("تعذر التشغيل")); 
    };
    
    controls.querySelector('[data-action="back"]').onclick = () => seek(-10);
    controls.querySelector('[data-action="forward"]').onclick = () => seek(10);

    progress.oninput = () => { if (video.duration) { video.currentTime = (progress.value / 100) * video.duration; } controlsShow(); };
    
    volume.oninput = () => {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
      muteBtn.textContent = video.muted ? "🔇" : "🔊";
      updateVolumeUI();
    };
    muteBtn.onclick = () => {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? "🔇" : "🔊";
      if(!video.muted && volume.value == 0) { volume.value = 0.5; video.volume = 0.5; }
      updateVolumeUI();
    };

    function openMenuPage(page) {
      menu.querySelectorAll(".settings-page").forEach(el => el.style.display = el.dataset.page === page ? "block" : "none");
    }
    
    controls.querySelector('[data-action="speedMenu"]').onclick = (e) => {
        e.stopPropagation();
        if(menu.classList.contains('open') && menu.querySelector('[data-page="speed"]').style.display === "block"){
            menu.classList.remove('open');
        } else {
            menu.classList.add("open"); openMenuPage("speed");
        }
    };
    
    controls.querySelector('[data-action="settingsMenu"]').onclick = (e) => {
        e.stopPropagation();
        if(menu.classList.contains('open') && menu.querySelector('[data-page="main"]').style.display === "block"){
            menu.classList.remove('open');
        } else {
            menu.classList.add("open"); openMenuPage("main");
        }
    };
    
    controls.querySelector('[data-action="fullscreen"]').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen();
    };

    menu.querySelectorAll("[data-open]").forEach(btn => {
      btn.onclick = () => openMenuPage(btn.dataset.open);
    });
    menu.querySelectorAll(".settings-back").forEach(btn => {
      btn.onclick = () => {
         const parent = btn.closest(".settings-page").dataset.page;
         if (parent === "subtitle-size" || parent === "subtitle-position") openMenuPage("subtitle-settings");
         else openMenuPage("main");
      };
    });

    function setSpeed(val) {
        video.playbackRate = val;
        menu.querySelectorAll("[data-speed]").forEach(el => el.classList.remove("active"));
        const btn = menu.querySelector(`[data-speed="${val}"]`);
        if(btn) btn.classList.add("active");
        msg(`السرعة: ${val}x`);
    }
    menu.querySelectorAll("[data-speed]").forEach(btn => {
      btn.onclick = () => setSpeed(Number(btn.dataset.speed));
    });

    const uploadBtn = menu.querySelector('[data-action="uploadSub"]');
    const fileInput = menu.querySelector('#local-sub-file');
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            customSubCues = parseSRT(ev.target.result);
            currentCues = customSubCues;
            isCCToggled = true;
            ccBtn.classList.add('active');
            msg("تم تحميل ملف الترجمة بنجاح");
            menu.classList.remove('open');
            updateSubtitle();
        };
        reader.readAsText(file);
    };

    menu.querySelectorAll("[data-subtitle-size]").forEach(btn => {
      btn.onclick = () => {
        subtitleSize = btn.dataset.subtitleSize;
        menu.querySelectorAll("[data-subtitle-size]").forEach(el => el.innerHTML = el.innerHTML.replace(" ✓", ""));
        btn.innerHTML += " ✓"; applySubtitleStyle();
      };
    });
    menu.querySelectorAll("[data-subtitle-position]").forEach(btn => {
      btn.onclick = () => {
        subtitlePosition = btn.dataset.subtitlePosition;
        menu.querySelectorAll("[data-subtitle-position]").forEach(el => el.innerHTML = el.innerHTML.replace(" ✓", ""));
        btn.innerHTML += " ✓"; applySubtitleStyle();
      };
    });

    const lockBtn = menu.querySelector('[data-action="lockScreen"]');
    const unlockBtn = lockOverlay.querySelector('.player-lock-btn');
    lockBtn.onclick = () => {
        root.classList.add('locked');
        lockOverlay.style.display = 'block';
        menu.classList.remove('open');
        msg("تم قفل الشاشة");
    };
    unlockBtn.onclick = () => {
        root.classList.remove('locked');
        lockOverlay.style.display = 'none';
        msg("تم فتح الشاشة");
    };

    menu.querySelectorAll("[data-timer]").forEach(btn => {
        btn.onclick = () => {
            menu.querySelectorAll("[data-timer]").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            const mins = Number(btn.dataset.timer);
            if(sleepTimerObj) clearTimeout(sleepTimerObj);
            if(mins === 0) {
                msg("تم إيقاف المؤقت");
            } else {
                msg(`سيتوقف الفيديو بعد ${mins} دقيقة`);
                sleepTimerObj = setTimeout(() => {
                    video.pause();
                    msg("تم إيقاف الفيديو بناءً على المؤقت");
                }, mins * 60 * 1000);
            }
            menu.classList.remove('open');
        };
    });

    const castBtn = menu.querySelector('[data-action="cast"]');
    castBtn.onclick = () => {
        if (video.remote && video.remote.prompt) {
            video.remote.prompt().catch(err => msg("لم يتم العثور على أجهزة متاحة للربط"));
        } else {
            msg("متصفحك لا يدعم هذه الميزة حالياً");
        }
        menu.classList.remove('open');
    };

    document.addEventListener("click", e => {
      if (root.contains(e.target) && !menu.contains(e.target) && !e.target.closest('[data-action="settingsMenu"]') && !e.target.closest('[data-action="speedMenu"]')) {
        menu.classList.remove("open");
      }
    });

    root.addEventListener("mousemove", controlsShow);
    root.addEventListener("touchstart", controlsShow, { passive: true });

    ["loadstart", "waiting", "stalled", "seeking"].forEach(ev => video.addEventListener(ev, () => root.classList.add("loading")));
    ["canplay", "playing", "seeked"].forEach(ev => video.addEventListener(ev, () => root.classList.remove("loading")));

    video.addEventListener("play", () => { poster.classList.add("hidden"); posterOverlay.classList.add("hidden"); root.classList.remove("poster-active"); ui(); });
    video.addEventListener("pause", ui); video.addEventListener("timeupdate", ui); video.addEventListener("loadedmetadata", ui);
    
    root.tabIndex = 0;
    root.addEventListener("keydown", event => {
      if (event.target.tagName === "INPUT" || root.classList.contains('locked')) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); } 
      else if (event.key === "ArrowLeft") { seek(-10); msg("−10"); } 
      else if (event.key === "ArrowRight") { seek(10); msg("+10"); } 
      else if (event.key.toLowerCase() === "m") { muteBtn.click(); } 
      else if (event.key.toLowerCase() === "f") { controls.querySelector('[data-action="fullscreen"]').click(); }
      else if (event.key.toLowerCase() === "c") { ccBtn.click(); }
    });
  }

  document.querySelectorAll(".video-player").forEach(makePlayer);
})();