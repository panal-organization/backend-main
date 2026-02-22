const BaseService = require('./base.service');

module.exports = {
    EstadoTicketsService: new BaseService(require('../models/estado_tickets.model')),
    EstadoOrdenService: new BaseService(require('../models/estado_orden.model')),
    TicketsService: new BaseService(require('../models/tickets.model')),
    UsuariosService: new BaseService(require('../models/usuarios.model')),
    RolesService: new BaseService(require('../models/roles.model')),
    ModulosService: new BaseService(require('../models/modulos.model')),
    WorkspacesService: new BaseService(require('../models/workspaces.model')),
    PlanService: new BaseService(require('../models/plan.model')),
    TipoOrdenesService: new BaseService(require('../models/tipo_ordenes.model')),
    OrdenesServicioService: new BaseService(require('../models/ordenes_servicio.model')),
    AlmacenService: new BaseService(require('../models/almacen.model')),
    ArticulosService: new BaseService(require('../models/articulos.model')),
    PropiedadesService: new BaseService(require('../models/propiedades.model')),
    PlantillasService: new BaseService(require('../models/plantillas.model')),
    WorkspacesUsuariosService: new BaseService(require('../models/workspaces_usuarios.model')),
    ArticulosPropiedadesService: new BaseService(require('../models/articulos_propiedades.model')),
    PlantillaPropiedadesService: new BaseService(require('../models/plantilla_propiedades.model')),
    ArchivosService: new BaseService(require('../models/archivos.model')),
    AuthService: require('./auth.service')
};
