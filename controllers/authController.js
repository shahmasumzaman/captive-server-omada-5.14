// controllers/authController.js
import { authenticateWithRadius } from "../services/radiusService.js";
import { loginToOmadaController, authorizeOmadaClient } from "../services/omadaAuthService.js";
import config from "../config/index.js"; // To access operator credentials

import {
    AuthenticationError,
    ValidationError,
    RadiusError,
    OmadaAPIError,
    NetworkError,
} from "../errors/customErrors.js";

/**
 * Handles username/password login for Omada Captive Portal using RADIUS.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<void>}
 */
export async function handleOmadaUsernameLogin(req, res) {
    // These parameters come from the client's form submission OR
    // were stored in session/passed from the initial Omada redirect
    // (e.g., if your login form submits the query params from the redirect URL)
    const {
        username,
        password,
        clientMac,
        clientIp,
        redirectUrl,
        radioId,
        apMac,
        ssidName,
        gatewayMac,
        vid,
        // originUrl is often same as redirectUrl or a specific Omada param
        // For simplicity, let's use redirectUrl if originUrl is not distinctly needed.
    } = req.body;

    // You also need the 'site' parameter, which comes from the initial Omada redirect.
    // If your login form doesn't carry it in the body, it must be stored in a session
    // or passed via a hidden input from the initial GET request.
    const site = req.body.site || "Default"; // Assuming your form sends it, or default to "Default"
    const authDurationSeconds = 3600; // Define your desired authentication duration in seconds (1 hour example)

    // 1. Input Validation
    if (!username || !password || !clientMac || !apMac || !ssidName || !site) {
        console.error("Validation error: Missing required authentication parameters.", {
            username: !!username, password: !!password, clientMac: !!clientMac,
            apMac: !!apMac, ssidName: !!ssidName, site: !!site
        });
        return res.status(400).json({
            success: false,
            message: "Missing required authentication parameters.",
            error: "One or more required parameters are missing.",
        });
    }

    try {
        // 2. Authenticate with RADIUS
       const radiusSuccess = await authenticateWithRadius(
           username,
           password,
           clientMac,
           clientIp // clientIp is relevant for RADIUS Access-Request
       );

       if (!radiusSuccess) {
           console.log(`RADIUS authentication failed for user: ${username}`);
           throw new AuthenticationError("Invalid username or password.");
       }

        console.log(`RADIUS authentication successful for user: ${username}`);

        // --- NEW STEP: Log in to Omada Controller to get CSRF Token and TPOMADA_SESSIONID ---
        const { csrfToken, tpOmadaSessionId } = await loginToOmadaController(
            config.omada.operatorUsername,
            config.omada.operatorPassword
        );
        console.log(`Successfully logged into Omada Controller. CSRF: ${csrfToken}. TPOMADA_SESSIONID received.`);


        // 3. Notify Omada Controller (using authorizeOmadaClient)
        const omadaAuthDetails = {
            clientMac,
            apMac,
            ssidName,
            radioId: parseInt(radioId), // Ensure radioId is a number
            site, // Pass the site
            authDurationSeconds, // Pass the defined duration
            csrfToken, // Pass the obtained CSRF token
            tpOmadaSessionId, // Pass the obtained TPOMADA_SESSIONID
            // clientIp, gatewayMac, vid, originUrl, username, password are NOT included
            // in this specific Omada API call payload for authType: 4
        };

        await authorizeOmadaClient(omadaAuthDetails);

        console.log(`Omada Controller successfully authorized ${clientMac}`);

        // 4. Respond to client - Redirect to the original URL
        // Ensure redirectUrl is decoded if it came from URL parameters.
        const finalRedirectUrl = decodeURIComponent(redirectUrl || 'https://www.google.com');
        console.log(`Redirecting client to: ${finalRedirectUrl}`);
        return res.json({ success: true, message: "Authenticated", redirectUrl: finalRedirectUrl });

    } catch (error) {
        console.error(`Authentication error for ${username} (MAC: ${clientMac}):`, error);

        // Customize error responses based on error type
        if (error instanceof AuthenticationError || error instanceof RadiusError) {
            return res.status(401).json({ success: false, message: error.message });
        } else if (error instanceof OmadaAPIError) {
            let message = "Failed to authorize with Omada Controller.";
            if (error.errorCode) {
                message += ` Omada Error Code: ${error.errorCode}`;
            }
            return res.status(500).json({ success: false, message: message, error: error.message });
        } else if (error instanceof NetworkError) {
            return res.status(503).json({ success: false, message: `Network issue during authentication: ${error.message}` });
        } else {
            return res.status(500).json({ success: false, message: "An unexpected error occurred during authentication.", error: error.message });
        }
    }
}

// Placeholder for Aruba specific login handler
export async function handleArubaLogin(req, res) {
    // Implement Aruba specific authentication logic here
    // This might involve calling a separate Aruba API service
    return res.status(501).json({ success: false, message: "Aruba authentication not yet implemented." });
}