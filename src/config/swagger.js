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
        "plan_id": "string",
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

components.schemas.AI_TICKET_DRAFT_REQUEST = {
    type: 'object',
    properties: {
        text: {
            type: 'string',
            description: 'Texto libre para generar el borrador del ticket'
        },
        workspace_id: {
            type: 'string',
            description: 'ID del workspace (opcional). Si no se envia, el backend intenta resolverlo automaticamente'
        }
    },
    required: ['text']
};

components.schemas.AI_TICKET_DRAFT_RESPONSE = {
    type: 'object',
    properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        prioridad: {
            type: 'string',
            enum: ['BAJA', 'ALTA', 'CRITICA']
        },
        categoria: {
            type: 'string',
            enum: ['SOPORTE', 'MEJORA']
        },
        tags: {
            type: 'array',
            items: { type: 'string' }
        },
        confidence: {
            type: 'number',
            format: 'float',
            minimum: 0,
            maximum: 1
        }
    },
    required: ['titulo', 'descripcion', 'prioridad', 'categoria', 'tags', 'confidence']
};

components.schemas.AI_ERROR_RESPONSE = {
    type: 'object',
    properties: {
        message: { type: 'string' }
    },
    required: ['message']
};

components.schemas.AI_TICKET_SAVE_FROM_DRAFT_REQUEST = {
    type: 'object',
    properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        prioridad: {
            type: 'string',
            enum: ['BAJA', 'ALTA', 'CRITICA']
        },
        categoria: {
            type: 'string',
            enum: ['SOPORTE', 'MEJORA']
        },
        ai_log_id: {
            type: 'string',
            description: 'ID opcional del log IA generado por /api/ai/agent o /api/ai/agent/plan. Si se envia, el backend actualiza el log con executed=true y execution_result.ticket_id del ticket creado.'
        }
    },
    required: ['titulo', 'descripcion', 'prioridad', 'categoria']
};

components.schemas.AI_TICKET_SAVE_FROM_DRAFT_RESPONSE = {
    type: 'object',
    properties: {
        _id: { type: 'string' },
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        foto: { type: 'string', nullable: true },
        estado: { type: 'string', enum: ['PENDIENTE', 'EN_PROGRESO', 'RESUELTO'] },
        prioridad: { type: 'string', enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] },
        categoria: { type: 'string', enum: ['BUG', 'SOPORTE', 'MEJORA', 'MANTENIMIENTO'] },
        created_by: { type: 'string' },
        workspace_id: { type: 'string' },
        is_deleted: { type: 'boolean' },
        comentarios: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    usuario: { type: 'string' },
                    comentario: { type: 'string' },
                    fecha: { type: 'string', format: 'date-time' }
                }
            }
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
    },
    required: [
        '_id',
        'titulo',
        'descripcion',
        'foto',
        'estado',
        'prioridad',
        'categoria',
        'created_by',
        'workspace_id',
        'is_deleted',
        'comentarios',
        'created_at',
        'updated_at'
    ]
};

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

paths['/api/workspaces/join-by-code'] = {
    post: {
        tags: ['WORKSPACES'],
        summary: 'Join a workspace by its unique code',
        security: [{ BearerAuth: [] }],
        requestBody: {
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            usuario_id: { type: 'string' },
                            codigo: { type: 'string' }
                        },
                        required: ['usuario_id', 'codigo']
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
                                workspace: {
                                    type: 'object',
                                    properties: {
                                        _id: { type: 'string' },
                                        nombre: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: { description: 'Bad Request / Already a member' },
            404: { description: 'Code not found' }
        }
    }
};

paths['/api/ai/tickets/draft'] = {
    post: {
        tags: ['AI'],
        summary: 'Generate AI ticket draft',
        description: 'Proxy endpoint that sends free text to the IA microservice and returns a validated ticket draft. Uses req.jwt.sub as user_id and resolves workspace_id automatically when omitted.',
        security: [{ BearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/AI_TICKET_DRAFT_REQUEST' },
                    examples: {
                        default: {
                            summary: 'Minimal request',
                            value: {
                                text: 'La impresora del area de recepcion no funciona y urge porque nadie puede imprimir'
                            }
                        },
                        withWorkspace: {
                            summary: 'Request with explicit workspace',
                            value: {
                                text: 'La impresora del area de recepcion no funciona y urge porque nadie puede imprimir',
                                workspace_id: '69a3e13581a5be4cb1bd8bc8'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Ticket draft generated successfully',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_TICKET_DRAFT_RESPONSE' }
                    }
                }
            },
            400: {
                description: 'Bad request (for example: text requerido)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            textRequired: {
                                value: { message: 'El campo text es requerido' }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Unauthorized (usuario no autenticado)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            unauthorized: {
                                value: { message: 'Usuario no autenticado' }
                            }
                        }
                    }
                }
            },
            403: {
                description: 'Forbidden (workspace_id invalido o no pertenece al usuario)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            workspaceForbidden: {
                                value: { message: 'El usuario no pertenece al workspace indicado' }
                            }
                        }
                    }
                }
            },
            404: {
                description: 'No workspace available for user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            workspaceNotFound: {
                                value: { message: 'No se encontro un workspace para el usuario autenticado' }
                            }
                        }
                    }
                }
            },
            502: {
                description: 'IA microservice error or connection error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            microserviceError: {
                                value: { message: 'Error al generar el borrador con IA' }
                            },
                            connectionError: {
                                value: { message: 'No se pudo conectar con el microservicio de IA' }
                            }
                        }
                    }
                }
            }
        }
    }
};

