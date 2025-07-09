// 改进的 Lambda 函数处理器
exports.handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, body, headers } = event;
  
  // 添加 CORS 头
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };
  
  // 处理 OPTIONS 请求
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }
  
  try {
    // 路由处理
    if (path === '/health') {
      return {
        statusCode: 200,
        headers: corsHeaders,
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
    }
    
    // API 路由处理
    if (path.startsWith('/api/')) {
      const apiPath = path.replace('/api', '');
      
      switch (apiPath) {
        case '/health':
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              service: 'fake-wechat-api',
              environment: process.env.NODE_ENV || 'development',
              database: {
                connected: !!process.env.DATABASE_URL,
              },
              redis: {
                connected: !!process.env.REDIS_URL,
              },
            }),
          };
        
        case '/auth/login':
          if (httpMethod === 'POST') {
            const requestBody = JSON.parse(body || '{}');
            console.log('Login request:', requestBody);
            
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                message: 'Login endpoint is working',
                data: {
                  token: 'mock-jwt-token',
                  user: {
                    id: 'user-123',
                    username: requestBody.username || 'testuser',
                    email: requestBody.email || 'test@example.com'
                  }
                },
                timestamp: new Date().toISOString(),
              }),
            };
          }
          break;
        
        case '/auth/register':
          if (httpMethod === 'POST') {
            const requestBody = JSON.parse(body || '{}');
            console.log('Register request:', requestBody);
            
            return {
              statusCode: 201,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                message: 'Registration endpoint is working',
                data: {
                  user: {
                    id: 'user-456',
                    username: requestBody.username || 'newuser',
                    email: requestBody.email || 'new@example.com'
                  }
                },
                timestamp: new Date().toISOString(),
              }),
            };
          }
          break;
        
        case '/users/profile':
          if (httpMethod === 'GET') {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                data: {
                  id: 'user-123',
                  username: 'testuser',
                  email: 'test@example.com',
                  avatar: null,
                  createdAt: new Date().toISOString(),
                },
                timestamp: new Date().toISOString(),
              }),
            };
          }
          break;
        
        case '/friends':
          if (httpMethod === 'GET') {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                data: {
                  friends: [
                    {
                      id: 'friend-1',
                      username: 'friend1',
                      email: 'friend1@example.com',
                      status: 'online',
                    },
                    {
                      id: 'friend-2',
                      username: 'friend2',
                      email: 'friend2@example.com',
                      status: 'offline',
                    },
                  ],
                },
                timestamp: new Date().toISOString(),
              }),
            };
          }
          break;
        
        default:
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'API endpoint not found',
              path: apiPath,
              method: httpMethod,
              timestamp: new Date().toISOString(),
            }),
          };
      }
    }
    
    // 默认响应
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Fake WeChat API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        requestId: context.awsRequestId,
        event: {
          httpMethod,
          path,
          queryStringParameters: event.queryStringParameters,
        },
      }),
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};