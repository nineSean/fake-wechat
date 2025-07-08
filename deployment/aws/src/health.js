exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'fake-wechat-backend',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: !!process.env.DATABASE_URL,
      },
      redis: {
        connected: !!process.env.REDIS_URL,
      },
    }),
  };
};