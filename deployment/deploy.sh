#!/bin/bash
#
# Fake WeChat 一键部署脚本 - Cloudflare Workers + AWS Lambda 混合架构
#
# 这个脚本实现了复杂的多云部署自动化，整合了 AWS 和 Cloudflare 的服务：
# 
# 🏗️ 部署架构：
# 1. AWS 基础设施：VPC、RDS PostgreSQL、ElastiCache Redis、S3
# 2. AWS Lambda：API 核心业务逻辑，运行在私有网络中
# 3. Cloudflare Workers：全球 CDN 边缘计算，API 网关和 CORS 处理
# 4. Cloudflare Pages：静态网站托管，前端应用
# 5. Cloudflare R2：对象存储，媒体文件备份
#
# 🎯 脚本特点：
# - 幂等性：可重复执行，已存在的资源会被跳过
# - 错误处理：任何步骤失败都会立即停止并显示错误
# - 进度跟踪：实时显示部署进度和预计时间
# - 环境检测：自动检查必需工具和凭证
# - 资源追踪：保存部署信息到临时文件
#
# 📋 使用方法：
#   chmod +x deploy.sh
#   ./deploy.sh
#
# ⏱️ 预计耗时：15-25 分钟（首次部署）
# 💰 预计成本：约 $13-15/月（前12个月AWS免费层）

# Bash 严格模式设置
set -e  # 遇到任何错误立即退出脚本

# ========== 全局环境变量设置 ==========
# 这些变量控制整个部署过程的行为和配置

# 部署环境标识（影响资源命名和配置）
export NODE_ENV=dev
# AWS 区域选择（影响延迟和法规要求）
export AWS_REGION=us-east-1
# 部署阶段标识（用于 Serverless Framework）
export STAGE=dev

# ========== 终端颜色定义 ==========
# 使用 ANSI 颜色代码美化输出，提升用户体验
# 这些颜色会在不同类型的消息中使用

RED='\033[0;31m'     # 错误消息 - 红色
GREEN='\033[0;32m'   # 成功消息 - 绿色
YELLOW='\033[0;33m'  # 警告消息 - 黄色
BLUE='\033[0;34m'    # 信息消息 - 蓝色
NC='\033[0m'         # 重置颜色 - No Color

# ========== 日志函数定义 ==========
# 这些函数提供一致的日志输出格式，便于调试和监控

# 成功消息：绿色复选标记
log() {
    echo -e "${GREEN}[✓] $1${NC}"
}

# 错误消息：红色错误标记
error() {
    echo -e "${RED}[✗] ERROR: $1${NC}"
}

# 警告消息：黄色警告标记
warn() {
    echo -e "${YELLOW}[⚠] WARNING: $1${NC}"
}

# 信息消息：蓝色信息标记
info() {
    echo -e "${BLUE}[ℹ] $1${NC}"
}

# ========== 环境检查函数 ==========

# 检查必要工具是否安装
# 这个函数确保所有部署所需的命令行工具都已正确安装
check_tools() {
    log "正在检查必要工具..."
    
    # 定义必需工具列表
    local tools=("node" "npm" "aws" "wrangler" "serverless")
    local missing_tools=()
    
    # 遍历检查每个工具
    for tool in "${tools[@]}"; do
        # 使用 command -v 检查命令是否存在
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    # 如果有缺失的工具，提供安装指导
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "缺少必要工具: ${missing_tools[*]}"
        info "请安装缺少的工具:"
        
        # 为每个缺失的工具提供具体安装指导
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
        exit 1  # 退出脚本，要求用户先安装工具
    fi
    
    log "所有工具检查通过"
}

# 检查 AWS 凭证配置
# 验证 AWS CLI 是否正确配置了访问密钥和秘密密钥
check_aws_credentials() {
    log "检查 AWS 凭证..."
    
    # 使用 AWS STS 服务检查凭证有效性
    # get-caller-identity 命令会返回当前身份信息
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS 凭证未配置或无效"
        info "请运行: aws configure"
        info "需要配置: Access Key ID, Secret Access Key, Region"
        exit 1
    fi
    
    log "AWS 凭证检查通过"
}

