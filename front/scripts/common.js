// === Глобальные настройки ===
// Если `API_BASE` задан в другом месте (config.js), не перезаписываем его.
window.API_BASE = window.API_BASE || "http://26.185.77.179:3000";

// shared utilities for front-end pages
// handles asset path resolution, header/footer loading and basic navigation

// auth token getter: prefer sessionStorage (non-persistent), fall back to localStorage
window.getAuthToken = function () {
  return (
    sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token")
  );
};

function asset(path) {
  // Корректно формируем относительный путь к ассетам для страниц в /main/
  // Если страница находится в /main/, добавляем ../, иначе используем путь как есть.
  try {
    const isInMain = window.location.pathname.includes("/main/");
    // Не трогаем уже относительные или абсолютные пути
    if (path.startsWith("./") || path.startsWith("../") || path.startsWith("/"))
      return path;
    return (isInMain ? "../" : "") + path;
  } catch (e) {
    return path;
  }
}

function goBack() {
  window.history.back();
}

function goHome() {
  // Все файлы в одной папке, поэтому просто home.html
  window.location.href = "home.html";
}

function loadHeader() {
  const holder = document.getElementById("header");
  if (!holder) return;
  const isInMain = window.location.pathname.includes("/main/");
  const headerPath = isInMain
    ? "partials/header.html"
    : "main/partials/header.html";
  fetch(headerPath)
    .then((r) => r.text())
    .then((html) => {
      holder.innerHTML = html;
      try {
        const logo = holder.querySelector(".header__logo");
        if (logo) logo.src = asset("assets/logo/logo.svg");
        const aiImg = holder.querySelector(".header__ai");
        if (aiImg) aiImg.src = asset("assets/img/AI.png");

        const storedName = localStorage.getItem("userName");
        if (storedName) {
          const nameEl = holder.querySelector("#profileModalName");
          if (nameEl) nameEl.textContent = storedName;
        }
        const storedEmail = localStorage.getItem("userEmail");
        if (storedEmail) {
          const emailEl = holder.querySelector("#profileModalEmail");
          if (emailEl) emailEl.textContent = storedEmail;
        }

        // per-user photo
        const userPhoto = getUserPhoto();
        if (userPhoto) {
          const imgEl = holder.querySelector("#profileModalImg");
          if (imgEl) {
            if (imgEl.tagName === "IMG") imgEl.src = userPhoto;
            else {
              imgEl.style.backgroundImage = `url(${userPhoto})`;
              imgEl.textContent = "";
            }
          }
          const headerImg = holder.querySelector(".header__profile-img");
          if (headerImg) headerImg.src = userPhoto;
        }

        // inline name edit handled in profile modal; no separate edit form
      } catch (e) {
        console.warn("Header init error", e);
      }
    })
    .catch((err) => console.error("Failed to load header:", err));
}

function loadFooter() {
  const holder = document.getElementById("footer");
  if (!holder) return;
  const isInMain = window.location.pathname.includes("/main/");
  const footerPath = isInMain
    ? "partials/footer.html"
    : "main/partials/footer.html";
  fetch(footerPath)
    .then((r) => r.text())
    .then((html) => {
      holder.innerHTML = html;
    })
    .catch((err) => console.error("Failed to load footer:", err));
}

window.goBack = goBack;
window.goHome = goHome;
window.loadHeader = loadHeader;
window.loadFooter = loadFooter;

function openProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.classList.add("active");
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.classList.remove("active");
}

document.addEventListener("click", function (e) {
  const modal = document.getElementById("profileModal");
  if (modal && e.target === modal) closeProfileModal();
  const photoModal = document.getElementById("editPhotoModal");
  if (photoModal && e.target === photoModal) closeEditPhotoModal();
  const logoutModal = document.getElementById("logoutConfirmModal");
  if (logoutModal && e.target === logoutModal) closeLogoutConfirmModal();
});

// Inline name edit toggles
function toggleNameEdit() {
  const block = document.getElementById("profileNameEdit");
  const input = document.getElementById("profileNameInput");
  const name = localStorage.getItem("userName") || "";
  if (!block) return;
  if (block.style.display === "none" || !block.style.display) {
    input.value = name;
    block.style.display = "block";
  } else {
    block.style.display = "none";
  }
}

function saveInlineName() {
  const input = document.getElementById("profileNameInput");
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    alert("Имя обязательно");
    return;
  }
  localStorage.setItem("userName", val);
  localStorage.setItem("lastNameChange", Date.now().toString());
  const nameEl = document.getElementById("profileModalName");
  if (nameEl) nameEl.textContent = val;
  // update header small name if present
  const headerName = document.querySelector("#header #profileModalName");
  if (headerName) headerName.textContent = val;
  const block = document.getElementById("profileNameEdit");
  if (block) block.style.display = "none";
}

