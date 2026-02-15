/**
 * Utility function to validate redirect URLs
 * Ensures redirects only go to relative paths within the application
 */
export function isValidRedirectUrl(url: string | null | undefined): boolean {
	if (!url || typeof url !== 'string') {
		return false;
	}

	// Trim whitespace
	url = url.trim();

	// Must start with /
	if (!url.startsWith('/')) {
		return false;
	}

	// Must not contain protocol (http://, https://, //)
	if (url.includes('://') || url.includes('//')) {
		return false;
	}

	// Must not contain common attack patterns
	if (url.includes('javascript:') || url.includes('data:') || url.includes('vbscript:')) {
		return false;
	}

	return true;
}

/**
 * Get safe redirect URL, defaulting to '/groups' if invalid
 * @param requestedUrl - URL from query parameter or form
 * @returns Validated URL or '/groups'
 */
export function getSafeRedirectUrl(requestedUrl: string | null | undefined): string {
	return isValidRedirectUrl(requestedUrl) ? requestedUrl! : '/groups';
}
