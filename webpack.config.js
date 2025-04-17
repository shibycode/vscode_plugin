const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const path = require('path');
module.exports = {
  entry: './src/App.tsx',
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
          },
        }
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  output: {
    path: path.join(__dirname, 'public'),
    filename: 'auto_charts_bundle.js'
  }
};