paths['/api/ai/tickets/draft-demo'] = {
    post: {
        tags: ['AI'],
        summary: 'Generate AI ticket draft (DEMO - no authentication required)',
        description: 'Demo endpoint to generate ticket drafts without JWT authentication. Requires AI_DEMO_MODE=true in environment. Uses fixed demo user and workspace from environment variables (AI_DEMO_USER_ID and AI_DEMO_WORKSPACE_ID). Perfect for testing the IA microservice locally.',
        security: [],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            text: {
                                type: 'string',
                                description: 'Texto libre para generar el borrador del ticket'
                            }
                        },
                        required: ['text']
                    },
                    examples: {
                        default: {
                            summary: 'Demo request',
                            value: {
                                text: 'La impresora del area de recepcion no funciona y urge porque nadie puede imprimir'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Ticket draft generated successfully',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_TICKET_DRAFT_RESPONSE' }
                    }
                }
            },
            400: {
                description: 'Bad request (text requerido)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            textRequired: {
                                value: { message: 'El campo text es requerido' }
                            }
                        }
                    }
                }
            },
            403: {
                description: 'Demo mode deshabilitado (AI_DEMO_MODE no es true)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            demoDisabled: {
                                value: { message: 'Demo mode esta deshabilitado' }
                            }
                        }
                    }
                }
            },
            500: {
                description: 'Server error (demo variables not configured or IA microservice error)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            missingVars: {
                                value: { message: 'Variables de demo no configuradas correctamente' }
                            },
                            microserviceError: {
                                value: { message: 'Error al generar el borrador con IA' }
                            }
                        }
                    }
                }
            }
        }
    }
};

