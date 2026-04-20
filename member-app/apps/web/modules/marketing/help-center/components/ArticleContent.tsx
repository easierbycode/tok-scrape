"use client";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ArticleContentProps {
	content: string;
}

export function ArticleContent({ content }: ArticleContentProps) {
	return (
		<div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4 prose-p:mb-4 prose-a:text-primary prose-a:underline prose-strong:font-semibold prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-ul:list-disc prose-ul:list-inside prose-ul:space-y-1 prose-ul:my-4 prose-ol:list-decimal prose-ol:list-inside prose-ol:space-y-1 prose-ol:my-4">
			<ReactMarkdown
				components={{
					code({ node, inline, className, children, ...props }: any) {
						const match = /language-(\w+)/.exec(className || "");
						return !inline && match ? (
							<SyntaxHighlighter
								style={vscDarkPlus}
								language={match[1]}
								PreTag="div"
								{...props}
							>
								{String(children).replace(/\n$/, "")}
							</SyntaxHighlighter>
						) : (
							<code className={className} {...props}>
								{children}
							</code>
						);
					},
					a({ node, href, children, ...props }: any) {
						return (
							<a
								href={href}
								className="text-primary hover:underline"
								{...props}
							>
								{children}
							</a>
						);
					},
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
