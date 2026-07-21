// ── Herramienta oculta: Generador de JSON (#frk-mod-list) ───────────────
// Este archivo es completamente independiente del router de main.js
// (handleHashRouting) y no lo modifica ni interfiere con él. main.js ya
// activa/desactiva la sección #tab-frk-mod-list de forma genérica al
// detectar el hash; aquí solo nos encargamos de ocultar la navegación y
// demás elementos de interfaz cuando esa ruta está activa.
//
// En este paso no se implementa lógica de carga/descarga de JSON: solo
// se controla la visibilidad de la interfaz.

function actualizarModoModList() {
    const route = window.location.hash.replace('#', '').toLowerCase();
    document.body.classList.toggle('mod-list-active', route === 'frk-mod-list');
}

window.addEventListener('hashchange', actualizarModoModList);
document.addEventListener('DOMContentLoaded', actualizarModoModList);

// Ejecutar de inmediato por si la página se abre directamente con el hash
actualizarModoModList();

// ── Formulario: Creators y Records dinámicos ─────────────────────────
// Todavía SIN lógica de generación/descarga de JSON. Solo se encarga de
// que el usuario pueda añadir y quitar filas de Creators y bloques de
// Records sin tener que escribir jamás llaves, corchetes, comillas ni
// comas: cada campo es un input independiente.

function crearFilaCreator() {
    const fila = document.createElement('div');
    fila.className = 'modlist-creator-row';
    fila.setAttribute('data-creator-row', '');
    fila.innerHTML = `
        <input type="text" class="modlist-input modlist-creator-input" placeholder="Nombre del creator">
        <button type="button" class="modlist-remove-btn" data-remove-creator title="Eliminar creator">×</button>
    `;
    return fila;
}

function actualizarEstadoRemoveCreators() {
    const filas = document.querySelectorAll('#modlist-creators-list [data-creator-row]');
    filas.forEach(fila => {
        const btn = fila.querySelector('[data-remove-creator]');
        if (btn) btn.disabled = filas.length <= 1;
    });
}

function crearBloqueRecord(numero) {
    const bloque = document.createElement('div');
    bloque.className = 'modlist-record';
    bloque.setAttribute('data-record', '');
    bloque.innerHTML = `
        <div class="modlist-record__header">
            <span class="modlist-record__label" data-record-label>Record #${numero}</span>
            <button type="button" class="modlist-remove-btn" data-remove-record title="Eliminar record">×</button>
        </div>
        <div class="modlist-record__grid">
            <div class="modlist-field">
                <label class="modlist-label">User</label>
                <input type="text" class="modlist-input modlist-record-user">
            </div>
            <div class="modlist-field">
                <label class="modlist-label">Link</label>
                <input type="url" class="modlist-input modlist-record-link" placeholder="https://www.youtube.com/watch?v=...">
            </div>
            <div class="modlist-field">
                <label class="modlist-label">Percent</label>
                <input type="number" class="modlist-input modlist-record-percent" min="1" max="100">
            </div>
            <div class="modlist-field">
                <label class="modlist-label">Hz</label>
                <input type="number" class="modlist-input modlist-record-hz" min="0">
            </div>
        </div>
    `;
    return bloque;
}

function renumerarRecords() {
    const bloques = document.querySelectorAll('#modlist-records-list [data-record]');
    bloques.forEach((bloque, i) => {
        const label = bloque.querySelector('[data-record-label]');
        if (label) label.textContent = `Record #${i + 1}`;
        const btn = bloque.querySelector('[data-remove-record]');
        if (btn) btn.disabled = bloques.length <= 1;
    });
}

