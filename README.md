# 🎪 EventosFC – Sistema de Gestión de Eventos

**TP3 – Programación III | Tecnicatura Superior en Programación**
**Base de datos: MySQL**

Una app web para gestionar eventos: crear eventos, inscribirse, ver cupos y manejar estados. Tiene autenticación con JWT, un stored procedure, un trigger y transacciones con ROLLBACK.

---

## Stack

- **Backend:** Node.js + Express
- **Base de datos:** MySQL
- **Autenticación:** JWT + bcryptjs
- **Frontend:** HTML + CSS + JS (fetch)

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
│   └── index.js               # Conexión a MySQL
├── controllers/
│   └── controllers.js         # Lógica de cada endpoint
├── routes/
│   ├── auth.js                # Registro y login
│   └── eventos.js             # CRUD de eventos (requiere JWT)
├── middleware/
│   └── auth.js                # Verificación del token JWT
└── public/
    ├── index.html             # Frontend
    ├── style.css              # Estilos
    └── app.js                 # Lógica del frontend
```

---

## ⚙️ Cómo levantar el proyecto

### 1. Clonar o descomprimir el proyecto

### 2. Crear la base de datos

```bash
mysql -u root -p < database.sql
```

O abrirlo desde MySQL Workbench y ejecutarlo.

### 3. Crear el archivo .env

Copiar `.env.example` como `.env` y completar con tus datos:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=gestion_eventos
DB_USER=root
DB_PASSWORD=tu_password

JWT_SECRET=alguna_clave_larga_random
JWT_EXPIRES_IN=24h
PORT=3000
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Iniciar el servidor

```bash
npm start
```

### 6. Abrir en el navegador

```
http://localhost:3000
```

Usuario de prueba: `admin@eventos.com` / `123456`

---

## 🗄️ Tablas de la base de datos

| Tabla | Descripción |
|---|---|
| `usuarios` | Usuarios registrados con su rol |
| `categorias` | Tipos de eventos |
| `organizadores` | Quién organiza cada evento |
| `eventos` | El recurso principal |
| `inscripciones` | Relación entre usuarios y eventos |
| `historial_inscripciones` | Log automático generado por el trigger |

---

## 🔧 Stored Procedure: `inscribir_participante`

Lo que hace es verificar varias cosas antes de inscribir a alguien: que el evento exista, que esté activo, que tenga cupos y que el usuario no esté ya anotado. Si algo falla, tira un error y no inserta nada. Si todo está bien, inserta la inscripción y resta un cupo al evento. Lo llamo desde Node con `CALL inscribir_participante(id_usuario, id_evento)`.

---

## ⚡ Trigger: `log_cambio_inscripcion`

Se activa automáticamente después de cada UPDATE en la tabla `inscripciones`. Si el estado cambió, guarda el cambio en `historial_inscripciones`. Y si el nuevo estado es "cancelada", también le devuelve el cupo al evento solito, sin que yo tenga que hacer nada desde Node.

---

## 🔒 Transacción con ROLLBACK

La uso en el endpoint `PUT /api/eventos/:id`. Abro una transacción, verifico que el evento exista, recalculo los cupos si cambió la capacidad y hago el UPDATE. Si en algún paso hay un error, llamo al rollback y todo vuelve al estado anterior. Así no queda nada a medias en la base de datos.

---

## 🔑 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Registrar usuario |
| POST | `/api/auth/login` | No | Login, devuelve JWT |
| GET | `/api/eventos` | ✅ | Listar eventos |
| GET | `/api/eventos/:id` | ✅ | Ver un evento |
| POST | `/api/eventos` | ✅ | Crear evento |
| PUT | `/api/eventos/:id` | ✅ | Actualizar evento |
| DELETE | `/api/eventos/:id` | ✅ | Cancelar evento |
| POST | `/api/eventos/:id/inscribir` | ✅ | Inscribirse |
| DELETE | `/api/eventos/:id/cancelar-inscripcion` | ✅ | Cancelar inscripción |
| GET | `/api/eventos/:id/inscripciones` | ✅ | Ver inscriptos |

---

## ❓ Preguntas conceptuales

### 1. ¿Qué es un servidor web y cómo funciona el ciclo request-response?

Un servidor web es básicamente un programa que está escuchando en un puerto esperando que alguien le mande una petición. Cuando llega una request con método, URL y datos, el servidor la procesa, hace lo que tenga que hacer (consultar la base, calcular algo) y manda de vuelta una response con un código de estado y los datos en JSON. En este proyecto Node corre en el puerto 3000 y Express se encarga de derivar cada request al controller que corresponde.

### 2. ¿Qué es Express y por qué lo usamos en lugar de usar solo Node.js?

Express es un framework que va arriba de Node y te simplifica un montón de cosas. Con Node puro tendrías que manejar los streams de datos a mano, parsear las URLs vos mismo y armar las respuestas HTTP desde cero. Express te da todo eso listo, más un sistema de routers y middlewares para organizar el código. Sin Express el proyecto sería mucho más difícil de mantener.

### 3. ¿Qué es un JWT y cómo se diferencia de guardar la sesión en el servidor?

JWT es un token que el servidor genera cuando el usuario hace login y se lo manda al cliente. El cliente lo guarda (en este caso en el localStorage) y lo manda en cada request protegida. El servidor no guarda nada, solo verifica la firma del token con su clave secreta. La diferencia con las sesiones tradicionales es que esas sí guardan el estado del lado del servidor, lo que usa más recursos y complica escalar. Con JWT es stateless, cualquier instancia del servidor puede verificar el token.

### 4. ¿Qué ventaja tiene usar un procedimiento almacenado en lugar de escribir ese SQL desde Node.js?

La principal ventaja es que la lógica de negocio queda en la base de datos y no depende de que pase por la API. Si alguien inserta directo desde Workbench, las mismas reglas se aplican igual. También es más eficiente porque todo se resuelve con un solo CALL en vez de varios queries ida y vuelta entre Node y MySQL. Y si hay que cambiar la lógica de inscripción, lo cambio en un solo lugar.

### 5. ¿Por qué es importante usar transacciones? Poné un ejemplo de cuando un ROLLBACK salva la integridad de los datos.

Las transacciones son importantes porque garantizan que un conjunto de operaciones se complete entero o no se aplique ninguna. En este proyecto, al actualizar un evento que cambió de capacidad, primero calculo los nuevos cupos y después hago el UPDATE. Si falla en el medio, sin transacción el evento podría quedar con la capacidad nueva pero los cupos mal calculados. Con el ROLLBACK todo vuelve atrás y los datos quedan consistentes.

### 6. ¿Qué es un trigger? Describí el trigger que implementaste y en qué momento se dispara.

Un trigger es código que la base de datos ejecuta sola cuando pasa algo en una tabla, sin que vos lo llames. Yo implementé `log_cambio_inscripcion`, que se dispara después de cada UPDATE en la tabla inscripciones. Si el estado de la inscripción cambió, guarda el historial en otra tabla. Y si el nuevo estado es "cancelada", devuelve el cupo al evento automáticamente. Todo eso sin que Node tenga que hacer nada extra.
