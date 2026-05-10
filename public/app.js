// app.js – Lógica del frontend con fetch() y JWT

// ============================================================
// HELPERS DE AUTENTICACIÓN
// ============================================================
const getToken  = ()    => localStorage.getItem('eh_token');
const setToken  = (t)   => localStorage.setItem('eh_token', t);
const delToken  = ()    => localStorage.removeItem('eh_token');
const getUser   = ()    => JSON.parse(localStorage.getItem('eh_user') || 'null');
const setUser   = (u)   => localStorage.setItem('eh_user', JSON.stringify(u));
const delUser   = ()    => localStorage.removeItem('eh_user');

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.classList.remove('hidden');
}
function hideMsg(elId) {
    document.getElementById(elId)?.classList.add('hidden');
}

// ============================================================
// AUTH
// ============================================================

async function handleLogin() {
    hideMsg('login-error');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showError('login-error', 'Completá email y contraseña');
        return;
    }

    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError('login-error', data.error || 'Error al iniciar sesión');
            return;
        }

        setToken(data.token);
        setUser(data.usuario);
        irAlDashboard(data.usuario);

    } catch {
        showError('login-error', 'No se pudo conectar al servidor');
    }
}

async function handleRegister() {
    hideMsg('reg-error');
    hideMsg('reg-ok');
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!nombre || !email || !password) {
        showError('reg-error', 'Completá todos los campos');
        return;
    }
    if (password.length < 6) {
        showError('reg-error', 'La contraseña debe tener al menos 6 caracteres');
        return;
    }

    try {
        const res  = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError('reg-error', data.error || 'Error al registrarse');
            return;
        }

        const okEl = document.getElementById('reg-ok');
        okEl.textContent = '✅ Cuenta creada. Ya podés iniciar sesión.';
        okEl.classList.remove('hidden');
        ['reg-nombre','reg-email','reg-password'].forEach(id =>
            document.getElementById(id).value = ''
        );
    } catch {
        showError('reg-error', 'No se pudo conectar al servidor');
    }
}

function handleLogout() {
    delToken(); delUser();
    _misInscripciones = new Set();
    showScreen('screen-login');
}

function irAlDashboard(usuario) {
    document.getElementById('nav-username').textContent = usuario.nombre;
    showScreen('screen-dashboard');
    cargarTodo();
}

// ============================================================
// CARGAR DATOS
// ============================================================

// IDs de eventos en los que el usuario logueado está inscripto
let _misInscripciones = new Set();

async function cargarTodo() {
    await Promise.all([cargarMisInscripciones(), cargarCategorias(), cargarOrganizadores()]);
    await cargarEventos();
}

async function cargarMisInscripciones() {
    try {
        const res = await fetch('/api/eventos/mis-inscripciones', { headers: authHeaders() });
        if (!res.ok) return;
        const ids = await res.json();
        _misInscripciones = new Set(ids);
    } catch {}
}

async function cargarEventos() {
    const grid = document.getElementById('eventos-grid');
    grid.innerHTML = '<p class="loading-msg">Cargando eventos...</p>';

    try {
        const res = await fetch('/api/eventos', { headers: authHeaders() });

        if (res.status === 401 || res.status === 403) { handleLogout(); return; }

        const eventos = await res.json();
        actualizarStats(eventos);
        renderizarEventos(eventos);
    } catch {
        grid.innerHTML = '<p class="loading-msg" style="color:var(--red)">Error al cargar los eventos</p>';
    }
}

function actualizarStats(eventos) {
    document.getElementById('stat-total').textContent      = eventos.length;
    document.getElementById('stat-activos').textContent    = eventos.filter(e => e.estado === 'activo').length;
    document.getElementById('stat-cancelados').textContent = eventos.filter(e => e.estado === 'cancelado').length;
    const totalInscriptos = eventos.reduce((acc, e) => acc + (e.capacidad - e.cupos_disponibles), 0);
    document.getElementById('stat-inscriptos').textContent = totalInscriptos;
}

