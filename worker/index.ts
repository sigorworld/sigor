export default {
  async fetch(request, env, ctx): Promise<Response> {
    return new Response('Hello World!');

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
