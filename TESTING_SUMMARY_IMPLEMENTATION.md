# Testing Guide: Summary Action Implementation

Complete guide to test the new summary action implementation in the Panal AI system.

## Architecture Overview

The summary feature involves:
- **FastAPI (port 8000)**: `/tickets/summary` endpoint for summary generation
- **Node.js (port 3000)**: `/api/ai/agent` routes summary requests to FastAPI
- **MongoDB**: Queries tickets by workspace
- **Ollama (port 11434)**: qwen2.5:7b model generates summaries

## Step 1: Verify Services Are Running

```bash
# Check FastAPI is running
curl http://localhost:8000/health

# Output should be:
# {"status":"ok"}

# Check Node.js is running  
curl http://localhost:3000/api-docs

# Should return Swagger UI HTML
```

## Step 2: Test FastAPI /tickets/summary Endpoint

### Direct Test (requires internal API key)

```bash
# Test summary generation directly on FastAPI
curl -X POST http://localhost:8000/tickets/summary \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: your-internal-api-key" \
  -d '{
    "tickets": [
      {
        "titulo": "Impresora no funciona",
        "descripcion": "La impresora del piso 3 no imprime documentos",
        "estado": "ABIERTO",
        "prioridad": "CRITICA",
        "categoria": "SOPORTE"
      },
      {
        "titulo": "Base de datos lenta",
        "descripcion": "Las consultas toman mas de 30 segundos",
        "estado": "EN_PROGRESO",
        "prioridad": "ALTA",
        "categoria": "MEJORA"
      },
      {
        "titulo": "Conexion intermitente",
        "descripcion": "El router pierde conexion cada hora",
        "estado": "ABIERTO",
        "prioridad": "CRITICA",
        "categoria": "SOPORTE"
      }
    ],
    "scope": "weekly"
  }'

# Expected response (200 OK):
# {
#   "resumen": "Este workspace enfrentas 3 tickets criticos principalmente...",
#   "tickets_criticos": 2,
#   "problemas_recurrentes": [
#     "Problemas de conectividad",
#     "Lentitud en base de datos"
#   ],
#   "recomendacion": "Priorizar la revision del router y optimizacion de queries"
# }
```

## Step 3: Test Node.js /api/ai/agent with Summary

### Using Demo Mode (no authentication needed)

```bash
# Send a summary request through the agent router
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Dame un resumen de tickets de esta semana"
  }'

# Expected response (200 OK):
# {
#   "action": "summary",
#   "confidence": 0.92,
#   "result": {
#     "resumen": "Summary of tickets from this week...",
#     "tickets_criticos": 2,
#     "problemas_recurrentes": [...],
#     "recomendacion": "..."
#   }
# }
```

### Using JWT Authentication

```bash
# Get a JWT token (replace with your actual credentials)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'

# Use the token to access agent router
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"text": "Resumen de tickets de hoy"}'
```

## Step 4: Test Via Frontend Demo

1. Open `http://localhost:3000/ai-demo/index.html` in browser
2. Click the "Resumen de tickets" quick action chip
3. Verify:
   - 🤖 Shows: "Detecté que quieres: Resumen (confidence%)"
   - Displays real summary card with:
     - Summary text
     - Critical ticket count
     - Recurring problems list
     - Recommendation
   - "Save to workspace" button works

## Step 5: Verify Different Scope Detection

The system automatically detects scope from user input:

```bash
# Daily scope
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Resumen de tickets de hoy"}'
# Detects: scope="daily"

# Weekly scope
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Dame un resumen semanal de tickets"}'
# Detects: scope="weekly"

# Generic scope (default)
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Necesito un analisis de los tickets"}'
# Detects: scope="generic"
```

## Step 6: Test Edge Cases

### No Tickets in Workspace

```bash
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Resumen de tickets"}'

# With empty workspace, returns graceful response:
# {
#   "action": "summary",
#   "confidence": 0.85,
#   "result": {
#     "resumen": "No hay tickets en este workspace para analizar",
#     "tickets_criticos": 0,
#     "problemas_recurrentes": [],
#     "recomendacion": "Crea tickets para obtener análisis"
#   }
# }
```

