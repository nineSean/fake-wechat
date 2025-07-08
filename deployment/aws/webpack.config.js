/**
 * Webpack 配置文件 - AWS Lambda 部署专用
 * 
 * 这个配置文件专门用于将 Node.js 应用打包成适合 AWS Lambda 运行的格式
 * 
 * 关键特性：
 * 1. 目标平台：Node.js 运行时
 * 2. 外部依赖：排除 node_modules 以减小包体积
 * 3. 代码转换：支持 TypeScript 和现代 JavaScript
 * 4. 输出格式：CommonJS2 模块格式
 * 
 * 作用：
 * - 将 src/lambda.js 打包为 Lambda 函数入口
 * - 处理 TypeScript 编译
 * - 优化代码体积
 * - 保持代码可读性便于调试
 */

const path = require('path');
// webpack-node-externals: 排除 node_modules 依赖，减小打包体积
// Lambda 运行时会提供 AWS SDK 和其他常用依赖
const nodeExternals = require('webpack-node-externals');

module.exports = {
  // 生产模式：启用优化，但不压缩代码（便于调试）
  mode: 'production',
  
  // 入口文件：Lambda 函数的主入口点
  // 注意：实际文件路径需要根据项目结构调整
  entry: './src/lambda.js', // 将根据实际文件调整
  
  // 目标平台：Node.js 环境（Lambda 运行时）
  target: 'node',
  
  // 外部依赖：排除 node_modules 中的所有依赖
  // 这样做的好处：
  // 1. 减小打包体积
  // 2. 利用 Lambda 层提供的公共依赖
  // 3. 避免打包 AWS SDK（Lambda 运行时已提供）
  externals: [nodeExternals()],
  // 模块解析配置
  resolve: {
    // 支持的文件扩展名
    extensions: ['.js', '.ts', '.json'],
    
    // 路径别名：简化模块引用
    // 例如：import something from '@/utils/helper'
    // 而不是：import something from '../../utils/helper'
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // 模块处理规则
  module: {
    rules: [
      {
        // TypeScript 文件处理
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        // ts-loader 会根据 tsconfig.json 编译 TypeScript
      },
      {
        // JavaScript 文件处理
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/,
        // babel-loader 会根据 .babelrc 或 babel.config.js 转换代码
        // 支持 ES6+ 语法转换为 Node.js 兼容代码
      },
    ],
  },
  // 输出配置
  output: {
    // 输出格式：CommonJS2 模块格式
    // 这是 Node.js 的标准模块格式，Lambda 可以直接执行
    libraryTarget: 'commonjs2',
    
    // 输出目录：.webpack 文件夹
    // Serverless Framework 会从这里读取打包后的文件
    path: path.join(__dirname, '.webpack'),
    
    // 输出文件名：保持原有文件名
    // [name] 会被替换为入口文件的名字
    filename: '[name].js',
  },
  // 优化配置
  optimization: {
    // 不压缩代码：保持可读性，便于调试
    // 在生产环境中，通常会启用压缩以减小体积
    // 但对于学习和调试，保持代码可读性更重要
    minimize: false, // 保持可读性，便于调试
    
    // 其他可选的优化选项：
    // splitChunks: false, // 不拆分代码块
    // runtimeChunk: false, // 不生成运行时代码块
  },
};