function inicializarFormularioModList() {
    const btnAddCreator = document.getElementById('modlist-btn-add-creator');
    const listaCreators = document.getElementById('modlist-creators-list');
    const btnAddRecord = document.getElementById('modlist-btn-add-record');
    const listaRecords = document.getElementById('modlist-records-list');

    if (!btnAddCreator || !listaCreators || !btnAddRecord || !listaRecords) return;

    btnAddCreator.addEventListener('click', () => {
        listaCreators.appendChild(crearFilaCreator());
        actualizarEstadoRemoveCreators();
    });

    listaCreators.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-creator]');
        if (!btn || btn.disabled) return;
        const filas = listaCreators.querySelectorAll('[data-creator-row]');
        if (filas.length <= 1) return; // Siempre debe quedar al menos un Creator
        btn.closest('[data-creator-row]').remove();
        actualizarEstadoRemoveCreators();
    });

    btnAddRecord.addEventListener('click', () => {
        const total = listaRecords.querySelectorAll('[data-record]').length;
        listaRecords.appendChild(crearBloqueRecord(total + 1));
        renumerarRecords();
        validarFormularioModList();
    });

    listaRecords.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-record]');
        if (!btn || btn.disabled) return;
        const bloques = listaRecords.querySelectorAll('[data-record]');
        if (bloques.length <= 1) return; // Siempre debe quedar al menos un Record
        btn.closest('[data-record]').remove();
        renumerarRecords();
        validarFormularioModList();
    });

    const btnDescargar = document.getElementById('modlist-btn-download');
    if (btnDescargar) {
        btnDescargar.addEventListener('click', descargarModListJSON);
    }

    const btnCargar = document.getElementById('modlist-btn-load');
    const inputArchivo = document.getElementById('modlist-file-input');
    if (btnCargar && inputArchivo) {
        btnCargar.addEventListener('click', () => inputArchivo.click());
        inputArchivo.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) cargarArchivoModList(file);
            e.target.value = ''; // permite volver a seleccionar el mismo archivo
        });
    }

    actualizarEstadoRemoveCreators();
    renumerarRecords();

    inicializarValidaciones();
}

document.addEventListener('DOMContentLoaded', inicializarFormularioModList);

// ── Validaciones ──────────────────────────────────────────────────────
// Reglas: el botón "Descargar JSON" solo se habilita cuando el nombre de
// archivo y todos los campos de "Datos generales" están completos, y
// además existe al menos un Record con sus 4 campos completos. Solo se
// usa un borde rojo/normal en cada input; no hay mensajes ni popups.

const MODLIST_CAMPOS_PRINCIPALES_IDS = [
    'modlist-filename',
    'modlist-id',
    'modlist-name',
    'modlist-author',
    'modlist-verifier',
    'modlist-verification',
    'modlist-percent',
    'modlist-password'
];

function marcarValidezInput(el, esValido) {
    if (!el) return;
    el.classList.toggle('modlist-input--invalid', !esValido);
}

function validarCamposPrincipales() {
    let todosValidos = true;
    MODLIST_CAMPOS_PRINCIPALES_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const valido = el.value.trim() !== '';
        marcarValidezInput(el, valido);
        if (!valido) todosValidos = false;
    });
    return todosValidos;
}

function validarRecords() {
    const bloques = document.querySelectorAll('#modlist-records-list [data-record]');
    let hayAlMenosUnoCompleto = false;

    bloques.forEach(bloque => {
        const inputs = bloque.querySelectorAll(
            '.modlist-record-user, .modlist-record-link, .modlist-record-percent, .modlist-record-hz'
        );
        let bloqueCompleto = true;
        inputs.forEach(input => {
            const valido = input.value.trim() !== '';
            marcarValidezInput(input, valido);
            if (!valido) bloqueCompleto = false;
        });
        if (bloqueCompleto) hayAlMenosUnoCompleto = true;
    });

    return hayAlMenosUnoCompleto;
}

function validarFormularioModList() {
    const principalesOk = validarCamposPrincipales();
    const recordsOk = validarRecords();

    const btnDescargar = document.getElementById('modlist-btn-download');
    if (btnDescargar) {
        btnDescargar.disabled = !(principalesOk && recordsOk);
    }
}