function renderizarEventos(eventos) {
    const grid = document.getElementById('eventos-grid');
    if (eventos.length === 0) {
        grid.innerHTML = '<p class="loading-msg">No hay eventos registrados. ¡Creá el primero!</p>';
        return;
    }

    grid.innerHTML = eventos.map(e => {
        const inscriptos   = e.capacidad - e.cupos_disponibles;
        const pct          = Math.round((inscriptos / e.capacidad) * 100);
        const barClass     = pct >= 90 ? 'full' : pct >= 70 ? 'warn' : '';
        const fechaFormato = new Date(e.fecha_inicio).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const precioTexto  = parseFloat(e.precio) === 0 ? 'Gratis' : `$${parseFloat(e.precio).toLocaleString('es-AR')}`;
        const yaInscripto  = _misInscripciones.has(e.id);

        return `
        <div class="evento-card">
          <div class="card-header">
            <div>
              <div class="card-title">${e.titulo}</div>
              ${e.categoria ? `<span class="cat-badge" style="margin-top:6px;display:inline-block">${e.categoria}</span>` : ''}
            </div>
            <span class="badge badge-${e.estado}">${e.estado}</span>
          </div>
          <div class="card-body">
            <div class="card-meta"><span class="card-meta-icon">📅</span> ${fechaFormato}</div>
            <div class="card-meta"><span class="card-meta-icon">📍</span> ${e.lugar}</div>
            <div class="card-meta"><span class="card-meta-icon">🎤</span> ${e.organizador || 'Sin organizador'}</div>
            <div class="card-meta"><span class="card-meta-icon">💰</span> ${precioTexto}</div>
            <div class="card-cupos">
              <span class="cupos-text">${inscriptos}/${e.capacidad}</span>
              <div class="cupos-bar-wrap">
                <div class="cupos-bar ${barClass}" style="width:${pct}%"></div>
              </div>
              <span class="cupos-text">${e.cupos_disponibles} cupos</span>
            </div>
          </div>
          <div class="card-footer">
            ${yaInscripto
                ? `<button class="btn-xs" style="color:var(--red)" onclick="cancelarMiInscripcion(${e.id})">↩️ Cancelar inscripción</button>`
                : `<button class="btn-xs" onclick="inscribirse(${e.id})">✋ Inscribirme</button>`
            }
            <button class="btn-xs" onclick="verInscriptos(${e.id}, '${e.titulo.replace(/'/g,"\\'")}')">👥 Ver inscriptos</button>
            <button class="btn-xs" onclick="abrirModalEditar(${e.id})">✏️ Editar</button>
            <button class="btn-xs" style="color:var(--red)" onclick="cancelarEvento(${e.id})">🗑️</button>
          </div>
        </div>`;
    }).join('');
}

// ============================================================
// INSCRIBIRSE / CANCELAR MI INSCRIPCIÓN
// ============================================================

async function inscribirse(id_evento) {
    try {
        const res  = await fetch(`/api/eventos/${id_evento}/inscribir`, {
            method: 'POST',
            headers: authHeaders()
        });
        const data = await res.json();

        if (!res.ok) {
            alert('⚠️ ' + (data.error || 'Error al inscribirse'));
            return;
        }

        alert('✅ ¡Inscripción realizada correctamente!');
        _misInscripciones.add(id_evento);
        cargarEventos();
    } catch {
        alert('Error de conexión');
    }
}