# 检查 Cloudflare 认证状态
# 验证 Wrangler CLI 是否已登录 Cloudflare 账户
check_cloudflare_auth() {
    log "检查 Cloudflare 认证..."
    
    # 使用 wrangler whoami 检查登录状态
    if ! wrangler whoami &> /dev/null; then
        warn "Cloudflare 未登录"
        info "请运行: wrangler login"
        info "这将打开浏览器进行 OAuth 授权"
        
        # 等待用户确认后自动启动登录流程
        read -p "按回车键继续登录 Cloudflare..."
        wrangler login
    fi
    
    log "Cloudflare 认证检查通过"
}

# ========== AWS 基础设施部署 ==========

# 部署 AWS CloudFormation 基础设施堆栈
# 这个函数创建 VPC、数据库、缓存、存储等所有 AWS 资源
deploy_aws_infrastructure() {
    log "部署 AWS 基础设施..."
    
    # CloudFormation 堆栈名称（包含环境标识）
    local stack_name="${STAGE}-fake-wechat-infrastructure"
    
    # 检查堆栈是否已存在（实现幂等性）
    # 如果已存在，则跳过创建步骤，避免重复部署
    if aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
        warn "堆栈 $stack_name 已存在，跳过创建"
        return 0  # 成功返回，继续后续步骤
    fi
    
    # 创建 CloudFormation 堆栈
    aws cloudformation create-stack \
        --stack-name "$stack_name" \
        --template-body file://aws/infrastructure.yml \
        --parameters ParameterKey=Environment,ParameterValue="$STAGE" \
                     ParameterKey=DatabasePassword,ParameterValue="DevPassword123!" \
        --capabilities CAPABILITY_NAMED_IAM  # 允许创建 IAM 资源
    
    # 等待堆栈创建完成（可能需要 10-15 分钟）
    info "等待堆栈创建完成（预计 10-15 分钟）..."
    aws cloudformation wait stack-create-complete --stack-name "$stack_name"
    
    log "AWS 基础设施部署完成"
}

# 获取 CloudFormation 堆栈输出值
# 这些输出值包含数据库连接信息、缓存地址、存储桶名称等
get_infrastructure_outputs() {
    log "获取基础设施信息..."
    
    local stack_name="${STAGE}-fake-wechat-infrastructure"
    
    # 使用 AWS CLI JMESPath 查询语法获取特定输出值
    # 数据库连接端点（用于构建数据库连接字符串）
    DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)
    
    # Redis 缓存连接端点
    REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    # S3 媒体存储桶名称
    S3_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
        --output text)
    
    # 显示获取到的连接信息
    info "数据库端点: $DATABASE_ENDPOINT"
    info "Redis 端点: $REDIS_ENDPOINT"
    info "S3 存储桶: $S3_BUCKET"
}

# ========== 环境配置管理 ==========

