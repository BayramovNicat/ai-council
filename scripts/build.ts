import { rm, mkdir, mkdtemp, readFile, writeFile, copyFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import packageJson from "../package.json";

async function main() {
  const appName = packageJson.displayName || packageJson.name;
  const projectPath = process.cwd();

  const outDir = join(projectPath, "dist", `${appName}.app`);
  const contentsDir = join(outDir, "Contents");
  const macosDir = join(contentsDir, "MacOS");
  const resourcesDir = join(contentsDir, "Resources");
  const iconSource = join(projectPath, "assets", "Council.icns");
  const iconTarget = join(resourcesDir, "icon.icns");

  await rm(outDir, { recursive: true, force: true });
  await mkdir(macosDir, { recursive: true });
  await mkdir(resourcesDir, { recursive: true });

  if (!existsSync(iconSource)) {
    throw new Error(`Missing app icon at ${iconSource}. Generate or add Council.icns before building.`);
  }

  // Locate bun path on the compiling machine to bypass zsh shell overhead
  let bunPath = "/usr/local/bin/bun";
  try {
    const result = spawnSync("which", ["bun"], { encoding: "utf8" });
    if (result.status === 0) {
      bunPath = result.stdout.trim();
    }
  } catch {
    if (process.platform === "darwin") {
      if (existsSync("/opt/homebrew/bin/bun")) {
        bunPath = "/opt/homebrew/bin/bun";
      }
    }
  }
  const bunDir = dirname(bunPath);

  const tempDir = await mkdtemp(join(tmpdir(), "council-mac-"));
  try {
    const swiftSource = await readFile(
      join(projectPath, "scripts", "mac-launcher.swift"),
      "utf8",
    );
    const plistSource = await readFile(
      join(projectPath, "scripts", "Info.plist.xml"),
      "utf8",
    );

    const swiftFile = join(tempDir, "main.swift");
    const plistFile = join(contentsDir, "Info.plist");

    await writeFile(
      swiftFile,
      swiftSource
        .replaceAll("{{APP_NAME}}", appName)
        .replaceAll("{{PROJECT_PATH}}", projectPath)
        .replaceAll("{{BUN_PATH}}", bunPath)
        .replaceAll("{{BUN_DIR}}", bunDir),
      "utf8",
    );

    await writeFile(
      plistFile,
      plistSource.replaceAll("{{APP_NAME}}", appName),
      "utf8",
    );

    await copyFile(iconSource, iconTarget);

    const nextStandalone = join(projectPath, ".next", "standalone");
    const nextStatic = join(projectPath, ".next", "static");
    const publicDir = join(projectPath, "public");
    const appResourcesDir = join(resourcesDir, "app");

    await cp(nextStandalone, appResourcesDir, { recursive: true });
    await cp(nextStatic, join(appResourcesDir, ".next", "static"), { recursive: true });
    if (existsSync(publicDir)) {
      await cp(publicDir, join(appResourcesDir, "public"), { recursive: true });
    }

    console.log("Compiling swift launcher...");
    const swiftc = spawnSync(
      "xcrun",
      [
        "swiftc",
        swiftFile,
        "-o",
        join(macosDir, appName),
        "-framework",
        "Cocoa",
        "-framework",
        "WebKit",
      ],
      { stdio: "inherit" },
    );

    if (swiftc.status !== 0) {
      throw new Error(`swiftc exited with code ${swiftc.status}`);
    }

    console.log(`Created ${outDir} successfully!`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