function cancelInlineName() {
  const block = document.getElementById("profileNameEdit");
  if (block) block.style.display = "none";
}

// Photo crop state
let _cropImage = null; // {img:Image, w,h}
let _cropState = { zoom: 1, x: 50, y: 50 };

function openPhotoEdit() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      initImageCrop(ev.target.result);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function initImageCrop(dataURL) {
  const img = new Image();
  img.onload = function () {
    _cropImage = { img: img, w: img.naturalWidth, h: img.naturalHeight };
    // fixed centered crop: no zoom/move allowed
    _cropState = { zoom: 1, x: 50, y: 50 };
    const preview = document.getElementById("photoPreview");
    if (preview) {
      preview.style.backgroundImage = `url(${dataURL})`;
      preview.dataset.tempPhoto = dataURL;
      // force centered cover preview
      preview.style.backgroundSize = "cover";
      preview.style.backgroundPosition = "50% 50%";
    }
    // show modal
    const modal = document.getElementById("editPhotoModal");
    if (modal) modal.classList.add("active");
    // bind controls
    // controls removed — fixed centered crop
  };
  img.src = dataURL;
}

function updateCropPreview() {
  const preview = document.getElementById("photoPreview");
  if (!preview || !_cropImage) return;
  const zoomEl = document.getElementById("cropZoom");
  const xEl = document.getElementById("cropX");
  const yEl = document.getElementById("cropY");
  const zoom = zoomEl ? parseFloat(zoomEl.value) : 1;
  const x = xEl ? parseInt(xEl.value) : 50;
  const y = yEl ? parseInt(yEl.value) : 50;
  _cropState = { zoom, x, y };
  // CSS preview: background-size in percent
  const sizePercent = Math.round(100 * zoom);
  preview.style.backgroundSize = `${sizePercent}%`;
  preview.style.backgroundPosition = `${x}% ${y}%`;
}

function closeEditPhotoModal() {
  const modal = document.getElementById("editPhotoModal");
  if (modal) modal.classList.remove("active");
  const preview = document.getElementById("photoPreview");
  if (preview) {
    const saved = getUserPhoto();
    if (saved) {
      preview.style.backgroundImage = `url(${saved})`;
      preview.textContent = "";
    } else {
      preview.style.backgroundImage = "";
      preview.textContent = "IMG";
    }
    delete preview.dataset.tempPhoto;
  }
  _cropImage = null;
}

function saveCroppedPhoto() {
  const preview = document.getElementById("photoPreview");
  if (!preview || !_cropImage) {
    closeEditPhotoModal();
    return;
  }
  const dataURL = preview.dataset.tempPhoto;
  const { img, w, h } = _cropImage;
  // fixed center-crop behaviour (no zoom/move)
  const zoom = 1;
  const x = 50,
    y = 50;
  // compute crop square in source image coords (centered)
  const cropSize = Math.min(w, h);
  const centerX = Math.round(w / 2);
  const centerY = Math.round(h / 2);
  let sx = Math.round(centerX - cropSize / 2);
  let sy = Math.round(centerY - cropSize / 2);
  sx = Math.max(0, Math.min(sx, w - cropSize));
  sy = Math.max(0, Math.min(sy, h - cropSize));
  const canvas = document.createElement("canvas");
  const outSize = 256;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);
  const out = canvas.toDataURL("image/png");
  setUserPhoto(out);
  // update profile modal image
  const imgEl = document.getElementById("profileModalImg");
  if (imgEl) {
    if (imgEl.tagName === "IMG") imgEl.src = out;
    else {
      imgEl.style.backgroundImage = `url(${out})`;
      imgEl.textContent = "";
    }
  }
  const headerImg = document.querySelector(".header__profile-img");
  if (headerImg) headerImg.src = out;
  closeEditPhotoModal();
}

function goToModelPage() {
  window.location.href = "model-page.html";
}

function goToSettings() {
  window.location.href = "settings.html#key-management";
}

function confirmLogout() {
  const modal = document.getElementById("logoutConfirmModal");
  if (modal) modal.classList.add("active");
}

function closeLogoutConfirmModal() {
  const modal = document.getElementById("logoutConfirmModal");
  if (modal) modal.classList.remove("active");
}

function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("token");
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("token");
  // redirect to front index - handle pages inside /main/
  const path = window.location.pathname;
  if (path.includes("/main/")) {
    window.location.href = "../index.html";
  } else {
    window.location.href = "index.html";
  }
}

