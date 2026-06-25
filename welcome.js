// ══════════════════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE LA PANTALLA DE BIENVENIDA
//  Editá este bloque para cambiar textos, nombres y enlaces.
//  No necesitás tocar nada más abajo de la línea de separación.
// ══════════════════════════════════════════════════════════════════════════════

const WELCOME_CONFIG = {

    // ── Descripción principal ───────────────────────────────────────────────
    descripcion: `Una lista la cual recopila record EXTREMES que se pasa los miembros del Fraka Clan.
Cada nivel es verificado y clasificado por dificultad real, construida por y para la comunidad.
Solamente se mete los RECORDS de las personas activas y que tengan el rol FRAKA VIP dentro del server. Si dejas de ser activo y pierdes ese ROL tus records dejarán de aparecer en la LISTA y LEADERBOARD.`,

    // ── Texto del botón que lleva a la lista ────────────────────────────────
    botonLista: 'Ver la Lista',

    // ── Owners de la lista ─────────────────────────────────────────────────
    // url: opcional. Si está vacío o null, la tarjeta no es clickeable.
    owners: [
        { nombre: 'TheGlaiCat',    url: 'https://twitch.tv/theglaicat' },
        { nombre: 'xReizer',  url: 'https://www.twitch.tv/xreizer_8' },
        { nombre: 'Kepta_bb',  url: 'https://www.twitch.tv/kepta_bb' },
        { nombre: 'S3b4s506_',  url: 'https://twitch.tv/sebastianrm506' },
    ],

    // ── Editores de la lista ────────────────────────────────────────────────
    editores: [
        { nombre: 'Hanky_rawr', url: null },
        { nombre: 'Fiumba',      url: null },
        { nombre: 'Aku',      url: null },
    ],

    // ── Listas de referencia ────────────────────────────────────────────────
    // imagen: ruta relativa al archivo de imagen (desde la raíz del sitio).
    // Las listas en las que se basa la Fraka List para su sistema de puntos / criterios.
    listas: [
        {
            nombre: 'AREDL',
            url: 'https://aredl.net/',
            imagen: 'assets/img/AREDL.webp',
            descripcion: 'The All Rated Extreme Demons List (AREDL).',
        }
    ],
};

// ══════════════════════════════════════════════════════════════════════════════
//  RENDERIZADO — no necesitás editar nada debajo de esta línea
// ══════════════════════════════════════════════════════════════════════════════

(function renderWelcome() {

    // Genera la inicial del nombre para el avatar
    function inicial(nombre) {
        return nombre.trim().charAt(0).toUpperCase();
    }

    // Genera una tarjeta de persona (owner o editor)
    function personaHTML(persona, rol) {
        const tieneLink = persona.url && persona.url.trim() !== '';
        const tag       = tieneLink ? 'a' : 'div';
        const href      = tieneLink ? `href="${persona.url}" target="_blank" rel="noopener noreferrer"` : '';
        const noLink    = tieneLink ? '' : 'welcome-person--no-link';

        return `
            <${tag} ${href} class="welcome-person ${noLink}" aria-label="${persona.nombre}">
                <div class="welcome-person__avatar">${inicial(persona.nombre)}</div>
                <span class="welcome-person__role">${rol}</span>
                <span class="welcome-person__name">${persona.nombre}</span>
            </${tag}>
        `;
    }

    // Genera una tarjeta de lista de referencia
    function listaHTML(lista) {
        return `
            <a href="${lista.url}"
               target="_blank"
               rel="noopener noreferrer"
               class="welcome-list-card"
               aria-label="Ir a ${lista.nombre}">
                <img src="${lista.imagen}"
                     alt="${lista.nombre}"
                     class="welcome-list-card__img">
                <span class="welcome-list-card__name">${lista.nombre}</span>
                <p class="welcome-list-card__desc">${lista.descripcion}</p>
                <span class="welcome-list-card__arrow">Visitar ↗</span>
            </a>
        `;
    }

    // Construye el HTML de la sección de personas (owners + editores unidos)
    const todasLasPersonas = [
        ...WELCOME_CONFIG.owners.map(p => ({ ...p, rol: 'Owner' })),
        ...WELCOME_CONFIG.editores.map(p => ({ ...p, rol: 'Editor' })),
    ];

    const personasHTML = todasLasPersonas.map(p => personaHTML(p, p.rol)).join('');
    const listasHTML   = WELCOME_CONFIG.listas.map(listaHTML).join('');

    // Descripción: preserva saltos de línea como párrafos
    const parrafos = WELCOME_CONFIG.descripcion
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => `<p class="welcome-hero__desc">${l}</p>`)
        .join('');

    const section = document.getElementById('tab-welcome');
    if (!section) return;

    section.innerHTML = `

        <!-- ── Hero ─────────────────────────────────────────────────────── -->
        <div class="welcome-hero">
            <span class="welcome-hero__eyebrow">Fraka List · GD Community</span>
            <h1 class="welcome-hero__title">
                THE <span>FRAKA</span> LIST
            </h1>
            ${parrafos}
            <div class="welcome-hero__actions">
                <button
                    class="btn btn--primary"
                    onclick="window.location.hash='list'"
                    aria-label="${WELCOME_CONFIG.botonLista}">
                    ${WELCOME_CONFIG.botonLista} →
                </button>
                <button
                    class="btn btn--secondary"
                    onclick="window.location.hash='leaderboard'"
                    aria-label="Ver Leaderboard">
                    Leaderboard
                </button>
            </div>
        </div>

        <!-- ── Owners & Editores ─────────────────────────────────────────── -->
        <div class="welcome-section">
            <div class="welcome-section__header">
                <span class="welcome-section__label">Equipo</span>
                <div class="welcome-section__line"></div>
            </div>
            <div class="welcome-people-grid">
                ${personasHTML}
            </div>
        </div>

        <!-- ── Listas de referencia ──────────────────────────────────────── -->
        <div class="welcome-section">
            <div class="welcome-section__header">
                <span class="welcome-section__label">Nos basamos en</span>
                <div class="welcome-section__line"></div>
            </div>
            <div class="welcome-lists-grid">
                ${listasHTML}
            </div>
        </div>

    `;
})();
