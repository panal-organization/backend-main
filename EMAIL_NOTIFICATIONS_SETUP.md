# Configuración de Notificaciones por Email

## Descripción General

El sistema de Panal ahora envía notificaciones por email automáticas cuando se crea un ticket desde el agente IA. Estas notificaciones se envían tanto al usuario que creó el ticket como a un correo administrativo fijo.

## Archivos Implementados

### 1. **EmailService** (`src/services/email.service.js`)
- Servicio centralizado para gestionar envíos de email
- Usa **nodemailer** para conectar con servidores SMTP
- Genera HTML profesional para los emails
- Maneja errores sin bloquear la creación de tickets

### 2. **Integración en TicketsFromAIService** (`src/services/tickets-from-ai.service.js`)
- Llama automáticamente a EmailService después de crear el ticket
- Obtiene datos del usuario (nombre, correo) desde la base de datos
- Envía emails de forma asincrónica sin afectar la respuesta HTTP

### 3. **package.json**
- Se agregó dependencia: `"nodemailer": "^6.9.4"`

## Configuración de Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# SMTP Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu_usuario_mailtrap@example.com
SMTP_PASS=tu_password_mailtrap
SMTP_SECURE=false

# Admin Email
ADMIN_NOTIFICATION_EMAIL=admin@panal-empresa.com
```

### Parámetros Explicados

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` o `smtp.mailtrap.io` |
| `SMTP_PORT` | Puerto SMTP | `587` (TLS) o `465` (SSL) |
| `SMTP_USER` | Usuario/email SMTP | `tu-email@gmail.com` |
| `SMTP_PASS` | Contraseña SMTP | `abc123xyz789` |
| `SMTP_SECURE` | Usar SSL/TLS | `true` (puerto 465) o `false` (puerto 587) |
| `ADMIN_NOTIFICATION_EMAIL` | Email de administrador | `soporte@empresa.com` |

## Opciones de Configuración SMTP

### Opción 1: Gmail (RECOMENDADO PARA DESARROLLO)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@empresa.com
```

**Pasos:**
1. Activa verificación en dos pasos en tu cuenta Google
2. Genera una **App Password** en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Usa esa contraseña en `SMTP_PASS` (no tu contraseña de Gmail)

### Opción 2: Mailtrap (RECOMENDADO PARA TESTING)

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu_mailtrap_user
SMTP_PASS=tu_mailtrap_pass
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@empresa.com
```

**Pasos:**
1. Regístrate en [mailtrap.io](https://mailtrap.io)
2. Crea un proyecto/inbox
3. Copia las credenciales SMTP
4. Todos los emails se capturan en el inbox de prueba (perfecto para development)

### Opción 3: SendGrid (PRODUCCIÓN)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.tu-api-key-completa
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@empresa.com
```

### Opción 4: Servidor SMTP Propio

```env
SMTP_HOST=mail.tu-dominio.com
SMTP_PORT=587
SMTP_USER=noreply@tu-dominio.com
SMTP_PASS=contraseña_segura
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@tu-dominio.com
```

## Instalación de Dependencias

Después de configurar las variables, instala nodemailer:

```bash
npm install
```

O solo nodemailer si prefieres:

```bash
npm install nodemailer
```

## Flujo de Emails

### 1. Cuando se crea un ticket desde `POST /api/tickets/from-ai-draft`:

```
┌─────────────────────────────────────────┐
│  Recibe solicitud de crear ticket       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Valida datos del ticket                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Crea ticket en MongoDB                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Inicia envío de emails (async)         │
│  ✓ Al usuario (correo personal)         │
│  ✓ Al admin (correo fijo)               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Retorna ticket al cliente (201)        │
│  (Sin esperar que terminen los emails)  │
└─────────────────────────────────────────┘
```

### 2. Emails Enviados

**Al Usuario:**
- Asunto: `✓ Tu ticket ha sido creado en Panal`
- Contiene: Número de ticket, título, descripción, prioridad, categoría, fecha
- Tono: Confirmativo y orientado al cliente

**Al Administrador:**
- Asunto: `[PANAL] Nuevo ticket creado - #XXXXX`
- Contiene: Información completa del ticket + datos del usuario
- Tono: Informativo y administrativo

## Contenido del Email

Ambos emails incluyen:

✅ **Encabezado:** Logo/marca de Panal  
✅ **Número de Ticket Único:** #XXXXX (últimos 6 caracteres del ID)  
✅ **Información Estructurada:**
- Asunto/Título
- Descripción completa
- Prioridad (con badge de color)
- Categoría
- Fecha y hora de creación
- Estado

✅ **Diseño Responsivo:** Se adapta a dispositivos móviles  
✅ **Profesional:** HTML limpio y estilos suaves  
✅ **Footer:** Aviso legal de mensaje automático

## Manejo de Errores

### Si el email falla:
- ✅ El ticket **SÍ se crea** (no se bloquea)
- ✅ El error se registra en los logs del servidor
- ✅ El cliente recibe confirmación de creación de ticket (201)
- ⚠️ El usuario no recibe notificación por email

### Logs disponibles en consola del servidor:

```
✅ Email enviado a Usuario (user@example.com): <message-id>
❌ Error enviando email a admin@company.com: Network error
⚠️  EmailService no está configurado. Saltando envío de notificaciones.
```

## Testing

### Paso 1: Instala las dependencias

```bash
npm install
```

### Paso 2: Configura .env con Mailtrap (para testing)

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu_usuario
SMTP_PASS=tu_pass
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@panal-test.com
```

### Paso 3: Inicia el servidor

```bash
npm start
```

### Paso 4: Crea un ticket

```bash
curl -X POST http://localhost:3000/api/tickets/from-ai-draft \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Impresora offline",
    "descripcion": "La impresora de tercer piso no responde",
    "prioridad": "ALTA",
    "categoria": "SOPORTE"
  }'
