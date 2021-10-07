const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const Purge = require('./index');

module.exports = {
  mode: 'development',
  entry: {
    one: './test/one',
    two: './test/two'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          "postcss-loader"
        ]
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new Purge()
  ]
};
