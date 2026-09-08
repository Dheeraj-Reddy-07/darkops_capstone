/**
 * Validation utilities for security hardening
 * Provides field allowlisting and input sanitization
 */

/**
 * Filters an object to only include allowed fields (mass assignment protection)
 * @param input - The raw input object from request body
 * @param allowedFields - Array of allowed field names
 * @returns Object containing only allowed fields
 */
export function filterAllowedFields<T extends Record<string, any>>(
  input: Record<string, any>,
  allowedFields: readonly (keyof T)[],
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const field of allowedFields) {
    if (field in input) {
      filtered[field] = input[field as string];
    }
  }

  return filtered;
}

/**
 * Sanitizes string input by removing potentially dangerous characters
 * @param input - Raw string input
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";

  // Remove null bytes and control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Escapes HTML entities to prevent XSS attacks
 * @param input - Raw string that may contain HTML
 * @returns HTML-escaped string
 */
export function escapeHTML(input: string): string {
  if (typeof input !== "string") return "";

  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEscapes[char]);
}

/**
 * Sanitizes user-generated content for safe display
 * Removes HTML tags and escapes special characters
 * @param input - Raw user input
 * @returns Sanitized string safe for display
 */
export function sanitizeUserContent(input: string): string {
  if (typeof input !== "string") return "";

  // First escape HTML entities
  const escaped = escapeHTML(input);

  // Remove any remaining potentially dangerous patterns
  return escaped
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/data:/gi, "");
}

/**
 * Validates and sanitizes pagination parameters
 * @param page - Page number from request
 * @param limit - Limit from request
 * @param maxLimit - Maximum allowed limit
 * @returns Validated pagination object
 */
export function validatePagination(
  page: any,
  limit: any,
  maxLimit: number = 100,
): { page: number; limit: number; from: number; to: number } {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 20));
  const from = (validatedPage - 1) * validatedLimit;
  const to = from + validatedLimit - 1;

  return {
    page: validatedPage,
    limit: validatedLimit,
    from,
    to,
  };
}

/**
 * Validates that a sort field is in the allowlist
 * @param field - Sort field from request
 * @param allowedFields - Array of allowed sort fields
 * @returns Validated sort field or default
 */
export function validateSortField(
  field: any,
  allowedFields: string[],
  defaultField: string,
): string {
  if (typeof field !== "string" || !allowedFields.includes(field)) {
    return defaultField;
  }
  return field;
}

/**
 * Validates sort direction
 * @param direction - Sort direction from request
 * @returns Validated sort direction (asc or desc)
 */
export function validateSortDirection(direction: any): "asc" | "desc" {
  if (direction === "desc") return "desc";
  return "asc";
}
