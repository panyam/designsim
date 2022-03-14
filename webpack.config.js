const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const uglifyJsPlugin = require("uglifyjs-webpack-plugin");

// Read Samples first
function readdir(path) {
  const items = fs.readdirSync(path);
  return items.map(function (item) {
    let file = path;
    if (item.startsWith("/") || file.endsWith("/")) {
      file += item;
    } else {
      file += "/" + item;
    }
    const stats = fs.statSync(file);
    return { file: file, name: item, stats: stats };
  });
}

module.exports = (_env, options) => {
  context: path.resolve(__dirname, "src"), console.log("Options: ", options);
  const isDevelopment = options.mode == "development";
  const plugins = [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "demos/ext/"),
          to: "demos/ext/",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      title: "Demo List Page",
      myPageHeader: "Demo List",
      chunks: ["demos"],
      inject: false,
      filename: path.resolve(__dirname, "dist/demos/index.html"),
      template: path.resolve(__dirname, "demos/index.html"),
    }),
    new HtmlWebpackPlugin({
      chunks: ["comeyounity"],
      filename: path.resolve(__dirname, "dist/demos/comeyounity/index.html"),
      template: path.resolve(__dirname, "demos/comeyounity/index.hbs"),
    }),
    new HtmlWebpackPlugin({
      chunks: ["tinyurl"],
      filename: path.resolve(__dirname, "dist/demos/tinyurl/index.html"),
      template: path.resolve(__dirname, "demos/tinyurl/index.hbs"),
    }),
    new HtmlWebpackPlugin({
      chunks: ["idgen"],
      filename: path.resolve(__dirname, "dist/demos/idgen/index.html"),
      template: path.resolve(__dirname, "demos/idgen/index.hbs"),
    }),
    new webpack.HotModuleReplacementPlugin(),
  ];
  if (false && !isDevelopment) {
    plugins.splice(0, 0, new uglifyJsPlugin());
  }

  const webpackConfigs = {
    devtool: "inline-source-map",
    devServer: {
      hot: true,
      serveIndex: true,
      contentBase: path.join(__dirname, "dist"),
      before: function (app, server) {
        app.get(/\/dir\/.*/, function (req, res) {
          const path = "./" + req.path.substr(5);
          console.log("Listing dir: ", path);
          const listing = readdir(path);
          res.json({ entries: listing });
        });
      },
    },
    entry: {
      designsim: "./src/index.ts",
      demos: "./demos/index.ts",
      comeyounity: "./demos/comeyounity/index.ts",
      tinyurl: "./demos/tinyurl/index.ts",
      idgen: "./demos/idgen/index.ts",
    },
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
    output: {
      path: path.resolve(__dirname, "dist/"),
      filename: "[name].js",
      library: ["designsim", "[name]"],
      libraryTarget: "umd",
      umdNamedDefine: true,
      globalObject: "this",
    },
    module: {
      rules: [
        // The rule for rendering page-hbs.html from a handlebars template.
        {
          test: /\.hbs$/,
          use: [
            /*
            {
              loader: "file-loader?name=[path][name]-[ext].html",
            },
            {
              loader: "extract-loader",
            },
            */
            {
              loader: "render-template-loader",
              options: {
                engine: "handlebars",
                locals: {
                  title: "Rendered with Handlebars!",
                  desc: "Partials Support",
                },
                init: function (engine, info) {
                  engine.registerPartial("include", function (filename) {
                    const contents = fs.readFileSync(filename).toString();
                    const template = engine.compile(contents);
                    const result = template({});
                    return result;
                  });
                  engine.registerPartial(
                    "commonHeaders",
                    fs.readFileSync("./demos/global/partials/commonHeaders.hbs").toString(),
                  );
                  engine.registerPartial(
                    "commonFooters",
                    fs.readFileSync("./demos/global/partials/commonFooters.hbs").toString(),
                  );
                },
              },
            },
          ],
        },
        {
          test: /\.js$/,
          exclude: ["/node_modules/"],
          use: ["babel-loader"],
        },
        {
          test: /\.ts$/,
          exclude: ["/node_modules/"],
          use: ["ts-loader"],
        },
        {
          test: /\.s(a|c)ss$/,
          loader: [
            "style-loader",
            "css-loader",
            {
              loader: "sass-loader",
              options: {
                sourceMap: isDevelopment,
              },
            },
          ],
        },
        {
          test: /\.(png|svg|jpg|gif)$/,
          use: ["url-loader"],
        },
      ],
    },
    plugins: plugins,
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".scss", ".css"],
    },
  };
  return webpackConfigs;
};
