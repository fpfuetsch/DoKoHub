/**
 * Generates a palette of maximally distinguishable colors using HSL color space.
 * This ensures good color distribution even for an arbitrary number of players.
 *
 * @param count Number of colors to generate
 * @returns Array of color strings in hex format
 */
export function generateDistinctColorPalette(count: number): string[] {
	if (count <= 0) return [];
	if (count === 1) return ['#ef562f'];

	const colors: string[] = [];
	const saturation = 70; // 70% saturation for vibrant colors
	const lightness = 50; // 50% lightness for good visibility

	// Use golden ratio for optimal hue distribution
	const goldenRatioConjugate = 0.618033988749895;

	for (let i = 0; i < count; i++) {
		// Distribute hues evenly using golden ratio
		// This provides better visual distinction than simple division
		const hue = (i * goldenRatioConjugate * 360) % 360;

		// Alternate lightness slightly for adjacent colors
		// This helps when colors have similar hues
		const adjustedLightness = lightness + (i % 2 === 0 ? 5 : -5);

		const color = hslToHex(hue, saturation, adjustedLightness);
		colors.push(color);
	}

	return colors;
}

/**
 * Converts HSL color values to hex format
 *
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
	const sNorm = s / 100;
	const lNorm = l / 100;

	const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = lNorm - c / 2;

	let r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	const rHex = Math.round((r + m) * 255)
		.toString(16)
		.padStart(2, '0');
	const gHex = Math.round((g + m) * 255)
		.toString(16)
		.padStart(2, '0');
	const bHex = Math.round((b + m) * 255)
		.toString(16)
		.padStart(2, '0');

	return `#${rHex}${gHex}${bHex}`;
}
