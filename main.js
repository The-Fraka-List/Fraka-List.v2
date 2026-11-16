let globalLevels = [];
let globalLeaderboard = [];
let legacyMode = false;
let currentDetailLevelId = null;

// Estado propio de RISING: mismo patrón que List, sin legacyMode (RISING no
// tiene distinción Top 150+ y puede superar los 150 niveles sin problema).
let globalRisingLevels = [];
let currentRisingDetailId = null;

// Ruta de perfil de jugador (#player/Nombre). No es una sección estática:
// se resuelve siempre contra el contenedor genérico tab-profile. Se guarda
// el username tal cual vino en el hash (sin forzar minúsculas), porque las
// comparaciones de jugador en el resto del sistema son case-sensitive.
let currentProfileUsername = null;
// Contexto de lista activo para la tarjeta de perfil: si el usuario entra a
// un perfil desde List o Rising, la barra de progreso usa esa lista como base.
let currentProfileListContext = 'list';
let currentProfileLevelId = null;
let profileSidebarScrollTop = 0;
let profileLegacyMode = false;
let profileLevelSearchTerm = '';
// El interruptor en RISING no controla Legacy (no existe en este apartado):
// alterna entre la lista de niveles y la leaderboard propia de RISING.
let risingLeaderboardVisible = false;

// Top 1-150 = vista principal, Top 151+ = vista Legacy (oculta por defecto, pero ya cargada)
const LEGACY_THRESHOLD = 150;

function getVisibleLevels(levels) {
    return legacyMode
        ? levels.filter(n => n.rank > LEGACY_THRESHOLD)
        : levels.filter(n => n.rank <= LEGACY_THRESHOLD);
}

function getLevelSlug(level) {
    return level.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function setMobileDetailView(route, isOpen) {
    ['list', 'rising'].forEach(sectionRoute => {
        const section = document.getElementById(`tab-${sectionRoute}`);
        if (section) section.classList.toggle('mobile-detail-open', isOpen && route === sectionRoute);
    });

    document.querySelectorAll('#levels-sidebar, #rising-sidebar').forEach(sidebar => {
        sidebar.classList.remove('mobile-hidden');
    });
    document.querySelectorAll('#level-details, #rising-details').forEach(detail => {
        detail.classList.remove('mobile-active');
    });
}

function volverALista(route) {
    if (route === 'profile') {
        const layout = document.querySelector('#profile-mini-list .profile-mini-layout');
        if (layout) {
            layout.classList.remove('mobile-detail-open');
            const sidebar = document.getElementById('profile-level-sidebar');
            const scrollTop = profileSidebarScrollTop;
            if (sidebar) {
                requestAnimationFrame(() => {
                    if (sidebar.isConnected) sidebar.scrollTop = scrollTop;
                });
            }
        }
        return;
    }

    const section = document.getElementById(`tab-${route}`);
    if (section) section.classList.remove('mobile-detail-open');
    setMobileDetailView(route, false);
    window.history.replaceState(window.history.state, '', `#/${route}`);
}

function updateListLabel(isLegacy) {
    const label = isLegacy ? 'LEGACY' : 'LIST';

    const logoSpan = document.querySelector('.nav__logo .text-accent');
    if (logoSpan) logoSpan.textContent = label;

    const navBtn = document.querySelector('.nav__links .nav__link-btn[data-route="list"]');
    if (navBtn) navBtn.textContent = label.charAt(0) + label.slice(1).toLowerCase();

    const mobileBtn = document.querySelector('.nav__mobile-menu [data-tab="tab-list"]');
    if (mobileBtn) mobileBtn.textContent = label.charAt(0) + label.slice(1).toLowerCase();
}

function updateDiscordIcon(isLegacy) {
    const iconSrc = isLegacy ? 'assets/img/discord-icon-ngr.svg' : 'assets/img/discord-icon.svg';
    document.querySelectorAll('.nav__discord-icon').forEach(img => {
        img.src = iconSrc;
    });
}

function toggleLegacyMode() {
    legacyMode = !legacyMode;

    document.body.classList.toggle('legacy-mode', legacyMode);

    const toggleBtn = document.getElementById('legacy-toggle');
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', legacyMode);
        toggleBtn.setAttribute('aria-pressed', String(legacyMode));
    }

    updateListLabel(legacyMode);
    updateDiscordIcon(legacyMode);

    // Re-renderizar la sidebar respetando una búsqueda activa, si la hay
    const searchInput = document.getElementById('level-search');
    if (searchInput && searchInput.value.trim() !== '') {
        filterLevels(searchInput.value);
    } else {
        renderSidebar();
    }

    // Si el nivel abierto en el panel de detalles queda fuera del rango visible,
    // mostrar automáticamente el primer nivel del modo recién activado
    const nivelActual = globalLevels.find(n => n.id === currentDetailLevelId);
    const fueraDeRango = !nivelActual || (legacyMode ? nivelActual.rank <= LEGACY_THRESHOLD : nivelActual.rank > LEGACY_THRESHOLD);

    if (fueraDeRango) {
        const primerNivelVisible = legacyMode
            ? globalLevels.find(n => n.rank === LEGACY_THRESHOLD + 1)
            : globalLevels.find(n => n.rank === 1);
        if (primerNivelVisible) mostrarDetallesNivel(primerNivelVisible.id, false);
    }
}

// Helper: fuerza display con !important vía JS, necesario porque mobile.css
// define '.list-layout { display: block !important; }' dentro de un media
// query — un inline-style sin !important no podría ocultarlo en mobile.
// value === null restaura el display por defecto (el que decida el CSS).
function setDisplayImportant(el, value) {
    if (!el) return;
    if (value === null) el.style.removeProperty('display');
    else el.style.setProperty('display', value, 'important');
}

// Interruptor exclusivo de RISING: alterna entre la lista (sidebar+detalle)
// y la leaderboard propia de RISING. No comparte nada con toggleLegacyMode;
// LIST sigue usando su propio interruptor sin ningún cambio.
function toggleRisingView() {
    risingLeaderboardVisible = !risingLeaderboardVisible;

    const listLayout = document.querySelector('#tab-rising .list-layout');
    const lbContainer = document.getElementById('rising-leaderboard-container');
    const toggleBtn = document.getElementById('rising-view-toggle');
    const label = toggleBtn ? toggleBtn.querySelector('.legacy-toggle-label') : null;
    const listControls = document.querySelector('#tab-rising .level-search-container');
    const leaderboardHero = lbContainer ? lbContainer.querySelector('.rising-leaderboard-hero') : null;

    if (risingLeaderboardVisible) {
        setDisplayImportant(listLayout, 'none');
        setDisplayImportant(lbContainer, 'flex');
        lbContainer?.classList.add('active');
        if (label) label.textContent = 'Rising';
        if (listControls && toggleBtn && listControls.contains(toggleBtn)) {
            listControls.removeChild(toggleBtn);
        }
        if (leaderboardHero && toggleBtn && !leaderboardHero.contains(toggleBtn)) {
            leaderboardHero.appendChild(toggleBtn);
        }
        if (listControls) {
            listControls.classList.add('is-hidden');
        }
    } else {
        setDisplayImportant(listLayout, null);
        setDisplayImportant(lbContainer, 'none');
        lbContainer?.classList.remove('active');
        if (label) label.textContent = 'Leader';
        if (leaderboardHero && toggleBtn && leaderboardHero.contains(toggleBtn)) {
            leaderboardHero.removeChild(toggleBtn);
        }
        if (listControls && toggleBtn && !listControls.contains(toggleBtn)) {
            listControls.appendChild(toggleBtn);
        }
        if (listControls) {
            listControls.classList.remove('is-hidden');
        }
    }

    if (toggleBtn) {
        toggleBtn.classList.toggle('active', risingLeaderboardVisible);
        toggleBtn.setAttribute('aria-pressed', String(risingLeaderboardVisible));
    }
}

// Sistema de puntos: Top 1 = 500.00, Top 150 = 14.50, curva exponencial progresiva
// entre medio, y 1.00 fijo para cualquier posición fuera del Top 150.
function getMaxPointsForPosition(topPosition) {
    if (topPosition <= 1) return 500;
    if (topPosition >= 150) return topPosition === 150 ? 14.5 : 1;
    const ratio = 14.5 / 500;
    const points = 500 * Math.pow(ratio, (topPosition - 1) / 149);
    return Math.round(points * 100) / 100;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = 'Copiado';
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 1500);
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

// ── SISTEMA DE ENRUTAMIENTO DINÁMICO Y ESCALABLE ──────────────────────
// Router único: antes existía también switchTabByHash() con un mapa de rutas
// hardcodeado en paralelo a este. Se eliminó por duplicar exactamente esta
// misma responsabilidad; handleHashRouting() ya es genérico (tab-${route})
// y no requiere tocarse para agregar nuevos apartados como RISING.

