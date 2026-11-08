import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, mergeConfig } from 'vite';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig as defineVitestConfig } from 'vitest/config';

const viteConfig = defineConfig({
	plugins: [
		tailwindcss(),
		withPwa(
			{ preprocess: vitePreprocess(), adapter: adapter() },
			{
				// Kit builds with a relative Vite base; PWA URLs must stay root-absolute on nested routes.
				base: '/',
				scope: '/',
				manifest: {
					name: 'DoKoHub',
					short_name: 'DoKoHub',
					description: 'Dokumentiere Doppelkopf-Spiele, verwalte Gruppen und sieh Statistiken ein.',
					theme_color: '#ef562f',
					background_color: '#ffffff',
					display: 'standalone',
					icons: [
						{
							src: '/dokohub.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any maskable'
						}
					]
				},
				generateSW: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
					globStrict: false,
					navigateFallback: null
				},
				injectRegister: false,
				devOptions: {
					enabled: true,
					type: 'classic'
				}
			}
		)
	],
	ssr: {
		noExternal: ['layerchart', 'layercake']
	},
	optimizeDeps: {
		include: ['layerchart', 'layercake']
	}
});

const vitestConfig = defineVitestConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: './vitest.setup.ts'
	}
});

export default mergeConfig(viteConfig, vitestConfig);
