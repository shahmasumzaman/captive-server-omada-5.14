// services/radiusService.js
import radius from "radius";
import dgram from "dgram";
import config from "../config/index.js";
import { RadiusError, NetworkError } from "../errors/customErrors.js";

const socket = dgram.createSocket("udp4");

/**
 * Authenticates a user against a RADIUS server.
 * @param {string} username - The username.
 * @param {string} password - The password.
 * @param {string} clientMac - The client's MAC address.
 * @param {string} clientIp - The client's IP address.
 * @returns {Promise<boolean>} - True if authentication is successful, false otherwise.
 * @throws {RadiusError|NetworkError} If RADIUS communication fails or times out.
 */
export function authenticateWithRadius(username, password, clientMac, clientIp) {
    return new Promise((resolve, reject) => {
        const packet = radius.encode({
            code: "Access-Request",
            secret: config.radius.sharedSecret,
            attributes: [
                ["User-Name", username],
                ["User-Password", password],
                ["Calling-Station-Id", clientMac || ""],
                ["Framed-IP-Address", clientIp || ""],
            ],
        });

        const timeoutId = setTimeout(() => {
            socket.removeListener("message", onMessage);
            reject(new RadiusError("RADIUS server timeout"));
        }, config.radius.timeout);

        const onMessage = (msg, rinfo) => {
            // Ensure response is from the expected RADIUS server
            if (rinfo.address !== config.radius.serverIp || rinfo.port !== config.radius.serverPort) {
                // Ignore messages from unexpected sources
                return;
            }

            clearTimeout(timeoutId);
            socket.removeListener("message", onMessage);

            try {
                const response = radius.decode({
                    packet: msg,
                    secret: config.radius.sharedSecret,
                });
                resolve(response.code === "Access-Accept");
            } catch (err) {
                console.error("Error decoding RADIUS response:", err);
                reject(new RadiusError("Failed to decode RADIUS response", { originalError: err.message }));
            }
        };

        socket.on("message", onMessage);
        socket.once("error", (err) => {
            clearTimeout(timeoutId);
            socket.removeListener("message", onMessage);
            console.error("RADIUS socket error:", err);
            reject(new NetworkError("RADIUS socket error", { originalError: err.message }));
        });

        socket.send(
            packet,
            0,
            packet.length,
            config.radius.serverPort,
            config.radius.serverIp,
            (err) => {
                if (err) {
                    clearTimeout(timeoutId);
                    socket.removeListener("message", onMessage);
                    console.error("Error sending RADIUS packet:", err);
                    reject(new NetworkError("Failed to send RADIUS packet", { originalError: err.message }));
                }
            }
        );
    });
}