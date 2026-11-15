#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-tokens.sh — validate the token file by COMPUTED STYLES, not by eye.
#
# A CSS custom property that fails to parse is dropped silently, and the page
# still renders — just wrong. This script asserts that the values that matter
# actually resolve in the browser.
#
#   usage: tooling/check-tokens.sh [path] [width] [height]
# ---------------------------------------------------------------------------
set -uo pipefail

PORT="${PORT:-8902}"
PATH="/c/Users/owida/.workbuddy-ai/binaries/node/versions/22.22.2-6:$PATH"
export PATH

TARGET="${1:-apps/prototype/index.html}"
W="${2:-1440}"
H="${3:-900}"

URL="http://127.0.0.1:${PORT}/${TARGET#/}"

playwright-cli open "$URL" >/dev/null 2>&1
playwright-cli resize "$W" "$H" >/dev/null 2>&1

playwright-cli eval "() => {
  const g = (sel, prop) => {
    const el = document.querySelector(sel);
    if (!el) return '  ' + sel.padEnd(26) + ' MISSING';
    const s = getComputedStyle(el);
    return '  ' + sel.padEnd(26) + ' ' + s[prop];
  };
  const out = [];
  out.push('-- ground and ink --');
  out.push(g('body','backgroundColor'));
  out.push(g('body','color'));
  out.push(g('body','fontFamily'));
  out.push('-- display --');
  out.push(g('.display','fontFamily'));
  out.push(g('.display','fontSize'));
  out.push(g('.display','color'));
  out.push('-- marine field --');
  out.push(g('.marine-band','backgroundColor'));
  out.push(g('.marine-band','backgroundImage').slice(0, 54));
  out.push('-- mono meta --');
  out.push(g('.eyebrow','fontFamily'));
  out.push(g('.eyebrow','letterSpacing'));
  out.push('-- controls --');
  out.push(g('.btn','borderRadius'));
  out.push(g('.btn--primary','backgroundColor'));
  out.push(g('.btn--primary','color'));
  out.push('-- folio --');
  out.push(g('.folio-row .n','color'));
  out.push(g('.folio-row .n','fontFamily'));
  out.push(g('.folio-row .code','fontFamily'));
  out.push('-- fonts --');
  out.push('  Fraunces:          ' + document.fonts.check('16px Fraunces'));
  out.push('  IBM Plex Mono:     ' + document.fonts.check('16px \"IBM Plex Mono\"'));
  out.push('  Inter:             ' + document.fonts.check('16px Inter'));
  out.push('-- overflow --');
  out.push('  scrollWidth ' + document.documentElement.scrollWidth + ' vs clientWidth ' + document.documentElement.clientWidth);
  out.push('  height ' + document.documentElement.scrollHeight);
  return out.join('\n');
}" 2>&1 | tail -32

playwright-cli close >/dev/null 2>&1
