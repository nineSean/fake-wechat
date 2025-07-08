#!/bin/bash

# 新手部署脚本 - Cloudflare Workers + AWS Lambda
set -e  # 遇到错误立即停止

# 设置环境变量
export NODE_ENV=dev
export AWS_REGION=us-east-1
export STAGE=dev

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[✓] $1${NC}"
}

error() {
    echo -e "${RED}[✗] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[⚠] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[ℹ] $1${NC}"
}

# 检查必要工具
check_tools() {
    log "正在检查必要工具..."
    
    local tools=("node" "npm" "aws" "wrangler" "serverless")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "缺少必要工具: ${missing_tools[*]}"
        info "请安装缺少的工具:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                "node"|"npm")
                    echo "  - Node.js: https://nodejs.org"
                    ;;
                "aws")
                    echo "  - AWS CLI: https://aws.amazon.com/cli/"
                    ;;
                "wrangler")
                    echo "  - Wrangler: npm install -g wrangler"
                    ;;
                "serverless")
                    echo "  - Serverless: npm install -g serverless"
                    ;;
            esac
        done
        exit 1
    fi
    
    log "所有工具检查通过"
}

# 检查 AWS 凭证
check_aws_credentials() {
    log "检查 AWS 凭证..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS 凭证未配置或无效"
        info "请运行: aws configure"
        exit 1
    fi
    
    log "AWS 凭证检查通过"
}

# 检查 Cloudflare 凭证
check_cloudflare_auth() {
    log "检查 Cloudflare 认证..."
    
    if ! wrangler whoami &> /dev/null; then
        warn "Cloudflare 未登录"
        info "请运行: wrangler login"
        read -p "按回车键继续登录 Cloudflare..."
        wrangler login
    fi
    
    log "Cloudflare 认证检查通过"
}

# 部署 AWS 基础设施
deploy_aws_infrastructure() {
    log "部署 AWS 基础设施..."
    
    local stack_name="${STAGE}-fake-wechat-infrastructure"
    
    # 检查堆栈是否已存在
    if aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
        warn "堆栈 $stack_name 已存在，跳过创建"
        return 0
    fi
    
    aws cloudformation create-stack \
        --stack-name "$stack_name" \
        --template-body file://aws/infrastructure.yml \
        --parameters ParameterKey=Environment,ParameterValue="$STAGE" \
                     ParameterKey=DatabasePassword,ParameterValue="DevPassword123!" \
        --capabilities CAPABILITY_NAMED_IAM
    
    info "等待堆栈创建完成（预计 10-15 分钟）..."
    aws cloudformation wait stack-create-complete --stack-name "$stack_name"
    
    log "AWS 基础设施部署完成"
}

# 获取基础设施信息
get_infrastructure_outputs() {
    log "获取基础设施信息..."
    
    local stack_name="${STAGE}-fake-wechat-infrastructure"
    
    # 获取输出值
    DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)
    
    REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    S3_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
        --output text)
    
    info "数据库端点: $DATABASE_ENDPOINT"
    info "Redis 端点: $REDIS_ENDPOINT"
    info "S3 存储桶: $S3_BUCKET"
}

# 更新环境变量
update_env_file() {
    log "更新环境变量文件..."
    
    cat > .env.dev << EOF
# 开发环境配置 - 自动生成
NODE_ENV=dev
DATABASE_URL=postgresql://postgres:DevPassword123!@${DATABASE_ENDPOINT}:5432/fakewechat
REDIS_URL=redis://${REDIS_ENDPOINT}:6379
JWT_SECRET=dev-jwt-secret-please-change-in-production
AWS_S3_BUCKET=${S3_BUCKET}
CLOUDFLARE_R2_BUCKET=dev-fake-wechat-media

# AWS 配置
AWS_REGION=${AWS_REGION}

# 应用配置
APP_NAME=fake-wechat-dev
APP_VERSION=1.0.0
LOG_LEVEL=debug
EOF
    
    log "环境变量文件已更新"
}

# 运行数据库迁移
run_database_migration() {
    log "运行数据库迁移..."
    
    cd ../backend
    
    # 安装依赖（如果还没有）
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # 运行迁移
    npx prisma migrate deploy
    npx prisma generate
    
    cd ../deployment
    log "数据库迁移完成"
}

# 部署 AWS Lambda
deploy_aws_lambda() {
    log "部署 AWS Lambda 函数..."
    
    cd aws
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # 复制环境变量
    cp ../.env.dev .env
    
    # 部署
    serverless deploy --stage "$STAGE" --verbose
    
    # 获取 API Gateway URL
    API_GATEWAY_URL=$(serverless info --stage "$STAGE" | grep "endpoints:" -A 1 | tail -n 1 | awk '{print $2}' | sed 's|/{proxy+}||')
    
    cd ..
    info "API Gateway URL: $API_GATEWAY_URL"
    
    # 保存 API URL 到文件
    echo "API_GATEWAY_URL=$API_GATEWAY_URL" >> .api-info
    
    log "AWS Lambda 部署完成"
}

# 创建 Cloudflare 资源
setup_cloudflare_resources() {
    log "创建 Cloudflare 资源..."
    
    cd cloudflare
    
    # 创建 KV 命名空间
    info "创建 KV 命名空间..."
    USER_SESSIONS_ID=$(wrangler kv:namespace create "USER_SESSIONS" --preview false | grep "id" | cut -d'"' -f4)
    CACHE_ID=$(wrangler kv:namespace create "CACHE" --preview false | grep "id" | cut -d'"' -f4)
    
    # 创建 R2 存储桶
    info "创建 R2 存储桶..."
    wrangler r2 bucket create dev-fake-wechat-media || true  # 如果已存在则忽略错误
    
    cd ..
    
    info "KV USER_SESSIONS ID: $USER_SESSIONS_ID"
    info "KV CACHE ID: $CACHE_ID"
    
    # 保存 KV ID
    echo "USER_SESSIONS_ID=$USER_SESSIONS_ID" >> .cloudflare-info
    echo "CACHE_ID=$CACHE_ID" >> .cloudflare-info
    
    log "Cloudflare 资源创建完成"
}

