# 🎪 EventosFC – Sistema de Gestión de Eventos

**TP3 – Programación III | Tecnicatura Superior en Programación**
**Base de datos: MySQL**

Aplicación web full-stack para gestionar eventos: creación, inscripción de participantes, control de cupos y seguimiento de estados. Autenticación con JWT, stored procedure, trigger y transacciones con ROLLBACK.

---

## Stack tecnológico

- **Backend:** Node.js + Express
- **Base de datos:** MySQL
- **Autenticación:** JWT + bcryptjs
- **Frontend:** HTML + CSS + Vanilla JS (fetch)

---

## 📁 Estructura del proyecto

```
tp3-eventos/
├── server.js                  # Punto de entrada
├── .env.example               # Variables de entorno de ejemplo
├── .gitignore
├── package.json
├── database.sql               # Script completo de la BD
├── db/
│   └── index.js               # Conexión a MySQL (Pool)
├── controllers/
│   └── controllers.js         # Lógica de cada endpoint
├── routes/
│   ├── auth.js                # POST /register y /login
│   └── eventos.js             # CRUD de eventos (requiere JWT)
├── middleware/
│   └── auth.js                # Verificación de token JWT
└── public/
    ├── index.html             # SPA del frontend
    ├── style.css              # Estilos
    └── app.js                 # Lógica frontend (fetch + JWT)
```

---

## ⚙️ Instalación paso a paso

### 1. Instalar MySQL
Bajarlo de: https://dev.mysql.com/downloads/installer/
Durante la instalación anotá la contraseña del usuario `root`.

### 2. Descomprimir y abrir la carpeta
Extraer el zip y abrir una terminal dentro de la carpeta.

### 3. Crear la base de datos y las tablas

Opción A — desde la terminal:
```bash
mysql -u root -p < database.sql
```

Opción B — desde MySQL Workbench:
Abrir el archivo `database.sql` y ejecutarlo completo.

### 4. Crear el archivo .env
Copiar `.env.example` como `.env` y editarlo:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gestion_eventos
DB_USER=root
DB_PASSWORD=tu_password_de_mysql

