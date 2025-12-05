const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Connect to database
connectDB();

// Routes
app.use(routes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Glycr API is running' });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ API: http://localhost:${PORT}/api`);
});
