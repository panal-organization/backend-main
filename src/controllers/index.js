const BaseController = require('./base.controller');
const {
    EstadoTicketsService,
    EstadoOrdenService,
    TicketsService,
    UsuariosService,
    RolesService,
    ModulosService,
    WorkspacesService,
    PlanService,
    TipoOrdenesService,
    OrdenesServicioService,
    AlmacenService,
    ArticulosService,
    PropiedadesService,
    PlantillasService,
    WorkspacesUsuariosService,
    ArticulosPropiedadesService,
    PlantillaPropiedadesService,
    ArchivosService
} = require('../services');

module.exports = {
    EstadoTicketsController: new BaseController(EstadoTicketsService),
    EstadoOrdenController: new BaseController(EstadoOrdenService),
    TicketsController: new BaseController(TicketsService),
    UsuariosController: new BaseController(UsuariosService),
    RolesController: new BaseController(RolesService),
    ModulosController: new BaseController(ModulosService),
    WorkspacesController: new BaseController(WorkspacesService),
    PlanController: new BaseController(PlanService),
    TipoOrdenesController: new BaseController(TipoOrdenesService),
    OrdenesServicioController: new BaseController(OrdenesServicioService),
    AlmacenController: new BaseController(AlmacenService),
    ArticulosController: new BaseController(ArticulosService),
    PropiedadesController: new BaseController(PropiedadesService),
    PlantillasController: new BaseController(PlantillasService),
    WorkspacesUsuariosController: new BaseController(WorkspacesUsuariosService),
    ArticulosPropiedadesController: new BaseController(ArticulosPropiedadesService),
    PlantillaPropiedadesController: new BaseController(PlantillaPropiedadesService),
    ArchivosController: new BaseController(ArchivosService),
    AuthController: require('./auth.controller')
};
