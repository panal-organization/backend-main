const Usuarios = require('../models/usuarios.model');

class SubscriptionValidationService {
    /**
     * IDs predefinidos de planes gratuito
     * Estos planes NO permiten acceso al agente IA en modo real
     */
    FREE_PLAN_IDS = ['69a3de4281a5be4cb1bd8bc0'];

    normalizePlanId(plan) {
        if (!plan) {
            return null;
        }

        if (typeof plan === 'object') {
            return plan._id?.toString?.() || plan.toString?.() || null;
        }

        return plan.toString?.() || String(plan);
    }

    normalizeDate(value) {
        if (!value) {
            return null;
        }

        const parsed = value instanceof Date ? value : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Valida si un usuario tiene suscripción activa para usar el agente IA
     * 
     * @param {string} userId - ID del usuario a validar
     * @returns {Promise<{isActive: boolean, reason: string|null, user: object|null}>}
     * 
     * Retorna:
     * - isActive: true si puede usar IA
     * - reason: descripción del bloqueo si isActive=false
     * - user: datos del usuario si existe
     */
    async validateUserSubscription(userId) {
        try {
            if (!userId) {
                return {
                    isActive: false,
                    reason: 'Usuario no identificado',
                    user: null
                };
            }

            const user = await Usuarios.findById(userId).lean();

            if (!user) {
                return {
                    isActive: false,
                    reason: 'Usuario no encontrado en el sistema',
                    user: null
                };
            }

            // Validar que el usuario esté activo
            if (!user.estatus) {
                return {
                    isActive: false,
                    reason: 'Tu cuenta no se encuentra activa en el sistema',
                    user
                };
            }

            // Validar que tenga un plan asignado
            if (!user.plan_id) {
                return {
                    isActive: false,
                    reason: 'No se encontró un plan asignado a tu cuenta',
                    user
                };
            }

            const planId = this.normalizePlanId(user.plan_id);

            // Validar que no sea un plan gratuito
            if (this.FREE_PLAN_IDS.includes(planId)) {
                return {
                    isActive: false,
                    reason: 'Tu plan actual no incluye acceso al asistente IA. Actualiza tu suscripción para usar esta funcionalidad.',
                    user,
                    planType: 'free',
                    validationMode: 'plan_only'
                };
            }

            const planInicio = this.normalizeDate(user.plan_inicio);
            const planVence = this.normalizeDate(user.plan_vence);
            const now = new Date();

            // Si el documento trae ambas fechas, la vigencia real manda.
            // Si faltan una o ambas, se mantiene fallback por plan_id + estatus.
            const hasDateWindow = Boolean(planInicio && planVence);

            if (hasDateWindow) {
                if (now < planInicio) {
                    return {
                        isActive: false,
                        reason: 'Tu suscripción aún no se encuentra vigente para usar el asistente IA.',
                        user,
                        planType: 'premium',
                        validationMode: 'date_window'
                    };
                }

                if (now > planVence) {
                    return {
                        isActive: false,
                        reason: 'Tu suscripción no se encuentra activa para usar el asistente IA.',
                        user,
                        planType: 'premium',
                        validationMode: 'date_window'
                    };
                }
            }

            return {
                isActive: true,
                reason: null,
                user,
                planType: 'premium',
                validationMode: hasDateWindow ? 'date_window' : 'plan_only_fallback'
            };
        } catch (error) {
            console.error('❌ Error validando suscripción:', error.message);
            return {
                isActive: false,
                reason: 'Error al validar tu suscripción. Intenta nuevamente.',
                user: null,
                error: error.message
            };
        }
    }

    /**
     * Valida suscripción sin información detallada (solo boolean)
     * Útil para rutas que solo necesitan saber si puede o no
     */
    async isSubscriptionActive(userId) {
        const validation = await this.validateUserSubscription(userId);
        return validation.isActive;
    }

    /**
     * Obtiene el correo del usuario si tiene suscripción activa
     * @param {string} userId - ID del usuario
     * @returns {Promise<string|null>} - Email del usuario o null si no válido
     */
    async getUserEmailIfSubscriptionActive(userId) {
        const validation = await this.validateUserSubscription(userId);
        if (validation.isActive && validation.user?.correo) {
            return validation.user.correo;
        }
        return null;
    }
}

module.exports = new SubscriptionValidationService();
