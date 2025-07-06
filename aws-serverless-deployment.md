# AWS Serverless 部署架构设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Applications                         │
├─────────────────────────────────────────────────────────────────────┤
│    React Web App    │    React Native App    │    Admin Dashboard   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS CloudFront (CDN)                         │
├─────────────────────────────────────────────────────────────────────┤
│  Static Assets Cache  │  API Response Cache  │  Media File Cache    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Origin Request
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AWS API Gateway                               │
├─────────────────────────────────────────────────────────────────────┤
│  HTTP API  │  WebSocket API  │  Rate Limiting  │  Authorization     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Lambda Invoke
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Lambda Functions                        │
├─────────────────────────────────────────────────────────────────────┤
│  User Service  │  Chat Service  │  Media Service  │  Notification   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Data Access
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                │
├─────────────────────────────────────────────────────────────────────┤
│  RDS PostgreSQL  │  DynamoDB  │  ElastiCache  │  S3  │  SQS  │  SNS │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心 AWS 服务架构

### 1. API Gateway 配置

#### HTTP API Gateway
```yaml
# api-gateway.yaml
Resources:
  HttpApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: wechat-app-api
      ProtocolType: HTTP
      CorsConfiguration:
        AllowCredentials: true
        AllowHeaders:
          - "*"
        AllowMethods:
          - "*"
        AllowOrigins:
          - "https://yourapp.com"
          - "https://admin.yourapp.com"
      
  # JWT Authorizer
  JwtAuthorizer:
    Type: AWS::ApiGatewayV2::Authorizer
    Properties:
      ApiId: !Ref HttpApi
      AuthorizerType: JWT
      Name: jwt-authorizer
      JwtConfiguration:
        Audience:
          - wechat-app
        Issuer: https://auth.yourapp.com
      IdentitySource:
        - $request.header.Authorization
```

#### WebSocket API Gateway
```yaml
Resources:
  WebSocketApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: wechat-app-websocket
      ProtocolType: WEBSOCKET
      RouteSelectionExpression: $request.body.action
      
  # WebSocket Routes
  ConnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $connect
      Target: !Sub "integrations/${ConnectIntegration}"
      
  DisconnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $disconnect
      Target: !Sub "integrations/${DisconnectIntegration}"
```

### 2. Lambda Functions 架构

#### Function 配置模板
```yaml
# lambda-functions.yaml
Resources:
  # User Service Lambda
  UserServiceFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: wechat-user-service
      Runtime: nodejs18.x
      Handler: dist/user-service/handler.handler
      Code:
        S3Bucket: !Ref DeploymentBucket
        S3Key: user-service.zip
      Environment:
        Variables:
          DB_HOST: !GetAtt Database.Endpoint.Address
          REDIS_HOST: !GetAtt RedisCluster.RedisEndpoint.Address
          JWT_SECRET: !Ref JwtSecret
      VpcConfig:
        SecurityGroupIds:
          - !Ref LambdaSecurityGroup
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
      ReservedConcurrencyLimit: 100
      
  # Chat Service Lambda
  ChatServiceFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: wechat-chat-service
      Runtime: nodejs18.x
      Handler: dist/chat-service/handler.handler
      Timeout: 30
      MemorySize: 512
      Environment:
        Variables:
          DYNAMODB_TABLE: !Ref MessagesTable
          WEBSOCKET_API_ENDPOINT: !Sub "${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com"
      
  # Media Service Lambda
  MediaServiceFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: wechat-media-service
      Runtime: nodejs18.x
      Handler: dist/media-service/handler.handler
      Timeout: 300
      MemorySize: 1024
      Environment:
        Variables:
          S3_BUCKET: !Ref MediaBucket
          CLOUDFRONT_DOMAIN: !GetAtt CloudFrontDistribution.DomainName
```

### 3. 数据存储架构

