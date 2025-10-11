const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './app/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, process.env.NODE_ENV === 'production' ? './public' : './public-dev')
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.app.json',
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader, {
            loader: "css-loader",
            options: {
              url: false,
            },
          }
        ]
      },
      {
        test: /\.ya?ml$/,
        use: "yaml-loader",
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset', // 100kb 이하면 자동으로 base64 인라인, 크면 파일로
        parser: {
          dataUrlCondition: {
            maxSize: 100 * 1024 // 100kb
          }
        }
      },
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      APP_NAME: JSON.stringify('Sigor'),
      WALLET_CONNECT_PROJECT_ID: JSON.stringify('7aa47ae0ec2e26682abd93948a24e755'),
      MATE_API_BASE_URI: JSON.stringify(
        process.env.NODE_ENV === 'production'
          ? 'https://api-v2.matedevdao.workers.dev'
          : 'http://localhost:8081'
      ),
    })
  ],
  mode: 'development'
};
