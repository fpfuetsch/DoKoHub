import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, mergeConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig as defineVitestConfig } from 'vitest/config';

const viteConfig = defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
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
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
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
