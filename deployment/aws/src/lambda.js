// 简化的 Lambda 函数处理器
exports.handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));
  console.log('Lambda context:', JSON.stringify(context, null, 2));
  
  // 基本的健康检查响应
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify({
      message: 'Fake WeChat API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      requestId: context.awsRequestId,
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers,
      },
    }),
  };
};