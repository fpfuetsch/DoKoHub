<script lang="ts">
	import './layout.css';
	import logo from '$lib/assets/dokohub.png';

	const { data, children } = $props();
	const baseUrl = $derived(data.origin);
	const siteTitle = 'DoKoHub';
	const siteDescription =
		'DoKoHub — Dokumentiere Doppelkopf-Spiele, verwalte Gruppen und sieh Statistiken ein.';
</script>

<svelte:head>
	<link rel="icon" href={logo} />
	<link rel="canonical" href={baseUrl} />

	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />

	<!-- Open Graph -->
	<meta property="og:url" content={baseUrl} />
	<meta property="og:locale" content="de_DE" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={siteTitle} />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:image" content={logo} />
	<meta property="og:image:alt" content="DoKoHub Logo" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	<meta name="twitter:image" content={logo} />
</svelte:head>

{@render children()}
