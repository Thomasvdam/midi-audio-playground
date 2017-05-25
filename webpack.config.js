const path = require('path');

module.exports = {
    output: {
        path: path.resolve(__dirname, './build'),
        filename: 'bundle.js',
        publicPath: '/build/',
        libraryTarget: 'umd',
    },
};