# 生成应用环境变量文件
# 基于 CloudFormation 输出创建完整的 .env 配置文件
update_env_file() {
    log "更新环境变量文件..."
    
    # 使用 heredoc 创建 .env.dev 文件
    # 这个文件包含所有应用运行所需的环境变量
    cat > .env.dev << EOF
# 开发环境配置 - 由部署脚本自动生成
# 生成时间: $(date)

# 应用环境
NODE_ENV=dev

# 数据库连接（PostgreSQL）
DATABASE_URL=postgresql://postgres:DevPassword123!@${DATABASE_ENDPOINT}:5432/fakewechat

# 缓存连接（Redis）
REDIS_URL=redis://${REDIS_ENDPOINT}:6379

# 安全配置
JWT_SECRET=dev-jwt-secret-please-change-in-production

# 存储配置
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

# ========== 数据库初始化 ==========

# 运行 Prisma 数据库迁移
# 初始化数据库表结构和类型定义
run_database_migration() {
    log "运行数据库迁移..."
    
    # 切换到后端项目目录
    cd ../backend
    
    # 检查并安装 Node.js 依赖（如果需要）
    if [ ! -d "node_modules" ]; then
        info "安装后端依赖..."
        npm install
    fi
    
    # 运行 Prisma 数据库迁移
    info "执行数据库 schema 迁移..."
    npx prisma migrate deploy
    
    # 生成 Prisma 客户端代码
    info "生成 Prisma 客户端..."
    npx prisma generate
    
    # 返回部署目录
    cd ../deployment
    log "数据库迁移完成"
}

# ========== AWS Lambda 部署 ==========

# 使用 Serverless Framework 部署 Lambda 函数
# 包括 API Gateway、Lambda 函数和相关配置
deploy_aws_lambda() {
    log "部署 AWS Lambda 函数..."
    
    # 切换到 AWS 部署目录
    cd aws
    
    # 安装 Serverless Framework 依赖
    if [ ! -d "node_modules" ]; then
        info "安装 Serverless 依赖..."
        npm install
    fi
    
    # 复制环境变量文件供 Serverless 使用
    cp ../.env.dev .env
    
    # 执行 Serverless 部署
    info "正在部署 Lambda 函数和 API Gateway..."
    serverless deploy --stage "$STAGE" --verbose
    
    # 获取 API Gateway 的对外访问 URL
    # 使用 grep 和 awk 从 Serverless 输出中提取 URL
    API_GATEWAY_URL=$(serverless info --stage "$STAGE" | grep "endpoints:" -A 1 | tail -n 1 | awk '{print $2}' | sed 's|/{proxy+}||')
    
    cd ..  # 返回部署目录
    
    info "API Gateway URL: $API_GATEWAY_URL"
    
    # 保存 API URL 到临时文件供后续步骤使用
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

# ========== 主函数和错误处理 ==========

# 清理临时文件
# 删除部署过程中生成的临时文件，避免敏感信息泄露
cleanup() {
    log "清理临时文件..."
    # 删除包含 API URL 和 Cloudflare 资源 ID 的临时文件
    rm -f .api-info .cloudflare-info
}

# 主函数 - 协调整个部署流程
# 按照依赖关系有序执行所有部署步骤
main() {
    echo "🚀 开始部署 Fake WeChat 应用 (Cloudflare Workers + AWS Lambda)"
    echo ""
    
    # 阶段 1: 环境预检查
    info "阶段 1/4: 环境预检查"
    check_tools              # 检查必要工具
    check_aws_credentials    # 验证 AWS 凭证
    check_cloudflare_auth   # 验证 Cloudflare 认证
    
    # 阶段 2: AWS 资源部署
    info "阶段 2/4: AWS 基础设施和服务部署"
    deploy_aws_infrastructure  # 创建 VPC、数据库、缓存等
    get_infrastructure_outputs # 获取连接信息
    update_env_file           # 生成环境变量文件
    run_database_migration    # 初始化数据库
    deploy_aws_lambda         # 部署 Lambda 函数
    
    # 阶段 3: Cloudflare 资源部署
    info "阶段 3/4: Cloudflare 资源和服务部署"
    setup_cloudflare_resources  # 创建 KV 和 R2 资源
    update_cloudflare_config   # 配置 Workers
    deploy_cloudflare_workers  # 部署 Workers
    
    # 阶段 4: 前端部署和测试
    info "阶段 4/4: 前端部署和系统测试"
    deploy_frontend           # 构建和部署前端
    run_tests                 # 运行健康检查
    
    # 显示部署结果汇总
    show_deployment_summary
}

# ========== 脚本执行和错误处理 ==========

# 全局错误处理器
# 当任何命令失败时自动触发，显示错误信息并清理资源
trap 'error "部署过程中出现错误，请检查日志"; cleanup; exit 1' ERR

# 脚本入口点
# 只有当脚本被直接执行时才运行主函数（而非被 source 引入）
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"    # 执行主函数，传递所有命令行参数
    cleanup      # 清理临时文件
fi