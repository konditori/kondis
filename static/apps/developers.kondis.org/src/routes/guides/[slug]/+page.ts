import { error } from "@sveltejs/kit";

const documents = import.meta.glob("../../../../../../../docs/dev/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

export function entries() {
  return [
    { slug: "api" },
    { slug: "architecture" },
    { slug: "contributing" },
    { slug: "cursed-knowledge" },
    { slug: "local-development" },
    { slug: "overview" },
  ];
}

export function load({ params }: { params: { slug: string } }) {
  const source = Object.entries(documents).find(([path]) => path.endsWith(`/docs/dev/${params.slug}.md`))?.[1];
  if (!source) error(404, "Guide not found");
  const frontMatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  const title = frontMatter?.[1].match(/^title:\s*(.+)$/m)?.[1] ?? params.slug;
  const markdown = frontMatter ? source.slice(frontMatter[0].length) : source;
  return { title, html: markdownToHtml(markdown) };
}

function markdownToHtml(markdown: string) {
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const html: string[] = [];
  let code = false;
  let codeLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (code) html.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
      code = !code;
      codeLines = [];
    } else if (code) codeLines.push(line);
    else if (/^#{1,6} /.test(line)) {
      const [, hashes, text] = line.match(/^(#{1,6}) (.*)$/)!;
      html.push(`<h${hashes.length}>${inline(text)}</h${hashes.length}>`);
    } else if (line.startsWith("- ")) html.push(`<li>${inline(line.slice(2))}</li>`);
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  return html.join("\n").replace(/(<li>.*<\/li>\n?)+/g, (list) => `<ul>${list}</ul>`);
}

function inline(text: string) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
