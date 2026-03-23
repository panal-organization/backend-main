# Guía del módulo IA — Panal AI Tickets

Documentación del flujo completo para generar y guardar borradores de tickets con IA.

---

## Requisitos previos

| Herramienta | Versión mínima | Comando verificación |
|---|---|---|
| Node.js | 18+ | `node -v` |
| Python | 3.12 | `python --version` |
| Ollama | ≥ 0.1.x | `ollama --version` |

### Modelo Ollama requerido
```
ollama pull qwen2.5:7b
```

---

## Variables de entorno (.env)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MONGODB_URI` | Cadena de conexión Atlas | `mongodb+srv://...` |
| `PORT` | Puerto Express | `3000` |
| `AI_SERVICE_URL` | URL del microservicio FastAPI | `http://127.0.0.1:8000` |
| `AI_INTERNAL_API_KEY` | Clave interna Node → FastAPI | `panal_internal_dev_key` |
| `AI_DEMO_MODE` | Habilita rutas sin autenticación | `true` |
| `AI_DEMO_USER_ID` | ObjectId de usuario demo | `699d2f62b00a373767e0adc1` |
| `AI_DEMO_WORKSPACE_ID` | ObjectId de workspace demo | `69a3e13581a5be4cb1bd8bc8` |

---

## Orden de arranque

```
# 1. Motor LLM
ollama serve

# 2. Microservicio FastAPI (desde la carpeta panal-ai-service)
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Backend Node.js (desde backend-main)
npm start
```

---

## Endpoints del módulo IA

### 1. Generar borrador (con JWT)
```
POST /api/ai/tickets/draft
Authorization: Bearer <token>
Content-Type: application/json

{ "text": "La impresora de recepción no enciende desde ayer" }
```

**Respuesta 200:**
```json
{
  "titulo": "Impresora de recepción sin encender",
  "descripcion": "El usuario reporta que la impresora de recepción no enciende desde ayer.",
  "prioridad": "ALTA",
  "categoria": "SOPORTE",
  "tags": ["impresora", "hardware", "recepción"],
  "confidence": 0.9
}
```

---

### 2. Generar borrador (modo demo, sin JWT)
```
POST /api/ai/tickets/draft-demo
Content-Type: application/json

{ "text": "La impresora de recepción no enciende desde ayer" }
```

Requiere `AI_DEMO_MODE=true` en el .env.

**Respuesta 200:** misma forma que el endpoint con JWT.

---

### 3. Guardar ticket desde borrador
```
POST /api/tickets/from-ai-draft
Content-Type: application/json
Authorization: Bearer <token>   ← opcional

{
  "titulo": "Impresora de recepción sin encender",
  "descripcion": "El usuario reporta que la impresora de recepción no enciende desde ayer.",
  "prioridad": "ALTA",
  "categoria": "SOPORTE"
}
```

- Si se envía JWT válido, el creador y workspace se obtienen del token.
- Si no hay JWT (modo demo), se usan `AI_DEMO_USER_ID` y `AI_DEMO_WORKSPACE_ID` del .env.

**Respuesta 201:**
```json
{
  "_id": "69c0909830a17e6f525f57b3",
  "titulo": "Impresora de recepción sin encender",
  "descripcion": "...",
  "estado": "PENDIENTE",
  "prioridad": "ALTA",
  "categoria": "SOPORTE",
  "created_by": "699d2f62b00a373767e0adc1",
  "workspace_id": "69a3e13581a5be4cb1bd8bc8",
  "created_at": "2025-07-20T..."
}
```

---

## Demo HTML

Abre `ai-demo/index.html` directamente en el navegador (no requiere servidor web).

1. Escribe el problema en el textarea.
2. Pulsa **Generar borrador** — el modelo IA devuelve título, descripción, prioridad y categoría sugeridos.
3. Revisa el borrador generado.
4. Pulsa **Guardar ticket** — el ticket se persiste en MongoDB y se muestra el ID creado.

El modo demo no requiere JWT. Asegúrate de que los tres servicios estén corriendo antes de abrir el demo.

---

## Documentación Swagger

```
http://localhost:3000/api-docs
```

Sección **AI** → contiene todos los endpoints con ejemplos de request/response.

---

## Verificar un ticket en MongoDB (Node.js)

```js
// Desde backend-main
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Ticket = require('./src/models/tickets.model').Tickets;
  const doc = await Ticket.findById('REEMPLAZA_CON_ID').lean();
  console.log(JSON.stringify(doc, null, 2));
  mongoose.disconnect();
});
"
```

---

## Flujo de datos resumido

```
Navegador
  │  POST /api/ai/tickets/draft-demo
  ▼
Node.js Express (puerto 3000)
  │  X-Internal-API-Key  POST /tickets/draft
  ▼
FastAPI microservicio (puerto 8000)
  │  HTTP  POST /api/generate
  ▼
Ollama qwen2.5:7b (puerto 11434)
  │  texto generado
  ▼
FastAPI → Node.js → Navegador  [draft JSON]
  │
  │  POST /api/tickets/from-ai-draft
  ▼
Node.js → MongoDB Atlas  [ticket guardado]
```
