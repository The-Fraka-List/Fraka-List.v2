let fdmPublicacionesGlobales = [];


async function inicializarFrkDm() {
    const contenedorTab = document.getElementById('tab-frk-dm');
    if (!contenedorTab) return;

    contenedorTab.innerHTML = `
        <div style="text-align:center; padding: var(--space-12); color: var(--text-muted); font-family: var(--font-mono);">
            Cargando publicaciones de FRK-DM...
        </div>
    `;

    try {
        const respuestaIndice = await fetch('fdm-arch/_list.json');
        if (!respuestaIndice.ok) throw new Error('No se pudo acceder al índice');
        const listaArchivos = await respuestaIndice.json();

        fdmPublicacionesGlobales = []; 

        for (const nombreArchivo of listaArchivos) {
            try {
                const respuestaMes = await fetch(`fdm-arch/${nombreArchivo}.json`);
                if (!respuestaMes.ok) continue;
                const publicaciones = await respuestaMes.json();
                
                publicaciones.forEach((post, index) => {
                    if (!post.id) post.id = `${nombreArchivo}-${index}`;
                    fdmPublicacionesGlobales.push(post);
                });
            } catch (e) {
                console.error(`Error cargando ${nombreArchivo}:`, e);
            }
        }

        mostrarListaPosts();

    } catch (error) {
        console.error('Error en FRK-DM:', error);
        contenedorTab.innerHTML = `
            <div style="text-align:center; padding: var(--space-12); color: #ef4444; font-family: var(--font-mono);">
                ❌ Error al cargar las publicaciones.
            </div>
        `;
    }
}


function mostrarListaPosts() {
    const contenedorTab = document.getElementById('tab-frk-dm');
    let htmlContenido = '<div class="fdm-layout">';

    fdmPublicacionesGlobales.forEach(post => {
        const bannerHTML = post.banner ? `<img src="${post.banner}" class="fdm-card__banner" style="width:100%; display:block;">` : '';
        
        htmlContenido += `
            <article class="card fdm-card" onclick="mostrarDetallePost('${post.id}')" style="cursor:pointer;">
                ${bannerHTML}
                <div class="fdm-card__content">
                    <h2 class="fdm-card__title">${post.title}</h2>
                    ${post.subtitle ? `<p class="fdm-card__subtitle">${post.subtitle}</p>` : ''}
                    ${post.winner ? `<p class="fdm-card__winner">🏆 Ganador: <strong>${post.winner}</strong></p>` : ''}
                </div>
            </article>
        `;
    });

    htmlContenido += '</div>';
    contenedorTab.innerHTML = htmlContenido;
}


function mostrarDetallePost(postId) {
    const contenedorTab = document.getElementById('tab-frk-dm');
    const post = fdmPublicacionesGlobales.find(p => p.id === postId);

    if (!post) return;

    const bannerHTML = post.banner 
        ? `<div class="fdm-detail__banner-container">
            <img src="${post.banner}" alt="${post.title}" class="fdm-detail__banner">
           </div>` 
        : '';

    let top4HTML = '';
    if (post.top4 && post.top4.length > 0) {
        top4HTML = `
            <div class="fdm-detail__top4-container">
                <h3 class="fdm-detail__section-title">Top 4 de la Edición</h3>
                <ol class="fdm-detail__top4-list">
                    ${post.top4.map((jugador, i) => `<li><strong>#${i + 1}</strong> ${jugador}</li>`).join('')}
                </ol>
            </div>
        `;
    } else if (post.winner) {
        top4HTML = `
            <div class="fdm-detail__top4-container">
                <h3 class="fdm-detail__section-title">Podio</h3>
                <p>🏆 Ganador indiscutido: <strong>${post.winner}</strong></p>
            </div>
        `;
    }

    const votacionesHTML = post.votes && post.votes.length > 0
        ? `<div class="fdm-detail__votes-container">
            <h3 class="fdm-detail__section-title">Resultado de Votaciones</h3>
            <ul class="fdm-detail__votes-list">
                ${post.votes.map(v => `<li><span class="fdm-detail__voter">${v.voter}:</span> <span class="fdm-detail__score">${v.score}/10</span></li>`).join('')}
            </ul>
           </div>`
        : '';

    let videoHTML = '';
    if (post.video) {
        const videoId = obtenerYouTubeId(post.video);
        if (videoId) {
            videoHTML = `
                <div class="fdm-detail__video-container">
                    <h3 class="fdm-detail__section-title">Video / Review</h3>
                    <div class="fdm-detail__iframe-wrapper">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}" 
                            title="YouTube video player" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            `;
        }
    }

    contenedorTab.innerHTML = `
        <div class="fdm-detail">
            <article class="card fdm-detail__card" style="position: relative;">
                <button class="fdm-detail__close-btn" onclick="mostrarListaPosts()">×</button>
                
                ${bannerHTML}

                <div class="fdm-detail__header">
                    <h1 class="fdm-detail__title">${post.title}</h1>
                    ${post.subtitle ? `<p class="fdm-detail__subtitle">${post.subtitle}</p>` : ''}
                </div>

                <div class="fdm-detail__body">
                    ${top4HTML}

                    <div class="fdm-detail__motivos-container">
                        <h3 class="fdm-detail__section-title">Motivos de Elección / Crónica</h3>
                        <p class="fdm-detail__info-text">${post.info || ''}</p>
                        ${post.subinfo ? `<p class="fdm-detail__subinfo-text">${post.subinfo}</p>` : ''}
                    </div>
                </div>

                ${votacionesHTML}
                ${videoHTML}
            </article>
        </div>
    `;
}


function obtenerYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
