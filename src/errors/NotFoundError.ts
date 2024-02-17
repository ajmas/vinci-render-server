class NotFoundError extends Error {

  httpStatus: number = 404;

  constructor (message) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export default NotFoundError;