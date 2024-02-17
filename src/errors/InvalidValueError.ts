class InvalidValueError extends Error {

  httpStatus: number = 422;
  field: string | undefined;

  constructor (message: string, field?: string) {
    super(message);

    this.field = field;

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InvalidValueError.prototype);
  }

  toJson (): Record<string, any> | Record<string, any>[] {
    return {
      field: this.field,
      message: this.message
    };
  }
}

export default InvalidValueError;