#### RDS PostgreSQL 配置
```yaml
Resources:
  # Database Subnet Group
  DatabaseSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      Tags:
        - Key: Name
          Value: wechat-db-subnet-group
          
  # RDS Instance
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: wechat-app-db
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: "15.4"
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      AllocatedStorage: 20
      StorageType: gp2
      StorageEncrypted: true
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      DBSubnetGroupName: !Ref DatabaseSubnetGroup
      BackupRetentionPeriod: 7
      MultiAZ: true
      DeletionProtection: true
```

#### DynamoDB 配置
```yaml
Resources:
  # Messages Table
  MessagesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: wechat-messages
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: conversation_id
          AttributeType: S
        - AttributeName: timestamp_message_id
          AttributeType: S
        - AttributeName: sender_id
          AttributeType: S
        - AttributeName: message_timestamp
          AttributeType: S
      KeySchema:
        - AttributeName: conversation_id
          KeyType: HASH
        - AttributeName: timestamp_message_id
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: sender-timestamp-index
          KeySchema:
            - AttributeName: sender_id
              KeyType: HASH
            - AttributeName: message_timestamp
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
        
  # Conversations Table
  ConversationsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: wechat-conversations
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: conversation_id
          AttributeType: S
        - AttributeName: user_id
          AttributeType: S
        - AttributeName: last_message_timestamp
          AttributeType: S
      KeySchema:
        - AttributeName: conversation_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: user-conversations-index
          KeySchema:
            - AttributeName: user_id
              KeyType: HASH
            - AttributeName: last_message_timestamp
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
```

#### ElastiCache Redis 配置
```yaml
Resources:
  # Redis Subnet Group
  RedisSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: Subnet group for Redis cluster
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
        
  # Redis Cluster
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: wechat-redis-cluster
      ReplicationGroupDescription: Redis cluster for WeChat app
      NodeType: cache.t3.micro
      NumCacheClusters: 2
      Engine: redis
      EngineVersion: "7.0"
      Port: 6379
      CacheSubnetGroupName: !Ref RedisSubnetGroup
      SecurityGroupIds:
        - !Ref RedisSecurityGroup
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true
      AutomaticFailoverEnabled: true
```

### 4. 文件存储架构

#### S3 + CloudFront 配置
```yaml
Resources:
  # Media S3 Bucket
  MediaBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: wechat-app-media
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldVersions
            Status: Enabled
            NoncurrentVersionExpirationInDays: 30
      CorsConfiguration:
        CorsRules:
          - AllowedHeaders:
              - "*"
            AllowedMethods:
              - GET
              - PUT
              - POST
              - DELETE
            AllowedOrigins:
              - "*"
            
  # CloudFront Distribution
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
            - OPTIONS
          CachedMethods:
            - GET
            - HEAD
          Compress: true
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad # CachingOptimized
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt MediaBucket.DomainName
            S3OriginConfig:
              OriginAccessIdentity: !Sub "origin-access-identity/cloudfront/${CloudFrontOAI}"
        PriceClass: PriceClass_100
        
  # CloudFront OAI
  CloudFrontOAI:
    Type: AWS::CloudFront::OriginAccessIdentity
    Properties:
      OriginAccessIdentityConfig:
        Comment: OAI for WeChat app media bucket
```

### 5. 消息队列架构

#### SQS + SNS 配置
```yaml
Resources:
  # Message Processing Queue
  MessageQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: wechat-message-queue
      VisibilityTimeoutSeconds: 300
      MessageRetentionPeriod: 1209600 # 14 days
      DeadLetterTargetArn: !GetAtt MessageDLQ.Arn
      MaxReceiveCount: 3
      
  # Dead Letter Queue
  MessageDLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: wechat-message-dlq
      MessageRetentionPeriod: 1209600
      
  # SNS Topic for Notifications
  NotificationTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: wechat-notifications
      DisplayName: WeChat App Notifications
      
  # SNS Subscription for Mobile Push
  MobilePushSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      Protocol: lambda
      TopicArn: !Ref NotificationTopic
      Endpoint: !GetAtt NotificationServiceFunction.Arn
```

