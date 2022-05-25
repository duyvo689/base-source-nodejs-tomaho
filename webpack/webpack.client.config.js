const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
module.exports = (env, argv) => {
    return {
        mode: argv.mode ? argv.mode : 'development',
        target: "web",
        entry: {
            "request_reset_password.js": path.resolve(__dirname, "../addons/user/react_template/components/request_reset_password/index.js"),
            "confirm_reset_password.js": path.resolve(__dirname, "../addons/user/react_template/components/confirm_reset_password/index.js"),
            "style.css": path.resolve(__dirname, "../addons/user/react_template/static/style.css"),
        },
        // resolve: {
        //     alias: {
        //         'style': path.join(__dirname, '../addons/user/react_template/reset-password/static'),
        //     },
        //     extensions: ['', '.js', '.jsx', '.css']
        // },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: ["@babel/preset-env", "@babel/preset-react"],
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [{
                        loader: 'style-loader',
                    }, {
                        loader: 'css-loader',
                    }],

                }
            ]
        },
        plugins: [
            // Xuất kết quả với CSS - sau khi qua loader MiniCssExtractPlugin.loader
            // new MiniCssExtractPlugin({
            //     filename: 'style.css'
            // })
        ],
        output: {
            // path: path.resolve(__dirname, "../dist/public"),
            path: path.resolve(__dirname, "../addons/user/public"),
            filename: "[name]",
        },
    }
};