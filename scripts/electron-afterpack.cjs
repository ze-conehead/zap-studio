// electron-builder afterPack hook. We have no Apple Developer ID
// certificate, so macOS builds ship completely unsigned — and an unsigned
// arm64 app downloaded from the internet gets flagged by Gatekeeper as
// "damaged" rather than the milder "unidentified developer" warning
// unsigned x64 apps get. An ad-hoc signature (no certificate needed) is
// enough to satisfy that arm64 check.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath]);
};
