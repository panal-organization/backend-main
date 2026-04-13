# Panal Backend

## 1. Descripcion del proyecto
Panal es una plataforma backend orientada a gestion operativa con capacidades de IA y observabilidad.

Arquitectura general:
- Backend API en Node.js + Express
- Microservicio AI en Python + FastAPI (opcional para entorno local)
- Stack DevOps con Docker Compose: backend, MongoDB, Prometheus, Grafana, Loki, Promtail y cAdvisor
- Pipeline CI/CD con GitHub Actions ejecutado sobre self-hosted runner en Windows

## 2. Prerrequisitos
Antes de iniciar, asegurate de tener:

| Requisito | Version recomendada | Obligatorio |
|---|---|---|
| Node.js | 20+ | Si |
| npm | 10+ | Si |
| Docker Desktop | Ultima estable y encendido | Si |
| Git | Ultima estable | Si |
| Python | 3.x | No (solo AI local fuera de Docker) |

## 3. Instalacion desde cero
```bash
git clone <repo-url>
cd backend-main
npm install
```

## 4. Configuracion de variables de entorno
1. Copia el archivo base de variables:

```bash
cp .env.example .env
```

En PowerShell tambien puedes usar:

```powershell
Copy-Item .env.example .env
```

2. Configura como minimo estas variables en `.env`:
- `MONGODB_URI`
- `AI_INTERNAL_API_KEY`

3. Variables opcionales para notificaciones por correo (SMTP):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE`
- `ADMIN_NOTIFICATION_EMAIL`

## 5. Levantar todo el entorno
Comando principal:

```bash
npm run devops:run-all
```

Este comando ejecuta el flujo completo de entorno local:
- valida Docker y Docker Compose
- levanta el stack Docker
- publica backend + observabilidad (Prometheus, Grafana, Loki, Promtail, cAdvisor)
- ejecuta validaciones de salud
- intenta iniciar AI local si esta disponible

Nota: el stack principal puede iniciar aunque el microservicio AI local no este disponible.

## 6. URLs de acceso
| Servicio | URL |
|---|---|
| Backend health | http://localhost:3000/health |
| Swagger | http://localhost:3000/api-docs |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Loki readiness | http://localhost:3100/ready |
| cAdvisor | http://localhost:8080 |

Credenciales por defecto de Grafana:
- Usuario: `admin`
- Password: `admin`

## Acceso remoto para pruebas (Cloudflare Tunnel)
### Que es
Cloudflare Tunnel permite exponer temporalmente tu backend local a Internet sin abrir puertos manualmente ni configurar DNS.

En este proyecto se usa en modo simple con URL temporal de `trycloudflare.com`, ideal para pruebas rapidas entre companeros.

### Requisitos
- Tener el backend levantado en `http://localhost:3000`
- Tener `cloudflared` instalado en Windows

Instalacion recomendada:

```powershell
winget install Cloudflare.cloudflared
```

### Uso rapido
Si tu backend ya esta arriba, ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-cloudflare-tunnel.ps1
```

Ese script ejecuta internamente:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Si quieres levantar backend + tunnel en una sola corrida:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-tunnel-and-backend.ps1
```

### Que compartir con tus companeros
Comparte la URL base que genera Cloudflare, por ejemplo:

```text
https://random-name.trycloudflare.com
```

Y estos endpoints utiles:
- `https://random-name.trycloudflare.com/api-docs`
- `https://random-name.trycloudflare.com/api/ai/agent/plan`
- `https://random-name.trycloudflare.com/api/ai/agent/continue`

### Advertencias importantes
- La URL cambia cada vez que levantas un nuevo tunnel
- Solo funciona mientras tu PC este encendida, con Internet y con el backend corriendo
- Si cierras `cloudflared`, la URL deja de funcionar

### Que no debes exponer
Para pruebas entre companeros, no expongas con este metodo:
- Prometheus
- Loki
- cAdvisor

Exponer solo el backend reduce superficie de riesgo y evita compartir herramientas internas de observabilidad.

## 7. Self-Hosted Runner (CI/CD)
### Que es
Es un agente de GitHub Actions instalado en tu maquina Windows. En lugar de ejecutar jobs en infraestructura de GitHub, los ejecuta localmente en tu equipo.

### Como configurarlo
1. Ir a GitHub: Settings -> Actions -> Runners
2. Crear un runner nuevo para Windows
3. En tu maquina, descomprimir el paquete oficial del runner
4. Ejecutar configuracion:

```powershell
.\config.cmd --url https://github.com/<owner>/<repo o organization> --token <TOKEN>
```

5. Ejecutar en modo interactivo:

```powershell
.\run.cmd
```

### Opcional: ejecucion continua (sin terminal manual)
Opcion A (si tu paquete incluye `svc.cmd`):

```powershell
.\svc.cmd install
.\svc.cmd start
```

Opcion B (cuando `svc.cmd` no existe en versiones recientes):
- Crear una tarea programada de Windows que ejecute `run.cmd` al iniciar sesion

Guia asistida incluida en el proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-runner.ps1
```

## 8. Pipeline CI/CD
Archivo del pipeline:
- `.github/workflows/local-ci-cd.yml`

Ejecucion:
- corre en self-hosted runner con labels de Windows/local
- se dispara por `push` a `main/master`
- se dispara en `pull_request` hacia `main/master`
- permite ejecucion manual (`workflow_dispatch`)

Etapas principales del pipeline:
- checkout del repositorio
- instalacion de dependencias
- validaciones de lint/test (si existen scripts)
- build de imagen Docker
- levantamiento del stack con Docker Compose
- health checks del backend y endpoints de monitoreo

Como probarlo:

```bash
git push
```

Luego revisar en GitHub -> Actions.

## 9. Flujo de desarrollo recomendado
1. Crear rama de trabajo por feature/fix
2. Desarrollar y validar en local
3. Abrir Pull Request hacia `main`
4. Esperar pipeline CI/CD en verde
5. Hacer merge a `main`
6. El merge vuelve a disparar el pipeline sobre `main`

## 10. Troubleshooting
### Docker no corre
- Verifica que Docker Desktop este iniciado
- Ejecuta `docker info` y `docker compose version`

### Runner offline
- Verifica estado en GitHub -> Settings -> Actions -> Runners
- En Windows, valida proceso: `Get-Process | Where-Object { $_.ProcessName -like "Runner*" }`
- Si usas tarea programada, revisa su estado en Task Scheduler

### Puertos ocupados
- Backend: 3000
- AI local: 8000
- Grafana: 3001
- Prometheus: 9090
- Loki: 3100
- cAdvisor: 8080

Si algun puerto esta ocupado, libera el proceso y vuelve a correr `npm run devops:run-all`.

### Prometheus/Grafana no accesibles
- Revisa contenedores: `docker ps`
- Revisa logs: `npm run devops:logs`
- Reinicia stack: `npm run devops:down` y luego `npm run devops:up`

## 11. Notas importantes
- El AI service es opcional para levantar el stack principal local
- El frontend demo fue eliminado del flujo principal
- El CI/CD de este proyecto esta orientado a self-hosted runner en Windows