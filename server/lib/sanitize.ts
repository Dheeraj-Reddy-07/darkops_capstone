/**
 * Input sanitization utilities to prevent XSS attacks
 */

/**
 * Sanitize user-generated text content
 * Removes HTML tags and dangerous characters while preserving safe text
 */
export function sanitizeText(input: string): string {
  if (!input) return "";

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove dangerous JavaScript protocols
      .replace(/javascript:/gi, "")
      // Remove data URLs (except images)
      .replace(/data:(?!image\/(png|jpeg|gif|webp))/gi, "")
      // Remove dangerous characters
      .replace(/[<>"'&]/g, "")
      // Normalize whitespace
      .trim()
  );
}

/**
 * Sanitize HTML content (for rich text that needs to be preserved)
 * This is a basic implementation - for production, use a library like DOMPurify
 */
export function sanitizeHTML(input: string): string {
  if (!input) return "";

  // Basic sanitization - remove script tags and dangerous attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers
    .replace(/javascript:/gi, "")
    .replace(/data:[^image]/gi, "");
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return "";

  return filename
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\.\./g, "") // Remove path traversal attempts
    .replace(/^\.+/, "") // Remove leading dots
    .trim();
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return "";

  return email.toLowerCase().trim().substring(0, 254); // Max email length
}

/**
 * Sanitize URL parameters
 */
export function sanitizeURLParam(param: string): string {
  if (!param) return "";

  return param.replace(/[<>"'&]/g, "").trim();
}

/**
 * Sanitize user input for database queries
 * This is a basic layer - parameterized queries should still be used
 */
export function sanitizeDBInput(input: string): string {
  if (!input) return "";

  return input
    .replace(/['"\\]/g, "") // Remove SQL quote characters
    .replace(/--/g, "") // Remove SQL comments
    .replace(/;/g, "") // Remove SQL statement terminators
    .trim();
}

/**
 * Validate that a string is a safe identifier (for IDs, etc.)
 */
export function isValidIdentifier(input: string): boolean {
  if (!input) return false;

  // Allow alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]+$/.test(input);
}

/**
 * Validate UUID format
 */
export function isValidUUID(input: string): boolean {
  if (!input) return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

/**
 * Sanitize search query to prevent injection
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return "";

  return query
    .replace(/[<>"'&;\\]/g, "")
    .replace(/\.\./g, "") // Prevent path traversal
    .trim()
    .substring(0, 100); // Limit length
}
