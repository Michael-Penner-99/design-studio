import * as cheerio from "cheerio";

const REVEAL_SCRIPT =
  `<script>(function(){var p=new URLSearchParams(location.search);` +
  `if(p.has('edit')||location.hash==='#edit'){var a=document.querySelector('[data-op-edit]');` +
  `if(a){a.hidden=false;a.setAttribute('style','position:fixed;bottom:16px;right:16px;z-index:99999;` +
  `background:#111;color:#fff;padding:10px 16px;border-radius:6px;font:600 14px system-ui;text-decoration:none');}}})();</script>`;

/** Append a hidden operator "Edit site" button + reveal script before </body>. Idempotent. */
export function injectOperatorEditButton(html: string, opts: { editorUrl: string; slug: string }): string {
  const $ = cheerio.load(html);
  if ($("[data-op-edit]").length) return html;
  const href = `${opts.editorUrl.replace(/\/$/, "")}/admin/${opts.slug}`;
  const anchor = `<a href="${href}" data-op-edit hidden>✎ Edit site</a>`;
  if ($("body").length) {
    $("body").append(anchor + REVEAL_SCRIPT);
    return $.html();
  }
  return html + anchor + REVEAL_SCRIPT;
}
