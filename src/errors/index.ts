import {
    helpers
} from 'common-errors';
  
export const JoiValidationError: any = helpers.generateClass('ValidationError');
export const BadRequest: any = helpers.generateClass('BadRequest');
export const FileError: any = helpers.generateClass('FileError');

export const AWSError:any = helpers.generateClass('AWSError', { extends: BadRequest });
export const S3Error = helpers.generateClass('S3Error', { extends: AWSError });