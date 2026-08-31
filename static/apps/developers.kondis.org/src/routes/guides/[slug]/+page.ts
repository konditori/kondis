import { error } from "@sveltejs/kit";
import { marked } from "marked";

const documents = import.meta.glob("../../../../../docs.kondis.org/dev/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

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
  const source = Object.entries(documents).find(([path]) =>
    path.endsWith(`/docs.kondis.org/dev/${params.slug}.md`),
  )?.[1];
  if (!source) error(404, "Guide not found");
  const frontMatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  const title = frontMatter?.[1].match(/^title:\s*(.+)$/m)?.[1] ?? params.slug;
  const markdown = frontMatter ? source.slice(frontMatter[0].length) : source;
  return { title, html: marked.parse(markdown, { async: false, gfm: true }) };
}
