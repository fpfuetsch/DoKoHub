import { describe, expect, it } from 'vitest';
import { isValidRedirectUrl, getSafeRedirectUrl } from './redirect';

describe('Redirect URL Validation', () => {
	describe('isValidRedirectUrl', () => {
		it('accepts relative URLs starting with /', () => {
			expect(isValidRedirectUrl('/groups')).toBe(true);
			expect(isValidRedirectUrl('/groups/abc-123')).toBe(true);
			expect(isValidRedirectUrl('/profile')).toBe(true);
		});

		it('accepts URLs with query parameters', () => {
			expect(isValidRedirectUrl('/groups?tab=games')).toBe(true);
			expect(isValidRedirectUrl('/groups/abc?filter=active&sort=name')).toBe(true);
		});

		it('accepts URLs with hash fragments', () => {
			expect(isValidRedirectUrl('/groups#section')).toBe(true);
		});

		it('rejects absolute URLs with protocol', () => {
			expect(isValidRedirectUrl('https://evil.com')).toBe(false);
			expect(isValidRedirectUrl('http://evil.com')).toBe(false);
		});

		it('rejects protocol-relative URLs', () => {
			expect(isValidRedirectUrl('//evil.com')).toBe(false);
		});

		it('rejects javascript: URLs', () => {
			expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false);
		});

		it('rejects data: URLs', () => {
			expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
		});

		it('rejects vbscript: URLs', () => {
			expect(isValidRedirectUrl('vbscript:msgbox(1)')).toBe(false);
		});

		it('rejects URLs not starting with /', () => {
			expect(isValidRedirectUrl('groups')).toBe(false);
			expect(isValidRedirectUrl('evil.com')).toBe(false);
		});

		it('rejects null, undefined, and empty strings', () => {
			expect(isValidRedirectUrl(null)).toBe(false);
			expect(isValidRedirectUrl(undefined)).toBe(false);
			expect(isValidRedirectUrl('')).toBe(false);
		});

		it('trims whitespace before validation', () => {
			expect(isValidRedirectUrl('  /groups  ')).toBe(true);
		});
	});

	describe('getSafeRedirectUrl', () => {
		it('returns valid URL when provided', () => {
			expect(getSafeRedirectUrl('/groups')).toBe('/groups');
			expect(getSafeRedirectUrl('/groups/abc')).toBe('/groups/abc');
		});

		it('returns /groups when URL is invalid', () => {
			expect(getSafeRedirectUrl('https://evil.com')).toBe('/groups');
			expect(getSafeRedirectUrl('//evil.com')).toBe('/groups');
			expect(getSafeRedirectUrl(null)).toBe('/groups');
		});
	});
});
