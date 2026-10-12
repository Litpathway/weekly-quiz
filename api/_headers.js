// Shared security-header helper — call once at the top of every handler.
module.exports = function applyHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // API responses are JSON — a tight CSP is safe and stops any hypothetical injection.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
};