// Layout base de la vista de perfil (#player/Nombre): 3 columnas vacías.
// Izquierda: panel vacío (uso futuro). Centro: contenedor donde luego irá
// la lista de niveles completados/progreso del jugador. Derecha: contenedor
// donde luego irá la tarjeta de stats del jugador. Por ahora no se pinta
// ningún dato, solo la estructura para que la sección no se vea rota.
// ── SISTEMA DE AVATAR DEL PERFIL ──────────────────────────────────────
// El nombre del jugador determina el archivo a buscar en assets/img/pfp/,
// probando extensiones en este orden hasta encontrar una que exista. Si
// ninguna existe, cae en el archivo fijo default.png. Los gifs no reciben
// ningún tratamiento especial: es solo una extensión más en la cascada, así
// que si el archivo es un gif animado, se muestra animado sin más.
const AVATAR_DIR = 'assets/img/pfp/';
const AVATAR_EXTENSIONS = ['png', 'webp', 'gif', 'jpg', 'jpeg', 'svg'];
const AVATAR_DEFAULT_SRC = `${AVATAR_DIR}default.png`;

function getAvatarSrc(username, extensionIndex) {
    return `${AVATAR_DIR}${encodeURIComponent(username)}.${AVATAR_EXTENSIONS[extensionIndex]}`;
}

// Se engancha al 'onerror' del <img>: si el formato actual no existe,
// intenta el siguiente de la lista. Cuando se agotan todos, usa
// default.png y desengancha el listener para no reintentar en bucle si
// default.png tampoco llegara a existir.
function handleAvatarError(imgEl) {
    const username = imgEl.dataset.avatarUsername;
    const nextIndex = parseInt(imgEl.dataset.avatarAttempt || '0', 10) + 1;

    if (nextIndex < AVATAR_EXTENSIONS.length) {
        imgEl.dataset.avatarAttempt = String(nextIndex);
        imgEl.src = getAvatarSrc(username, nextIndex);
        return;
    }

    imgEl.onerror = null;
    imgEl.src = AVATAR_DEFAULT_SRC;
}

// Las estadísticas consultan el leaderboard de origen del perfil para evitar
// mezclar la Main List con Rising.
function renderPlayerProfileStats(username) {
    const panel = document.getElementById('profile-stats-container');
    if (!panel) return;

    const profileData = getProfileContextData(username);
    const player = profileData.player;
    const completedLevels = player && Array.isArray(player.completedLevels)
        ? [...player.completedLevels].sort((a, b) => a.rank - b.rank)
        : [];
    const progressData = getPlayerProfileProgressData(username);
    const hardest = completedLevels[0] || null;
    const hardestRecordLink = hardest && typeof hardest.video === 'string' && hardest.video.trim()
        ? hardest.video
        : '';
    const percentageValue = player && progressData.percentage !== null
        ? `${progressData.percentage}%`
        : '—';
    const pointLabel = profileData.source === 'rising' ? 'Puntos de Rising' : 'Puntos de lista';
    const completionLabel = profileData.source === 'rising'
        ? 'Extremes completados (Rising)'
        : 'Extremes completados (List + Legacy)';
    const hardestValue = hardest
        ? hardestRecordLink
            ? `<a class="profile-stat-card__link" href="${hardestRecordLink}" target="_blank" rel="noopener noreferrer">${hardest.level}</a>`
            : hardest.level
        : '—';

    panel.innerHTML = `
        <article class="profile-stat-card">
            <span class="profile-stat-card__value">${player ? player.points.toFixed(2) : '—'}</span>
            <span class="profile-stat-card__label">${pointLabel}</span>
        </article>
        <article class="profile-stat-card">
            <span class="profile-stat-card__value">${percentageValue}</span>
            <span class="profile-stat-card__label">${progressData.statLabel}</span>
        </article>
        <article class="profile-stat-card">
            <span class="profile-stat-card__value">${player ? completedLevels.length : '—'}</span>
            <span class="profile-stat-card__label">${completionLabel}</span>
        </article>
        <article class="profile-stat-card${hardestRecordLink ? ' profile-stat-card--linked' : ''}">
            <span class="profile-stat-card__value profile-stat-card__value--hardest">${hardestValue}</span>
            <span class="profile-stat-card__label">Hardest</span>
        </article>
    `;

    renderPlayerProfileProgress(username, progressData);
}

function getPlayerProfileProgressData(username) {
    const profileData = getProfileContextData(username);
    const completedLevels = profileData.player && Array.isArray(profileData.player.completedLevels)
        ? profileData.player.completedLevels
        : [];
    const isRising = profileData.source === 'rising';
    const count = profileData.player
        ? isRising
            ? completedLevels.length
            : completedLevels.filter(level => level.rank <= 150).length
        : null;
    const denominator = isRising ? profileData.levels.length : 150;
    const percentage = count !== null && denominator > 0
        ? ((count / denominator) * 100).toFixed(2)
        : null;

    return {
        count,
        denominator,
        percentage,
        source: profileData.source,
        label: count === null
            ? '—'
            : isRising
                ? `${count}/${denominator} Rising`
                : `${count}/150 Main List`,
        statLabel: isRising
            ? `Progreso de Rising (${count === null ? '—' : `${count}/${denominator}`})`
            : 'Progreso de lista (Top 1–150)'
    };
}

function renderPlayerProfileProgress(username, progressData) {
    const container = document.getElementById('profile-progress-container');
    if (!container) return;

    const progressLabel = progressData.label;
    const progressTag = progressData.source === 'rising' ? 'Rising' : 'Main List';
    const percent = progressData.percentage || 0;

    container.innerHTML = `
        <div class="profile-card__progress-block">
            <h2 class="profile-progress-title">Progreso de colección</h2>
            <div class="profile-card__progress-label">
                <span class="profile-card__progress-count">${progressLabel}</span>
                <span class="profile-card__progress-tag">${progressTag}</span>
            </div>
            <div
                class="profile-card__progress-track"
                role="progressbar"
                aria-label="Progreso de colección de ${username}"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${percent}"
            >
                <div class="profile-card__progress-fill" style="width: ${percent}%;"></div>
            </div>
        </div>
    `;
}

