// errors/customErrors.js

export class AuthenticationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'AuthenticationError';
        this.details = details;
    }
}

export class RadiusError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'RadiusError';
        this.details = details;
    }
}

export class OmadaAPIError extends Error {
    constructor(message, errorCode = -1, details = {}) {
        super(message);
        this.name = 'OmadaAPIError';
        this.errorCode = errorCode;
        this.details = details;
    }
}

export class ValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}

export class NetworkError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'NetworkError';
        this.details = details;
    }
}

// Add more specific errors as needed (e.g., ArubaAPIError)