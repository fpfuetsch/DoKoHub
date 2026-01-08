# DoKoHub

## Development Setup

This project requires a few environment variables and a running Postgres database for local development. Below are the minimal steps to get a development environment running.

1. Create a `.env` file in the repository root (see `.env.example`)
2. Start the development Postgres (uses `dev.compose.yaml`):

```bash
docker compose -f dev.compose.yaml up -d
```

3. Install dependencies:

```bash
npm install
# or pnpm install
```

4. Run database migrations (Drizzle):

```bash
npx drizzle-kit migrate
```

5. Start the dev server:

```bash
npm run dev
```

The app typically appears at `http://localhost:5173` — check the terminal output for the exact URL.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
