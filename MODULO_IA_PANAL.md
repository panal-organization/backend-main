# Modulo IA Panal

## 1) Descripcion breve
El modulo IA de Panal convierte texto libre en acciones utiles para soporte tecnico, con dos modos de operacion:
- Ejecucion directa (`/api/ai/agent`) para responder de inmediato.
- Planeacion segura (`/api/ai/agent/plan`) para mostrar plan + preview antes de acciones sensibles.

El sistema ya soporta herramientas reales para:
- `draft`
- `summary`
- `classify`
- `create_ticket` con confirmacion explicita antes de guardar

---

## 2) Arquitectura general
### Componentes
- **Frontend demo**: `ai-demo` (plan-first UI, confirmacion explicita)
- **Backend Node.js (Express)**: orquestacion, seguridad, acceso Mongo, proxy a IA
- **Microservicio FastAPI**: endpoints IA internos (`draft`, `summary`, `classify`, `decide`)
- **LLM**: Ollama con modelo `qwen2.5:7b`
- **Base de datos**: MongoDB Atlas

### Flujo macro
1. Usuario escribe texto en `ai-demo` o cliente API.
2. Node decide entre ejecucion directa o planeacion.
3. Node consulta FastAPI para decision y/o herramientas IA.
4. FastAPI usa Ollama para respuesta JSON estructurada.
5. En `create_ticket`, solo se persiste en Mongo tras confirmacion explicita.

---

## 3) Endpoints principales
## Node (puerto 3000)
- `POST /api/ai/agent`
- `POST /api/ai/agent/plan`
- `POST /api/ai/tickets/draft`
- `POST /api/ai/tickets/draft-demo`
- `POST /api/tickets/from-ai-draft`

## FastAPI (puerto 8000)
- `POST /tickets/draft`
- `POST /tickets/summary`
- `POST /tickets/classify`
- `POST /agent/decide`

---

## 4) Modo real vs modo demo
## Modo real (JWT)
- Requiere token valido.
- Node resuelve `user_id` y `workspace_id` desde contexto autenticado.
- Uso recomendado para entorno productivo/controlado.

## Modo demo (sin JWT)
- Habilitado con `AI_DEMO_MODE=true`.
- Usa `AI_DEMO_USER_ID` y `AI_DEMO_WORKSPACE_ID`.
- Ideal para demostraciones rapidas y exposiciones.

---

## 5) Orden de arranque
1. **Ollama**
   - `ollama serve`
2. **Microservicio IA (FastAPI)** desde `panal-ai-service`
   - activar venv
   - `python -m uvicorn --app-dir . app.main:app --host 0.0.0.0 --port 8000 --reload`
3. **Backend Node** desde `backend-main`
   - `npm start`
4. **Demo UI**
   - abrir `ai-demo/index.html` (o servirlo desde backend si aplica)

---

## 6) Variables de entorno importantes
- `MONGODB_URI`
- `PORT`
- `AI_SERVICE_URL` (ej. `http://127.0.0.1:8000`)
- `AI_INTERNAL_API_KEY`
- `AI_DEMO_MODE`
- `AI_DEMO_USER_ID`
- `AI_DEMO_WORKSPACE_ID`

En FastAPI/Ollama:
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL` (`qwen2.5:7b`)
- timeout de Ollama segun configuracion de `core.config`

---

## 7) Casos de uso soportados
- **draft**: genera borrador estructurado de ticket.
- **summary**: resume tickets del workspace con patrones y recomendacion.
- **classify**: clasifica problema en prioridad/categoria con justificacion.
- **create_ticket**: arma plan con `draft_preview` y requiere confirmacion antes de persistir.

---

## 8) Flujo del agent router (ejecucion directa)
1. `POST /api/ai/agent` recibe texto.
2. Node llama `POST /agent/decide` (FastAPI).
3. Segun accion detectada:
   - `draft` -> llama `/tickets/draft`
   - `summary` -> consulta Mongo + llama `/tickets/summary`
   - `classify` -> llama `/tickets/classify`
4. Devuelve `action`, `confidence` y `result`.

---

## 9) Flujo plan-first (seguro)
1. `POST /api/ai/agent/plan` recibe texto.
2. Detecta `intent` y construye `steps`.
3. Devuelve preview correspondiente:
   - `draft_preview`
   - `summary_preview`
   - `classify_preview`
4. Si `intent=create_ticket`:
   - `requires_confirmation=true`
   - pasos: `draft` + `create_ticket_from_draft`
   - **no guarda automaticamente**
5. Frontend pide confirmacion explicita y solo entonces llama `/api/tickets/from-ai-draft`.

---

## 10) Como probar en Swagger
## Node Swagger
- URL: `http://localhost:3000/api-docs`
- Probar:
  - `/api/ai/agent`
  - `/api/ai/agent/plan`
  - `/api/tickets/from-ai-draft`