// La mini lista de perfil usa los mismos renderers de sidebar y detalle que
// List/Rising, limitada a los niveles completados por el jugador.
function renderPlayerProfileLevels(username) {
    const container = document.getElementById('profile-levels-container');
    if (!container) return;

    profileSidebarScrollTop = 0;
    const profileData = getProfileContextData(username);
    const completedRecords = profileData.player && Array.isArray(profileData.player.completedLevels)
        ? [...profileData.player.completedLevels].sort((a, b) => a.rank - b.rank)
        : [];
    const completedRanks = new Set(completedRecords.map(level => level.rank));
    const completedLevels = profileData.levels
        .filter(level => completedRanks.has(level.rank))
        .sort((a, b) => a.rank - b.rank);

    profileLegacyMode = false;
    profileLevelSearchTerm = '';
    currentProfileLevelId = completedLevels[0] ? completedLevels[0].id : null;

    if (completedLevels.length === 0) {
        container.innerHTML = `
            <section class="profile-completed-section">
                <h2 class="profile-section-title">Niveles completados</h2>
                <p class="profile-completed-empty">
                    ${profileData.source === 'rising'
                        ? 'Este jugador todavía no completó niveles de Rising.'
                        : 'Este jugador todavía no completó niveles de la Main List.'}
                </p>
            </section>
        `;
        return;
    }

    container.innerHTML = `
        <section class="profile-completed-section profile-mini-list" id="profile-mini-list">
            <div class="profile-completed-heading">
                <h2 class="profile-section-title">Niveles completados</h2>
                <div class="level-search-container profile-mini-controls">
                    <input
                        type="search"
                        id="profile-level-search"
                        class="level-search-input"
                        placeholder="Buscar nivel..."
                        aria-label="Buscar niveles completados"
                    >
                    ${profileData.source === 'list' ? `
                        <button
                            type="button"
                            id="profile-legacy-toggle"
                            class="legacy-toggle-btn"
                            aria-pressed="false"
                            aria-label="Alternar niveles Legacy"
                        >
                            <span class="legacy-toggle-track"><span class="legacy-toggle-thumb"></span></span>
                            <span class="legacy-toggle-label">Legacy</span>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="profile-mini-layout">
                <aside class="profile-mini-sidebar sidebar-list-wrapper">
                    <div class="sidebar-list" id="profile-level-sidebar"></div>
                </aside>
                <div class="profile-mini-details" id="profile-level-details"></div>
            </div>
        </section>
    `;

    const searchInput = document.getElementById('profile-level-search');
    if (searchInput) {
        searchInput.addEventListener('input', event => {
            profileLevelSearchTerm = event.target.value;
            renderProfileCompletedSidebar(username, profileData, completedLevels);
        });
    }

    const legacyToggle = document.getElementById('profile-legacy-toggle');
    if (legacyToggle) {
        legacyToggle.addEventListener('click', () => {
            profileLegacyMode = !profileLegacyMode;
            legacyToggle.classList.toggle('active', profileLegacyMode);
            legacyToggle.setAttribute('aria-pressed', String(profileLegacyMode));
            const miniList = document.getElementById('profile-mini-list');
            if (miniList) miniList.classList.toggle('legacy-mode', profileLegacyMode);
            renderProfileCompletedSidebar(username, profileData, completedLevels);
        });
    }

    renderProfileCompletedSidebar(username, profileData, completedLevels);
}

function renderProfileCompletedSidebar(username, profileData, completedLevels) {
    const sidebar = document.getElementById('profile-level-sidebar');
    if (!sidebar) return;

    const visibleLevels = profileData.source === 'list'
        ? completedLevels.filter(level => profileLegacyMode ? level.rank > LEGACY_THRESHOLD : level.rank <= LEGACY_THRESHOLD)
        : completedLevels;
    const selectedLevel = visibleLevels.find(level => level.id === currentProfileLevelId)
        || visibleLevels[0]
        || null;
    currentProfileLevelId = selectedLevel ? selectedLevel.id : null;

    filtrarNivelesEnSidebar(
        visibleLevels,
        profileLevelSearchTerm,
        'profile-level-sidebar',
        'profile-level-item-',
        id => mostrarDetallePerfilNivel(id, username, profileData),
        currentProfileLevelId
    );

    const detailPanel = document.getElementById('profile-level-details');
    if (selectedLevel && detailPanel) {
        mostrarDetallePerfilNivel(selectedLevel.id, username, profileData, false);
    } else if (detailPanel) {
        const message = visibleLevels.length === 0 && profileLevelSearchTerm.trim() === ''
            ? profileLegacyMode
                ? 'Este jugador no tiene niveles Legacy completados.'
                : 'Este jugador no tiene niveles principales completados.'
            : 'No hay niveles que coincidan con la búsqueda.';
        detailPanel.innerHTML = `<p class="profile-completed-empty">${message}</p>`;
    }
}

function mostrarDetallePerfilNivel(idNivel, username, profileData, openMobile = true) {
    const nivel = profileData.levels.find(level => level.id === idNivel);
    if (!nivel) return;

    currentProfileLevelId = nivel.id;
    document.querySelectorAll('#profile-level-sidebar .level-card').forEach(item => {
        const isCurrent = item.id === `profile-level-item-${idNivel}`;
        item.classList.toggle('active', isCurrent);
        if (isCurrent) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
    });
    renderDetalleNivel(nivel, 'profile-level-details', username);

    if (openMobile && window.innerWidth < 900) {
        const sidebar = document.getElementById('profile-level-sidebar');
        if (sidebar) profileSidebarScrollTop = sidebar.scrollTop;
        const layout = document.querySelector('#profile-mini-list .profile-mini-layout');
        if (layout) layout.classList.add('mobile-detail-open');
    }
}

// ── Popup "¿Ir al video del jugador...?" ──────────────────────────────
// Componente propio, independiente de #player-modal (no se toca ni se
// reutiliza ese modal viejo). Reusa el mismo lenguaje visual del sitio:
// overlay con blur + tarjeta bg-surface/border/radius-lg, y los mismos
// botones .btn/.btn--primary/.btn--secondary que ya existen en el resto
// de la página (roulette, mod-list, etc.).
function openPlayerVideoConfirm(username, videoUrl) {
    closePlayerVideoConfirm(); // por si ya había uno abierto

    const overlay = document.createElement('div');
    overlay.id = 'confirm-popup-overlay';
    overlay.className = 'confirm-popup';
    overlay.onclick = (event) => {
        if (event.target === overlay) closePlayerVideoConfirm();
    };

    overlay.innerHTML = `
        <div class="confirm-popup__content">
            <p class="confirm-popup__text">¿Ir al video del jugador "${username}"?</p>
            <div class="confirm-popup__actions">
                <button type="button" class="btn btn--secondary" id="confirm-popup-no">No</button>
                <button type="button" class="btn btn--primary" id="confirm-popup-yes">Sí</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    document.getElementById('confirm-popup-no').onclick = closePlayerVideoConfirm;
    document.getElementById('confirm-popup-yes').onclick = () => {
        if (videoUrl) {
            window.open(videoUrl, '_blank');
        }
        closePlayerVideoConfirm();
    };
}

function closePlayerVideoConfirm() {
    const overlay = document.getElementById('confirm-popup-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
}

function renderPlayerProfileLayout(username) {
    const container = document.getElementById('tab-profile');
    if (!container) return;

    container.innerHTML = `
        <div class="profile-page">
            <section class="profile-header" id="profile-card-container"></section>
            <section class="profile-progress-section" id="profile-progress-container"></section>
            <section class="profile-stats-grid" id="profile-stats-container"></section>
            <div id="profile-levels-container"></div>
        </div>
    `;

    renderPlayerProfileStats(username);
    renderPlayerProfileLevels(username);
    renderPlayerProfileCard(username);
}

function getProfileContextData(username, source = currentProfileListContext) {
    const isRising = source === 'rising';
    const players = isRising
        ? (window.risingLeaderboardPlayers || [])
        : (window.leaderboardPlayers || []);
    const levels = isRising ? globalRisingLevels : globalLevels;
    const rankIndex = players.findIndex(player => player.name === username);

    return {
        source: isRising ? 'rising' : 'list',
        players,
        levels,
        rank: rankIndex === -1 ? null : rankIndex + 1,
        player: rankIndex === -1 ? null : players[rankIndex]
    };
}

function getYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return '';

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0];
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
            const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
            return match ? match[1] : '';
        }
    } catch (error) {
        return '';
    }

    return '';
}

function handleProfileBannerLoad(img) {
    const fallback = img.parentElement.querySelector('.profile-banner__fallback');
    if (fallback) fallback.hidden = true;
}

function handleProfileBannerError(img) {
    if (img.dataset.thumbnailSize === 'maxres') {
        img.dataset.thumbnailSize = 'hq';
        img.src = img.dataset.hqSrc;
        return;
    }

    img.hidden = true;
}

// Tarjeta del jugador (columna derecha): usa el progreso real del jugador
// según la lista activa (Main List o Rising) en lugar de valores fijos.
function renderPlayerProfileCard(username) {
    const cardContainer = document.getElementById('profile-card-container');
    if (!cardContainer) return;

    const profileData = getProfileContextData(username);
    const hardest = profileData.player && Array.isArray(profileData.player.completedLevels)
        ? [...profileData.player.completedLevels].sort((a, b) => a.rank - b.rank)[0]
        : null;
    const hardestLevel = hardest
        ? profileData.levels.find(level => level.rank === hardest.rank)
        : null;
    const videoId = hardestLevel ? getYouTubeVideoId(hardestLevel.verification) : '';
    const imageMarkup = videoId
        ? `<img
                class="profile-banner__image"
                src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg"
                data-thumbnail-size="maxres"
                data-hq-src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg"
                onload="handleProfileBannerLoad(this)"
                onerror="handleProfileBannerError(this)"
                loading="lazy"
                width="1280"
                height="720"
                alt="Miniatura de ${hardestLevel.name}"
            >`
        : '';
    const fallbackText = hardest
        ? `#${hardest.rank} ${hardest.level}`
        : '';
    const hardestLabel = hardest
        ? `<span class="profile-banner__hardest">#${hardest.rank} ${hardest.level}</span>`
        : '';
    const rankLabel = profileData.rank === null ? '—' : `#${profileData.rank}`;

    cardContainer.innerHTML = `
        <div class="profile-card">
            <div class="profile-banner">
                <div class="profile-banner__fallback" role="img" aria-label="${fallbackText || 'Banner del perfil'}">
                    ${fallbackText ? `<span>${fallbackText}</span>` : ''}
                </div>
                ${imageMarkup}
                ${hardestLabel}
            </div>
            <div class="profile-identity">
                <div class="profile-identity__avatar-column">
                    <div class="profile-card__avatar">
                    <img
                        class="profile-card__avatar-img"
                        src="${getAvatarSrc(username, 0)}"
                        data-avatar-username="${username}"
                        data-avatar-attempt="0"
                        onerror="handleAvatarError(this)"
                        alt="${username}"
                    >
                    </div>
                    <div class="profile-rank">
                        <span class="profile-rank__value">${rankLabel}</span>
                        <span class="profile-rank__label">RANK</span>
                    </div>
                </div>
                <h1 class="profile-card__name">${username}</h1>
            </div>
        </div>
    `;
}