### 6. 网络架构

#### VPC 配置
```yaml
Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: wechat-app-vpc
          
  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: wechat-app-igw
          
  # Attach IGW to VPC
  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC
      
  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: Public Subnet (AZ1)
          
  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: Public Subnet (AZ2)
          
  # Private Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.11.0/24
      Tags:
        - Key: Name
          Value: Private Subnet (AZ1)
          
  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.12.0/24
      Tags:
        - Key: Name
          Value: Private Subnet (AZ2)
          
  # NAT Gateways
  NatGateway1EIP:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc
      
  NatGateway1:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway1EIP.AllocationId
      SubnetId: !Ref PublicSubnet1
```

### 7. 监控和日志架构

#### CloudWatch 配置
```yaml
Resources:
  # CloudWatch Log Groups
  UserServiceLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /aws/lambda/wechat-user-service
      RetentionInDays: 30
      
  ChatServiceLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /aws/lambda/wechat-chat-service
      RetentionInDays: 30
      
  # CloudWatch Alarms
  UserServiceErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: wechat-user-service-errors
      AlarmDescription: Alarm for user service errors
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref UserServiceFunction
      AlarmActions:
        - !Ref NotificationTopic
```

## 部署策略

### 1. 基础设施即代码 (IaC)

#### AWS SAM 模板
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs18.x
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        NODE_ENV: production
        LOG_LEVEL: info

Parameters:
  Environment:
    Type: String
    Default: prod
    AllowedValues:
      - dev
      - staging
      - prod

Resources:
  # API Gateway
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: !Ref Environment
      Cors:
        AllowMethods: "'*'"
        AllowHeaders: "'*'"
        AllowOrigin: "'*'"
      Auth:
        DefaultAuthorizer: JwtAuthorizer
        Authorizers:
          JwtAuthorizer:
            JwtConfiguration:
              issuer: !Sub "https://auth.${Environment}.yourapp.com"
              audience:
                - wechat-app
            IdentitySource: "$request.header.Authorization"
            
  # Lambda Functions
  UserServiceFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/user-service/
      Handler: handler.handler
      Events:
        UserApi:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /users/{proxy+}
            Method: ANY
            Auth:
              Authorizer: JwtAuthorizer
```

### 2. CI/CD 管道

#### GitHub Actions 配置
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Deploy to AWS
        run: |
          npm run deploy:prod
```

### 3. 环境管理

#### 多环境配置
```bash
# 开发环境
sam deploy --template-file template.yaml --stack-name wechat-app-dev --parameter-overrides Environment=dev

# 预发布环境
sam deploy --template-file template.yaml --stack-name wechat-app-staging --parameter-overrides Environment=staging

# 生产环境
sam deploy --template-file template.yaml --stack-name wechat-app-prod --parameter-overrides Environment=prod
```

## 成本优化策略

### 1. Lambda 优化
- 使用 Provisioned Concurrency 减少冷启动
- 优化内存配置降低成本
- 使用 Lambda Layers 减少部署包大小

### 2. 存储优化
- S3 生命周期策略自动归档
- DynamoDB 按需计费模式
- CloudFront 缓存策略优化

### 3. 网络优化
- VPC Endpoint 减少 NAT Gateway 成本
- CloudFront 边缘位置优化
- 数据传输优化

## 安全架构

### 1. 身份认证
- AWS IAM 角色和策略
- JWT Token 验证
- API Key 管理

### 2. 网络安全
- VPC 网络隔离
- Security Group 规则
- WAF 防护规则

### 3. 数据安全
- 传输加密 (TLS/SSL)
- 静态加密 (S3, RDS, DynamoDB)
- 密钥管理 (AWS KMS)

## 备份和恢复

### 1. 数据备份
- RDS 自动备份
- DynamoDB 时间点恢复
- S3 版本控制

### 2. 灾难恢复
- 多 AZ 部署
- 跨区域复制
- 自动故障转移