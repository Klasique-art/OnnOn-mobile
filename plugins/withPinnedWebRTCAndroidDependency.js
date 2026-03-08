const fs = require("fs/promises");
const path = require("path");
const {
  withDangerousMod,
  createRunOncePlugin,
} = require("expo/config-plugins");

const pkg = {
  name: "with-pinned-webrtc-android-dependency",
  version: "1.0.0",
};

async function pinReactNativeWebRTCDependency(projectRoot) {
  const webrtcPackagePath = path.join(
    projectRoot,
    "node_modules",
    "react-native-webrtc",
    "package.json"
  );
  const webrtcGradlePath = path.join(
    projectRoot,
    "node_modules",
    "react-native-webrtc",
    "android",
    "build.gradle"
  );

  const { version } = JSON.parse(await fs.readFile(webrtcPackagePath, "utf8"));
  const gradle = await fs.readFile(webrtcGradlePath, "utf8");
  const desiredDependency = `api 'org.jitsi:webrtc:${resolveAndroidArtifactVersion(
    version
  )}'`;

  const nextGradle = gradle.replace(
    /api 'org\.jitsi:webrtc:[^']+'/,
    desiredDependency
  );

  if (nextGradle !== gradle) {
    await fs.writeFile(webrtcGradlePath, nextGradle, "utf8");
  }
}

function resolveAndroidArtifactVersion(packageVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(packageVersion);
  if (!match) {
    return packageVersion;
  }

  const [, major, minor] = match;

  // react-native-webrtc ships npm patch releases, but the Android org.jitsi:webrtc
  // artifacts are published once per WebRTC line, for example 124.0.0 for M124.
  return `${major}.${minor}.0`;
}

const withPinnedWebRTCAndroidDependency = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      await pinReactNativeWebRTCDependency(config.modRequest.projectRoot);
      return config;
    },
  ]);

module.exports = createRunOncePlugin(
  withPinnedWebRTCAndroidDependency,
  pkg.name,
  pkg.version
);
