import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function MinWords(
  minWords: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minWords',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [minWords],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const words = value.trim().split(/\s+/).filter(Boolean);
          return words.length >= args.constraints[0];
        },
        defaultMessage(args: ValidationArguments) {
          return `Trường "${args.property}" phải có ít nhất ${args.constraints[0]} từ`;
        },
      },
    });
  };
}
