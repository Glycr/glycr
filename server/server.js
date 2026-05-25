const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');
const fs = require('fs');


if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir);
if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir);
connectDB();
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