function handleHashRouting() {
    // 0. Extraer el hash crudo, SIN forzar minúsculas todavía: si es una ruta
    // de perfil (#player/Nombre) necesitamos preservar mayúsculas/minúsculas
    // originales del username antes de decidir cómo tratar el resto de la ruta.
    const rawHash = window.location.hash.replace('#', '');
    const routePath = rawHash.replace(/^\/+/, '');
    const routeParts = routePath.split('/').filter(Boolean);
    const isProfileRoute = /^player\//i.test(routePath);
    const profileRouteParts = isProfileRoute ? routePath.slice('player/'.length).split('/') : [];

    // 1. Extraer el identificador del hash actual (ej: '#roulette' -> 'roulette')
    let route = (routeParts[0] || '').toLowerCase();
    const requestedLevelSlug = routeParts.length > 1 ? routeParts[1].toLowerCase() : '';
    if (!route) route = 'welcome'; // Sin hash → pantalla de bienvenida

    // Excepción única por si usas el alias heredado '#challenges' para la sección frk-dm
    if (route === 'challenges') route = 'frk-dm';

    // 2. Construir dinámicamente el ID de la sección que deberíamos buscar.
    // Caso especial: las rutas de perfil no tienen una sección estática propia
    // por jugador (no existe tab-player-matus); todas resuelven contra el
    // mismo contenedor genérico tab-profile.
    currentProfileUsername = null;
    if (route === 'list' || route === 'rising') {
        currentProfileListContext = route;
    }

    let targetSectionId;
    if (isProfileRoute) {
        currentProfileUsername = decodeURIComponent(profileRouteParts[0] || '');
        if (profileRouteParts[1] === 'rising' || profileRouteParts[1] === 'list') {
            currentProfileListContext = profileRouteParts[1];
        }
        targetSectionId = 'tab-profile';
    } else {
        targetSectionId = `tab-${route}`;
    }
    let targetSection = document.getElementById(targetSectionId);

    // Redirección de seguridad: Si el hash no existe en el HTML, volver a la bienvenida
    if (!targetSection) {
        route = 'welcome';
        currentProfileUsername = null;
        targetSection = document.getElementById('tab-welcome');
    }

    // 3. Desactivar visualmente todas las secciones y botones que existan en la página
    document.querySelectorAll('.main-content').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav__link-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 4. Activar dinámicamente la sección encontrada y su correspondiente botón de navegación
    if (targetSection) {
        targetSection.classList.add('active');
    }

    const targetBtn = document.querySelector(`.nav__link-btn[data-route="${route}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }

    // 5. Si la ruta resolvió a un perfil de jugador válido, armar el layout
    // base dentro de tab-profile. Todavía no se completa con datos: eso se
    // hace en un paso posterior.
    if (currentProfileUsername) {
        playTheGlaiCatProfileAudio(currentProfileUsername);
        renderPlayerProfileLayout(currentProfileUsername);
    }

    if (route === 'list' || route === 'rising') {
        const levels = route === 'list' ? globalLevels : globalRisingLevels;
        const currentId = route === 'list' ? currentDetailLevelId : currentRisingDetailId;
        const slugMatch = requestedLevelSlug
            ? levels.find(level => getLevelSlug(level) === requestedLevelSlug)
            : null;
        const currentLevel = levels.find(level => level.id === currentId);
        const firstVisible = route === 'list'
            ? getVisibleLevels(levels)[0]
            : levels[0];
        const selectedLevel = slugMatch || currentLevel || firstVisible;

        setMobileDetailView(route, Boolean(slugMatch));
        if (selectedLevel) {
            if (route === 'list') mostrarDetallesNivel(selectedLevel.id, false);
            else mostrarDetalleRising(selectedLevel.id, false);
        }
    } else {
        setMobileDetailView('', false);
    }
}

// Vincula de forma automática el evento de click a todos los botones del menú presentes en el DOM
function initDynamicNavigation() {
    document.querySelectorAll('.nav__link-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const route = btn.getAttribute('data-route');
            if (route) {
                window.location.hash = route; // Cambiar el hash dispara 'hashchange' automáticamente
            }
        });
    });
}

// Función puente de retrocompatibilidad por si otros scripts de apartados llaman a switchTab por código
function switchTab(tabId, buttonElement) {
    const route = tabId.replace('tab-', '');
    window.location.hash = route;
}

// ESCUCHADORES DE EVENTOS DEL SISTEMA
window.addEventListener('hashchange', handleHashRouting);

document.addEventListener('DOMContentLoaded', () => {
    initDynamicNavigation(); // Escucha los clics de cualquier botón con la clase .nav__link-btn
    handleHashRouting();     // Evalúa el hash con el que se abrió la página originalmente
});

// ── Loader genérico de niveles ────────────────────────────────────────
// Reutilizado por List (carpetaDatos = 'data-lvl') y por RISING
// (carpetaDatos = 'data-rising'). Aplica los mismos baneos globales de
// jugadores/niveles (_baneos.json / _lvl_baneos.json) y la misma detección
// de bugs que ya existía para List, sin duplicar esa lógica por sección.
async function cargarNivelesConBaneos(carpetaDatos, archivoIndice) {
    // A) Cargar lista de jugadores baneados desde _baneos.json
    // Si el archivo no existe o falla, se continúa sin baneos (array vacío).
    let jugadoresBaneados = [];
    try {
        const resBaneos = await fetch('_baneos.json');
        if (resBaneos.ok) {
            jugadoresBaneados = await resBaneos.json();
        }
    } catch (baneoErr) {
        console.warn('No se pudo cargar _baneos.json, se omiten baneos.', baneoErr);
    }

    // B) Cargar lista de niveles baneados desde _lvl_baneos.json
    // Si el archivo no existe o falla, se continua sin baneos de niveles.
    let nivelesBaneados = [];
    try {
        const resLvlBaneos = await fetch('_lvl_baneos.json');
        if (resLvlBaneos.ok) {
            nivelesBaneados = await resLvlBaneos.json();
        }
    } catch (lvlBaneoErr) {
        console.warn('No se pudo cargar _lvl_baneos.json, se omiten baneos de niveles.', lvlBaneoErr);
    }

    // C) Leer el índice maestro de niveles y filtrar los baneados
    // El filtro ocurre ANTES de iterar, por lo que el rank (index + 1)
    // se reasigna automaticamente: si se baneó el top 5, el top 6 pasa a ser top 5.
    // La comparacion es exacta (case-sensitive), igual que en _baneos.json.
    const resListIndex = await fetch(`${carpetaDatos}/${archivoIndice}`);
    const listaNombresRaw = await resListIndex.json();
    const listaNombres = nivelesBaneados.length > 0
        ? listaNombresRaw.filter(nombre => !nivelesBaneados.includes(nombre.trim()))
        : listaNombresRaw;

    const bugs = [];

    const promesasNiveles = listaNombres.map(async (nombreArchivo, index) => {
        try {
            const resNivel = await fetch(`${carpetaDatos}/${nombreArchivo}.json`);
            if (!resNivel.ok) throw new Error(`No se pudo cargar ${nombreArchivo}.json`);
            const datosNivel = await resNivel.json();

            if (!datosNivel.id || !datosNivel.name) {
                bugs.push({
                    file: `${carpetaDatos}/${nombreArchivo}.json`,
                    reason: 'Falta "id" o "name" en el archivo (se usaron valores de respaldo para la leaderboard).'
                });
// Asignamos datos mínimos de respaldo para que la leaderboard pueda leer los récords sin romperse
                if (!datosNivel.id) datosNivel.id = `id_${nombreArchivo}`;
                if (!datosNivel.name) datosNivel.name = nombreArchivo;
            }

            datosNivel.rank = index + 1;
            datosNivel._file = `${carpetaDatos}/${nombreArchivo}.json`;

            // El bug check usa el conteo ORIGINAL del JSON, antes de aplicar baneos.
            // Así solo reporta bug si el nivel genuinamente no tiene records,
            // y no confunde un nivel con todos sus records baneados como un nivel vacío.
            const recordsOriginales = Array.isArray(datosNivel.records) ? datosNivel.records.length : 0;
            if (recordsOriginales === 0) {
                bugs.push({
                    file: `${carpetaDatos}/${nombreArchivo}.json`,
                    reason: `${nombreArchivo}.json no tiene un record registrado.`
                });
            }

            // Filtrar records de jugadores baneados (comparación exacta, case-sensitive)
            // Se opera sobre el objeto en memoria; el archivo JSON original no se toca.
            if (Array.isArray(datosNivel.records) && jugadoresBaneados.length > 0) {
                datosNivel.records = datosNivel.records.filter(
                    rec => !jugadoresBaneados.includes(rec.user)
                );
            }

            return datosNivel;
        } catch (err) {
            console.warn(`Error al cargar el nivel individual: ${carpetaDatos}/${nombreArchivo}`, err);
            bugs.push({
                file: `${carpetaDatos}/${nombreArchivo}.json`,
                reason: 'Código mal ejecutado o archivo no encontrado.'
            });
            return null;
        }
    });

    const nivelesCargados = await Promise.all(promesasNiveles);
    const niveles = nivelesCargados.filter(n => n !== null);

    // Detección de IDs duplicadas entre los niveles cargados correctamente,
    // acotada a este dataset (List y RISING se validan cada uno por separado).
    const idMap = {};
    niveles.forEach(nivel => {
        if (!idMap[nivel.id]) idMap[nivel.id] = [];
        idMap[nivel.id].push(nivel);
    });
    Object.values(idMap).forEach(grupo => {
        if (grupo.length > 1) {
            grupo.forEach(nivel => {
                const otros = grupo.filter(n => n !== nivel).map(n => n._file).join(', ');
                bugs.push({
                    file: nivel._file,
                    reason: `ID duplicada (${nivel.id}), compartida con ${otros}.`
                });
            });
        }
    });

    return { niveles, bugs };
}

async function inicializarSitio() {
    try {
        const resultadoList = await cargarNivelesConBaneos('data-lvl', '_list.json');
        globalLevels = resultadoList.niveles;
        let bugs = resultadoList.bugs;

        const resultadoRising = await cargarNivelesConBaneos('data-rising', '_list.json');
        globalRisingLevels = resultadoRising.niveles;
        bugs = bugs.concat(resultadoRising.bugs);

        renderBugTab(bugs);

        renderLeaderboard(globalLevels, 'leaderboard-container', 'leaderboardPlayers');

        renderLeaderboard(globalRisingLevels, 'rising-leaderboard-container', 'risingLeaderboardPlayers');
        // El hash directo puede abrir un perfil antes de que se calculen ambos
        // leaderboards; se renderiza de nuevo cuando las dos fuentes están listas.
        if (currentProfileUsername) renderPlayerProfileLayout(currentProfileUsername);

        renderSidebar();
        renderRisingSidebar();

        const searchInput = document.getElementById('level-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterLevels(e.target.value);
            });
        }

        const risingSearchInput = document.getElementById('rising-search');
        if (risingSearchInput) {
            risingSearchInput.addEventListener('input', (e) => {
                filterRisingLevels(e.target.value);
            });
        }

        const legacyToggleBtn = document.getElementById('legacy-toggle');
        if (legacyToggleBtn) {
            legacyToggleBtn.addEventListener('click', toggleLegacyMode);
        }

        const risingViewToggleBtn = document.getElementById('rising-view-toggle');
        if (risingViewToggleBtn) {
            risingViewToggleBtn.addEventListener('click', toggleRisingView);
        }

        if (globalLevels.length > 0) mostrarDetallesNivel(globalLevels[0].id, false);
        if (globalRisingLevels.length > 0) mostrarDetalleRising(globalRisingLevels[0].id, false);
        handleHashRouting();

        // Inicializar la sección FRK-DM
        await inicializarFrkDm();

    } catch (error) {
        console.error("Error crítico al inicializar la estructura dinámica data-lvl/data-rising:", error);
    }
}

function renderBugTab(bugs) {
    const tabEl = document.getElementById('bug-tab');
    if (!tabEl) return;

    if (!bugs || bugs.length === 0) {
        tabEl.classList.remove('has-bugs', 'open');
        return;
    }

    const list = document.getElementById('bug-tab-list');
    list.innerHTML = bugs.map(b => `
        <li class="bug-tab__item">
            <div class="bug-tab__item-file">${b.file}</div>
            <div class="bug-tab__item-reason">${b.reason}</div>
        </li>
    `).join('');

    tabEl.classList.add('has-bugs');
}

function toggleBugTab() {
    const tabEl = document.getElementById('bug-tab');
    if (tabEl) tabEl.classList.toggle('open');
}

function getCreatorList(creators, author) {
    if (Array.isArray(creators)) {
        return creators.filter(Boolean);
    }

    if (typeof creators === 'string' && creators.trim()) {
        return [creators.trim()];
    }

    if (typeof author === 'string' && author.trim()) {
        return [author.trim()];
    }

    return [];
}

function getCreatorDisplay(creators, author) {
    const creatorsList = getCreatorList(creators, author);
    return creatorsList.length > 0 ? creatorsList.join(', ') : 'Desconocido';
}

function getCreatorPrimary(creators, author) {
    const creatorsList = getCreatorList(creators, author);
    return creatorsList[0] || author || 'Desconocido';
}

// ── Núcleo genérico de sidebar (List y RISING comparten esta función) ──
// idPrefix distingue los IDs de card entre secciones (sidebar-item- vs
// rising-sidebar-item-) para que no colisionen si algún día un nivel
// aparece con el mismo id en ambos datasets.
function renderNivelesEnSidebar(niveles, sidebarElId, idPrefix, onClickFn, selectedId) {
    const sidebar = document.getElementById(sidebarElId);
    if (!sidebar) return;
    sidebar.innerHTML = '';

    niveles.forEach(nivel => {
        const item = document.createElement('button');
        const isRising = sidebarElId === 'rising-sidebar';
        const selectedLevelId = selectedId === undefined
            ? (isRising ? currentRisingDetailId : currentDetailLevelId)
            : selectedId;
        item.className = 'card level-card';
        item.id = `${idPrefix}${nivel.id}`;
        item.type = 'button';
        if (nivel.id === selectedLevelId) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'true');
        }
        item.setAttribute('aria-label', `#${nivel.rank} ${nivel.name}, por ${getCreatorPrimary(nivel.creators, nivel.author)}`);
        item.style.marginBottom = 'var(--space-3)';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = 'var(--space-4)';
        item.style.padding = 'var(--space-4)';

        item.onclick = () => onClickFn(nivel.id);
        item.addEventListener('keydown', event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const items = Array.from(sidebar.querySelectorAll('.level-card'));
            if (items.length < 2) return;
            const currentIndex = items.indexOf(item);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const nextIndex = (currentIndex + step + items.length) % items.length;
            event.preventDefault();
            items[nextIndex].focus();
        });

        item.innerHTML = `
            <div class="text-accent text-mono" style="font-size: 1.3rem; font-weight: 700; min-width: 45px;">#${nivel.rank}</div>
            <div style="flex: 1;">
                <div class="text-display level-card__name" style="font-weight: 600; font-size: 1.15rem; color: var(--text-primary); line-height: 1.2;">${nivel.name}</div>
                <div class="level-card__creator" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">por ${getCreatorPrimary(nivel.creators, nivel.author)}</div>
            </div>
        `;
        sidebar.appendChild(item);
    });
}

