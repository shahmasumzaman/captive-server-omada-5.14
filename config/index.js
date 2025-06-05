// config/index.js
import dotenv from "dotenv";
dotenv.config();

const config = {
    port: parseInt(process.env.PORT || "3000"), // Uses 3000 by default if PORT isn't set
    omada: {
        controllerIP: process.env.OMADA_CONTROLLER_IP || '127.0.0.1',
        controllerPort: process.env.OMADA_CONTROLLER_PORT ? parseInt(process.env.OMADA_CONTROLLER_PORT) : 8043,
        controllerID: process.env.OMADA_CONTROLLER_ID || '', // Default to empty string if no ID
        operatorUsername: process.env.OMADA_OPERATOR_USERNAME,
        operatorPassword: process.env.OMADA_OPERATOR_PASSWORD,
        rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    },
    radius: {
        serverIp: process.env.RADIUS_SERVER_IP || '127.0.0.1',
        serverPort: parseInt(process.env.RADIUS_SERVER_PORT || "1812"),
        sharedSecret: process.env.RADIUS_SHARED_SECRET,
        timeout: parseInt(process.env.RADIUS_TIMEOUT || "5000"),
    },
    aruba: {
        apiEndpoint: process.env.ARUBA_API_ENDPOINT,
        clientId: process.env.ARUBA_CLIENT_ID,
        clientSecret: process.env.ARUBA_CLIENT_SECRET,
    },
};

export default config;