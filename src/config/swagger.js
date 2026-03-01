const swaggerUi = require('swagger-ui-express');

// Helper to convert type strings to Swagger
const getType = (type) => {
    switch (type.toLowerCase()) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        case 'date': return 'string'; // format: date-time
        default: return 'string';
    }
};

// Raw schemas from prompt
const rawSchemas = {
    "ESTADO_TICKETS": {
        "_id": "string",
        "nombre": "string"
    },
    "ESTADO_ORDEN": {
        "_id": "string",
        "nombre": "string"
    },
    "TICKETS": {
        "_id": "string",
        "descripcion": "string",
        "estado_id": "string",
        "created_by": "string",
        "created_at": "date",
        "updated_at": "date",
        "is_deleted": "boolean",
        "workspace_id": "string"
    },
    "USUARIOS": {
        "_id": "string",
        "nombre": "string",
        "correo": "string",
        "contrasena": "string",
        "estatus": "boolean",
        "rol_id": "string",
        "foto": "string"
    },
    "ROLES": {
        "_id": "string",
        "nombre": "string",
        "codigo": "string",
    },
    "MODULOS": {
        "_id": "string",
        "nombre": "string",
        "ruta": "string",
        "icono": "string",
        "estatus": "boolean"
    },
    "WORKSPACES": {
        "_id": "string",
        "nombre": "string",
        "admin_id": "string",
        "created_at": "date",
        "is_deleted": "boolean"
    },
    "PLAN": {
        "_id": "string",
        "nombre": "string",
        "descripcion": "string"
    },
    "TIPO_ORDENES": {
        "_id": "string",
        "nombre": "string"
    },
    "ORDENES_SERVICIO": {
        "_id": "string",
        "descripcion": "string",
        "estado_id": "string",
        "created_by": "string",
        "articulo_id": "string",
        "tipo_id": "string",
        "created_at": "date",
        "updated_at": "date",
        "is_deleted": "boolean",
        "workspace_id": "string"
    },
    "ALMACEN": {
        "_id": "string",
        "nombre": "string",
        "icono": "string",
        "registros": "number",
        "workspace_id": "string"
    },
    "ARTICULOS": {
        "_id": "string",
        "nombre": "string",
        "workspace_id": "string"
    },
    "PROPIEDADES": {
        "_id": "string",
        "nombre": "string",
        "descripcion": "string",
        "workspace_id": "string"
    },
    "PLANTILLAS": {
        "_id": "string",
        "nombre": "string",
        "descripcion": "string",
        "workspace_id": "string"
    },
    "WORKSPACES_USUARIOS": {
        "_id": "string",
        "workspace_id": "string",
        "usuario_id": "string"
    },
    "ARTICULOS_PROPIEDADES": {
        "_id": "string",
        "articulo_id": "string",
        "propiedad_id": "string"
    },
    "PLANTILLA_PROPIEDADES": {
        "_id": "string",
        "plantilla_id": "string",
        "propiedad_id": "string"
    },
    "ARCHIVOS": {
        "_id": "string",
        "nombre_original": "string",
        "nombre_servidor": "string",
        "mimetype": "string",
        "size": "number",
        "url": "string",
        "usuario_id": "string",
        "tipo": "string"
    }
};

const routeMap = {
    'estado-tickets': 'ESTADO_TICKETS',
    'estado-orden': 'ESTADO_ORDEN',
    'tickets': 'TICKETS',
    'usuarios': 'USUARIOS',
    'roles': 'ROLES',
    'modulos': 'MODULOS',
    'workspaces': 'WORKSPACES',
    'plan': 'PLAN',
    'tipo-ordenes': 'TIPO_ORDENES',
    'ordenes-servicio': 'ORDENES_SERVICIO',
    'almacen': 'ALMACEN',
    'articulos': 'ARTICULOS',
    'propiedades': 'PROPIEDADES',
    'plantillas': 'PLANTILLAS',
    'workspaces-usuarios': 'WORKSPACES_USUARIOS',
    'articulos-propiedades': 'ARTICULOS_PROPIEDADES',
    'plantilla-propiedades': 'PLANTILLA_PROPIEDADES',
    'archivos': 'ARCHIVOS'
};