function filtrarNivelesEnSidebar(niveles, searchTerm, sidebarElId, idPrefix, onClickFn, selectedId) {
    const term = searchTerm.toLowerCase().trim();

    const filteredLevels = niveles.filter(level => {
        if (level.name.toLowerCase().includes(term)) return true;
        if (level.author && level.author.toLowerCase().includes(term)) return true;
        if (level.verifier && level.verifier.toLowerCase().includes(term)) return true;
        if (getCreatorList(level.creators, level.author).some(c => c.toLowerCase().includes(term))) return true;
        if (level.records && level.records.some(r => r.user && r.user.toLowerCase().includes(term))) return true;
        return false;
    });

    renderNivelesEnSidebar(filteredLevels, sidebarElId, idPrefix, onClickFn, selectedId);
}

function renderSidebar() {
    renderNivelesEnSidebar(getVisibleLevels(globalLevels), 'levels-sidebar', 'sidebar-item-', mostrarDetallesNivel);
}

function filterLevels(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (term !== '') {
        const matchingNames = globalLevels.filter(level =>
            typeof level.name === 'string' && level.name.toLowerCase().includes(term)
        );
        const matchingModes = new Set(
            matchingNames.map(level => level.rank > LEGACY_THRESHOLD)
        );

        if (matchingModes.size === 1) {
            const shouldUseLegacy = matchingModes.has(true);
            if (shouldUseLegacy !== legacyMode) {
                toggleLegacyMode();
                return;
            }
        }
    }

    filtrarNivelesEnSidebar(getVisibleLevels(globalLevels), searchTerm, 'levels-sidebar', 'sidebar-item-', mostrarDetallesNivel);
}