paths['/api/tickets/from-ai-draft'] = {
    post: {
        tags: ['AI'],
        summary: 'Save real ticket from AI draft',
        description: 'Creates and stores a real ticket in MongoDB from an IA draft payload. It uses req.jwt.sub when Authorization Bearer is valid, or fallback demo context when AI_DEMO_MODE=true. If ai_log_id is provided, the related AI trace log is updated with executed=true and execution_result.ticket_id.',
        security: [{ BearerAuth: [] }, {}],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/AI_TICKET_SAVE_FROM_DRAFT_REQUEST' },
                    examples: {
                        default: {
                            value: {
                                titulo: 'Impresora no funciona',
                                descripcion: 'No imprime en recepcion y urge para atencion al cliente',
                                prioridad: 'ALTA',
                                categoria: 'SOPORTE',
                                ai_log_id: '69c0b62a6658a029e404c216'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'Ticket stored successfully',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_TICKET_SAVE_FROM_DRAFT_RESPONSE' }
                    }
                }
            },
            400: {
                description: 'Invalid body values',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            403: {
                description: 'Unauthorized workspace relation or demo mode disabled',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            404: {
                description: 'No workspace found for current user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            500: {
                description: 'Server or configuration error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            }
        }
    }
};

paths['/api/ai/agent'] = {
    post: {
        tags: ['AI'],
        summary: 'AI Agent Router - Intelligent Action Detection',
        description: 'Smart endpoint that analyzes user text and automatically routes to appropriate AI action handler (draft, summary, classify). Uses AGENT_ROUTER_SYSTEM_PROMPT to detect intent. Supports both authenticated and demo modes.',
        security: [{ BearerAuth: [] }, {}],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            text: {
                                type: 'string',
                                description: 'Natural language input for the AI agent to analyze and route'
                            },
                            workspace_id: {
                                type: 'string',
                                description: 'Optional: Specific workspace ID for authenticated users'
                            }
                        },
                        required: ['text']
                    },
                    examples: {
                        draftRequest: {
                            summary: 'Request for creating a ticket draft',
                            value: {
                                text: 'El router de la oficina no tiene internet y es urgente arreglarlo'
                            }
                        },
                        summaryRequest: {
                            summary: 'Request for ticket summary analysis',
                            value: {
                                text: 'Dame un resumen de los tickets de esta semana'
                            }
                        },
                        classifyRequest: {
                            summary: 'Request for ticket classification',
                            value: {
                                text: 'Clasifica este ticket como bug: la aplicacion se congela al cargar reportes'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Action detected and executed successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    enum: ['draft', 'summary', 'classify'],
                                    description: 'Detected action type'
                                },
                                confidence: {
                                    type: 'number',
                                    format: 'float',
                                    minimum: 0,
                                    maximum: 1,
                                    description: 'Confidence score of the action detection (0-1)'
                                },
                                ai_log_id: {
                                    type: 'string',
                                    description: 'ID del registro de trazabilidad de la interacción IA'
                                },
                                message: {
                                    type: 'string',
                                    description: 'Mensaje opcional del agente cuando la acción no devuelve un objeto result completo'
                                },
                                result: {
                                    type: 'object',
                                    description: 'Action-specific result object (varies by action type)'
                                }
                            }
                        },
                        examples: {
                            draftResult: {
                                summary: 'Draft action result',
                                value: {
                                    action: 'draft',
                                    confidence: 0.95,
                                    ai_log_id: '69c0b7ef6658a029e404c240',
                                    result: {
                                        titulo: 'Router sin internet',
                                        descripcion: 'El router de la oficina no tiene conexion a internet y es urgente repararlo',
                                        prioridad: 'ALTA',
                                        categoria: 'SOPORTE'
                                    }
                                }
                            },
                            summaryResult: {
                                summary: 'Summary action result',
                                value: {
                                    action: 'summary',
                                    confidence: 0.92,
                                    ai_log_id: '69c0b7ef6658a029e404c241',
                                    result: {
                                        resumen: 'Esta semana se reportaron 8 tickets, con 3 criticos relacionados con conectividad y performance de bases de datos.',
                                        tickets_criticos: 3,
                                        problemas_recurrentes: [
                                            'Problemas de conectividad',
                                            'Lentitud en consultas',
                                            'Fallos en sincronizacion'
                                        ],
                                        recomendacion: 'Revisar configuration del router y optimizar queries de BD'
                                    }
                                }
                            },
                            classifyResult: {
                                summary: 'Classify action result',
                                value: {
                                    action: 'classify',
                                    confidence: 0.9,
                                    ai_log_id: '69c0b7ef6658a029e404c242',
                                    result: {
                                        prioridad: 'ALTA',
                                        categoria: 'SOPORTE',
                                        justificacion: 'El problema afecta al trabajo del equipo y requiere atencion pronta de soporte técnico.',
                                        confidence: 0.9
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Bad request - Invalid action or missing required fields',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            textRequired: {
                                value: { message: 'El campo text es requerido' }
                            },
                            actionNotRecognized: {
                                value: {
                                    message: 'Acción no reconocida: "unknown". Válidas: draft, classify, summary',
                                    action: 'unknown',
                                    confidence: 0.4
                                }
                            }
                        }
                    }
                }
            },
            401: {
                description: 'Unauthorized - Authentication required (demo mode disabled)',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            unauthorized: {
                                value: { message: 'Autenticación requerida' }
                            }
                        }
                    }
                }
            },
            403: {
                description: 'Forbidden - Workspace authorization failed',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            workspaceForbidden: {
                                value: { message: 'El usuario no pertenece al workspace indicado' }
                            }
                        }
                    }
                }
            },
            404: {
                description: 'Not found - No workspace available for user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            workspaceNotFound: {
                                value: { message: 'No se encontro un workspace para el usuario autenticado' }
                            }
                        }
                    }
                }
            },
            501: {
                description: 'Not implemented - Reserved for future agent actions not yet available',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            notImplemented: {
                                value: {
                                    message: 'La acción "x" aún no está implementada',
                                    action: 'x',
                                    confidence: 0.88
                                }
                            }
                        }
                    }
                }
            },
            502: {
                description: 'Bad gateway - IA microservice error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' },
                        examples: {
                            microserviceError: {
                                value: { message: 'No se pudo conectar con el microservicio de IA' }
                            }
                        }
                    }
                }
            }
        }
    }
};

