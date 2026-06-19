import * as cheerio from "cheerio";

/**
 * Append a hidden inline loader before </body>. On ?edit / #edit the loader
 * injects the editor embed bundle from the editor app. Idempotent.
 */
export function injectEditorEmbed(html: string, opts: { editorUrl: string; slug: string }): string {
  const $ = cheerio.load(html);
  if ($("[data-editor-embed]").length) return html;
  const base = opts.editorUrl.replace(/\/$/, "");
  const baseJson = JSON.stringify(base);
  const slugJson = JSON.stringify(opts.slug);
  const loader =
    `<script data-editor-embed data-slug=${JSON.stringify(opts.slug)} data-editor=${JSON.stringify(base)}>` +
    `(function(){var p=new URLSearchParams(location.search);` +
    `if(p.has('edit')||location.hash==='#edit'){var s=document.createElement('script');` +
    `s.src=${baseJson}+'/embed.js';s.defer=true;` +
    `s.setAttribute('data-slug',${slugJson});s.setAttribute('data-editor',${baseJson});` +
    `document.body.appendChild(s);}})();</script>`;
  if ($("body").length) {
    $("body").append(loader);
    return $.html();
  }
  return html + loader;
}