function inicializarValidaciones() {
    const form = document.getElementById('modlist-form');
    if (!form) return;

    // Delegación de eventos: cubre también los Records/Creators añadidos
    // dinámicamente después de este punto.
    form.addEventListener('input', validarFormularioModList);
    form.addEventListener('focusout', validarFormularioModList);

    // Estado inicial (con el único Record vacío, el botón queda deshabilitado)
    validarFormularioModList();
}

// ── Generación del archivo JSON ──────────────────────────────────────
// Reproduce EXACTAMENTE la estructura de damage.json: mismos nombres de
// propiedad y mismo orden. El usuario solo escribe valores en inputs; las
// llaves, corchetes, comillas, comas y dos puntos los genera JSON.stringify,
// nunca el usuario.

function obtenerValor(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

// Los Creators se toman en el orden en que aparecen en el DOM, ignorando
// filas vacías (p. ej. si el usuario añadió una fila de más sin rellenar).
function obtenerCreators() {
    return Array.from(document.querySelectorAll('#modlist-creators-list .modlist-creator-input'))
        .map(input => input.value.trim())
        .filter(valor => valor !== '');
}

// Solo se incluyen los Records completamente rellenados (User, Link,
// Percent y Hz); un bloque a medias simplemente no forma parte del JSON.
function obtenerRecords() {
    return Array.from(document.querySelectorAll('#modlist-records-list [data-record]'))
        .map(bloque => ({
            user: bloque.querySelector('.modlist-record-user').value.trim(),
            link: bloque.querySelector('.modlist-record-link').value.trim(),
            percent: bloque.querySelector('.modlist-record-percent').value.trim(),
            hz: bloque.querySelector('.modlist-record-hz').value.trim()
        }))
        .filter(r => r.user !== '' && r.link !== '' && r.percent !== '' && r.hz !== '')
        .map(r => ({
            user: r.user,
            link: r.link,
            percent: Number(r.percent),
            hz: Number(r.hz)
        }));
}

// Construye el objeto con las mismas claves y el mismo orden que damage.json.
// "id" es numérico, "percentToQualify" es string (igual que en la plantilla,
// donde aparece como "100" entre comillas), y el resto de campos de texto
// se guardan tal cual los escribió el usuario.
function construirDatosModList() {
    return {
        id: Number(obtenerValor('modlist-id')),
        name: obtenerValor('modlist-name'),
        author: obtenerValor('modlist-author'),
        creators: obtenerCreators(),
        verifier: obtenerValor('modlist-verifier'),
        verification: obtenerValor('modlist-verification'),
        percentToQualify: obtenerValor('modlist-percent'),
        password: obtenerValor('modlist-password'),
        records: obtenerRecords()
    };
}

// Garantiza que el archivo descargado termine siempre en ".json",
// sin importar lo que haya escrito el usuario en "Nombre del archivo".
function construirNombreArchivo() {
    let nombre = obtenerValor('modlist-filename');
    if (!nombre) nombre = 'level';
    if (!/\.json$/i.test(nombre)) nombre += '.json';
    return nombre;
}

function descargarModListJSON() {
    // Revalidación de seguridad: si por algún motivo el formulario ya no
    // es válido (p. ej. el usuario vació un campo justo antes del click),
    // no se genera ni descarga nada.
    validarFormularioModList();
    const btnDescargar = document.getElementById('modlist-btn-download');
    if (btnDescargar && btnDescargar.disabled) return;

    const datos = construirDatosModList();
    const contenido = JSON.stringify(datos, null, 4);

    const blob = new Blob([contenido], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = construirNombreArchivo();
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

// ── Carga de archivo (Cargar archivo) ────────────────────────────────
// Lee un .json con la misma estructura que damage.json, rellena todos los
// campos y reconstruye Creators/Records según lo encontrado. A partir de
// ahí el usuario puede modificar cualquier valor, añadir o eliminar
// Records/Creators igual que si los hubiera creado a mano, y volver a
// descargar el resultado.

// Comprobación mínima de que el archivo tiene la forma esperada, sin ser
// estricta con tipos (por si algún campo viene como número/string distinto).
function esEstructuraModListValida(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const clavesEsperadas = ['id', 'name', 'author', 'creators', 'verifier', 'verification', 'percentToQualify', 'password', 'records'];
    const tieneClavesBase = clavesEsperadas.some(clave => Object.prototype.hasOwnProperty.call(data, clave));
    if (!tieneClavesBase) return false;
    if (data.records !== undefined && !Array.isArray(data.records)) return false;
    if (data.creators !== undefined && !Array.isArray(data.creators)) return false;
    return true;
}

function establecerValor(id, valor) {
    const el = document.getElementById(id);
    if (el) el.value = (valor === undefined || valor === null) ? '' : String(valor);
}

// Vacía la lista de Creators y la reconstruye con los valores del archivo
// cargado. Si el archivo no trae ninguno, deja una fila vacía (mínimo 1).
function reconstruirCreators(creators) {
    const lista = document.getElementById('modlist-creators-list');
    if (!lista) return;
    lista.innerHTML = '';

    const valores = Array.isArray(creators) && creators.length > 0 ? creators : [''];
    valores.forEach(valor => {
        const fila = crearFilaCreator();
        const input = fila.querySelector('.modlist-creator-input');
        if (input) input.value = valor || '';
        lista.appendChild(fila);
    });

    actualizarEstadoRemoveCreators();
}

// Vacía la lista de Records y la reconstruye con los del archivo cargado.
// Si no trae ninguno, deja un bloque vacío (mínimo 1), igual que al iniciar
// la herramienta desde cero.
function reconstruirRecords(records) {
    const lista = document.getElementById('modlist-records-list');
    if (!lista) return;
    lista.innerHTML = '';

    const valores = Array.isArray(records) && records.length > 0 ? records : [{}];
    valores.forEach((record, i) => {
        const bloque = crearBloqueRecord(i + 1);
        bloque.querySelector('.modlist-record-user').value = record.user ?? '';
        bloque.querySelector('.modlist-record-link').value = record.link ?? '';
        bloque.querySelector('.modlist-record-percent').value = record.percent ?? '';
        bloque.querySelector('.modlist-record-hz').value = record.hz ?? '';
        lista.appendChild(bloque);
    });

    renumerarRecords();
}

// El nombre de archivo se rellena a partir del propio archivo seleccionado
// (sin la extensión .json), listo para volver a descargarse con el mismo
// nombre tras modificarlo.
function establecerNombreArchivoDesdeFile(file) {
    const el = document.getElementById('modlist-filename');
    if (!el) return;
    el.value = file.name.replace(/\.json$/i, '');
}

function rellenarFormularioConDatos(data, file) {
    establecerNombreArchivoDesdeFile(file);
    establecerValor('modlist-id', data.id);
    establecerValor('modlist-name', data.name);
    establecerValor('modlist-author', data.author);
    establecerValor('modlist-verifier', data.verifier);
    establecerValor('modlist-verification', data.verification);
    establecerValor('modlist-percent', data.percentToQualify);
    establecerValor('modlist-password', data.password);

    reconstruirCreators(data.creators);
    reconstruirRecords(data.records);

    validarFormularioModList();
}

async function cargarArchivoModList(file) {
    // Solo se aceptan archivos .json (el <input accept=".json"> ya filtra
    // en el selector, pero se revalida aquí por si el navegador lo permite).
    if (!/\.json$/i.test(file.name)) return;

    let data;
    try {
        const texto = await file.text();
        data = JSON.parse(texto);
    } catch (err) {
        console.warn('No se pudo leer el archivo como JSON válido.', err);
        return;
    }

    if (!esEstructuraModListValida(data)) {
        console.warn('El archivo no tiene la estructura esperada para esta herramienta.');
        return;
    }

    rellenarFormularioConDatos(data, file);
}