JWT_SECRET=cualquier_string_largo_y_random
JWT_EXPIRES_IN=24h
PORT=3000
```

### 5. Instalar dependencias

```bash
npm install
```

### 6. Iniciar el servidor

```bash
npm start
```

### 7. Abrir la app

Ir a: **http://localhost:3000**

**Credenciales de prueba:** `admin@eventos.com` / `123456`

---

## 🗄️ Tablas de la base de datos

| Tabla | Descripción |
|---|---|
| `usuarios` | Cuentas de acceso (admin / participante) |
| `categorias` | Tipos de eventos |
| `organizadores` | Empresas o personas que organizan eventos |
| `eventos` | Recurso principal con cupos, fechas y precio |
| `inscripciones` | Relación entre usuarios y eventos |
| `historial_inscripciones` | Log automático via trigger |

---

## 🔧 Stored Procedure: `inscribir_participante`

Antes de inscribir, verifica que el evento exista, esté activo, tenga cupos disponibles y que el usuario no esté ya inscripto. Si algo falla, lanza un error con `SIGNAL SQLSTATE '45000'` y no inserta nada. Si todo está bien, inserta la inscripción y descuenta el cupo.

```sql
CALL inscribir_participante(2, 1);
```

---

## ⚡ Trigger: `log_cambio_inscripcion`

Se dispara `AFTER UPDATE` en la tabla `inscripciones`. Si el estado cambió, guarda el historial en `historial_inscripciones`. Si el nuevo estado es `cancelada`, además devuelve el cupo al evento automáticamente con un `UPDATE` en `eventos`.

---

## 🔒 Transacción con ROLLBACK

Usada en `PUT /api/eventos/:id`. Se obtiene una conexión dedicada del pool, se ejecuta `beginTransaction()`, y si cualquier operación falla se llama a `rollback()` para revertir todos los cambios. Esto evita que el evento quede con datos inconsistentes si falla a mitad de la actualización.

---

## 🔑 Endpoints de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Crear cuenta |
| POST | `/api/auth/login` | No | Login → JWT |
| GET | `/api/eventos` | ✅ | Listar eventos |
| GET | `/api/eventos/:id` | ✅ | Ver un evento |
| POST | `/api/eventos` | ✅ | Crear evento |
| PUT | `/api/eventos/:id` | ✅ | Actualizar (con transacción) |
| DELETE | `/api/eventos/:id` | ✅ | Cancelar evento |
| POST | `/api/eventos/:id/inscribir` | ✅ | Inscribirse (stored procedure) |
| DELETE | `/api/eventos/:id/cancelar-inscripcion` | ✅ | Cancelar inscripción |
| GET | `/api/eventos/:id/inscripciones` | ✅ | Ver inscriptos |

---

## ❓ Preguntas conceptuales

### 1. ¿Qué es un servidor web y cómo funciona el ciclo request-response?

Un servidor web es un programa que escucha en un puerto esperando conexiones de clientes. Cuando llega una petición HTTP (con método, URL y cuerpo), el servidor la procesa, ejecuta la lógica correspondiente, consulta la base de datos si hace falta, y devuelve una respuesta con un código de estado y datos en JSON. Ese ciclo de "el cliente pide, el servidor responde" se llama request-response. En este proyecto Node.js escucha en el puerto 3000 y Express enruta cada request al controller correcto.

### 2. ¿Qué es Express y por qué lo usamos en lugar de usar solo Node.js?

Express es un framework que corre sobre Node.js y simplifica la creación de rutas, el parseo del body y la gestión de middlewares. Con Node puro habría que leer el stream de datos byte a byte, parsear la URL manualmente y construir las respuestas HTTP sin ayuda. Express nos da todo eso resuelto con pocas líneas, y permite organizar el proyecto en routers y middlewares separados para que el código sea más legible y mantenible.

### 3. ¿Qué es un JWT y cómo se diferencia de guardar la sesión en el servidor?

JWT es un token firmado digitalmente que contiene los datos del usuario y se guarda del lado del cliente (en este proyecto en el localStorage). El servidor no guarda ningún estado: solo verifica la firma con su clave secreta en cada request protegido. Con sesiones tradicionales el servidor mantiene en memoria qué usuarios están logueados, lo que consume recursos y complica escalar. JWT es stateless: cualquier instancia del servidor puede verificarlo con solo conocer la clave secreta.

### 4. ¿Qué ventaja tiene usar un procedimiento almacenado en lugar de escribir ese SQL desde Node.js?

El stored procedure vive en la base de datos, por lo que la validación se aplica sin importar quién intente insertar datos: la API, un script de mantenimiento o una consulta directa desde MySQL Workbench. También reduce el tráfico entre Node y MySQL porque todo se resuelve con un solo CALL. Centraliza reglas de negocio críticas (verificar cupos antes de inscribir) en un solo lugar más fácil de auditar sin tocar el código de la aplicación.

### 5. ¿Por qué es importante usar transacciones? Poné un ejemplo de cuando un ROLLBACK salva la integridad de los datos.

Las transacciones garantizan que un conjunto de operaciones se ejecute como una unidad: o todas tienen éxito (commit) o ninguna se aplica (rollback). Al actualizar un evento que cambió su capacidad, primero calculamos los nuevos cupos y luego ejecutamos el UPDATE. Si entre esas operaciones hay un error, sin transacción el evento podría quedar con la capacidad actualizada pero los cupos mal calculados. Con rollback todo vuelve al estado anterior y la respuesta al cliente refleja el error correctamente.

### 6. ¿Qué es un trigger? Describí el trigger que implementaste y en qué momento se dispara.

Un trigger es código SQL que MySQL ejecuta automáticamente cuando ocurre un evento en una tabla, sin que lo llamemos nosotros. Implementamos `log_cambio_inscripcion`, que se dispara AFTER UPDATE en la tabla inscripciones. Si el estado cambió, guarda el historial en historial_inscripciones. Además, si el nuevo estado es "cancelada", ejecuta automáticamente un UPDATE en eventos para devolver el cupo, sin que el código de Node tenga que hacerlo explícitamente.
