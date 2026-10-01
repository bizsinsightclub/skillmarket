import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 원시 HTML 은 버린다(skipHtml, rehype-raw 금지). react-markdown 기본값이 javascript: 같은 URL 도 걸러준다.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
