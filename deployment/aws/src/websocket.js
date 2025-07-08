exports.handler = async (event, context) => {
  const { requestContext, body } = event;
  
  console.log('WebSocket event:', {
    routeKey: requestContext.routeKey,
    connectionId: requestContext.connectionId,
    eventType: requestContext.eventType,
  });

  switch (requestContext.routeKey) {
    case '$connect':
      return { statusCode: 200 };
    case '$disconnect':
      return { statusCode: 200 };
    case '$default':
      // Handle WebSocket messages
      return { statusCode: 200 };
    default:
      return { statusCode: 400 };
  }
};