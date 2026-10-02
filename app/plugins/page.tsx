import Catalog from "@/components/catalog";

export default async function PluginsPage({ searchParams }: PageProps<"/plugins">) {
  return <Catalog base="/plugins" title="플러그인·MCP" kind="link" sp={await searchParams} />;
}
