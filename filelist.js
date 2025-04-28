#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";

const targetDirectory = "./src";
const excludedDirs = [
  // "src/features/credits",
  // "src/features/stats",
  // "src/features/title",
  // "src/features/undocking",
];

/**
 * Checks if a given path should be excluded based on excludedDirs
 * @param {string} currentPath The path to check
 * @returns {boolean} True if the path should be excluded
 */
function shouldExclude(currentPath) {
  const relativePath = path.relative(process.cwd(), currentPath);
  return excludedDirs.some((dir) =>
    path.normalize(relativePath).startsWith(path.normalize(dir))
  );
}

/**
 * Recursively reads directories, finds files, and prints their content.
 * Uses absolute paths for internal operations but prints paths relative to process.cwd().
 * @param {string} currentAbsolutePath The absolute path of the directory currently being scanned.
 */
function readAndPrintFilesRecursive(currentAbsolutePath) {
  try {
    if (shouldExclude(currentAbsolutePath)) {
      return; // Skip excluded directories
    }

    // Check if the path exists before trying to read it
    if (!fs.existsSync(currentAbsolutePath)) {
      const relativePath = path.relative(process.cwd(), currentAbsolutePath);
      console.warn(
        `Warning: Path no longer exists during scan, skipping: "${path.normalize(
          relativePath
        )}"`
      );
      return;
    }

    // Get stats to ensure it's a directory before reading contents
    const dirStats = fs.statSync(currentAbsolutePath);
    if (!dirStats.isDirectory()) {
      const relativePath = path.relative(process.cwd(), currentAbsolutePath);
      console.warn(
        `Warning: Path is not a directory, skipping: "${path.normalize(
          relativePath
        )}"`
      );
      return; // Stop processing if it's not a directory
    }

    // Get a list of all entries (files and subdirectories) in the directory
    const entries = fs.readdirSync(currentAbsolutePath);

    entries.forEach((entry) => {
      const fullAbsolutePath = path.join(currentAbsolutePath, entry);
      // Skip if this path should be excluded
      if (shouldExclude(fullAbsolutePath)) {
        return;
      }
      // Calculate the relative path for display purposes *now*
      const relativePath = path.relative(process.cwd(), fullAbsolutePath);
      const normalizedRelativePath = path.normalize(relativePath); // Ensure consistent separators

      try {
        // Get information (stats) about the current entry using its absolute path
        const stats = fs.statSync(fullAbsolutePath);

        if (stats.isFile()) {
          const ext = path.extname(fullAbsolutePath).toLowerCase();
          const allowedExtensions = [".ts", ".tsx", ".html", ".css"];
          if (allowedExtensions.includes(ext)) {
            const content = fs.readFileSync(fullAbsolutePath, "utf8");

            console.log(`${normalizedRelativePath}:`);
            console.log("```");
            console.log(content);
            console.log("```");
            console.log(""); // Add a blank line for separation
          }
        } else if (stats.isDirectory()) {
          // It's a directory - make the recursive call using the absolute path
          readAndPrintFilesRecursive(fullAbsolutePath);
        }
        // Ignore other types like symbolic links, block devices etc. for this script
      } catch (entryError) {
        // Log errors accessing specific files/subdirs using the relative path
        console.error(
          `\nError processing entry "${normalizedRelativePath}": ${entryError.message}`
        );
        // Continue with the next entry in the current directory
      }
    });
  } catch (dirReadError) {
    // Log errors reading the directory itself using the relative path
    const relativeDirPath = path.relative(process.cwd(), currentAbsolutePath);
    console.error(
      `\nFailed to read directory "${path.normalize(relativeDirPath)}": ${
        dirReadError.message
      }`
    );

    const initialAbsoluteTargetPath = path.resolve(targetDirectory);
    if (currentAbsolutePath === initialAbsoluteTargetPath) {
      console.error(`Cannot read the initial target directory. Exiting.`);
      process.exit(1);
    }
  }
}

// --- Main Execution ---
const absoluteTargetPath = path.resolve(process.cwd(), targetDirectory); // Resolve target relative to CWD

if (!fs.existsSync(absoluteTargetPath)) {
  // Use the original targetDirectory string and the resolved absolute path in the error
  console.error(
    `Error: Starting directory "${targetDirectory}" (resolved to "${absoluteTargetPath}") not found.`
  );
  process.exit(1);
}

if (!fs.statSync(absoluteTargetPath).isDirectory()) {
  console.error(
    `Error: Starting path "${targetDirectory}" (resolved to "${absoluteTargetPath}") is not a directory.`
  );
  process.exit(1);
}

readAndPrintFilesRecursive(absoluteTargetPath);