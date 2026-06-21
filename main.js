let globalLevels = [];
let globalLeaderboard = [];
let legacyMode = false;
let currentDetailLevelId = null;

// Top 1-150 = vista principal, Top 151+ = vista Legacy (oculta por defecto, pero ya cargada)
const LEGACY_THRESHOLD = 150;

function getVisibleLevels(levels) {
    return legacyMode
        ? levels.filter(n => n.rank > LEGACY_THRESHOLD)
        : levels.filter(n => n.rank <= LEGACY_THRESHOLD);
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
        if (primerNivelVisible) mostrarDetallesNivel(primerNivelVisible.id);
    }
}

// Sistema de puntos: Top 1 = 500.00, Top 150 = 14.50, curva exponencial progresiva
// entre medio, y 0.01 fijo para cualquier posición fuera del Top 150.
function getMaxPointsForPosition(topPosition) {
    if (topPosition <= 1) return 500;
    if (topPosition >= 150) return topPosition === 150 ? 14.5 : 0.01;
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

// Centraliza la navegación leyendo directamente el hash de la URL
function switchTabByHash() {
    const hash = window.location.hash.replace('#', '') || 'list';
    
    // Mapeo de hashes a los IDs de las secciones <section>
    const routes = {
        'list': 'tab-list',
        'leaderboard': 'tab-leaderboard',
        'roulette': 'tab-roulette',
        'frk-dm': 'tab-frk-dm',
        'challenges': 'tab-frk-dm' // Soporte por si decides usar #challenges para la sección FRK-DM
    };
    
    const targetTabId = routes[hash] || 'tab-list';
    const targetRouteName = (hash === 'challenges') ? 'frk-dm' : (routes[hash] ? hash : 'list');

    // Desactivar visualmente todas las secciones y botones
    document.querySelectorAll('.main-content').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav__link-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar la sección correspondiente
    const targetSection = document.getElementById(targetTabId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Activar el botón del menú correspondiente usando el data-route
    const targetBtn = document.querySelector(`.nav__link-btn[data-route="${targetRouteName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// ── SISTEMA DE ENRUTAMIENTO DINÁMICO Y ESCALABLE ──────────────────────

function handleHashRouting() {
    // 1. Extraer el identificador del hash actual (ej: '#roulette' -> 'roulette')
    let route = window.location.hash.replace('#', '').toLowerCase();
    if (!route) route = 'list'; // Por defecto, si está vacío va a 'list'

    // Excepción única por si usas el alias heredado '#challenges' para la sección frk-dm
    if (route === 'challenges') route = 'frk-dm';

    // 2. Construir dinámicamente el ID de la sección que deberíamos buscar
    const targetSectionId = `tab-${route}`;
    let targetSection = document.getElementById(targetSectionId);

    // Redirección de seguridad: Si el hash inventariado no existe en el HTML, volver a la lista principal
    if (!targetSection) {
        route = 'list';
        targetSection = document.getElementById('tab-list');
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

async function inicializarSitio() {
    try {
        // A) Leer el índice maestro de niveles
        const resListIndex = await fetch('data-lvl/_list.json');
        const listaNombres = await resListIndex.json(); 

        const bugs = [];

        const promesasNiveles = listaNombres.map(async (nombreArchivo, index) => {
            try {
                const resNivel = await fetch(`data-lvl/${nombreArchivo}.json`);
                if (!resNivel.ok) throw new Error(`No se pudo cargar ${nombreArchivo}.json`);
                const datosNivel = await resNivel.json();

                if (!datosNivel.id || !datosNivel.name) {
                    bugs.push({
                        file: `${nombreArchivo}.json`,
                        reason: 'Falta "id" o "name" en el archivo (se usaron valores de respaldo para la leaderboard).'
                    });
    // Asignamos datos mínimos de respaldo para que la leaderboard pueda leer los récords sin romperse
                    if (!datosNivel.id) datosNivel.id = `id_${nombreArchivo}`;
                    if (!datosNivel.name) datosNivel.name = nombreArchivo;
                }

                datosNivel.rank = index + 1;
                datosNivel._file = `${nombreArchivo}.json`;

                if (Array.isArray(datosNivel.records) && datosNivel.records.length === 0) {
                    bugs.push({
                        file: `${nombreArchivo}.json`,
                        reason: `${nombreArchivo}.json no tiene un record registrado.`
                    });
                }

                return datosNivel;
            } catch (err) {
                console.warn(`Error al cargar el nivel individual: ${nombreArchivo}`, err);
                bugs.push({
                    file: `${nombreArchivo}.json`,
                    reason: 'Código mal ejecutado o archivo no encontrado.'
                });
                return null;
            }
        });

        const nivelesCargados = await Promise.all(promesasNiveles);
        globalLevels = nivelesCargados.filter(n => n !== null);

        // Detección de IDs duplicadas entre los niveles cargados correctamente
        const idMap = {};
        globalLevels.forEach(nivel => {
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

        renderBugTab(bugs);

        renderLeaderboard();

        renderSidebar();

        const searchInput = document.getElementById('level-search');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterLevels(e.target.value);
            });
        }

        const legacyToggleBtn = document.getElementById('legacy-toggle');
        if (legacyToggleBtn) {
            legacyToggleBtn.addEventListener('click', toggleLegacyMode);
        }

        if (globalLevels.length > 0) {
            mostrarDetallesNivel(globalLevels[0].id);
        }

        // Inicializar la sección FRK-DM
        await inicializarFrkDm();

    } catch (error) {
        console.error("Error crítico al inicializar la estructura dinámica data-lvl:", error);
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

function renderSidebar() {
    const sidebar = document.getElementById('levels-sidebar');
    sidebar.innerHTML = '';

    const nivelesVisibles = getVisibleLevels(globalLevels);

    nivelesVisibles.forEach(nivel => {
        const item = document.createElement('div');
        item.className = 'card level-card'; 
        item.id = `sidebar-item-${nivel.id}`;
        item.style.marginBottom = 'var(--space-3)';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = 'var(--space-4)';
        item.style.padding = 'var(--space-4)';
        
        item.onclick = () => mostrarDetallesNivel(nivel.id);

        item.innerHTML = `
            <div class="text-accent text-mono" style="font-size: 1.3rem; font-weight: 700; min-width: 45px;">#${nivel.rank}</div>
            <div style="flex: 1;">
                <div class="text-display" style="font-weight: 600; font-size: 1.15rem; color: var(--text-primary); line-height: 1.2;">${nivel.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">por ${nivel.author || nivel.creators[0]}</div>
            </div>
        `;
        sidebar.appendChild(item);
    });
}

function filterLevels(searchTerm) {
    const sidebar = document.getElementById('levels-sidebar');

    sidebar.innerHTML = '';

    const term = searchTerm.toLowerCase().trim();

    const filteredLevels = getVisibleLevels(globalLevels).filter(level => {
        if (level.name.toLowerCase().includes(term)) return true;
        if (level.author && level.author.toLowerCase().includes(term)) return true;
        if (level.verifier && level.verifier.toLowerCase().includes(term)) return true;
        if (level.creators && level.creators.some(c => c.toLowerCase().includes(term))) return true;
        if (level.records && level.records.some(r => r.user && r.user.toLowerCase().includes(term))) return true;
        return false;
    });

    filteredLevels.forEach(nivel => {
        const item = document.createElement('div');

        item.className = 'card level-card';
        item.id = `sidebar-item-${nivel.id}`;

        item.style.marginBottom = 'var(--space-3)';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = 'var(--space-4)';
        item.style.padding = 'var(--space-4)';

        item.onclick = () => mostrarDetallesNivel(nivel.id);

        item.innerHTML = `
            <div class="text-accent text-mono"
                 style="font-size:1.3rem;font-weight:700;min-width:45px;">
                 #${nivel.rank}
            </div>

            <div style="flex:1;">
                <div class="text-display"
                     style="font-weight:600;font-size:1.15rem;color:var(--text-primary);line-height:1.2;">
                     ${nivel.name}
                </div>

                <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">
                    por ${nivel.author || nivel.creators[0]}
                </div>
            </div>
        `;

        sidebar.appendChild(item);
    });
}

function mostrarDetallesNivel(idNivel) {
    document.querySelectorAll('.level-card').forEach(el => el.classList.remove('active'));
    const activeItem = document.getElementById(`sidebar-item-${idNivel}`);
    if (activeItem) activeItem.classList.add('active');

    const nivel = globalLevels.find(n => n.id === idNivel);
    const detailPanel = document.getElementById('level-details');

    if (!nivel) return;

    currentDetailLevelId = idNivel;

    let youtubeId = "";
    if (nivel.verification) {
        if (nivel.verification.includes("v=")) {
            youtubeId = nivel.verification.split("v=")[1].split("&")[0];
        } else if (nivel.verification.includes("youtu.be/")) {
            youtubeId = nivel.verification.split("youtu.be/")[1].split("?")[0];
        }
    }

    const puntosCalculados = getMaxPointsForPosition(nivel.rank).toFixed(2);

    let recordsHTML = `
        <div style="background: var(--bg-base); padding: var(--space-4); border-radius: var(--radius-md); border: 1px dashed var(--border); text-align: center;">
            <p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic; margin: 0;">No se han validado récords adicionales para este nivel todavía.</p>
        </div>
    `;

    if (nivel.records && nivel.records.length > 0) {
        recordsHTML = `<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);">`;
        nivel.records.forEach(rec => {
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

    detailPanel.innerHTML = `
        <div class="card" style="padding: var(--space-6); background: var(--bg-surface); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
            <div style="margin-bottom: var(--space-4);">
                <h1 class="text-display" style="font-size: 2.5rem; margin: 0; font-weight: 700; color: var(--text-primary);">${nivel.name}</h1>
                <p style="font-size: 0.95rem; color: var(--text-secondary); margin: var(--space-1) 0 0 0;">
                    Creado por <span class="text-accent" style="font-weight: 600;">${nivel.creators ? nivel.creators.join(', ') : nivel.author}</span> — Verificado por <span class="text-cyan" style="font-weight: 600;">${nivel.verifier}</span>
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

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6);">
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
                <h3 class="text-display" style="font-size: 1.2rem; margin-bottom: var(--space-3); border-bottom: 1px solid var(--border); padding-bottom: var(--space-2);">Records Registrados (${nivel.records ? nivel.records.length : 0})</h3>
                ${recordsHTML}
            </div>
        </div>
    `;
}

function openPlayerModal(playerData) {
    // ── Easter Egg: TheGlaiCat audio (45% de probabilidad) ──
    if (playerData.name.trim().toLowerCase() === 'theglaicat' && Math.random() < 0.45) {
        const _cata = new Audio('assets/img/cata.mp3');
        _cata.play().catch(() => {});
    }

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
                onclick="showCompletedLevels('${playerData.name}')"
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

function showCompletedLevels(playerName) {

    const player = window.leaderboardPlayers.find(
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

function renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;

    const playerRegistry = {};

globalLevels.forEach(nivel => {
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

    if (rankedPlayers.length === 0) {
        container.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);">
                No se encontraron récords registrados en la lista todavía.
            </div>`;
        return;
    }

    // Store players globally for modal
    window.leaderboardPlayers = rankedPlayers;

    // MOBILE VERSION
    let htmlMobile = `<div class="leaderboard-mobile">`;
    rankedPlayers.forEach((player, idx) => {
        const rank = idx + 1;
        htmlMobile += `
            <div class="leaderboard-mobile-row" onclick="openPlayerModal(window.leaderboardPlayers[${idx}])">
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
                onclick='openPlayerModal(window.leaderboardPlayers[${idx}])'
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

    container.innerHTML = htmlMobile + htmlTable;
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
// Escuchar cuando el usuario cambia el hash manualmente o usa las flechas del navegador
window.addEventListener('hashchange', switchTabByHash);

// Ejecutar inmediatamente al cargar el archivo para abrir la sección correcta si usan un enlace directo
switchTabByHash();