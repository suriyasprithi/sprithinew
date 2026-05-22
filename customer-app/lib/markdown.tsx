import { Fragment, type ReactNode } from "react";

// Tiny markdown renderer — handles the subset a blog post actually needs:
// headings (#, ##, ###), bold (**text**), italic (*text*), inline code (`code`),
// links ([text](url)), bullet lists (- item), ordered lists (1. item),
// blockquotes (> text), code fences (```), and paragraphs.
//
// Why not react-markdown? It adds ~100 KB to the bundle for what amounts to
// regex passes. Keep it local + dependency-free. Trade-off: no GFM tables,
// no autolinks, no html passthrough.

function escape(s: string): string {
  // Strip raw HTML so admin markdown can't inject scripts.
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

function inline(raw: string): ReactNode[] {
  const escaped = escape(raw);
  const out: ReactNode[] = [];
  let rest = escaped;
  let key = 0;

  // Order matters: code first so its contents aren't re-processed,
  // then links, then bold (double-star) before italic (single-star).
  const patterns: Array<{ re: RegExp; build: (m: RegExpExecArray) => ReactNode }> = [
    { re: /`([^`]+)`/,                        build: (m) => <code key={key++} className="rounded bg-[var(--mk-surface-2)] px-1 py-0.5 text-[0.92em]">{m[1]}</code> },
    { re: /\[([^\]]+)\]\(([^)\s]+)\)/,        build: (m) => <a key={key++} href={m[2]} className="text-[var(--mk-brand)] underline-offset-2 hover:underline" target={m[2].startsWith("http") ? "_blank" : undefined} rel={m[2].startsWith("http") ? "noopener noreferrer" : undefined}>{m[1]}</a> },
    { re: /\*\*([^*]+)\*\*/,                  build: (m) => <strong key={key++} className="font-semibold">{m[1]}</strong> },
    { re: /\*([^*]+)\*/,                      build: (m) => <em key={key++}>{m[1]}</em> },
  ];

  while (rest.length > 0) {
    let earliest: { idx: number; match: RegExpExecArray; build: (m: RegExpExecArray) => ReactNode } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (earliest === null || m.index < earliest.idx)) {
        earliest = { idx: m.index, match: m, build: p.build };
      }
    }
    if (!earliest) { out.push(rest); break; }
    if (earliest.idx > 0) out.push(rest.slice(0, earliest.idx));
    out.push(earliest.build(earliest.match));
    rest = rest.slice(earliest.idx + earliest.match[0].length);
  }
  return out;
}

export function renderMarkdown(src: string): ReactNode {
  // Normalize line endings, split into blocks (blank line separated).
  const text = (src || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const ln = lines[i];

    // Code fence
    if (/^```/.test(ln)) {
      const fenced: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { fenced.push(lines[i]); i++; }
      i++; // skip closing fence (or EOF)
      blocks.push(
        <pre key={key++} className="my-4 overflow-x-auto rounded-xl bg-[var(--mk-surface-2)] p-4 text-sm">
          <code>{fenced.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = /^(#{1,3})\s+(.+)$/.exec(ln);
    if (h) {
      const level = h[1].length;
      const cls = level === 1
        ? "mt-8 mb-3 text-3xl font-bold tracking-tight"
        : level === 2
          ? "mt-6 mb-2 text-2xl font-bold tracking-tight"
          : "mt-5 mb-2 text-xl font-semibold";
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      blocks.push(<Tag key={key++} className={cls}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(ln)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-4 border-l-4 border-[var(--mk-brand)]/40 bg-[var(--mk-brand-soft)]/50 px-4 py-2 text-[var(--mk-text-soft)]">
          {inline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-3 list-disc space-y-1 pl-6">
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-3 list-decimal space-y-1 pl-6">
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ol>,
      );
      continue;
    }

    // Blank line — skip
    if (ln.trim() === "") { i++; continue; }

    // Paragraph — accumulate lines until blank / structural break.
    const para: string[] = [ln];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|>\s|[-*]\s|\d+\.\s|```)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-3 leading-relaxed">
        {inline(para.join(" "))}
      </p>,
    );
  }

  return <Fragment>{blocks}</Fragment>;
}
