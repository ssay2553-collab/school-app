const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const path = require("path");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    // Make imports like `import X from 'app/...';` resolve to the local `app/` dir
    app: path.resolve(__dirname, "app"),
  };

  return config;
};