// === Работа с ключами моделей ===
function getKeyByName(name) {
  const keys = JSON.parse(localStorage.getItem("ai_keys") || "[]");
  const found = keys.find((k) => k.name.toLowerCase() === name.toLowerCase());
  return found ? found.key : null;
}

function getAnyKey() {
  const keys = JSON.parse(localStorage.getItem("ai_keys") || "[]");
  return keys.length > 0 ? keys[0].key : null;
}

// Простая проверка что бэкенд доступен (использует /ping без авторизации)
async function serverPing(timeout = 3000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${window.API_BASE}/ping`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Проверка валидности токена (возвращает {ok,status})
async function checkAuthToken() {
  try {
    const res = await fetch(`${window.API_BASE}/api/me`, {
      headers: {
        Authorization: `Bearer ${window.getAuthToken()}`,
      },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

window.serverPing = serverPing;
window.checkAuthToken = checkAuthToken;

// Per-user photo helpers (keyed by username)
function getUserNameKey() {
  return (
    localStorage.getItem("username") ||
    localStorage.getItem("userName") ||
    "default_user"
  );
}

function getUserPhotoKey() {
  return `userPhoto_${getUserNameKey()}`;
}

function getUserPhoto() {
  return localStorage.getItem(getUserPhotoKey());
}

function setUserPhoto(dataUrl) {
  localStorage.setItem(getUserPhotoKey(), dataUrl);
}

function showRequireKeyOverlay() {
  if (document.getElementById("requireKeyOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "requireKeyOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;
  overlay.innerHTML = `<div style="background:#fff;padding:24px;border-radius:12px;max-width:420px;text-align:center;">
    <h3 style="color:#2e44ff;">Нужен ключ AI</h3>
    <p>Для работы с CLAIR необходим AI‑ключ. Перейдите в настройки и добавьте ключ.</p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
      <button id="goToSettingsBtn" style="padding:8px 14px;border-radius:8px;background:#2e44ff;color:#fff;border:none;">Перейти в настройки</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const target = window.location.pathname.includes("/main/")
    ? "settings.html#key-management"
    : "main/settings.html#key-management";
  document.getElementById("goToSettingsBtn").onclick = () => {
    window.location.href = target;
  };
}

function hideRequireKeyOverlay() {
  const el = document.getElementById("requireKeyOverlay");
  if (el) el.remove();
}

// (name edit handled inline now)

// automatically load header/footer and handle redirects
window.addEventListener("DOMContentLoaded", () => {
  loadHeader();
  loadFooter();

  // === ПРОВЕРКА ТОКЕНА ДЛЯ ПЛОСКОЙ СТРУКТУРЫ ===
  const path = window.location.pathname;
  const isAuthPage =
    path.includes("index.html") ||
    path.includes("sign-up.html") ||
    path.includes("reset.html") ||
    path.endsWith("/") ||
    path.endsWith("/Front"); // Подстрой под имя своей папки проекта

  if (!window.getAuthToken() && !isAuthPage) {
    window.location.href = "index.html";
    return;
  }

  // === Проверка наличия AI ключа: если нет — блокируем UI и направляем в настройки ===
  const hasKey = getAnyKey();
  const isSettings =
    path.includes("settings") ||
    path.includes("index.html") ||
    path.includes("sign-up.html") ||
    path.includes("reset.html");
  if (!hasKey && !isSettings) {
    showRequireKeyOverlay();
  } else {
    hideRequireKeyOverlay();
  }

  // restore profile data if available
  const storedName = localStorage.getItem("userName");
  if (storedName) {
    const nameEl = document.getElementById("profileModalName");
    if (nameEl) nameEl.textContent = storedName;
  }
  const storedPhoto = getUserPhoto();
  if (storedPhoto) {
    const imgEl = document.getElementById("profileModalImg");
    if (imgEl) {
      if (imgEl.tagName === "IMG") {
        imgEl.src = storedPhoto;
      } else {
        imgEl.style.backgroundImage = `url(${storedPhoto})`;
        imgEl.textContent = "";
      }
    }
  }
});

// logout on close if enabled
window.addEventListener("beforeunload", () => {
  if (localStorage.getItem("logout_on_close") === "true") {
    logout();
  }
});

// search functionality
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  const hideOn = ["analysis.html", "anomalies.html"];
  const searchInput = document.querySelector(".header__search-input");
  if (hideOn.some((p) => path.includes(p))) {
    if (searchInput) searchInput.style.display = "none";
    return;
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      if (query.length > 2) {
        fetch(`${window.API_BASE}/api/search?q=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${window.getAuthToken()}`,
          },
        })
          .then((r) => r.json())
          .then((data) => console.log("Результаты поиска:", data))
          .catch((err) => console.error("Ошибка поиска:", err));
      }
    });
  }
});
