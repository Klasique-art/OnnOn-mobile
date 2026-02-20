const { withMainApplication, createRunOncePlugin } = require("expo/config-plugins");

const pkg = {
  name: "with-webrtc-media-projection",
  version: "1.0.0",
};

function addJavaImport(src) {
  const importLine = "import com.oney.WebRTCModule.WebRTCModuleOptions;";
  if (src.includes(importLine)) return src;
  return src.replace(/(import [^\n]+;\n)/, `$1${importLine}\n`);
}

function addKotlinImport(src) {
  const importLine = "import com.oney.WebRTCModule.WebRTCModuleOptions";
  if (src.includes(importLine)) return src;
  return src.replace(/(import [^\n]+\n)/, `$1${importLine}\n`);
}

function addJavaOnCreateFlag(src) {
  const flagLine = "    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true;";
  if (src.includes(flagLine)) return src;
  return src.replace(
    /super\.onCreate\(\);\n/,
    `super.onCreate();\n${flagLine}\n`
  );
}

function addKotlinOnCreateFlag(src) {
  const flagLine = "    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true";
  if (src.includes(flagLine)) return src;
  return src.replace(
    /super\.onCreate\(\)\n/,
    `super.onCreate()\n${flagLine}\n`
  );
}

const withWebRTCMediaProjection = (config) =>
  withMainApplication(config, (config) => {
    const { modResults } = config;

    if (modResults.language === "java") {
      let contents = modResults.contents;
      contents = addJavaImport(contents);
      contents = addJavaOnCreateFlag(contents);
      modResults.contents = contents;
    }

    if (modResults.language === "kt") {
      let contents = modResults.contents;
      contents = addKotlinImport(contents);
      contents = addKotlinOnCreateFlag(contents);
      modResults.contents = contents;
    }

    return config;
  });

module.exports = createRunOncePlugin(
  withWebRTCMediaProjection,
  pkg.name,
  pkg.version
);

