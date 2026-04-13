require('dotenv').config(); // Must be first — services read process.env on module load
const { validateRequiredEnv } = require('./config/env.validation');
validateRequiredEnv();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const routes = require('./routes/index');
const requestLogger = require('./middlewares/request-logger');
const logger = require('./utils/logger');

const app = express();
const setupSwagger = require('./config/swagger');

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Documentation
setupSwagger(app);

// Routes
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('API Running');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'backend-main',
        uptime_seconds: Number(process.uptime().toFixed(2)),
        timestamp: new Date().toISOString()
    });
});

app.get('/metrics', (req, res) => {
    const uptime = Number(process.uptime().toFixed(2));
    const metrics = [
        '# HELP panal_app_up Panal backend availability',
        '# TYPE panal_app_up gauge',
        'panal_app_up 1',
        '# HELP panal_app_uptime_seconds Panal backend uptime in seconds',
        '# TYPE panal_app_uptime_seconds gauge',
        `panal_app_uptime_seconds ${uptime}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(`${metrics}\n`);
});

app.use((err, req, res, next) => {
    logger.error('unhandled_route_error', {
        path: req.originalUrl,
        method: req.method,
        error: logger.serializeError(err)
    });

    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || 500;
    res.status(status).json({
        message: err.message || 'Error interno del servidor'
    });
});

module.exports = app;
