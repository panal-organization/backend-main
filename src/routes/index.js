const { Router } = require('express');
const router = Router();
const controllers = require('../controllers');
const AuthController = require('../controllers/auth.controller');

// Auth Routes
router.post('/auth/sign-up', AuthController.signUp.bind(AuthController));
router.post('/auth/sign-in', AuthController.signIn.bind(AuthController));

// File Upload Route
const uploadMiddleware = require('../middlewares/upload.middleware');
const uploadController = require('../controllers/upload.controller');
router.post('/upload', uploadMiddleware.single('file'), uploadController.uploadFile);

// // Middleware to protect subsequent routes
// router.use(require('../middlewares/auth.middleware'));

// Mapping controller names to route paths
const routeMap = {
    EstadoTicketsController: 'estado-tickets',
    EstadoOrdenController: 'estado-orden',
    TicketsController: 'tickets',
    UsuariosController: 'usuarios',
    RolesController: 'roles',
    ModulosController: 'modulos',
    WorkspacesController: 'workspaces',
    PlanController: 'plan',
    TipoOrdenesController: 'tipo-ordenes',
    OrdenesServicioController: 'ordenes-servicio',
    AlmacenController: 'almacen',
    ArticulosController: 'articulos',
    PropiedadesController: 'propiedades',
    PlantillasController: 'plantillas',
    WorkspacesUsuariosController: 'workspaces-usuarios',
    ArticulosPropiedadesController: 'articulos-propiedades',
    PlantillaPropiedadesController: 'plantilla-propiedades',
    ArchivosController: 'archivos'
};

Object.keys(controllers).forEach(key => {
    const controller = controllers[key];
    const route = routeMap[key];
    if (route) {
        // Bind methods to controller instance to preserve context
        router.get(`/${route}`, controller.getAll.bind(controller));
        router.get(`/${route}/:id`, controller.get.bind(controller));
        router.post(`/${route}`, controller.create.bind(controller));
        router.put(`/${route}/:id`, controller.update.bind(controller));
        router.delete(`/${route}/:id`, controller.delete.bind(controller));
    }
});

module.exports = router;
