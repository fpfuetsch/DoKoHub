<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/dokohub.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>DoKoHub </title>
	<meta name="description" content="DoKoHub — Dokumentiere Doppelkopf-Spiele, verwalte Gruppen und sieh Statistiken ein." />

	<!-- Open Graph -->
	<meta property="og:locale" content="de_DE" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="DoKoHub" />
	<meta property="og:title" content="DoKoHub" />
	<meta property="og:description" content="DoKoHub — Dokumentiere Doppelkopf-Spiele, verwalte Gruppen und sieh Statistiken ein." />
	<meta property="og:image" content={favicon} />
	<meta property="og:image:alt" content="DoKoHub Logo" />
</svelte:head>

{@render children()}