paths['/api/ai/agent/plan'] = {
    post: {
        tags: ['AI'],
        summary: 'AI Agent Planner - Execution plan before sensitive actions',
        description: 'Builds a structured execution plan from free text. It can include previews for draft/classify/summary and requires confirmation for create_ticket. This endpoint does not write to MongoDB.',
        security: [{ BearerAuth: [] }, {}],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            text: { type: 'string' },
                            workspace_id: { type: 'string' }
                        },
                        required: ['text']
                    },
                    examples: {
                        draftPlan: {
                            value: { text: 'La impresora de recepcion no funciona' }
                        },
                        createTicketPlan: {
                            value: { text: 'Crea un ticket porque la impresora de recepcion no funciona' }
                        }
                    }
                }
            }
        },
        responses: {
            200: {
                description: 'Plan generated successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                intent: {
                                    type: 'string',
                                    enum: ['draft', 'classify', 'summary', 'create_ticket']
                                },
                                confidence: { type: 'number', format: 'float' },
                                ai_log_id: {
                                    type: 'string',
                                    description: 'ID del registro de trazabilidad del plan IA'
                                },
                                message: { type: 'string' },
                                requires_confirmation: { type: 'boolean' },
                                steps: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            tool: { type: 'string' },
                                            status: {
                                                type: 'string',
                                                enum: ['ready', 'requires_confirmation']
                                            }
                                        }
                                    }
                                },
                                draft_preview: {
                                    type: 'object',
                                    properties: {
                                        titulo: { type: 'string' },
                                        descripcion: { type: 'string' },
                                        prioridad: { type: 'string' },
                                        categoria: { type: 'string' }
                                    }
                                },
                                summary_preview: {
                                    type: 'object',
                                    properties: {
                                        resumen: { type: 'string' }
                                    }
                                },
                                classify_preview: {
                                    type: 'object',
                                    properties: {
                                        prioridad: { type: 'string' },
                                        categoria: { type: 'string' },
                                        justificacion: { type: 'string' },
                                        confidence: { type: 'number', format: 'float' }
                                    }
                                }
                            }
                        },
                        examples: {
                            createTicketPlanResponse: {
                                summary: 'Plan con confirmación requerida y ai_log_id',
                                value: {
                                    intent: 'create_ticket',
                                    confidence: 1,
                                    ai_log_id: '69c0b62a6658a029e404c216',
                                    message: 'Plan preparado: el ticket requiere confirmación antes de guardarse.',
                                    requires_confirmation: true,
                                    steps: [
                                        { tool: 'draft', status: 'ready' },
                                        { tool: 'create_ticket_from_draft', status: 'requires_confirmation' }
                                    ],
                                    draft_preview: {
                                        titulo: 'Scanner de almacén no enciende',
                                        descripcion: 'El scanner de almacén no ha podido ser encendido desde esta mañana.',
                                        prioridad: 'ALTA',
                                        categoria: 'SOPORTE'
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            401: {
                description: 'Authentication required',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            502: {
                description: 'IA microservice error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            }
        }
    }
};

paths['/api/tickets/from-ai-draft'] = {
    post: {
        tags: ['AI'],
        summary: 'Save real ticket from AI draft',
        description: 'Creates and stores a real ticket in MongoDB from an IA draft payload. It uses req.jwt.sub when Authorization Bearer is valid, or fallback demo context when AI_DEMO_MODE=true. If ai_log_id is provided, the related AI trace log is updated with executed=true and execution_result.ticket_id.',
        security: [{ BearerAuth: [] }, {}],
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/AI_TICKET_SAVE_FROM_DRAFT_REQUEST' },
                    examples: {
                        default: {
                            value: {
                                titulo: 'Impresora no funciona',
                                descripcion: 'No imprime en recepcion y urge para atencion al cliente',
                                prioridad: 'ALTA',
                                categoria: 'SOPORTE',
                                ai_log_id: '69c0b62a6658a029e404c216'
                            }
                        }
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'Ticket stored successfully',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_TICKET_SAVE_FROM_DRAFT_RESPONSE' }
                    }
                }
            },
            400: {
                description: 'Invalid body values',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            403: {
                description: 'Unauthorized workspace relation or demo mode disabled',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            404: {
                description: 'No workspace found for current user',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
                    }
                }
            },
            500: {
                description: 'Server or configuration error',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AI_ERROR_RESPONSE' }
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
