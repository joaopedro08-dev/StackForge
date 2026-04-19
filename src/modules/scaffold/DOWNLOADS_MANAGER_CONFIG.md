/**
 * Downloads Manager Configuration
 * 
 * This module handles secure downloads of generated projects with:
 * - Token-based authentication (24-hour TTL)
 * - Automatic cleanup of old files (7-day retention)
 * - Periodic cleanup jobs (runs every 1 hour)
 * - In-memory token store with expiry validation
 */

// Token Time-To-Live (hours)
// Default: 24 hours - tokens expire after this duration
export const DOWNLOAD_TTL_HOURS = 24;

// File Retention Period (days)
// Default: 7 days - ZIP files older than this are deleted
export const DOWNLOAD_RETENTION_DAYS = 7;

// Cleanup Job Interval (hours)
// Default: 1 hour - automatic cleanup runs every hour
export const CLEANUP_INTERVAL_HOURS = 1;

/**
 * API Flow:
 * 
 * 1. POST /api/scaffold/projects/download
 *    Request: { projectName, profile, language, database, ... }
 *    Response: { message, projectName, downloadToken }
 *    - Generates project in developers/projects/
 *    - Creates ZIP in web/public/downloads/
 *    - Returns token valid for 24 hours
 * 
 * 2. GET /api/scaffold/projects/download/:token
 *    Request: Authorization via URL token
 *    Response: File download (application/zip)
 *    - Validates token (not expired, exists)
 *    - Serves ZIP file from web/public/downloads/
 *    - Automatically cleanup project directory after generation
 * 
 * Token Validation:
 *    - Tokens are 64-character hex strings
 *    - Stored in-memory with expiry timestamp
 *    - Expired tokens are automatically cleaned
 *    - One token per download
 * 
 * Cleanup Process:
 *    1. On server startup: Immediate cleanup of expired files
 *    2. Hourly: Automatic cleanup of files older than 7 days
 *    3. Token cleanup: Expired tokens removed from memory
 *    4. Error handling: Cleanup failures don't break request lifecycle
 */

/**
 * Directory Structure:
 * 
 * developers/projects/
 *   └─ auth-service-TIMESTAMP-RANDOM/
 *        └─ [generated project files]
 *        (Cleaned up immediately after ZIP creation)
 * 
 * web/public/downloads/
 *   └─ my-app-TIMESTAMP.zip
 *        (Kept for 7 days, then auto-deleted)
 */

/**
 * Usage Examples:
 * 
 * // Generate project and get download token
 * POST http://localhost:3000/api/scaffold/projects/download
 * Content-Type: application/json
 * 
 * {
 *   "projectName": "my-app",
 *   "profile": "full",
 *   "language": "typescript",
 *   "database": "postgresql",
 *   ...
 * }
 * 
 * Response (200):
 * {
 *   "message": "Project archive generated successfully.",
 *   "projectName": "my-app",
 *   "downloadToken": "a1b2c3d4e5f6..."
 * }
 * 
 * // Download the project using token
 * GET http://localhost:3000/api/scaffold/projects/download/a1b2c3d4e5f6...
 * 
 * Response (200): 
 *   [ZIP file binary data]
 *   Headers:
 *     Content-Type: application/zip
 *     Content-Disposition: attachment; filename="my-app.zip"
 * 
 * Error Cases:
 * 
 * // Missing or invalid token
 * GET http://localhost:3000/api/scaffold/projects/download/invalid
 * Response (404): { message: "Download token not found or expired." }
 * 
 * // Expired token (>24 hours)
 * Response (410): { message: "Download token has expired." }
 */
