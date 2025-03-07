import { JoiValidationError } from '../errors';
import { ValidationError } from '../errors/error';

const validate = (data : any, schema :any) => {
  const { error } = schema.validate(data);
   console.log('Errorororere', error)
  if (!error) {
    return;
  }

  const instance = new JoiValidationError(error.message);
  instance.details = error.details;
  throw new ValidationError(instance);
};

export { validate };