function renderRisingSidebar() {
    renderNivelesEnSidebar(globalRisingLevels, 'rising-sidebar', 'rising-sidebar-item-', mostrarDetalleRising);
}

function filterRisingLevels(searchTerm) {
    filtrarNivelesEnSidebar(globalRisingLevels, searchTerm, 'rising-sidebar', 'rising-sidebar-item-', mostrarDetalleRising);
}

function mostrarDetallesNivel(idNivel, updateHash = true) {
    const nivel = globalLevels.find(n => n.id === idNivel);
    if (!nivel) return;

    document.querySelectorAll('#levels-sidebar .level-card').forEach(el => {
        const isCurrent = el.id === `sidebar-item-${idNivel}`;
        el.classList.toggle('active', isCurrent);
        if (isCurrent) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
    });

    currentDetailLevelId = idNivel;
    if (updateHash) {
        const targetHash = `#/list/${getLevelSlug(nivel)}`;
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
    }
    if (updateHash && window.innerWidth < 900) setMobileDetailView('list', true);
    renderDetalleNivel(nivel, 'level-details');
}

function mostrarDetalleRising(idNivel, updateHash = true) {
    const nivel = globalRisingLevels.find(n => n.id === idNivel);
    if (!nivel) return;

    document.querySelectorAll('#rising-sidebar .level-card').forEach(el => {
        const isCurrent = el.id === `rising-sidebar-item-${idNivel}`;
        el.classList.toggle('active', isCurrent);
        if (isCurrent) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
    });

    currentRisingDetailId = idNivel;
    if (updateHash) {
        const targetHash = `#/rising/${getLevelSlug(nivel)}`;
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
    }
    if (updateHash && window.innerWidth < 900) setMobileDetailView('rising', true);
    renderDetalleNivel(nivel, 'rising-details');
}

// Núcleo genérico de renderizado del panel de detalle, compartido por
// List y RISING. Recibe el nivel ya resuelto y el ID del contenedor destino.
function renderDetalleNivel(nivel, detailPanelId, recordUser = null) {
    const detailPanel = document.getElementById(detailPanelId);
    if (!detailPanel) return;

    const autoresTexto = getCreatorDisplay(nivel.creators, nivel.author);

    let youtubeId = "";
    if (nivel.verification) {
        if (nivel.verification.includes("v=")) {
            youtubeId = nivel.verification.split("v=")[1].split("&")[0];
        } else if (nivel.verification.includes("youtu.be/")) {
            youtubeId = nivel.verification.split("youtu.be/")[1].split("?")[0];
        }
    }

    const puntosCalculados = getMaxPointsForPosition(nivel.rank).toFixed(2);

    const records = Array.isArray(nivel.records)
        ? recordUser
            ? nivel.records.filter(record => record.user === recordUser)
            : nivel.records
        : [];
    const noRecordsMessage = recordUser
        ? `No hay record de ${recordUser} registrado para este nivel.`
        : 'No se han validado récords adicionales para este nivel todavía.';
    let recordsHTML = `
        <div style="background: var(--bg-base); padding: var(--space-4); border-radius: var(--radius-md); border: 1px dashed var(--border); text-align: center;">
            <p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic; margin: 0;">${noRecordsMessage}</p>
        </div>
    `;

    if (records.length > 0) {
        recordsHTML = `<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);">`;
        records.forEach(rec => {
            recordsHTML += `
                <li style="background: var(--bg-base); border: 1px solid var(--border); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary);">${rec.user}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: var(--space-2); font-family: var(--font-mono);">${rec.hz ? rec.hz + 'Hz' : ''}</span>
                    </div>
                    <a href="${rec.link}" target="_blank" class="text-cyan text-mono" style="font-weight: 700; text-decoration: none; font-size: 1rem;">
                        ${rec.percent}% <span style="font-size: 0.75rem;">↗</span>
                    </a>
                </li>
            `;
        });
        recordsHTML += `</ul>`;
    }

    const backRoute = detailPanelId === 'profile-level-details'
        ? 'profile'
        : detailPanelId === 'rising-details'
            ? 'rising'
            : 'list';

    detailPanel.innerHTML = `
        <button type="button" class="mobile-detail-back" onclick="volverALista('${backRoute}')">← Volver</button>
        <div class="card" style="padding: var(--space-6); background: var(--bg-surface); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
            <div style="margin-bottom: var(--space-4);">
                <h1 class="text-display" style="font-size: 2.5rem; margin: 0; font-weight: 700; color: var(--text-primary);">${nivel.name}</h1>
                <p style="font-size: 0.95rem; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                    Creado por <span class="text-accent" style="font-weight: 600;">${autoresTexto}</span> — Verificado por <span class="text-cyan" style="font-weight: 600;">${nivel.verifier}</span>
                </p>
            </div>

            ${youtubeId ? `
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: var(--space-6);">
                <iframe 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                    src="https://www.youtube.com/embed/${youtubeId}" 
                    title="${nivel.name} Verification Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
            ` : `
            <div style="background: var(--bg-base); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center; margin-bottom: var(--space-6); color: var(--text-muted);">
                Sin video de verificación disponible.
            </div>
            `}

            <div class="level-meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
                <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center; cursor: pointer; transition: all var(--transition-fast);" onclick="copyToClipboard('${nivel.id}'); this.style.background='var(--bg-elevated)'; setTimeout(() => this.style.background='var(--bg-base)', 200);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">ID del Nivel</div>
                    <div class="text-mono" style="font-size: 1.1rem; font-weight: bold; margin-top: 4px; color: var(--accent-light);">${nivel.id}</div>
                </div>
                <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Puntos de Lista</div>
                    <div class="text-gold text-mono" style="font-size: 1.1rem; font-weight: bold; margin-top: 4px;">${puntosCalculados} <span style="font-size:0.8rem">pts</span></div>
                </div>
                <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Requisito Mín.</div>
                    <div class="text-mono" style="font-size: 1.1rem; font-weight: bold; margin-top: 4px;">${nivel.percentToQualify}%</div>
                </div>
            </div>

            <div>
                <h3 class="text-display" style="font-size: 1.2rem; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border); padding-bottom: var(--space-2);">Records Registrados (${records.length})</h3>
                ${recordsHTML}
            </div>
        </div>
    `;
}

function playTheGlaiCatProfileAudio(username) {
    const normalizedName = (username || '').trim().toLowerCase();

    if (normalizedName === 'theglaicat' && Math.random() < 0.45) {
        const audio = new Audio('assets/img/cata.mp3');
        audio.play().catch(() => {});
    }
}