async function cancelarMiInscripcion(id_evento) {
    if (!confirm('¿Cancelar tu inscripción a este evento?')) return;

    try {
        const res  = await fetch(`/api/eventos/${id_evento}/cancelar-inscripcion`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();

        if (!res.ok) {
            alert('⚠️ ' + (data.error || 'Error al cancelar inscripción'));
            return;
        }

        alert('✅ Inscripción cancelada. El cupo fue devuelto.');
        _misInscripciones.delete(id_evento);
        cargarEventos();
    } catch {
        alert('Error de conexión');
    }
}

// ============================================================
// VER INSCRIPTOS
// ============================================================

async function verInscriptos(id_evento, titulo) {
    document.getElementById('modal-inscriptos-titulo').textContent = `Inscriptos – ${titulo}`;
    document.getElementById('modal-inscriptos-body').innerHTML = 'Cargando...';
    document.getElementById('modal-inscriptos').classList.remove('hidden');

    try {
        const res = await fetch(`/api/eventos/${id_evento}/inscripciones`, { headers: authHeaders() });
        const inscriptos = await res.json();

        if (inscriptos.length === 0) {
            document.getElementById('modal-inscriptos-body').innerHTML =
                '<p class="empty-msg">Todavía no hay inscriptos para este evento</p>';
            return;
        }

        document.getElementById('modal-inscriptos-body').innerHTML = `
            <table class="inscriptos-table">
              <thead>
                <tr><th>#</th><th>Nombre</th><th>Email</th><th>Estado</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                ${inscriptos.map((i, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${i.participante}</td>
                    <td>${i.email}</td>
                    <td><span class="badge badge-${i.estado === 'confirmada' ? 'activo' : 'cancelado'}">${i.estado}</span></td>
                    <td>${new Date(i.fecha_inscripcion).toLocaleDateString('es-AR')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`;
    } catch {
        document.getElementById('modal-inscriptos-body').innerHTML =
            '<p class="empty-msg" style="color:var(--red)">Error al cargar inscriptos</p>';
    }
}

// ============================================================
// AUXILIARES DEL FORMULARIO
// ============================================================

let _categorias    = [];
let _organizadores = [];

async function cargarCategorias() {
    try {
        const res = await fetch('/api/eventos/aux/categorias', { headers: authHeaders() });
        _categorias = await res.json();
        const sel = document.getElementById('form-categoria');
        sel.innerHTML = '<option value="">Sin categoría</option>' +
            _categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch {}
}

async function cargarOrganizadores() {
    try {
        const res = await fetch('/api/eventos/aux/organizadores', { headers: authHeaders() });
        _organizadores = await res.json();
        const sel = document.getElementById('form-organizador');
        sel.innerHTML = '<option value="">Sin organizador</option>' +
            _organizadores.map(o => `<option value="${o.id}">${o.nombre}${o.empresa ? ' – ' + o.empresa : ''}</option>`).join('');
    } catch {}
}

// ============================================================
// CREAR / EDITAR EVENTO
// ============================================================

function abrirModalNuevo() {
    document.getElementById('form-evento-id').value    = '';
    document.getElementById('modal-titulo').textContent = 'Nuevo evento';
    document.getElementById('form-titulo').value       = '';
    document.getElementById('form-descripcion').value  = '';
    document.getElementById('form-lugar').value        = '';
    document.getElementById('form-capacidad').value    = '';
    document.getElementById('form-precio').value       = '0';
    document.getElementById('form-estado').value       = 'activo';
    document.getElementById('form-categoria').value    = '';
    document.getElementById('form-organizador').value  = '';

    const hoy = new Date();
    hoy.setHours(hoy.getHours() + 1, 0, 0, 0);
    const fin = new Date(hoy);
    fin.setHours(fin.getHours() + 3);
    document.getElementById('form-fecha-inicio').value = toDatetimeLocal(hoy);
    document.getElementById('form-fecha-fin').value    = toDatetimeLocal(fin);

    hideMsg('modal-evento-error');
    document.getElementById('modal-evento').classList.remove('hidden');
}

async function abrirModalEditar(id) {
    try {
        const res    = await fetch(`/api/eventos/${id}`, { headers: authHeaders() });
        const evento = await res.json();

        document.getElementById('form-evento-id').value      = evento.id;
        document.getElementById('modal-titulo').textContent   = 'Editar evento';
        document.getElementById('form-titulo').value          = evento.titulo;
        document.getElementById('form-descripcion').value     = evento.descripcion || '';
        document.getElementById('form-lugar').value           = evento.lugar;
        document.getElementById('form-capacidad').value       = evento.capacidad;
        document.getElementById('form-precio').value          = evento.precio;
        document.getElementById('form-estado').value          = evento.estado;
        document.getElementById('form-fecha-inicio').value    = toDatetimeLocal(new Date(evento.fecha_inicio));
        document.getElementById('form-fecha-fin').value       = toDatetimeLocal(new Date(evento.fecha_fin));

        await Promise.all([cargarCategorias(), cargarOrganizadores()]);
        document.getElementById('form-categoria').value   = evento.id_categoria || '';
        document.getElementById('form-organizador').value = evento.id_organizador || '';

        hideMsg('modal-evento-error');
        document.getElementById('modal-evento').classList.remove('hidden');
    } catch {
        alert('Error al cargar el evento');
    }
}

async function guardarEvento() {
    hideMsg('modal-evento-error');

    const id        = document.getElementById('form-evento-id').value;
    const esEdicion = !!id;

    const body = {
        titulo:         document.getElementById('form-titulo').value.trim(),
        descripcion:    document.getElementById('form-descripcion').value.trim() || null,
        fecha_inicio:   document.getElementById('form-fecha-inicio').value,
        fecha_fin:      document.getElementById('form-fecha-fin').value,
        lugar:          document.getElementById('form-lugar').value.trim(),
        capacidad:      parseInt(document.getElementById('form-capacidad').value),
        precio:         parseFloat(document.getElementById('form-precio').value) || 0,
        estado:         document.getElementById('form-estado').value,
        id_categoria:   parseInt(document.getElementById('form-categoria').value) || null,
        id_organizador: parseInt(document.getElementById('form-organizador').value) || null,
    };

    if (!body.titulo || !body.fecha_inicio || !body.fecha_fin || !body.lugar || !body.capacidad) {
        showError('modal-evento-error', 'Completá los campos obligatorios (*)');
        return;
    }

    try {
        const url    = esEdicion ? `/api/eventos/${id}` : '/api/eventos';
        const method = esEdicion ? 'PUT' : 'POST';

        const res  = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) {
            showError('modal-evento-error', data.error || 'Error al guardar');
            return;
        }

        cerrarModal('modal-evento');
        cargarEventos();
    } catch {
        showError('modal-evento-error', 'Error de conexión');
    }
}

async function cancelarEvento(id) {
    if (!confirm(`¿Cancelar el evento #${id}? Esta acción se puede revertir editando el evento.`)) return;

    try {
        const res  = await fetch(`/api/eventos/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Error al cancelar'); return; }
        cargarEventos();
    } catch {
        alert('Error de conexión');
    }
}

// ============================================================
// UTILIDADES
// ============================================================

function cerrarModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function toDatetimeLocal(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Cerrar modales haciendo click fuera
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// Permitir Enter en login
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const loginScreen = document.getElementById('screen-login');
        const regScreen   = document.getElementById('screen-register');
        if (loginScreen.classList.contains('active')) handleLogin();
        if (regScreen.classList.contains('active'))   handleRegister();
    }
});

// ============================================================
// INICIO: verificar si hay sesión guardada
// ============================================================
(function init() {
    const token   = getToken();
    const usuario = getUser();
    if (token && usuario) {
        irAlDashboard(usuario);
    } else {
        showScreen('screen-login');
    }
})();
