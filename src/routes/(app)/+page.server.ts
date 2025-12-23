import { redirect } from '@sveltejs/kit';

export function load() {
  // ...
  redirect(302, '/groups'); // needs `throw` in v1
}