```

### Paso 5: Revisa Mailtrap

Accede a tu inbox en [mailtrap.io](https://mailtrap.io) para ver los emails capturados.

## Seguridad

⚠️ **IMPORTANTE:**

- **NO commits contraseñas SMTP en Git**
- Usa archivo `.env` local (incluido en `.gitignore`)
- Para producción, usa variables de entorno del servidor/hosting
- Las credenciales SMTP no se loguean nunca
- Los emails se envían de forma asincrónica (no bloquean al usuario)

## Soporte y Troubleshooting

### El email no se envía

**Checklist:**
- ✓ Variables SMTP en `.env` configuradas
- ✓ `npm install` ejecutado
- ✓ Servidor reiniciado después de cambiar `.env`
- ✓ Credenciales SMTP son correctas (prueba conectando directamente)
- ✓ Firewall permite conexiones salientes al puerto SMTP
- ✓ Revisar logs del servidor: `npm start`

### Error: "SMTP_HOST not configured"

```
⚠️  EmailService no está configurado. Saltando envío de notificaciones.
```

**Solución:** Verifica que las variables SMTP están en `.env`:
```bash
echo $SMTP_HOST
```

### Error de autenticación SMTP

```
Error sending email: Invalid login - 535 Authentication failed
```

**Solución:** 
- Verifica credenciales SMTP
- Para Gmail, usa App Password, no tu contraseña de Google
- Para Mailtrap, revisa creaste el inbox correctamente

### Gmail rechaza conexión

**Error:** `EHOSTUNREACH` o `ECONNREFUSED`

**Solución:**
- Verifica verificación en dos pasos activa en Google
- Regenera App Password en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- Usa `SMTP_PORT=587` y `SMTP_SECURE=false`

## Próximos Pasos (Opcionales)

### 1. Agregar más recipientes SMTP
Modifica `generateTicketEmailHTML()` en `email.service.js` para enviar a equipos de soporte específicos.

### 2. Agregar templates dinámicos
Crea archivos HTML separados por tipo de notificación.

### 3. Agregar colas de email
Integra con Bull, RabbitMQ o similar para manejar fallos y reintentos.

### 4. Agregar tracking y estadísticas
Usa servicios como SendGrid u otros que proporcionen webhooks de entrega.

## Referencias

- [Nodemailer Documentation](https://nodemailer.com/)
- [SMTP Configuration](https://nodemailer.com/smtp/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Mailtrap Documentation](https://mailtrap.io/indiebox/)
