"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Error = exports.AWSError = exports.FileError = exports.BadRequest = exports.JoiValidationError = void 0;
const common_errors_1 = require("common-errors");
exports.JoiValidationError = common_errors_1.helpers.generateClass('ValidationError');
exports.BadRequest = common_errors_1.helpers.generateClass('BadRequest');
exports.FileError = common_errors_1.helpers.generateClass('FileError');
exports.AWSError = common_errors_1.helpers.generateClass('AWSError', { extends: exports.BadRequest });
exports.S3Error = common_errors_1.helpers.generateClass('S3Error', { extends: exports.AWSError });