## FastAPI Swagger
- URL: `http://localhost:8000/docs`
- Probar:
  - `/agent/decide`
  - `/tickets/draft`
  - `/tickets/summary`
  - `/tickets/classify`

---

## 11) Como probar en ai-demo
1. Abrir `ai-demo/index.html`.
2. Enviar texto desde quick actions o textarea.
3. Verificar:
   - deteccion de intencion
   - plan + steps
   - preview
4. Para `create_ticket`:
   - debe aparecer confirmacion
   - solo al confirmar se crea ticket real
   - mostrar `_id` de ticket creado

---

## 12) Como verificar tickets en MongoDB
Opciones:
- Revisar en MongoDB Atlas por `workspace_id` demo/real y `is_deleted=false`.
- Ejecutar query/script de conteo o `findById` desde Node.
- Confirmar incremento de conteo solo cuando se ejecuta confirmacion de `create_ticket`.

---

## 13) Casos de prueba finales
## Caso 1: Draft
- **Input**: "La impresora de recepcion no funciona"
- **Endpoint**: `POST /api/ai/agent/plan`
- **Esperado**:
  - `intent: draft`
  - `requires_confirmation: false`
  - `steps: [{ tool: "draft", status: "ready" }]`
  - `draft_preview` completo
- **UI**: muestra plan + preview de borrador
- **Mongo**: no guarda automaticamente en plan

## Caso 2: Classify
- **Input**: "Clasifica este problema: la impresora no enciende y afecta a todo el equipo"
- **Endpoint**: `POST /api/ai/agent/plan`
- **Esperado**:
  - `intent: classify`
  - `requires_confirmation: false`
  - `steps: [{ tool: "classify", status: "ready" }]`
  - `classify_preview` con prioridad/categoria/justificacion
- **UI**: muestra plan + preview de clasificacion
- **Mongo**: no guarda

## Caso 3: Summary
- **Input**: "Dame un resumen de tickets de esta semana"
- **Endpoint**: `POST /api/ai/agent/plan`
- **Esperado**:
  - `intent: summary`
  - `requires_confirmation: false`
  - `steps: [{ tool: "summary", status: "ready" }]`
  - `summary_preview.resumen`
- **UI**: muestra plan + preview de resumen
- **Mongo**: no guarda

## Caso 4: Create ticket con confirmacion
- **Input**: "Crea un ticket porque la impresora de recepcion no funciona"
- **Endpoint principal**: `POST /api/ai/agent/plan`
- **Esperado**:
  - `intent: create_ticket`
  - `requires_confirmation: true`
  - `steps` incluye:
    - `draft` (ready)
    - `create_ticket_from_draft` (requires_confirmation)
  - `draft_preview` completo
- **UI**:
  - muestra card de confirmacion
  - boton "Confirmar creacion del ticket"
- **Persistencia**:
  - solo tras confirmar -> `POST /api/tickets/from-ai-draft`
  - debe devolver `_id`

---

## 14) Guion breve de exposicion tecnica (hablado)
"En Panal resolvemos un problema comun en soporte: recibir texto libre y transformarlo en acciones utiles y seguras. Nuestro agente IA entiende la intencion del usuario y trabaja con herramientas reales: generar borradores, clasificar incidencias y resumir tickets.

La arquitectura se separa en capas: un frontend demo para la experiencia, un backend Node que orquesta y controla seguridad, un microservicio FastAPI para logica IA, Ollama con qwen2.5:7b para inferencia y MongoDB para persistencia.

Tenemos dos modos: ejecucion directa y plan-first. En ejecucion directa, el agente responde de inmediato. En plan-first, primero devuelve un plan estructurado con pasos y preview. Esto nos permite controlar acciones sensibles.

La accion create_ticket es el mejor ejemplo: el sistema prepara el borrador, muestra confirmacion y solo guarda en Mongo cuando el usuario confirma explicitamente. Asi evitamos escrituras automaticas no deseadas.

El valor para Panal es claro: mayor productividad para soporte, respuestas estandarizadas, trazabilidad y seguridad operacional. A futuro se puede escalar con aprobaciones por rol, historial de decisiones, metricas de confianza y nuevos tools especializados." 

---

## 15) Checklist final pre-demo / pre-exposicion
- [ ] Ollama activo (`qwen2.5:7b` disponible)
- [ ] FastAPI activo (`/docs` y endpoints IA responden)
- [ ] Node activo (`/api-docs` visible)
- [ ] Swagger Node visible y actualizado
- [ ] Swagger FastAPI visible
- [ ] ai-demo visible y usable
- [ ] Mongo conectado
- [ ] `create_ticket` guarda ticket real tras confirmacion
- [ ] `summary` responde resultado real
- [ ] `classify` responde resultado real
- [ ] plan-first exige confirmacion para `create_ticket`

---

## Nota de cierre
La fase actual queda cerrada para demostracion y replicacion: core estable, flujos IA funcionales, capa de seguridad plan-first operativa y documentacion lista para exposicion tecnica.
