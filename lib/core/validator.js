"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const errors_1 = require("../errors");
const error_1 = require("../errors/error");
const validate = (data, schema) => {
    const { error } = schema.validate(data);
    console.log('Errorororere', error);
    if (!error) {
        return;
    }
    const instance = new errors_1.JoiValidationError(error.message);
    instance.details = error.details;
    throw new error_1.ValidationError(instance);
};
exports.validate = validate;