function openPlayerModal(playerData, storageKey = 'leaderboardPlayers') {
    // ── Easter Egg: TheGlaiCat audio (45% de probabilidad) ──
    playTheGlaiCatProfileAudio(playerData?.name);

    const modal = document.getElementById('player-modal');
    const modalContent = document.getElementById('player-modal-content');

    const medalClass = playerData.rank === 1 ? 'text-gold' : playerData.rank === 2 ? 'text-silver' : playerData.rank === 3 ? 'text-bronze' : 'text-accent';
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <div class="text-mono ${medalClass}" style="font-size: 1.2rem; font-weight: 700; margin-bottom: var(--space-1);">
                    ${playerData.rank === 1 ? '🥇' : playerData.rank === 2 ? '🥈' : playerData.rank === 3 ? '🥉' : ''} #${playerData.rank}
                </div>
                <h2 class="text-display" style="font-size: 1.8rem; margin: 0; font-weight: 700; color: var(--text-primary);">${playerData.name}</h2>
            </div>
            <button onclick="closePlayerModal()" class="player-modal-close" style="background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); font-size: 1.2rem;">×</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); margin-bottom: var(--space-6);">
            <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">Puntos Totales</div>
                <div class="text-mono" style="font-size: 1.3rem; font-weight: 700; color: var(--accent-light);">${playerData.points.toFixed(2)}</div>
            </div>
            <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">Completados</div>
                <div class="text-mono" style="font-size: 1.3rem; font-weight: 700; color: var(--accent-light);">${playerData.completions}</div>
            </div>
            <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">En Progreso</div>
                <div class="text-mono" style="font-size: 1.3rem; font-weight: 700; color: var(--accent-light);">${playerData.listProgress}</div>
            </div>
            <div style="background: var(--bg-base); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">Hardest</div>
                <div style="font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${playerData.hardest.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">(Top ${playerData.hardest.rank})</div>
            </div>
        </div>
        
        <div style="margin-top:var(--space-4);">
            <button
                onclick="showCompletedLevels('${playerData.name}', '${storageKey}')"
                style="
                    width:100%;
                    padding:12px;
                    background:var(--accent);
                    border:none;
                    border-radius:var(--radius-md);
                    color:white;
                    font-weight:700;
                    cursor:pointer;
                "
            >
                Ver completados (${playerData.completions})
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
    const modal = document.getElementById('player-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function showCompletedLevels(playerName, storageKey = 'leaderboardPlayers') {

    const player = (window[storageKey] || []).find(
        p => p.name === playerName
    );

    if (!player) return;

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;">Completados de ${player.name}</h2>

            <button onclick="closePlayerModal()"
                style="
                    width:32px;
                    height:32px;
                    border:none;
                    border-radius:8px;
                    cursor:pointer;
                ">
                ×
            </button>
        </div>
    `;

    if (!player.completedLevels.length) {

        html += `
            <p style="color:var(--text-muted);">
                Este jugador todavía no tiene completados.
            </p>
        `;

    } else {

        html += `<div style="display:flex;flex-direction:column;gap:10px;">`;

        player.completedLevels
            .sort((a,b) => a.rank - b.rank)
            .forEach(level => {

                html += `
                    <div style="
                        background:var(--bg-base);
                        border:1px solid var(--border);
                        padding:12px;
                        border-radius:10px;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:10px;
                        ">

                            <div>
                                <div style="font-weight:700;">
                                    ${level.level}
                                </div>

                                <div style="
                                    font-size:0.8rem;
                                    color:var(--text-muted);
                                ">
                                    Top ${level.rank}
                                </div>
                            </div>

                            ${
                                level.video
                                ? `
                                    <a
                                        href="${level.video}"
                                        target="_blank"
                                        style="
                                            color:var(--accent-light);
                                            text-decoration:none;
                                            font-weight:700;
                                        "
                                    >
                                        Video ↗
                                    </a>
                                `
                                : ''
                            }

                        </div>
                    </div>
                `;
            });

        html += `</div>`;
    }

    document.getElementById('player-modal-content').innerHTML = html;
}

// containerId: dónde se pinta la tabla/cards. storageKey: nombre de la
// propiedad en window donde se guarda el ranking calculado, usada luego por
// openPlayerModal/showCompletedLevels para saber de qué dataset leer al
// abrir el modal de un jugador. Por defecto reproduce el comportamiento
// original de List ('leaderboard-container' / window.leaderboardPlayers).
function renderLeaderboard(niveles = globalLevels, containerId = 'leaderboard-container', storageKey = 'leaderboardPlayers') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const playerRegistry = {};

niveles.forEach(nivel => {
    if (!nivel || !nivel.records || !Array.isArray(nivel.records)) return;

    const topPosition = nivel.rank;
    const maxLevelPoints = getMaxPointsForPosition(topPosition);
    
    const nombreNivelSeguro = nivel.name || "Nivel Desconocido";

    nivel.records.forEach(record => {
        const username = record.user ? record.user.trim() : '';
        if (!username) return;

        if (!playerRegistry[username]) {
            playerRegistry[username] = {
                name: username,
                points: 0,
                completions: 0,
                listProgress: 0,
                hardest: { name: nombreNivelSeguro, rank: topPosition },
                completedLevels: [],
                progressLevels: []
            };
        }

        const p = playerRegistry[username];

        if (record.percent === 100) {
            p.points += maxLevelPoints;
            p.completions += 1;
            p.completedLevels.push({
                level: nombreNivelSeguro,
                rank: nivel.rank,
                video: record.link || null
            });
        } else if (record.percent >= parseInt(nivel.percentToQualify || 50)) {
            const progressScore = maxLevelPoints * (record.percent / 100) * 0.4;
            p.points += Math.round(progressScore * 100) / 100;
            p.listProgress += 1;
            p.progressLevels.push({
                level: nombreNivelSeguro,
                percent: record.percent,
                video: record.link || null
            });
        }

        if (record.percent === 100 && topPosition < p.hardest.rank) {
            p.hardest.name = nombreNivelSeguro;
            p.hardest.rank = topPosition;
        }
    });
});

    const rankedPlayers = Object.values(playerRegistry).sort((a, b) => b.points - a.points);

    const isRisingLeaderboard = containerId === 'rising-leaderboard-container';
    const profileSourcePath = isRisingLeaderboard ? '/rising' : '/list';
    const emptyState = `
        <div style="padding: var(--space-8); text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);">
            No se encontraron récords registrados en la lista todavía.
        </div>`;

    if (rankedPlayers.length === 0) {
        container.innerHTML = isRisingLeaderboard
            ? `
                <div class="rising-leaderboard-hero">
                    <div class="rising-leaderboard-label">Leaderboard de Rising</div>
                    <h1>Top Jugadores</h1>
                </div>
                <div class="rising-leaderboard-content">${emptyState}</div>
            `
            : emptyState;
        return;
    }

    // Store players globally for modal
    window[storageKey] = rankedPlayers;

    // MOBILE VERSION
    let htmlMobile = `<div class="leaderboard-mobile">`;
    rankedPlayers.forEach((player, idx) => {
        const rank = idx + 1;
        htmlMobile += `
            <div class="leaderboard-mobile-row" onclick="window.location.hash = 'player/' + encodeURIComponent(window.${storageKey}[${idx}].name) + '${profileSourcePath}'">
                <div class="leaderboard-mobile-rank">#${rank}</div>
                <div class="leaderboard-mobile-name">${player.name}</div>
                <div class="leaderboard-mobile-arrow">→</div>
            </div>
        `;
    });
    htmlMobile += `</div>`;

    // DESKTOP VERSION
    let htmlTable = `
        <div class="leaderboard-desktop">
            <div style="overflow-x: auto; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                    <thead>
                        <tr style="background: var(--bg-elevated); border-bottom: 1px solid var(--border);">
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">Puesto</th>
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">Jugador</th>
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">Puntos Totales</th>
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; text-align: center;">Completados</th>
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; text-align: center;">Progresos</th>
                            <th style="padding: var(--space-4); font-family: var(--font-display); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em;">Hardest</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    rankedPlayers.forEach((player, idx) => {
        let medal = `#${idx + 1}`;
        if (idx === 0) medal = '#1';
        if (idx === 1) medal = '#2';
        if (idx === 2) medal = '#3';

        htmlTable += `
            <tr
                onclick='window.location.hash = "player/" + encodeURIComponent(window.${storageKey}[${idx}].name) + "${profileSourcePath}"'
                style="border-bottom: 1px solid var(--border); transition: background var(--transition-fast); cursor: pointer;"
                onmouseover="this.style.background='var(--bg-elevated)'"
                onmouseout="this.style.background='transparent'">
                <td class="text-mono" style="padding: var(--space-4); font-weight: 700; font-size: 1.1rem; color: var(--accent-light);">${medal}</td>
                <td style="padding: var(--space-4); font-weight: 600; color: var(--text-primary);">${player.name}</td>
                <td class="text-mono" style="padding: var(--space-4); font-weight: 700; color: #fff;">
                    ${player.points.toFixed(2)} <span style="font-size: 0.8rem; color: var(--accent-light);">PTS</span>
                </td>
                <td style="padding: var(--space-4); text-align: center; color: var(--text-primary);">${player.completions}</td>
                <td style="padding: var(--space-4); text-align: center; color: var(--text-secondary);">${player.listProgress}</td>
                <td style="padding: var(--space-4); font-size: 0.9rem; color: var(--accent-light); font-style: italic;">
                    ${player.hardest.name}
                    <span style="color: var(--text-muted); font-size: 0.8rem; font-family: var(--font-mono);">(Top ${player.hardest.rank})</span>
                </td>
            </tr>
        `;
    });

    htmlTable += `</tbody></table></div></div>`;

    const contentHtml = htmlMobile + htmlTable;
    container.innerHTML = isRisingLeaderboard
        ? `
            <div class="rising-leaderboard-hero">
                <div class="rising-leaderboard-label">Leaderboard de Rising</div>
                <h1>Top Jugadores</h1>
            </div>
            <div class="rising-leaderboard-content">${contentHtml}</div>
        `
        : contentHtml;
}

const roulette = {
    levels: [],       
    progression: [],  
    givenUp: false,
    showRemaining: false,

    get currentLevel() {
        return this.levels[this.progression.length];
    },
    get currentPercentage() {
        return this.progression[this.progression.length - 1] || 0;
    },
    get hasCompleted() {
        return (
            this.progression[this.progression.length - 1] >= 100 ||
            this.progression.length === this.levels.length
        );
    },
    get isActive() {
        return this.progression.length > 0 && !this.givenUp && !this.hasCompleted;
    },
};