# 更新 Cloudflare Workers 配置
update_cloudflare_config() {
    log "更新 Cloudflare Workers 配置..."
    
    # 获取保存的信息
    source .api-info
    source .cloudflare-info
    
    # 更新 wrangler.toml
    cd cloudflare
    
    cat > wrangler.toml << EOF
# Cloudflare Workers 配置 - 自动生成
name = "fake-wechat-api-dev"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

# KV 存储绑定
[[kv_namespaces]]
binding = "USER_SESSIONS"
id = "$USER_SESSIONS_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "$CACHE_ID"

# R2 存储绑定
[[r2_buckets]]
binding = "MEDIA_STORAGE"
bucket_name = "dev-fake-wechat-media"

# 环境变量
[vars]
ENVIRONMENT = "development"
AWS_API_GATEWAY_URL = "$API_GATEWAY_URL"
JWT_SECRET = "dev-jwt-secret-please-change-in-production"
EOF
    
    cd ..
    log "Cloudflare Workers 配置已更新"
}

# 部署 Cloudflare Workers
deploy_cloudflare_workers() {
    log "部署 Cloudflare Workers..."
    
    cd cloudflare
    
    # 部署 Workers
    wrangler deploy
    
    # 获取 Workers URL
    WORKERS_URL="https://fake-wechat-api-dev.$(wrangler whoami | grep 'subdomain' | cut -d':' -f2 | tr -d ' ').workers.dev"
    
    cd ..
    
    info "Workers URL: $WORKERS_URL"
    echo "WORKERS_URL=$WORKERS_URL" >> .api-info
    
    log "Cloudflare Workers 部署完成"
}

# 部署前端
deploy_frontend() {
    log "构建和部署前端..."
    
    cd ../frontend
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # 获取 Workers URL
    source ../deployment/.api-info
    
    # 设置环境变量
    echo "NEXT_PUBLIC_API_URL=${WORKERS_URL}/api" > .env.local
    
    # 构建
    npm run build
    
    # 部署到 Cloudflare Pages
    if command -v wrangler &> /dev/null; then
        wrangler pages deploy .next --project-name fake-wechat-frontend-dev --compatibility-date 2024-01-01
    else
        warn "未找到 wrangler，跳过 Pages 部署"
        info "请手动在 Cloudflare Dashboard 中连接 GitHub 仓库部署前端"
    fi
    
    cd ../deployment
    log "前端部署完成"
}

# 运行测试
run_tests() {
    log "运行部署测试..."
    
    source .api-info
    
    # 测试 AWS Lambda
    info "测试 AWS Lambda..."
    if curl -f -s "${API_GATEWAY_URL}/health" > /dev/null; then
        log "AWS Lambda 健康检查通过"
    else
        warn "AWS Lambda 健康检查失败"
    fi
    
    # 测试 Cloudflare Workers
    info "测试 Cloudflare Workers..."
    if curl -f -s "${WORKERS_URL}/health" > /dev/null; then
        log "Cloudflare Workers 健康检查通过"
    else
        warn "Cloudflare Workers 健康检查失败"
    fi
}

# 显示部署结果
show_deployment_summary() {
    log "部署完成！"
    echo ""
    echo "==========================================="
    echo "           部署结果汇总"
    echo "==========================================="
    
    source .api-info 2>/dev/null || true
    
    echo "前端访问地址:"
    echo "  🌐 https://fake-wechat-frontend-dev.pages.dev"
    echo ""
    echo "API 端点:"
    echo "  ⚙️  AWS Lambda: ${API_GATEWAY_URL:-'未获取'}"
    echo "  🛡️  Cloudflare Workers: ${WORKERS_URL:-'未获取'}"
    echo ""
    echo "健康检查:"
    echo "  🎯 Workers Health: ${WORKERS_URL:-'未获取'}/health"
    echo "  🎯 Lambda Health: ${API_GATEWAY_URL:-'未获取'}/health"
    echo ""
    echo "成本预估: ~$13-15/月 (前12个月)"
    echo ""
    echo "下一步:"
    echo "  1. 测试用户注册登录功能"
    echo "  2. 上传头像和发送消息"
    echo "  3. 添加好友功能测试"
    echo "  4. 设置监控告警"
    echo "==========================================="
}

# 清理函数
cleanup() {
    log "清理临时文件..."
    rm -f .api-info .cloudflare-info
}

# 主函数
main() {
    echo "🚀 开始部署 Fake WeChat 应用 (Cloudflare Workers + AWS Lambda)"
    echo ""
    
    check_tools
    check_aws_credentials
    check_cloudflare_auth
    
    deploy_aws_infrastructure
    get_infrastructure_outputs
    update_env_file
    run_database_migration
    deploy_aws_lambda
    
    setup_cloudflare_resources
    update_cloudflare_config
    deploy_cloudflare_workers
    
    deploy_frontend
    run_tests
    
    show_deployment_summary
}

# 错误处理
trap 'error "部署过程中出现错误，请检查日志"; cleanup; exit 1' ERR

# 如果脚本被直接执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
    cleanup
fi