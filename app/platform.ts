const params = new URLSearchParams(window.location.search);

export const platform = params.get('platform');
export const isWebView = params.get('source') === 'webview';
