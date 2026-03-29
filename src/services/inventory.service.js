const Articulos = require('../models/articulos.model');
const Almacen = require('../models/almacen.model');
const TicketsFromAIService = require('./tickets-from-ai.service');

class InventoryService {
    async resolveWorkspaceInventory({ workspaceId }) {
        const almacenes = await Almacen.find({ workspace_id: workspaceId }).lean();
        const almacenesById = new Map(almacenes.map((almacen) => [almacen._id.toString(), almacen]));
        const almacenIds = almacenes.map((almacen) => almacen._id);

        const articleFilter = almacenIds.length
            ? {
                $or: [
                    { workspace_id: workspaceId },
                    { almacen_id: { $in: almacenIds } }
                ]
            }
            : { workspace_id: workspaceId };

        const articulos = await Articulos.find(articleFilter).lean();

        return {
            almacenes,
            almacenesById,
            articulos,
            articleFilter
        };
    }

    async getAllInventoryItems({ workspaceId }) {
        const { almacenesById, articulos } = await this.resolveWorkspaceInventory({ workspaceId });

        const items = articulos.map((articulo) => {
            const almacenId = articulo.almacen_id ? articulo.almacen_id.toString() : null;
            const almacen = almacenId ? almacenesById.get(almacenId) : null;

            return {
                id: articulo._id.toString(),
                nombre: articulo.nombre || '',
                descripcion: articulo.descripcion || null,
                estatus: Boolean(articulo.estatus),
                foto: articulo.foto || null,
                almacen_id: almacenId,
                almacen_nombre: almacen?.nombre || 'Sin almacén'
            };
        });

        return items;
    }

    async getInventorySummary({ workspaceId }) {
        const [items, almacenes] = await Promise.all([
            this.getAllInventoryItems({ workspaceId }),
            Almacen.find({ workspace_id: workspaceId }).lean()
        ]);

        const activos = items.filter((item) => item.estatus === true).length;
        const inactivos = items.filter((item) => item.estatus !== true).length;

        const articlesByAlmacenMap = new Map(
            almacenes.map((almacen) => [almacen._id.toString(), {
                almacen_id: almacen._id.toString(),
                almacen_nombre: almacen.nombre,
                total_articulos: 0
            }])
        );

        let orphanArticles = 0;
        items.forEach((item) => {
            if (!item.almacen_id || !articlesByAlmacenMap.has(item.almacen_id)) {
                orphanArticles += 1;
                return;
            }

            const current = articlesByAlmacenMap.get(item.almacen_id);
            current.total_articulos += 1;
        });

        const articulos_por_almacen = Array.from(articlesByAlmacenMap.values())
            .sort((a, b) => b.total_articulos - a.total_articulos || a.almacen_nombre.localeCompare(b.almacen_nombre));

        const integridad = orphanArticles === 0
            ? 'Integridad OK: todos los artículos tienen un almacén válido en el workspace.'
            : `Integridad parcial: ${orphanArticles} artículo(s) no tienen almacén válido en el workspace.`;

        return {
            total_articulos: items.length,
            total_almacenes: almacenes.length,
            articulos_activos: activos,
            articulos_inactivos: inactivos,
            articulos_por_almacen,
            integridad
        };
    }

    async getInventoryAlerts({ workspaceId, persistAlertState = false, autoCreateCriticalTickets = true } = {}) {
        const { almacenesById, articulos, articleFilter } = await this.resolveWorkspaceInventory({ workspaceId });

        const alertItems = articulos
            .filter((articulo) => {
                const stockActual = Number(articulo.stock_actual ?? 0);
                const stockMinimo = Number(articulo.stock_minimo ?? 0);
                return stockActual <= stockMinimo;
            })
            .map((articulo) => {
                const almacenId = articulo.almacen_id ? articulo.almacen_id.toString() : null;
                const almacen = almacenId ? almacenesById.get(almacenId) : null;
                const stockActual = Number(articulo.stock_actual ?? 0);
                const stockMinimo = Number(articulo.stock_minimo ?? 0);

                return {
                    id: articulo._id.toString(),
                    nombre: articulo.nombre || '',
                    almacen_nombre: almacen?.nombre || 'Sin almacén',
                    stock_actual: stockActual,
                    stock_minimo: stockMinimo,
                    unidad: articulo.unidad || 'unidad',
                    diferencia: stockMinimo - stockActual,
                    critico: stockActual === 0,
                    alerta_activa: true
                };
            })
            .sort((a, b) => b.diferencia - a.diferencia || a.nombre.localeCompare(b.nombre));

        const totalCriticos = alertItems.filter((item) => item.critico).length;
        const criticalItems = alertItems.filter((item) => item.critico);
        const ticketAutomation = {
            enabled: Boolean(autoCreateCriticalTickets),
            created: [],
            skipped: [],
            errors: []
        };

        if (persistAlertState) {
            const alertIds = new Set(alertItems.map((item) => item.id));
            const bulkOps = articulos.map((articulo) => ({
                updateOne: {
                    filter: { _id: articulo._id },
                    update: {
                        $set: {
                            alerta_activa: alertIds.has(articulo._id.toString())
                        }
                    }
                }
            }));

            if (bulkOps.length) {
                await Articulos.bulkWrite(bulkOps, { ordered: false });
            }
        }

        if (autoCreateCriticalTickets && criticalItems.length) {
            for (const item of criticalItems) {
                try {
                    const ticketResult = await TicketsFromAIService.createAutoInventoryCriticalTicket({
                        workspaceId,
                        articulo: item
                    });

                    if (ticketResult.created) {
                        ticketAutomation.created.push({
                            articulo_id: item.id,
                            ticket_id: ticketResult.ticket._id.toString()
                        });
                    } else {
                        ticketAutomation.skipped.push({
                            articulo_id: item.id,
                            reason: ticketResult.reason,
                            ticket_id: ticketResult.ticket?._id ? ticketResult.ticket._id.toString() : null
                        });
                    }
                } catch (error) {
                    ticketAutomation.errors.push({
                        articulo_id: item.id,
                        message: error.message
                    });
                }
            }
        }

        return {
            total_alertas: alertItems.length,
            total_criticos: totalCriticos,
            articulos_alerta: alertItems,
            regla: 'stock_actual <= stock_minimo',
            futuro_ticket_critico: {
                auto_ticket_sugerido: totalCriticos > 0,
                total_criticos: totalCriticos,
                articulos_criticos: criticalItems.map((item) => ({
                    id: item.id,
                    nombre: item.nombre,
                    almacen_nombre: item.almacen_nombre
                }))
            },
            ticket_automation: ticketAutomation,
            persistencia_alerta_activa: {
                enabled: Boolean(persistAlertState),
                scope: articleFilter
            }
        };
    }

    async getLowStockItems({ workspaceId }) {
        const alerts = await this.getInventoryAlerts({ workspaceId, persistAlertState: false });

        return {
            total_bajo_stock: alerts.total_alertas,
            total_criticos: alerts.total_criticos,
            items: alerts.articulos_alerta
        };
    }
}

module.exports = new InventoryService();
