// app.js
import express from "express";
import bodyParser from "body-parser";
import config from "./config/index.js"; // Import your configuration
import authRoutes from "./routes/authRoutes.js"; // Import authentication routes
import path from "path";
import { fileURLToPath } from 'url';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Use the authentication routes
app.use("/api/auth", authRoutes); // All auth routes will be prefixed with /api/auth

// Basic root route for the portal's index page (if needed, adjust as per your frontend)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware (optional, but good practice)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


app.listen(config.port, () => {
    console.log(`Captive portal server listening on port ${config.port}`);
    console.log(`Environment variables loaded:`);
    console.log(`RADIUS_SERVER_IP: ${config.radius.serverIp}`);
    console.log(`OMADA_CONTROLLER_IP: ${config.omada.controllerIP}`); 
});