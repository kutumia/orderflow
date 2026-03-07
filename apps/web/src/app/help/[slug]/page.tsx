"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import articles from "@/../../content/help/articles.json";

export default function HelpArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Article not found.</p>
          <Link href="/help" className="text-brand-600 text-sm font-medium">← Back to Help Centre</Link>
        </div>
      </div>
    );
  }

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-lg font-bold mt-6 mb-2">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("- ")) {
        return (
          <li key={i} className="ml-4 text-sm text-gray-700 leading-relaxed list-disc">
            {renderInline(line.replace("- ", ""))}
          </li>
        );
      }
      if (line.match(/^\d+\. /)) {
        return (
          <li key={i} className="ml-4 text-sm text-gray-700 leading-relaxed list-decimal">
            {renderInline(line.replace(/^\d+\. /, ""))}
          </li>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-gray-700 leading-relaxed">{renderInline(line)}</p>;
    });
  };

  const renderInline = (text: string) => {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Find related articles
  const related = articles
    .filter((a) => a.slug !== slug && a.tags.some((t) => article.tags.includes(t)))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand-600">OrderFlow</Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard →</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/help" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Help Centre
        </Link>

        <article className="bg-white rounded-xl border p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-brand-600" />
            <div className="flex gap-1">
              {article.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-4">{article.title}</h1>

          <div className="prose-sm">{renderContent(article.content)}</div>
        </article>

        {related.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Related Articles</h3>
            <div className="space-y-2">
              {related.map((a) => (
                <Link key={a.slug} href={`/help/${a.slug}`}
                  className="flex items-center gap-3 bg-white rounded-lg border p-3 hover:border-brand-200 transition-colors text-sm font-medium">
                  {a.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
