import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, mergeConfig } from 'vite';
import { defineConfig as defineVitestConfig } from 'vitest/config';

const viteConfig = defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
