export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not Found",
    path: req.originalUrl,
  });
}

export function errorHandler(error, req, res, next) {
  void next;
  const status = error.status ?? 500;
  res.status(status).json({
    error: status >= 500 ? "Internal Server Error" : error.message,
  });
}
