import path from "path";
import fs from "fs/promises";

function extractFrontMatter(content: string) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  if (!match) return {};

  const frontMatterStr = match[1];
  const result: Record<string, string> = {};

  const fields = ["title", "description"];
  fields.forEach((field) => {
    const match = frontMatterStr.match(new RegExp(`${field}:\\s*([^\n]+)`));
    if (match) {
      result[field] = match[1].trim().replace(/['"]|\\'/g, "");
    }
  });

  return result;
}

function pathToUrl(filePath: string): string {
  // Remove 'src/pages/' prefix, '.mdx' suffix, and 'index' for index pages
  const cleanPath = filePath
    .replaceAll("\\", "/") // windows support
    .replace(/^src\/content\//, "")
    .replace(/\/index\.mdx$|\.mdx$/, "");
  return `https://mastra.ai/${cleanPath}`;
}

async function concatenateMDXDocs(sourceDir: string) {
  console.log(`Starting documentation generation from: ${sourceDir}`);

  // Validate source directory exists
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Source path ${sourceDir} is not a directory`);
    }
  } catch (error) {
    console.error(
      `Error accessing source directory: ${error instanceof Error ? error?.message : error}`,
    );
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "public");
  // Ensure output directory exists
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error(
      `Error creating output directory: ${error instanceof Error ? error?.message : error}`,
    );
    process.exit(1);
  }

  const mdxFiles: Array<{
    path: string;
    content: string;
    title: string;
    description?: string;
    language: string;
  }> = [];

  async function processDirectory(dirPath: string, language: string) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            await processDirectory(fullPath, language);
          }
          continue;
        }

        if (!entry.name.endsWith(".mdx")) continue;

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const relativePath = path
            .relative(sourceDir, fullPath)
            .replaceAll("\\", "/");
          const frontMatter = extractFrontMatter(content);

          mdxFiles.push({
            path: relativePath,
            content,
            title: frontMatter.title || path.basename(relativePath, ".mdx"),
            description: frontMatter.description,
            language,
          });
        } catch (error) {
          console.error(
            `Error processing file ${fullPath}: ${error instanceof Error ? error?.message : error}`,
          );
          // Continue processing other files
        }
      }
    } catch (error) {
      console.error(
        `Error reading directory ${dirPath}: ${error instanceof Error ? error?.message : error}`,
      );
      throw error;
    }
  }

  try {
    // Process both English and Japanese directories
    const enDir = path.join(sourceDir, "src/content/en");
    const jaDir = path.join(sourceDir, "src/content/ja");

    await processDirectory(enDir, "en");
    await processDirectory(jaDir, "ja");

    if (mdxFiles.length === 0) {
      console.warn("No MDX files found in the specified directories");
      return;
    }

    // Write full content with source URLs
    const fullContent = mdxFiles
      .map((file) => {
        const sourceUrl = pathToUrl(file.path);
        const content = file.content;
        const languagePrefix = `[${file.language.toUpperCase()}] `;

        // Find the position after the title (h1 or h2)
        const titleMatch = content.match(/^(#|##)\s+.*$/m);
        if (titleMatch) {
          const titleIndex = content.indexOf(titleMatch[0]);
          const beforeTitle = content.slice(
            0,
            titleIndex + titleMatch[0].length,
          );
          const afterTitle = content.slice(titleIndex + titleMatch[0].length);
          return `${beforeTitle}\n${languagePrefix}Source: ${sourceUrl}${afterTitle}`;
        }

        // If no title found, add source URL after frontmatter if it exists
        const frontMatterMatch = content.match(/^---\n[\s\S]*?\n---/m);
        if (frontMatterMatch) {
          const frontMatterIndex = content.indexOf(frontMatterMatch[0]);
          const beforeFrontMatter = content.slice(
            0,
            frontMatterIndex + frontMatterMatch[0].length,
          );
          const afterFrontMatter = content.slice(
            frontMatterIndex + frontMatterMatch[0].length,
          );
          return `${beforeFrontMatter}\n${languagePrefix}Source: ${sourceUrl}${afterFrontMatter}`;
        }

        // If neither title nor frontmatter found, prepend source URL
        return `${languagePrefix}Source: ${sourceUrl}\n\n${content}`;
      })
      .join("\n\n");

    await fs.writeFile(
      path.join(outputDir, "llms-full.txt"),
      fullContent,
      "utf-8",
    );
    console.log(`Generated llms-full.txt`);

    // Group files by language and parent directory
    const groupedFiles = mdxFiles.reduce(
      (groups, file) => {
        const pagesIndex = file.path.indexOf("src/content/");
        if (pagesIndex === -1) {
          console.warn(
            `File ${file.path} is not under src/content/, skipping from index`,
          );
          return groups;
        }

        // Get the first directory after 'src/content/'
        const pathAfterContent = file.path.slice(
          pagesIndex + "src/content/".length,
        );
        const [language, firstDir] = pathAfterContent.split("/");

        const groupKey = `${language}/${firstDir}`;
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(file);
        return groups;
      },
      {} as Record<string, typeof mdxFiles>,
    );

    const indexContent = [
      "# Mastra\n",
      "> Mastra is an open-source TypeScript agent framework designed to provide the essential primitives for building AI applications. " +
        "It enables developers to create AI agents with memory and tool-calling capabilities, implement deterministic LLM workflows, and leverage RAG for knowledge integration. " +
        "With features like model routing, workflow graphs, and automated evals, Mastra provides a complete toolkit for developing, testing, and deploying AI applications.\n\n" +
        "This documentation covers everything from getting started to advanced features, APIs, and best practices for working with Mastra's agent-based architecture.\n\n" +
        "The documentation is organized into key sections:\n" +
        "- **docs**: Core documentation covering concepts, features, and implementation details\n" +
        "- **examples**: Practical examples and use cases demonstrating Mastra's capabilities\n" +
        "- **showcase**: A showcase of applications built using Mastra\n\n" +
        "Each section contains detailed markdown files that provide comprehensive information about Mastra's features and how to use them effectively.\n",
    ];

    for (const [group, files] of Object.entries(groupedFiles)) {
      const [language, section] = group.split("/");
      indexContent.push(`\n## ${language.toUpperCase()} - ${section}`);
      for (const file of files) {
        const url = pathToUrl(file.path);
        indexContent.push(
          `- [${file.title}](${url})${file.description ? ": " + file.description : ""}`,
        );
      }
    }

    try {
      await fs.writeFile(
        path.join(outputDir, "llms.txt"),
        indexContent.join("\n"),
        "utf-8",
      );
      console.log("Generated llms.txt");
    } catch (error) {
      console.error(
        `Error writing index file: ${error instanceof Error ? error?.message : error}`,
      );
      throw error;
    }
  } catch (error) {
    console.error(
      "Fatal error during documentation generation:",
      error instanceof Error ? error?.message : error,
    );
    process.exit(1);
  }
}

const docsDir = process.argv[2] || ".";
console.log(docsDir);

concatenateMDXDocs(docsDir).catch((error) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error?.message : error,
  );
  process.exit(1);
});
