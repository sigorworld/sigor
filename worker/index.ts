import { handleLogin, handleNonce, handleValidateToken } from '@gaiaprotocol/worker-common';

export default {
  async fetch(request, env, ctx): Promise<Response> {

    const url = new URL(request.url);
    if (url.pathname === '/api/nonce' && request.method === 'POST') return handleNonce(request, env);
    if (url.pathname === '/api/login' && request.method === 'POST') return handleLogin(request, 1, env);
    if (url.pathname === '/api/validate-token' && request.method === 'GET') return handleValidateToken(request, env);

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