### Missing Authentication

```bash
# Without JWT and demo mode disabled should return 401
curl -X POST http://localhost:3000/api/ai/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Resumen de tickets"}'

# Response: 401 Unauthorized
# { "message": "Autenticación requerida" }
```

## Step 7: Verify Swagger Documentation

1. Open `http://localhost:3000/api-docs`
2. Find `POST /api/ai/agent` endpoint
3. Verify documentation shows:
   - Description of intelligent routing
   - Request body examples for draft, summary, classify
   - Response examples for each action type
   - All error codes (400, 401, 403, 404, 501, 502)

## Step 8: Check Logs

### FastAPI Logs
Watch for:
```
INFO:     POST /tickets/summary - status_code: 200
Generating summary for X tickets (scope: weekly)
Summary generated successfully: Y patterns found
```

### Node.js Logs
Watch for:
```
[AI Controller] routeAgent - action detected: summary
[AI Service] summaryTickets - calling FastAPI service
```

## Troubleshooting

### Issue: FastAPI returning 502 from Node.js
- **Check**: FastAPI is running on port 8000
- **Check**: `AI_SERVICE_URL` env var points to correct URL
- **Check**: `AI_INTERNAL_API_KEY` is set correctly
- **Check**: Ollama is running on port 11434
- **Check**: Ollama model `qwen2.5:7b` is downloaded

### Issue: Summary returns placeholder text
- **Check**: Frontend cache - hard refresh (Ctrl+Shift+R)
- **Check**: Backend restarted after code changes
- **Check**: Demo mode is enabled (`AI_DEMO_MODE=true`)

### Issue: "No hay tickets" response
- **Check**: MongoDB is connected
- **Check**: Workspace has actual tickets (not all soft-deleted)
- **Check**: Tickets have `is_deleted: false`

### Issue: Action not detected as "summary"
- **Check**: Text contains summary keywords (resumen, semana, hoy, analisis, etc.)
- **Check**: Agent router is getting correct system prompt from FastAPI
- **Check**: Ollama model is responsive

## Files Modified

- `panal-ai-service/app/prompts/ticket_summary_prompt.py` - Summary prompt builder
- `panal-ai-service/app/services/ticket_summary_service.py` - Summary generation service
- `panal-ai-service/app/api/routes/tickets.py` - FastAPI /tickets/summary endpoint
- `panal-ai-service/app/schemas/summary.py` - Request/response models (already created)
- `src/services/ai.service.js` - Node.js AI service with summaryTickets() method
- `src/controllers/ai.controller.js` - Node.js AI controller with summary routing
- `src/config/swagger.js` - Updated Swagger documentation

## Success Criteria

✅ FastAPI `/tickets/summary` returns 200 with valid summary response
✅ Node.js `/api/ai/agent` routes "resumen" prompts correctly
✅ Summary action returns 200 (not 501)
✅ Frontend displays real summary instead of placeholder
✅ All scope variants (daily/weekly/generic) are detected
✅ Empty workspace returns graceful fallback response
✅ Swagger docs show /api/ai/agent endpoint with all examples
✅ End-to-end test: User prompt → Agent routing → Summary generation → Frontend display ✅ All error handling works correctly

## Demo Flow

```
User writes: "Dame un resumen de tickets de esta semana"
    ↓
POST /api/ai/agent (Node.js)
    ↓
AI.decideAction() → detects action="summary", scope="weekly"
    ↓
AI.summaryTickets(tickets[], scope="weekly") ← fetched from MongoDB
    ↓
POST /api/ai/microservice/tickets/summary (FastAPI)
    ↓
Build summary prompt with tickets data
    ↓
Call Ollama LLM with summary system prompt
    ↓
Parse JSON response
    ↓
Return: {
  resumen: "...",
  tickets_criticos: X,
  problemas_recurrentes: [...],
  recomendacion: "..."
}
    ↓
Frontend displays result in card format
    ↓
User can save critical tickets or request more details
```
