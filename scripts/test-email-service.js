#!/usr/bin/env node

/**
 * Script de prueba para validar funcionalidad de envío de emails
 * 
 * Uso:
 *   node scripts/test-email-service.js
 * 
 * Dependencias:
 *   - Requiere variables SMTP en .env configuradas
 *   - Se recomienda usar Mailtrap para testing (no contacta usuarios reales)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EmailService = require('../src/services/email.service');
const mongoose = require('mongoose');

async function testEmailService() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧪 TEST: Email Service para Notificaciones de Tickets');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Verificar configuración
    console.log('📋 Verificando configuración SMTP...\n');

    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'ADMIN_NOTIFICATION_EMAIL'];
    let allConfigured = true;

    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            const masked = varName.includes('PASS')
                ? value.substring(0, 4) + '****'
                : value;
            console.log(`  ✅ ${varName}: ${masked}`);
        } else {
            console.log(`  ❌ ${varName}: NO CONFIGURADO`);
            allConfigured = false;
        }
    });

    console.log('\n');

    if (!allConfigured) {
        console.error('❌ ERROR: Variables SMTP no completamente configuradas.');
        console.error('   Por favor, configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
        console.error('   en tu archivo .env\n');
        console.error('   Lee la documentación en: EMAIL_NOTIFICATIONS_SETUP.md\n');
        process.exit(1);
    }

    // Verificar que EmailService está configurado
    console.log('🔍 Verificando inicialización de EmailService...\n');
    if (!EmailService.isConfigured()) {
        console.error('❌ ERROR: EmailService no está configurado correctamente.');
        console.error('   Verifica variables SMTP en .env\n');
        process.exit(1);
    }
    console.log('  ✅ EmailService inicializado correctamente\n');

    console.log('🧪 Verificando conexión SMTP real...\n');
    const verification = await EmailService.verifyConnection();
    if (!verification.ok) {
        console.error('❌ ERROR: No fue posible verificar la conexión SMTP.');
        console.error(`   Motivo: ${verification.error}`);
        if (verification.code) {
            console.error(`   Código: ${verification.code}`);
        }
        if (verification.response) {
            console.error(`   Respuesta SMTP: ${verification.response}`);
        }
        console.error('   Configuración detectada:', verification.config);
        process.exit(1);
    }
    console.log('  ✅ Conexión SMTP verificada correctamente\n');

    // Crear ticket de prueba mock
    console.log('📧 Preparando datos de prueba...\n');
    const mockTicket = {
        _id: new mongoose.Types.ObjectId(),
        titulo: '[TEST] Impresora offline - Tercer Piso',
        descripcion: 'La impresora HP LaserJet del tercer piso no responde a solicitudes de impresión.\n\nEs urgente porque necesitamos imprimir documentos de la proposición del cliente.',
        prioridad: 'ALTA',
        categoria: 'SOPORTE',
        estado: 'PENDIENTE',
        createdAt: new Date(),
        userEmail: 'usuario@ejemplo.com'
    };

    const userEmail = process.env.TEST_USER_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL;
    const userName = 'Usuario de Prueba Panal';

    console.log(`  📍 Ticket ID: ${mockTicket._id}`);
    console.log(`  📌 Título: ${mockTicket.titulo}`);
    console.log(`  👤 Usuario: ${userName}`);
    console.log(`  📬 Email: ${userEmail}\n`);

    // Enviar email de prueba
    console.log('🚀 Enviando email de prueba...\n');
    try {
        const result = await EmailService.sendTicketCreatedNotification({
            ticket: mockTicket,
            userEmail: userEmail,
            userName: userName
        });

        if (!result?.ok) {
            console.error('❌ ERROR: El flujo de notificación no se completó correctamente.');
            console.error('   Resultado:', JSON.stringify(result, null, 2));
            process.exit(1);
        }

        console.log('✅ Emails enviados exitosamente!\n');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n📝 Próximos pasos:\n');

        if (process.env.SMTP_HOST.includes('mailtrap')) {
            console.log('  1. Accede a tu inbox en https://mailtrap.io');
            console.log('  2. Busca emails con asunto "Tu ticket ha sido creado en Panal"');
            console.log('  3. Revisa que contenga todos los detalles del ticket (ID, título, etc.)\n');
        } else if (process.env.SMTP_HOST.includes('gmail')) {
            console.log('  1. Revisa la bandeja de entrada de la cuenta Gmail configurada');
            console.log('  2. Busca emails con asunto "Tu ticket ha sido creado en Panal"');
            console.log('  3. Verifica que el contenido sea correcto\n');
        } else {
            console.log('  1. Revisa la bandeja de entrada del email configurado');
            console.log('  2. Busca emails recientes de notificación de tickets\n');
        }

        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ ERROR enviando email:\n');
        console.error(`  Tipo: ${error.code || error.name}`);
        console.error(`  Mensaje: ${error.message}\n`);

        console.log('🔧 Troubleshooting:\n');
        console.log('  • Verifica credenciales SMTP en .env');
        console.log('  • Para Gmail: Usa App Password, no tu contraseña');
        console.log('  • Para Mailtrap: Verifica que el inbox está activo');
        console.log('  • Verifica que el firewall permite conexiones SMTP salientes');
        console.log('  • Lee EMAIL_NOTIFICATIONS_SETUP.md para más detalles\n');

        process.exit(1);
    }
}

// Ejecutar test
testEmailService();
