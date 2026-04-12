# backend-main

## Variables de Entorno para Notificaciones por Email

El sistema Panal incluye notificaciones automáticas por email cuando se crean tickets desde el agente IA. Para configurarlo correctamente, agrega las siguientes variables a tu archivo `.env`:

### Configuración SMTP

```env
# Servidor SMTP (ejemplos de proveedores populares)
SMTP_HOST=smtp.mailtrap.io          # Mailtrap (testing) | smtp.gmail.com (Gmail) | tu-servidor.com
SMTP_PORT=2525                       # Puerto (2525 Mailtrap, 587 Gmail, 465 SSL)
SMTP_USER=tu-usuario@example.com     # Usuario SMTP
SMTP_PASS=tu-password-segura         # Contraseña SMTP
SMTP_SECURE=false                    # true para SSL (puerto 465), false para TLS (puerto 587)
```

### Email Administrativo

```env
ADMIN_NOTIFICATION_EMAIL=joseph.thedev117@gmail.com
```

Esta dirección recibe una copia de cada ticket creado desde el agente IA.

### Proveedores SMTP Recomendados

**Mailtrap** (Development/Testing - Recomendado)
```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=tu_username_mailtrap
SMTP_PASS=tu_password_mailtrap
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@panal.local
```
👉 Regístrate en [mailtrap.io](https://mailtrap.io) - Los emails se capturan en un inbox, no van a usuarios reales.

**Gmail** (Production)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
SMTP_SECURE=false
ADMIN_NOTIFICATION_EMAIL=admin@empresa.com
```
👉 Genera una App Password en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

Para más información sobre configuración y troubleshooting, consulta:
- `EMAIL_NOTIFICATIONS_SETUP.md` - Guía completa de configuración
- `TESTING_EMAIL_NOTIFICATIONS.md` - Guía de testing