
interface Env {
  // Add environment variables here if needed
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', ''); // Remove /api/ prefix

  // Determine target API based on path prefix
  let targetUrl = '';
  
  if (path.startsWith('deepseek')) {
    targetUrl = 'https://api.deepseek.com' + path.replace('deepseek', '');
  } else if (path.startsWith('doubao')) {
    targetUrl = 'https://ark.cn-beijing.volces.com' + path.replace('doubao', '');
  } else if (path.startsWith('tongyi')) {
    targetUrl = 'https://dashscope.aliyuncs.com' + path.replace('tongyi', '');
  } else {
    return new Response('Invalid API Service', { status: 400 });
  }

  // Create new request to upstream
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Handle CORS for the response
  const response = await fetch(newRequest);
  const newResponse = new Response(response.body, response);
  
  // Set standard CORS headers
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return newResponse;
};

// Handle OPTIONS requests specifically for preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
