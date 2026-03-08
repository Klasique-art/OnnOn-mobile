const fs = require("fs");
const path = require("path");

function resolveAndroidArtifactVersion(packageVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(packageVersion);
  if (!match) {
    return packageVersion;
  }

  const [, major, minor] = match;
  return `${major}.${minor}.0`;
}

function pinDependency() {
  const projectRoot = process.cwd();
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

  if (!fs.existsSync(webrtcPackagePath) || !fs.existsSync(webrtcGradlePath)) {
    console.log("react-native-webrtc not installed yet, skipping Android pin.");
    return;
  }

  const { version } = JSON.parse(fs.readFileSync(webrtcPackagePath, "utf8"));
  const gradle = fs.readFileSync(webrtcGradlePath, "utf8");
  const desiredDependency = `api 'org.jitsi:webrtc:${resolveAndroidArtifactVersion(
    version
  )}'`;
  const nextGradle = gradle.replace(
    /api 'org\.jitsi:webrtc:[^']+'/,
    desiredDependency
  );

  if (nextGradle !== gradle) {
    fs.writeFileSync(webrtcGradlePath, nextGradle, "utf8");
    console.log(`Pinned react-native-webrtc Android dependency to ${desiredDependency}`);
    return;
  }

  console.log("react-native-webrtc Android dependency already pinned.");
}

pinDependency();