function rouletteInit() {
    document.getElementById('roulette-btn-start').addEventListener('click', rouletteStart);
    document.getElementById('roulette-btn-giveup').addEventListener('click', rouletteGiveUp);
    document.getElementById('roulette-btn-done').addEventListener('click', rouletteDone);
    document.getElementById('roulette-btn-import').addEventListener('click', rouletteImport);
    document.getElementById('roulette-btn-export').addEventListener('click', rouletteExport);
    document.getElementById('roulette-file-input').addEventListener('change', rouletteImportUpload);

    const saved = JSON.parse(localStorage.getItem('fraka_roulette'));
    if (saved && saved.levels && saved.progression) {
        roulette.levels = saved.levels;
        roulette.progression = saved.progression;
        roulette.givenUp = saved.givenUp || false;
        rouletteRender();
    }
}

function rouletteShuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function rouletteStart() {
    if (roulette.isActive) {
        rouletteToast('Rendite antes de iniciar una nueva ruleta.');
        return;
    }
    if (globalLevels.length === 0) {
        rouletteToast('No hay niveles cargados todavía.');
        return;
    }

    const mapped = globalLevels.map(lvl => ({
        rank: lvl.rank,
        id: lvl.id,
        name: lvl.name,
        video: lvl.verification || '',
    }));

    roulette.levels = rouletteShuffle(mapped).slice(0, 100);
    roulette.progression = [];
    roulette.givenUp = false;
    roulette.showRemaining = false;

    rouletteSave();
    rouletteRender();
}

function rouletteDone() {
    const input = document.getElementById('roulette-percent-input');
    const val = parseInt(input.value);

    if (!val || isNaN(val)) { rouletteToast('Ingresá un porcentaje válido.'); return; }
    if (val <= roulette.currentPercentage || val > 100) { rouletteToast('Porcentaje inválido.'); return; }

    roulette.progression.push(val);
    input.value = '';

    rouletteSave();
    rouletteRender();
}

function rouletteGiveUp() {
    roulette.givenUp = true;
    localStorage.removeItem('fraka_roulette');
    rouletteRender();
}

function rouletteSave() {
    localStorage.setItem('fraka_roulette', JSON.stringify({
        levels: roulette.levels,
        progression: roulette.progression,
        givenUp: roulette.givenUp,
    }));
}

function rouletteImport() {
    if (roulette.isActive && !confirm('Esto sobreescribirá la ruleta en curso. ¿Continuar?')) return;
    document.getElementById('roulette-file-input').click();
}

async function rouletteImportUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!data.levels || !data.progression) { rouletteToast('Archivo inválido.'); return; }
        roulette.levels = data.levels;
        roulette.progression = data.progression;
        roulette.givenUp = false;
        roulette.showRemaining = false;
        rouletteSave();
        rouletteRender();
    } catch { rouletteToast('Archivo inválido.'); }
    e.target.value = '';
}

function rouletteExport() {
    const blob = new Blob([JSON.stringify({ levels: roulette.levels, progression: roulette.progression })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fraka_roulette.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function rouletteToast(msg) {
    const container = document.getElementById('roulette-toasts');
    const toast = document.createElement('div');
    toast.className = 'roulette-toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function rouletteGetThumb(url) {
    if (!url) return '';
    let id = '';
    if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

function rouletteRender() {
    const list = document.getElementById('roulette-levels-list');
    const currentPanel = document.getElementById('roulette-current-panel');
    const btnStart = document.getElementById('roulette-btn-start');
    const btnGiveUp = document.getElementById('roulette-btn-giveup');
    const btnExport = document.getElementById('roulette-btn-export');

    btnStart.textContent = roulette.levels.length === 0 ? 'INICIAR' : 'REINICIAR';
    btnGiveUp.style.display = roulette.isActive ? 'block' : 'none';
    btnExport.disabled = !roulette.isActive;

    if (roulette.levels.length > 0 && !roulette.hasCompleted && !roulette.givenUp) {
        const cur = roulette.currentLevel;
        document.getElementById('roulette-current-name').textContent = cur.name;
        document.getElementById('roulette-current-rank').textContent = `#${cur.rank} de la lista`;
        const input = document.getElementById('roulette-percent-input');
        input.min = roulette.currentPercentage + 1;
        input.placeholder = `Mínimo ${roulette.currentPercentage + 1}%`;
        currentPanel.style.display = 'block';
    } else {
        currentPanel.style.display = 'none';
    }

    if (roulette.levels.length === 0) {
        list.innerHTML = `<div class="roulette-empty"><p>Iniciá la ruleta para comenzar.</p></div>`;
        return;
    }

    let html = '';

    roulette.progression.forEach((pct, i) => {
        const lvl = roulette.levels[i];
        const thumb = rouletteGetThumb(lvl.video);
        html += `
            <div class="roulette-level roulette-level--done">
                ${thumb ? `<div class="roulette-level__thumb"><img src="${thumb}" alt="${lvl.name}"></div>` : ''}
                <div class="roulette-level__meta">
                    <span class="roulette-level__rank">#${lvl.rank}</span>
                    <span class="roulette-level__name">${lvl.name}</span>
                    <span class="roulette-level__pct roulette-level__pct--done">${pct}%</span>
                </div>
            </div>`;
    });

    if (!roulette.hasCompleted && !roulette.givenUp && roulette.currentLevel) {
        const cur = roulette.currentLevel;
        const thumb = rouletteGetThumb(cur.video);
        html += `
            <div class="roulette-level roulette-level--current">
                ${thumb ? `<div class="roulette-level__thumb"><img src="${thumb}" alt="${cur.name}"></div>` : ''}
                <div class="roulette-level__meta">
                    <span class="roulette-level__rank">#${cur.rank}</span>
                    <span class="roulette-level__name">${cur.name}</span>
                    <span class="roulette-level__pct">EN CURSO</span>
                </div>
            </div>`;
    }

    if (roulette.givenUp || roulette.hasCompleted) {
        html += `
            <div class="roulette-results">
                <h2>Resultados</h2>
                <p>Niveles completados: <strong>${roulette.progression.length}</strong></p>
                <p>Porcentaje más alto: <strong>${roulette.currentPercentage}%</strong></p>
                ${roulette.givenUp && roulette.currentPercentage < 99 ? `<button class="btn btn--secondary" onclick="rouletteToggleRemaining()">Ver niveles restantes</button>` : ''}
            </div>`;

        if (roulette.givenUp && roulette.showRemaining) {
            const remaining = roulette.levels.slice(roulette.progression.length + 1);
            remaining.forEach((lvl, i) => {
                const thumb = rouletteGetThumb(lvl.video);
                const pct = roulette.currentPercentage + 2 + i;
                html += `
                    <div class="roulette-level roulette-level--remaining">
                        ${thumb ? `<div class="roulette-level__thumb"><img src="${thumb}" alt="${lvl.name}"></div>` : ''}
                        <div class="roulette-level__meta">
                            <span class="roulette-level__rank">#${lvl.rank}</span>
                            <span class="roulette-level__name">${lvl.name}</span>
                            <span class="roulette-level__pct roulette-level__pct--fail">${pct}%</span>
                        </div>
                    </div>`;
            });
        }
    }

    list.innerHTML = html;
}

function rouletteToggleRemaining() {
    roulette.showRemaining = !roulette.showRemaining;
    rouletteRender();
}

(function initParallax() {
    const MAX_OFFSET = 20;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    document.addEventListener('mousemove', (e) => {
        const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        targetX = -nx * MAX_OFFSET;
        targetY = -ny * MAX_OFFSET;
    });
    function animate() {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;
        document.body.style.backgroundPosition =
            `calc(50% + ${currentX.toFixed(2)}px) calc(50% + ${currentY.toFixed(2)}px)`;
        requestAnimationFrame(animate);
    }
    animate();
})();

// ── Easter Egg: moment.ogg (2% de probabilidad global) ──────────────────
(function initEasterEgg() {
    const audio = new Audio('assets/img/moment.ogg');
    audio.preload = 'auto';

    function maybePlay() {
        if (Math.random() < 0.02) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    }

    // Captura clicks/taps en cualquier elemento interactuable
    document.addEventListener('click', (e) => {
        const el = e.target.closest('button, a, [onclick], input[type="button"], input[type="submit"], label, [role="button"], [tabindex]');
        if (el) maybePlay();
    }, true);

    // Soporte móvil táctil
    document.addEventListener('touchend', (e) => {
        const el = e.target.closest('button, a, [onclick], input[type="button"], input[type="submit"], label, [role="button"], [tabindex]');
        if (el) maybePlay();
    }, true);
})();

inicializarSitio();
document.addEventListener('DOMContentLoaded', rouletteInit);

// Ejecutar inmediatamente al cargar el archivo para abrir la sección correcta
// si usan un enlace directo. El listener de 'hashchange' que mantiene esto
// sincronizado en cambios posteriores ya está registrado más arriba, junto
// a handleHashRouting (único router del sitio).
handleHashRouting();
