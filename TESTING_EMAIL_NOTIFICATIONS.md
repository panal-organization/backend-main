# Guía Completa: Testing de Notificaciones por Email

## 📋 Tabla de Contenidos

1. [Setup Inicial](#setup-inicial)
2. [Testing con Mailtrap (Recomendado)](#testing-con-mailtrap)
3. [Testing con Gmail](#testing-con-gmail)
4. [Comandos de Test](#comandos-de-test)
5. [Validación de Resultados](#validación-de-resultados)
6. [Solución de Problemas](#solución-de-problemas)

---

## Setup Inicial

### Requisitos

- Node.js v14+ instalado
- MongoDB conectado y funcionando
- npm con dependencias instaladas (`npm install`)
- Credenciales SMTP válidas

### Instalación

```bash
# Instalar nodemailer (ya incluido en npm install)
npm install

# Crear .env con variables SMTP (ver opciones abajo)
# Editar archivo: .env
```

---

## Testing con Mailtrap (Recomendado)

**Por qué Mailtrap:**
- ✅ No envía emails a usuarios reales (testing seguro)
- ✅ Captura todos los emails en un inbox
- ✅ Permite inspeccionar HTML y contenido
- ✅ Tiene documentación excelente
- ✅ Cuenta gratuita suficiente para desarrollo

### Paso 1: Registrarse en Mailtrap

1. Ve a [mailtrap.io](https://mailtrap.io)
2. Click en "Sign Up"
3. Completa el formulario (email, contraseña)
4. Confirma tu email

### Paso 2: Crear un Inbox

1. Dashboard → "Inbox"
2. Click "Add Inbox"
3. Nombre: `"Panal Development"`
4. Click "Create"

### Paso 3: Obtener Credenciales SMTP

1. Abre el Inbox que creaste
2. Busca el botón "SMTP Settings" o "Show SMTP credentials"
3. Selecciona "Nodemailer" en el dropdown
4. Copia las credenciales mostradas

### Paso 4: Configurar .env

```bash
# Mailtrap SMTP Settings
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu_mailtrap_username
SMTP_PASS=tu_mailtrap_password
SMTP_SECURE=false

# Admin email (puede ser cualquiera)
ADMIN_NOTIFICATION_EMAIL=admin@panal-dev.local
```

### Paso 5: Probar Script Automático

```bash
node scripts/test-email-service.js
```

**Salida esperada:**
```
═══════════════════════════════════════════════════════════════
🧪 TEST: Email Service para Notificaciones de Tickets
═══════════════════════════════════════════════════════════════

📋 Verificando configuración SMTP...

  ✅ SMTP_HOST: smtp.mailtrap.io
  ✅ SMTP_PORT: 2525
  ✅ SMTP_USER: abc****xyz
  ✅ SMTP_PASS: ****
  ✅ ADMIN_NOTIFICATION_EMAIL: admin@panal-dev.local

🔍 Verificando inicialización de EmailService...

  ✅ EmailService inicializado correctamente

📧 Preparando datos de prueba...

  📍 Ticket ID: 507f1f77bcf86cd799439011
  📌 Título: [TEST] Impresora offline - Tercer Piso
  👤 Usuario: Usuario de Prueba Panal
  📬 Email: admin@panal-dev.local

🚀 Enviando email de prueba...

✅ Email enviado exitosamente!

═══════════════════════════════════════════════════════════════

📝 Próximos pasos:

  1. Accede a tu inbox en https://mailtrap.io
  2. Busca emails con asunto "Tu ticket ha sido creado en Panal"
  3. Revisa que contenga todos los detalles del ticket (ID, título, etc.)

═══════════════════════════════════════════════════════════════
```

### Paso 6: Verificar en Mailtrap

1. Abre Mailtrap en tu navegador
2. Ve al Inbox "Panal Development"
3. Deberías ver 2 emails:
   - Uno con asunto: `"✓ Tu ticket ha sido creado en Panal"`
   - Uno con asunto: `"[PANAL] Nuevo ticket creado - #XXXXX"`
4. Abre cada uno para inspeccionar contenido

**Qué buscar en los emails:**
- ✅ Número de ticket (#XXXXX) presente en ambos
- ✅ Título, descripción, prioridad, categoría
- ✅ HTML bien formateado con estilos
- ✅ Headers con colores
- ✅ Badges de prioridad con colores

---

## Testing con Gmail

### Ventajas
- ✅ Usa tu email real
- ✅ Requiere menos setup que Mailtrap
- ✅ Emails llegan a tu bandeja normal

### Paso 1: Habilitar verificación en dos pasos

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. Pestaña "Seguridad"
3. Busca "Verificación en dos pasos"
4. Habilítalo si no está activo

### Paso 2: Generar App Password

1. En "Seguridad" → busca "Contraseñas de aplicación"
2. Selecciona: Aplicación: "Correo", Dispositivo: "Windows, Mac, Linux"
3. Google genera una contraseña de 16 caracteres
4. **Cópiala exactamente como aparece (sin espacios)**

### Paso 3: Configurar .env

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=abcd1234efgh5678ijkl9012  # La App Password de 16 caracteres
SMTP_SECURE=false

# Admin email (puede ser el mismo o diferente)
ADMIN_NOTIFICATION_EMAIL=tu-email@gmail.com
```

### Paso 4: Probar

```bash
npm start
```

Luego crea un ticket (ver sección [Comandos de Test](#comandos-de-test))

### Paso 5: Revisar Gmail

- Abre tu bandeja de entrada Gmail
- Busca emails de "Panal"
- Deberías ver 2 emails (o 1 si admin es el mismo usuario)

---

## Comandos de Test

### Opción A: Script Automático (Recomendado)

```bash
# Prueba rápida de configuración SMTP
node scripts/test-email-service.js
```

### Opción B: Crear Ticket con cURL

**Prerequisito:** Servidor corriendo en http://localhost:3000

```bash
# Terminal 1: Inicia el servidor
npm start

# Terminal 2: Crea un ticket de prueba
curl -X POST http://localhost:3000/api/tickets/from-ai-draft \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Impresora offline - Tercer Piso",
    "descripcion": "La impresora HP LaserJet del tercer piso no responde a solicitudes de impresión.",
    "prioridad": "ALTA",
    "categoria": "SOPORTE"
  }'
```

**Respuesta esperada (201):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "titulo": "Impresora offline - Tercer Piso",
  "descripcion": "La impresora HP LaserJet del tercer piso no responde...",
  "prioridad": "ALTA",
  "categoria": "SOPORTE",
  "estado": "PENDIENTE",
  "created_by": "699d2f62b00a373767e0adc1",
  "workspace_id": "69a3e13581a5be4cb1bd8bc8",
  "createdAt": "2026-03-28T14:35:22.123Z",
  "updatedAt": "2026-03-28T14:35:22.123Z"
}
```

**Logs esperados en consola del servidor:**
```
✅ Email enviado a Usuario (admin@panal-dev.local): <message-id>
✅ Email enviado a Administrador (admin@panal-dev.local): <message-id>
```

### Opción C: Crear Ticket con Postman

1. Abre Postman
2. Crear nueva request:
   - Método: POST
   - URL: `http://localhost:3000/api/tickets/from-ai-draft`
   - Headers: `Content-Type: application/json`
   - Body (raw):
   ```json
   {
     "titulo": "Prueba desde Postman",
     "descripcion": "Este es un ticket de prueba de notificaciones por email",
     "prioridad": "BAJA",
     "categoria": "MEJORA"
   }
   ```
3. Click "Send"
4. Resultado: 201 con datos del ticket
5. Revisa emails en Mailtrap o Gmail

---

## Validación de Resultados

### Checklist de Validación

Después de crear un ticket, revisa:

#### Email al Usuario

**Asunto:**
```
✓ Tu ticket ha sido creado en Panal
```

**Contenido que debe incluir:**
- ✅ Número de ticket único (#XXXXX)
- ✅ Título exacto del ticket
- ✅ Descripción completa
- ✅ Prioridad con badge de color
- ✅ Categoría
- ✅ Fecha y hora de creación
- ✅ Estado "PENDIENTE"
- ✅ Sección "¿Qué sigue?" explicando próximos pasos
- ✅ Footer: "Este es un mensaje automático generado por el sistema Panal"

**Validación de estilo:**
- ✅ HTML bien formateado
- ✅ Colores suaves (gradientes azul/púrpura)
- ✅ Badges con colores (rojo para CRÍTICA, naranja para ALTA, azul para BAJA)
- ✅ Responsive (se ve bien en móvil)

#### Email al Administrador

**Asunto:**
```
[PANAL] Nuevo ticket creado - #XXXXX
```

**Contenido que debe incluir:**
- ✅ Nota administrativa ("Nuevo ticket creado por...")
- ✅ Todos los datos del ticket (igual que usuario)
- ✅ Información del usuario: nombre, email
- ✅ Indicación que requiere revisión y asignación

### Checklist de Funcionamiento

- ✅ Ticket se crea en MongoDB (respuesta 201)
- ✅ Email llega al usuario en <5 segundos
- ✅ Email llega al admin en <5 segundos
- ✅ Contenido HTML es correcto
- ✅ No hay errores en consola del servidor
- ✅ Número de ticket (#XXXXX) es único
- ✅ Estilo se aprecia profesional

---

## Solución de Problemas

### Problema: No recibo emails

**Checklist:**
```
□ ¿Credenciales SMTP correctas en .env?
  → Prueba: node scripts/test-email-service.js
  → Verifica SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

□ ¿SMTP_SECURE correcto?
  Gmail (587): SMTP_SECURE=false
  Gmail (465): SMTP_SECURE=true
  Mailtrap: SMTP_SECURE=false
  SendGrid: SMTP_SECURE=false

□ ¿EmailService inicializado?
  → Revisa logs: ✅ Email enviado... o ❌ Error enviando...

□ ¿Servidor reiniciado después de cambiar .env?
  → Detén npm start y vuelve a ejecutar: npm start

□ ¿Email admin configurado?
  → ADMIN_NOTIFICATION_EMAIL debe existir en .env
```

### Problema: Error "SMTP_HOST not configured"

```
⚠️  EmailService no está configurado. Saltando envío de notificaciones.
```

**Solución:**
```bash
# Verifica variables en .env
cat .env | grep SMTP

# Debe mostrar:
# SMTP_HOST=...
# SMTP_PORT=...
# SMTP_USER=...
# SMTP_PASS=...
```

### Problema: Error de autenticación SMTP

```
Error: Invalid login - 535 Authentication failed
```

**Para Gmail:**
- ❌ **NO** uses tu contraseña de Google
- ✅ **SÍ** usa App Password (generada en myaccount.google.com)
- ✅ Cópiala exactamente sin espacios

**Para Mailtrap:**
- Verifica credenciales en mailtrap.io → Inbox → SMTP Settings
- Revisa que escribiste correctamente

### Problema: Timeout de SMTP

```
Error: Connection timeout
```

**Causas posibles:**
- Firewall bloqueando puerto SMTP
- Servidor SMTP inaccesible
- Credenciales incorrectas

**Solución:**
```bash
# Prueba conectividad (requiere PowerShell/telnet)
# Windows:
Test-NetConnection -ComputerName smtp.mailtrap.io -Port 2525

# Linux/Mac:
nc -zv smtp.mailtrap.io 2525
```

### Problema: HTML mal formateado en email

**Causas:**
- Cliente email no soporta HTML (muy raro)
- Caracteres especiales sin escape

**Solución:**
- Abre en cliente web: Gmail, Mailbox, Mailtrap
- Si ves `&lt;` en lugar de `<` = problema de encoding

### Problema: Emails no llegan al usuario real

**Si usas Gmail:**
1. Revisa carpeta "Correo no deseado" / "Spam"
2. Gmail puede bloquer emails automáticos
3. Solución: Agregar dominio a lista blanca de SPF/DKIM

**Si usas servidor corporativo:**
- Contacta administrador de IT
- Puede haber restricciones de seguridad

---

## Comandos Útiles

```bash
# Prueba rápida
node scripts/test-email-service.js

# Ver variables SMTP configuradas
npm start > logs.txt 2>&1  # Revisa logs

# Crear un ticket de prueba
curl -X POST http://localhost:3000/api/tickets/from-ai-draft \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Test",
    "descripcion": "Test description",
    "prioridad": "BAJA",
    "categoria": "SOPORTE"
  }'

# Ver logs en tiempo real
npm start | grep -i email

# Verificar que nodemailer esta instalado
npm list nodemailer
```

---

## Checklist Final

Antes de pasar a producción:

- [ ] SMTP configurado en .env
- [ ] nodemailer instalado (`npm install`)
- [ ] EmailService exportado en `src/services/index.js`
- [ ] TicketsFromAIService importa EmailService
- [ ] Script test-email-service.js funciona
- [ ] Ticket se crea correctamente (201)
- [ ] Emails llegan a usuario y admin
- [ ] HTML se ve profesional
- [ ] No hay errores en consola
- [ ] Emails no bloquean creación de tickets
- [ ] SMTP_PASS no está en .gitignore (privado)
- [ ] Documentación actualizada

---

## Referencias

- [Nodemailer SMTP Config](https://nodemailer.com/smtp/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Mailtrap Docs](https://mailtrap.io/indiebox/)
- [SendGrid SMTP](https://sendgrid.com/docs/for-developers/sending-email/integrations/)

---

**Última actualización:** 28 Marzo 2026
**Versión de NodeMailer:** 6.9.4
**Compatibilidad:** Node.js 14+