// Build Components
const components = {
    schemas: {},
    securitySchemes: {
        BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
        }
    }
};
Object.entries(rawSchemas).forEach(([name, fields]) => {
    const properties = {};
    Object.entries(fields).forEach(([key, type]) => {
        properties[key] = { type: getType(type) };
        if (type === 'date') properties[key].format = 'date-time';
    });

    components.schemas[name] = { type: 'object', properties };

    // Input schema (exclude generic DB fields for POST/PUT examples if needed, but keeping simple)
    const inputProps = { ...properties };
    delete inputProps._id;
    delete inputProps.created_at;
    delete inputProps.updated_at;
    components.schemas[`${name}Input`] = { type: 'object', properties: inputProps };
});

// Build Paths
const paths = {};
Object.entries(routeMap).forEach(([route, schemaName]) => {
    const listPath = `/api/${route}`;
    const itemPath = `/api/${route}/{id}`;

    paths[listPath] = {
        get: {
            tags: [schemaName],
            summary: `Get all ${schemaName}`,
            security: [{ BearerAuth: [] }],
            responses: {
                200: {
                    description: 'Success',
                    content: { 'application/json': { schema: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } } } }
                }
            }
        },
        post: {
            tags: [schemaName],
            summary: `Create new ${schemaName}`,
            security: [{ BearerAuth: [] }],
            requestBody: {
                content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}Input` } } }
            },
            responses: { 201: { description: 'Created' } }
        }
    };

    paths[itemPath] = {
        get: {
            tags: [schemaName],
            summary: `Get ${schemaName} by ID`,
            security: [{ BearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Success' } }
        },
        put: {
            tags: [schemaName],
            summary: `Update ${schemaName}`,
            security: [{ BearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            requestBody: {
                content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}Input` } } }
            },
            responses: { 200: { description: 'Updated' } }
        },
        delete: {
            tags: [schemaName],
            summary: `Delete ${schemaName}`,
            security: [{ BearerAuth: [] }],
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Deleted' } }
        }
    };
});

// Auth Paths
paths['/api/auth/sign-in'] = {
    post: {
        tags: ['Auth'],
        summary: 'Sign in to the application',
        requestBody: {
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            correo: { type: 'string' },
                            contrasena: { type: 'string' }
                        },
                        required: ['correo', 'contrasena']
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Success',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                user: { $ref: '#/components/schemas/USUARIOS' },
                                token: { type: 'string' },
                                expiresIn: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }
};

paths['/api/auth/sign-up'] = {
    post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/USUARIOSInput' }
                }
            }
        },
        responses: {
            201: {
                description: 'Created',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                user: { $ref: '#/components/schemas/USUARIOS' },
                                token: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }
};

paths['/api/upload'] = {
    post: {
        tags: ['Files'],
        summary: 'Upload a file',
        requestBody: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            file: {
                                type: 'string',
                                format: 'binary'
                            },
                            usuario_id: {
                                type: 'string',
                                description: 'ID del usuario al que pertenece el archivo'
                            },
                            tipo: {
                                type: 'string',
                                enum: ['perfil', 'documento', 'otro'],
                                default: 'otro',
                                description: 'Si es "perfil", actualiza automáticamente la foto del usuario'
                            }
                        },
                        required: ['file', 'usuario_id']
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Success',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                archivo: { $ref: '#/components/schemas/ARCHIVOS' }
                            }
                        }
                    }
                }
            }
        }
    }
};

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Aplicaciones API',
        version: '1.0.0',
        description: 'Generated Swagger API documentation for Mongodb resources'
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: components,
    paths: paths
};

module.exports = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));
    console.log('Swagger UI setup at /api-docs');
};
