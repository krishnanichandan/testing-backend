"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ConflictError = exports.ForbiddenError = exports.RequestEntityTooLargeError = exports.RequestTimedOutError = exports.UnauthorizedError = exports.RecordNotFoundError = exports.ValidationError = exports.BadRequestError = exports.BaseError = void 0;
const common_errors_1 = require("common-errors");
const constants_1 = require("../core/constants");
class BaseError extends common_errors_1.Error {
    constructor(message) {
        super(message);
    }
}
exports.BaseError = BaseError;
class BadRequestError extends BaseError {
    constructor(message, errors) {
        super(message);
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.BAD_REQUEST;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
        this.errors = errors;
    }
}
exports.BadRequestError = BadRequestError;
class ValidationError extends BaseError {
    constructor(message) {
        super('Validation exception');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.BAD_REQUEST;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.ValidationError = ValidationError;
class RecordNotFoundError extends BaseError {
    constructor(message) {
        super('Record Not Found');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.NOT_FOUND;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.RecordNotFoundError = RecordNotFoundError;
class UnauthorizedError extends BaseError {
    constructor(message) {
        super('Unauthorized exception');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.UNAUTHORIZED;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.UnauthorizedError = UnauthorizedError;
class RequestTimedOutError extends BaseError {
    constructor(message) {
        super('Gateway Timeout');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.GATEWAY_TIMEOUT;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.RequestTimedOutError = RequestTimedOutError;
class RequestEntityTooLargeError extends BaseError {
    constructor(message) {
        super('Request entity too large');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.REQ_ENTITY_TOO_LARGE;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.RequestEntityTooLargeError = RequestEntityTooLargeError;
class ForbiddenError extends BaseError {
    constructor(message) {
        super('Access Forbidden');
        this.name = this.constructor.name;
        this.status = constants_1.httpStatusCode.FORBIDDEN;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends BaseError {
    constructor(message) {
        super('Conflict error');
        this.name = this.constructor.name;
        // eslint-disable-next-line no-unneeded-ternary
        this.status = constants_1.httpStatusCode.CONFLICT;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.message = message;
    }
}
exports.ConflictError = ConflictError;
class InternalServerError extends BaseError {
    constructor(message, coreException) {
        super('Internal Server Error');
        this.name = this.constructor.name;
        // eslint-disable-next-line no-unneeded-ternary
        this.status = constants_1.httpStatusCode.INTERNAL_SERVER_ERROR;
        common_errors_1.Error.captureStackTrace(this, this.constructor);
        // Saving custom property.
        this.coreException = coreException;
        this.message = message;
    }
}
exports.InternalServerError = InternalServerError;
