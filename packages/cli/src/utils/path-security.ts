import * as path from "node:path"

export class PathValidationError extends Error {
	constructor(
		message: string,
		public readonly attemptedPath: string,
		public readonly reason: string,
	) {
		super(message)
		this.name = "PathValidationError"
	}
}

// Windows reserved device names
const WINDOWS_RESERVED = new Set([
	"CON",
	"PRN",
	"AUX",
	"NUL",
	"COM1",
	"COM2",
	"COM3",
	"COM4",
	"COM5",
	"COM6",
	"COM7",
	"COM8",
	"COM9",
	"LPT1",
	"LPT2",
	"LPT3",
	"LPT4",
	"LPT5",
	"LPT6",
	"LPT7",
	"LPT8",
	"LPT9",
])

/**
 * Validates a path is safe to use within a base directory.
 * Adapted from Vercel Turborepo + pillarjs/resolve-path + Docker safepath.
 *
 * Security properties:
 * 1. No null bytes (prevents C-style string termination bypass)
 * 2. Must be relative (no absolute paths on any platform)
 * 3. No Windows drive letters or UNC paths
 * 4. No Windows reserved device names
 * 5. Unicode normalized (prevents combining character attacks)
 * 6. Backslash normalized (prevents mixed separator bypasses)
 * 7. Must stay within base directory after resolution
 *
 * @param basePath - The trusted base directory
 * @param userPath - The untrusted path to validate (should be relative)
 * @returns The safe, resolved absolute path
 * @throws {PathValidationError} If the path is unsafe
 */
export function validatePath(basePath: string, userPath: string): string {
	// 1. Null byte check (from pillarjs/resolve-path)
	if (userPath.includes("\0")) {
		throw new PathValidationError("Path contains null bytes", userPath, "null_byte")
	}

	// 2. Absolute path check - both POSIX and Windows (from resolve-path)
	if (path.isAbsolute(userPath) || path.win32.isAbsolute(userPath)) {
		throw new PathValidationError("Path must be relative", userPath, "absolute_path")
	}

	// 3. Windows drive letters and UNC paths
	if (/^[a-zA-Z]:/.test(userPath) || userPath.startsWith("\\\\")) {
		throw new PathValidationError("Path contains Windows absolute", userPath, "windows_absolute")
	}

	// 4. Windows reserved names
	const baseName = path.basename(userPath).toUpperCase().split(".")[0] ?? ""
	if (WINDOWS_RESERVED.has(baseName)) {
		throw new PathValidationError("Path uses Windows reserved name", userPath, "windows_reserved")
	}

	// 5. Unicode normalization (from Turborepo)
	const normalized = userPath.normalize("NFC")

	// 6. Separator normalization - backslash to forward slash
	const unified = normalized.replace(/\\/g, "/")

	// 7. Resolve and check containment (from Turborepo + Docker)
	const resolvedBase = path.resolve(basePath)
	const resolvedCombined = path.resolve(resolvedBase, unified)
	const relativePath = path.relative(resolvedBase, resolvedCombined)

	// 8. Escape detection
	if (
		relativePath.startsWith("../") ||
		relativePath.startsWith("..\\") ||
		relativePath === ".." ||
		path.isAbsolute(relativePath)
	) {
		throw new PathValidationError("Path escapes base directory", userPath, "path_traversal")
	}

	return resolvedCombined
}

/**
 * Boolean check for path safety.
 *
 * @param basePath - The trusted base directory
 * @param userPath - The untrusted path to validate
 * @returns true if the path is safe, false otherwise
 */
export function isPathSafe(basePath: string, userPath: string): boolean {
	try {
		validatePath(basePath, userPath)
		return true
	} catch {
		return false
	}
}
