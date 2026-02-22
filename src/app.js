const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const routes = require('./routes/index');

require('dotenv').config();

const app = express();
const setupSwagger = require('./config/swagger');

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Documentation
setupSwagger(app);

// Routes
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('API Running');
});

module.exports = app;
