import fetch from "node-fetch";
import https from "https"; // Import https module for custom agent
import config from "../config/index.js";
import { OmadaAPIError, NetworkError } from "../errors/customErrors.js";

// Create a custom HTTPS agent for development, if rejectUnauthorized is false
const agent = config.omada.rejectUnauthorized === false ?
    new https.Agent({ rejectUnauthorized: false }) :
    undefined;

// Helper to get the base URL for Omada API calls
function getOmadaBaseUrl() {
    const { controllerIP, controllerPort, controllerID } = config.omada;
    const controllerIdPath = controllerID ? `/${controllerID}` : '';
    return `https://${controllerIP}:${controllerPort}${controllerIdPath}`;
}

/**
 * Logs in to the Omada Controller API to obtain a CSRF token and the session ID.
 * This token and session ID are essential for subsequent authenticated API calls.
 *
 * @param {string} username - The operator username configured in Omada Hotspot Manager.
 * @param {string} password - The operator password configured in Omada Hotspot Manager.
 * @returns {Promise<object>} - An object containing the `csrfToken` and `tpOmadaSessionId`.
 * @throws {OmadaAPIError|NetworkError} If the login fails or a network error occurs.
 */
export async function loginToOmadaController(username, password) {
    const loginUrl = `${getOmadaBaseUrl()}/api/v2/hotspot/login`;
    const postData = { name: username, password: password };

    console.log(`========================================`);
    console.log(`Attempting Omada Controller login to: ${loginUrl}`);
    console.log(`========================================`);

    try {
        const response = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postData),
            agent: agent, // Custom agent for SSL handling
        });

        // setting up the cookie header
        const setCookieHeader = response.headers.get('set-cookie');
        let tpOmadaSessionId = null;
        if (setCookieHeader) {
            const cookieStrings = typeof setCookieHeader === 'string' ? [setCookieHeader] : setCookieHeader;
            for (const cookieString of cookieStrings) {
                const cookies = cookieString.split(';');
                for (const cookie of cookies) {
                    const trimmedCookie = cookie.trim();
                    if (trimmedCookie.startsWith('TPOMADA_SESSIONID=')) {
                        tpOmadaSessionId = trimmedCookie.split('=')[1].split(';')[0];
                        break;
                    }
                }
                if (tpOmadaSessionId) break;
            }
        }
        
        // Always try to parse JSON, even if response is not OK, to get error codes.
        // If it's HTML, the .json() will fail and the error handling below will catch it.
        let jsonResponse;
        try {
            jsonResponse = await response.json();
        } catch (jsonError) {
            const rawText = await response.text(); // Read as text if JSON parsing fails
            console.error("Failed to parse Omada Login response as JSON. Raw response body:\n", rawText);
            throw new OmadaAPIError(
                `Omada login returned non-JSON response. Original JSON parsing error: ${jsonError.message}`,
                -1, // Custom error code for JSON parsing failure
                { rawResponse: rawText, originalError: jsonError.message, statusCode: response.status, msg:jsonError}
            );
        }

        if (!response.ok) { // Check response.ok AFTER trying to parse as JSON
            console.error(`Omada Login HTTP error: ${response.status} ${response.statusText}`);
            // If jsonResponse has an errorCode, it means it was parsed but was an error from Omada
            if (jsonResponse && jsonResponse.errorCode) {
                 console.error("Omada Login API returned an error (JSON response with error code):", jsonResponse);
            }
            throw new NetworkError(`Omada login network error: ${response.status} ${response.statusText}`, { statusCode: response.status, responseBody: JSON.stringify(jsonResponse) });
        }


        if (!tpOmadaSessionId) {
            console.warn("TPOMADA_SESSIONID cookie not found in login response. This might cause issues. Check 'Set-Cookie' header above.");
        }

        // Omada API returns errorCode: 0 on success
        if (jsonResponse.errorCode === 0 && jsonResponse.result && jsonResponse.result.token) {
            const csrfToken = jsonResponse.result.token;
            console.log(`========================================`);
            console.log("Omada Controller login successful. CSRF Token obtained.");
            if (tpOmadaSessionId) {
                 console.log(`TPOMADA_SESSIONID obtained.`);
            }
            console.log(`========================================`);

            return { csrfToken, tpOmadaSessionId };
        } else {
            console.error("Omada Controller login failed (JSON response with error code):", jsonResponse);
            throw new OmadaAPIError(
                `Omada login error: ${jsonResponse.errorCode}, Message: ${jsonResponse.msg || 'Unknown login error'}`,
                jsonResponse.errorCode,
                { omadaResponse: jsonResponse }
            );
        }
    } catch (error) {
        if (error instanceof OmadaAPIError || error instanceof NetworkError) {
            throw error;
        }
        console.error("Error during Omada Controller login:", error);
        throw new NetworkError("Failed to communicate with Omada Controller for login", { originalError: error.message });
    }
}

