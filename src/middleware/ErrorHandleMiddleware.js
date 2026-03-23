const ResponseMiddleware = require("./ResponseMiddleware");

module.exports = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (ex) {
      console.error(`Error in ${handler.name || "handler"}`, {
        error: ex.message,
        stack: ex.stack,
      });

      req.rCode = 0;
      const message = ex.message || "An unexpected error occurred. Please try again.";

      ResponseMiddleware(req, res, next, message);
    }
  };
};
