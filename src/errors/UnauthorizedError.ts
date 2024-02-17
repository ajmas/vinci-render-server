class UnauthorizedError extends Error {

  httpStatus: number = 403;

  constructor (message) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export default UnauthorizedError;