/**
 * Authorizes a client with the Omada Controller after successful authentication
 * on your external portal. This uses the Omada 5.x External Portal API.
 *
 * @param {object} authDetails - Authentication details for Omada.
 * @param {string} authDetails.clientMac - Client's MAC address.
 * @param {string} authDetails.apMac - Access Point MAC address.
 * @param {string} authDetails.ssidName - SSID name.
 * @param {number} authDetails.radioId - Radio ID (0 for 2.4G, 1 for 5G).
 * @param {string} authDetails.site - The Omada site name (e.g., "Default").
 * @param {number} authDetails.authDurationSeconds - Duration of authentication in seconds (e.g., 3600 for 1 hour).
 * @param {string} authDetails.csrfToken - The CSRF token obtained from Omada Controller API login.
 * @param {string} authDetails.tpOmadaSessionId - The TPOMADA_SESSIONID obtained from Omada Controller API login.
 * @returns {Promise<object>} - Omada API response.
 * @throws {OmadaAPIError|NetworkError} If Omada API call fails.
 */
export async function authorizeOmadaClient(authDetails) {
    const {
        clientMac,
        apMac,
        ssidName,
        radioId,
        site,
        authDurationSeconds,
        csrfToken,
        tpOmadaSessionId,
    } = authDetails;

    if (!tpOmadaSessionId) {
        console.error("TPOMADA_SESSIONID is missing for authorization request.");
        throw new OmadaAPIError("Missing TPOMADA_SESSIONID for Omada authorization.", 1);
    }

    const authUrl = `${getOmadaBaseUrl()}/api/v2/hotspot/extPortal/auth?token=${csrfToken}`;

    const payload = {
        clientMac: clientMac,
        apMac: apMac,
        ssidName: ssidName,
        radioId: parseInt(radioId),
        site: site,
        authType: 4, // IMPORTANT: Use 4 for External Portal Server
        time: authDurationSeconds,
    };

    console.log(`========================================`);
    console.log("Sending authorization payload to Omada:", JSON.stringify(payload));
    console.log("Omada Authorization URL:", authUrl);
    console.log(`Including Cookie: TPOMADA_SESSIONID=${tpOmadaSessionId.substring(0, 10)}...`);
    console.log(`========================================`);

    try {
        const response = await fetch(authUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": `TPOMADA_SESSIONID=${tpOmadaSessionId}`,
                "Csrf-Token": csrfToken,
            },
            body: JSON.stringify(payload),
            agent: agent,
        });

        // Read the response body once, potentially as text
        const responseBody = await response.text(); // <--- Read the body ONCE as text

        // Now, try to parse it as JSON
        let omadaResult;
        try {
            omadaResult = JSON.parse(responseBody); // <--- Parse the string
        } catch (jsonError) {
            // If JSON parsing fails, the raw text is already available in responseBody
            console.error("Failed to parse Omada Authorization response as JSON. Raw response body:\n", responseBody);
            throw new OmadaAPIError(
                `Omada API returned non-JSON response. Original JSON parsing error: ${jsonError.message}`,
                -1,
                { rawResponse: responseBody, originalError: jsonError.message, statusCode: response.status }
            );
        }

        // Check if the response was OK (HTTP status 2xx)
        if (!response.ok) {
            console.error(`Omada API HTTP error for authorization: ${response.status} ${response.statusText}`);
            // If omadaResult has an errorCode, it means it was parsed but was an error from Omada
            if (omadaResult && omadaResult.errorCode) {
                 console.error("Omada Authorization API returned an error (JSON response with error code):", omadaResult);
            }
            throw new NetworkError(`Omada API network error: ${response.status} ${response.statusText}`, { statusCode: response.status, responseBody: responseBody });
        }

        if (omadaResult.errorCode === 0) {
            console.log("Omada authorization successful:", omadaResult);
            return omadaResult;
        } else {
            console.error("Omada API returned an error (JSON response with error code):", omadaResult);
            throw new OmadaAPIError(
                `Omada error code: ${omadaResult.errorCode}, Message: ${omadaResult.msg || 'Unknown Omada error'}`,
                omadaResult.errorCode,
                { omadaResponse: omadaResult }
            );
        }
    } catch (error) {
        if (error instanceof OmadaAPIError || error instanceof NetworkError) {
            throw error;
        }
        console.error("Error communicating with Omada API for authorization:", error);
        throw new NetworkError("Failed to communicate with Omada API for authorization", { originalError: error.message });
    }
}