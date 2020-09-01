const path = require('path')

/**
 * Webpack configuration
 */
module.exports = {
	context: __dirname,
	entry: path.resolve(__dirname, 'src/index.js'),
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.js'
	},
	plugins: [
		new (require('html-webpack-plugin'))
	],
	module: {
		rules: [
			{
				test: /\.m?js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env'
						],
						plugins: [
							'@babel/plugin-transform-runtime', '@babel/plugin-proposal-class-properties'
						]
					}
				}
			}
		]
	}
}