/* ═══════════════════════════════════════════
   SEO Audit Engine — app.js
   Fetches pages via reliable CORS proxies
═══════════════════════════════════════════ */

let lastReport = null;

// ─── Entry Point ───────────────────────────
async function runAudit() {
  const rawUrl = document.getElementById('urlInput').value.trim();
  if (!rawUrl) { showError('Please enter a URL to audit.'); return; }

  let url = rawUrl;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try { new URL(url); } catch {
    showError('Please enter a valid URL (e.g. https://example.com)');
    return;
  }

  setLoading(true);
  hideResults();
  clearError();

  try {
    const html = await fetchPage(url);
    const doc = parseHTML(html);
    const report = analyzeDoc(doc, url, html);
    lastReport = report;
    renderResults(report, url);
  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// Allow Enter key
document.getElementById('urlInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') runAudit();
});

// ─── Fetch with multiple strategies ────────
async function fetchPage(targetUrl) {

  // Strategy list — each returns HTML string or throws
  const strategies = [

    // 1. allorigins (JSON wrapper)
    async () => {
      setProgress(20, 'Trying proxy 1…');
      const r = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`,
        12000
      );
      if (!r.ok) throw new Error('allorigins HTTP ' + r.status);
      const j = await r.json();
      if (!j.contents) throw new Error('allorigins: empty contents');
      return j.contents;
    },

    // 2. corsproxy.io (raw)
    async () => {
      setProgress(40, 'Trying proxy 2…');
      const r = await fetchWithTimeout(
        `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
        12000
      );
      if (!r.ok) throw new Error('corsproxy HTTP ' + r.status);
      return await r.text();
    },

    // 3. htmldriven cors-anywhere clone
    async () => {
      setProgress(55, 'Trying proxy 3…');
      const r = await fetchWithTimeout(
        `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
        12000
      );
      if (!r.ok) throw new Error('thingproxy HTTP ' + r.status);
      return await r.text();
    },

    // 4. codetabs
    async () => {
      setProgress(70, 'Trying proxy 4…');
      const r = await fetchWithTimeout(
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        12000
      );
      if (!r.ok) throw new Error('codetabs HTTP ' + r.status);
      return await r.text();
    },
  ];

  const errors = [];
  for (const strategy of strategies) {
    try {
      const html = await strategy();
      if (html && html.length > 200) {
        setProgress(80, 'Parsing HTML…');
        return html;
      }
      errors.push('Response too short');
    } catch (e) {
      errors.push(e.message);
      console.warn('Strategy failed:', e.message);
    }
  }

  // All failed — show helpful message
  throw new Error(
    `Could not fetch "${targetUrl}".\n\n` +
    `All ${strategies.length} proxies failed. Common reasons:\n` +
    `• The website blocks automated requests\n` +
    `• The URL requires login\n` +
    `• Try a simpler URL like: https://example.com\n\n` +
    `Proxy errors:\n` + errors.map((e, i) => `  ${i+1}. ${e}`).join('\n')
  );
}

// Fetch with timeout
async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function parseHTML(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

// ─── SEO Analysis ─────────────────────────
function analyzeDoc(doc, url, rawHtml) {
  const checks = [];

  // 1. Title tag
  const title = doc.querySelector('title');
  const titleText = title ? title.textContent.trim() : '';
  const titleLen = titleText.length;
  checks.push({
    id: 'title',
    name: 'Title Tag',
    status: !titleText ? 'fail' : titleLen < 10 || titleLen > 70 ? 'warn' : 'pass',
    value: titleText || '(missing)',
    tip: titleText
      ? `Length: ${titleLen} chars. Ideal: 30–70 characters.`
      : 'Add a <title> tag to your <head> section.',
  });

  // 2. Meta Description
  const metaDesc = doc.querySelector('meta[name="description"]');
  const descContent = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';
  const descLen = descContent.length;
  checks.push({
    id: 'meta-desc',
    name: 'Meta Description',
    status: !descContent ? 'fail' : descLen < 50 || descLen > 160 ? 'warn' : 'pass',
    value: descContent || '(missing)',
    tip: descContent
      ? `Length: ${descLen} chars. Ideal: 120–160 characters.`
      : 'Add <meta name="description" content="..."> inside <head>.',
  });

  // 3. H1 tag
  const h1s = doc.querySelectorAll('h1');
  const h1Count = h1s.length;
  checks.push({
    id: 'h1',
    name: 'H1 Heading',
    status: h1Count === 0 ? 'fail' : h1Count > 1 ? 'warn' : 'pass',
    value: h1Count === 0 ? '(missing)' : Array.from(h1s).map(h => h.textContent.trim()).join(' | '),
    tip: h1Count === 0 ? 'Add exactly one <h1> per page.' : h1Count > 1 ? `Found ${h1Count} H1 tags — use only one.` : 'Good — single H1 found.',
  });

  // 4. Heading hierarchy
  const h2s = doc.querySelectorAll('h2').length;
  const h3s = doc.querySelectorAll('h3').length;
  checks.push({
    id: 'headings',
    name: 'Heading Structure',
    status: h2s === 0 && h3s === 0 ? 'warn' : 'pass',
    value: `H1: ${h1Count} · H2: ${h2s} · H3: ${h3s}`,
    tip: h2s === 0 ? 'Add H2/H3 subheadings to improve content structure.' : 'Good heading hierarchy found.',
  });

  // 5. Canonical URL
  const canonical = doc.querySelector('link[rel="canonical"]');
  checks.push({
    id: 'canonical',
    name: 'Canonical Tag',
    status: canonical ? 'pass' : 'warn',
    value: canonical ? canonical.getAttribute('href') : '(missing)',
    tip: canonical ? 'Canonical tag found.' : 'Add <link rel="canonical" href="..."> to prevent duplicate content issues.',
  });

  // 6. Robots meta
  const robotsMeta = doc.querySelector('meta[name="robots"]');
  const robotsContent = robotsMeta ? robotsMeta.getAttribute('content') || '' : '';
  const noindex = /noindex/i.test(robotsContent);
  checks.push({
    id: 'robots',
    name: 'Robots Meta',
    status: noindex ? 'fail' : robotsMeta ? 'pass' : 'warn',
    value: robotsContent || '(missing — defaults to index, follow)',
    tip: noindex ? '⚠️ Page is set to NOINDEX — search engines will not index it!' : robotsMeta ? 'Robots meta found.' : 'No robots meta found — page defaults to indexable (OK).',
  });

  // 7. Open Graph
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  const ogImage = doc.querySelector('meta[property="og:image"]');
  const ogScore = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  checks.push({
    id: 'og',
    name: 'Open Graph Tags',
    status: ogScore === 3 ? 'pass' : ogScore > 0 ? 'warn' : 'fail',
    value: `og:title ${ogTitle ? '✓' : '✗'} · og:description ${ogDesc ? '✓' : '✗'} · og:image ${ogImage ? '✓' : '✗'}`,
    tip: ogScore < 3 ? 'Add missing og: meta tags for better social media sharing.' : 'Full Open Graph tags found.',
  });

  // 8. Twitter Card
  const twCard = doc.querySelector('meta[name="twitter:card"]');
  checks.push({
    id: 'twitter',
    name: 'Twitter Card',
    status: twCard ? 'pass' : 'warn',
    value: twCard ? twCard.getAttribute('content') : '(missing)',
    tip: twCard ? 'Twitter Card meta found.' : 'Add <meta name="twitter:card" content="summary_large_image"> for rich Twitter previews.',
  });

  // 9. Images without alt
  const images = doc.querySelectorAll('img');
  const noAlt = Array.from(images).filter(img => !img.getAttribute('alt') && img.getAttribute('alt') !== '');
  checks.push({
    id: 'images',
    name: 'Image Alt Text',
    status: noAlt.length === 0 ? 'pass' : noAlt.length < 3 ? 'warn' : 'fail',
    value: `${images.length} images · ${noAlt.length} missing alt attributes`,
    tip: noAlt.length === 0 ? 'All images have alt text.' : `${noAlt.length} image(s) missing alt attributes — add descriptive alt text for SEO and accessibility.`,
  });

  // 10. Internal vs external links
  const links = doc.querySelectorAll('a[href]');
  const urlHost = new URL(url).hostname;
  let internal = 0, external = 0, broken = 0;
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    try {
      const abs = new URL(href, url);
      if (abs.hostname === urlHost) internal++; else external++;
    } catch { broken++; }
  });
  checks.push({
    id: 'links',
    name: 'Link Analysis',
    status: broken > 3 ? 'fail' : internal === 0 ? 'warn' : 'pass',
    value: `Internal: ${internal} · External: ${external} · Malformed: ${broken}`,
    tip: broken > 0 ? `${broken} malformed link(s) detected.` : `${internal} internal links for crawlability.`,
  });

  // 11. HTTPS
  const isHttps = url.startsWith('https://');
  checks.push({
    id: 'https',
    name: 'HTTPS / SSL',
    status: isHttps ? 'pass' : 'fail',
    value: isHttps ? 'HTTPS enabled' : 'HTTP only',
    tip: isHttps ? 'Good — page is served over HTTPS.' : 'Migrate to HTTPS — it is a Google ranking factor.',
  });

  // 12. Viewport meta
  const viewport = doc.querySelector('meta[name="viewport"]');
  checks.push({
    id: 'viewport',
    name: 'Mobile Viewport',
    status: viewport ? 'pass' : 'fail',
    value: viewport ? viewport.getAttribute('content') : '(missing)',
    tip: viewport ? 'Viewport meta found — mobile friendly.' : 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile support.',
  });

  // 13. Structured data (JSON-LD)
  const jsonLd = doc.querySelectorAll('script[type="application/ld+json"]');
  checks.push({
    id: 'schema',
    name: 'Structured Data (JSON-LD)',
    status: jsonLd.length > 0 ? 'pass' : 'warn',
    value: jsonLd.length > 0 ? `${jsonLd.length} JSON-LD block(s) found` : '(none found)',
    tip: jsonLd.length > 0 ? 'Structured data found — helps with rich results.' : 'Add JSON-LD schema markup for rich search results.',
  });

  // 14. Lang attribute
  const htmlEl = doc.documentElement;
  const lang = htmlEl ? htmlEl.getAttribute('lang') : null;
  checks.push({
    id: 'lang',
    name: 'Language Declaration',
    status: lang ? 'pass' : 'warn',
    value: lang || '(missing)',
    tip: lang ? `Language declared as "${lang}".` : 'Add lang attribute to <html> (e.g., <html lang="en">).',
  });

  // 15. Page size estimate
  const sizeKB = Math.round(rawHtml.length / 1024);
  checks.push({
    id: 'pagesize',
    name: 'Page Size',
    status: sizeKB < 100 ? 'pass' : sizeKB < 500 ? 'warn' : 'fail',
    value: `~${sizeKB} KB HTML`,
    tip: sizeKB < 100 ? 'Lightweight page — good for performance.' : sizeKB < 500 ? 'Moderate size — consider minification.' : 'Large HTML — optimize to improve load time.',
  });

  setProgress(100, 'Done!');
  return { checks, url };
}

// ─── Render Results ────────────────────────
function renderResults(report, url) {
  const { checks } = report;

  const pass = checks.filter(c => c.status === 'pass').length;
  const warn = checks.filter(c => c.status === 'warn').length;
  const fail = checks.filter(c => c.status === 'fail').length;
  const total = checks.length;
  const score = Math.round((pass / total) * 100);

  // Score ring
  const ring = document.getElementById('scoreRing');
  const circumference = 326.7;
  const offset = circumference - (score / 100) * circumference;
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  }, 100);
  document.getElementById('scoreNumber').textContent = score;

  // Audited URL
  document.getElementById('auditedUrl').textContent = url;

  // Pills
  document.getElementById('summaryPills').innerHTML = `
    <div class="pill pass">✓ ${pass} Passed</div>
    <div class="pill warn">⚠ ${warn} Warnings</div>
    <div class="pill fail">✗ ${fail} Failed</div>
  `;

  // Description
  const desc = score >= 80 ? 'Great SEO health! Fix the remaining warnings for a perfect score.'
    : score >= 60 ? 'Decent foundation — address the failures and warnings to improve rankings.'
    : score >= 40 ? 'Several issues found. Work through the failures first.'
    : 'Many critical issues. Start with the failed checks below.';
  document.getElementById('scoreDesc').textContent = desc;

  // Check cards
  const grid = document.getElementById('checksGrid');
  grid.innerHTML = '';
  const sorted = [...checks].sort((a, b) => {
    const order = { fail: 0, warn: 1, pass: 2 };
    return order[a.status] - order[b.status];
  });

  sorted.forEach(c => {
    const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗';
    const label = c.status === 'pass' ? 'Pass' : c.status === 'warn' ? 'Warning' : 'Fail';
    const card = document.createElement('div');
    card.className = `check-card ${c.status}`;
    card.innerHTML = `
      <div class="check-header" onclick="toggleCard(this)">
        <div class="check-title-row">
          <div class="check-icon">${icon}</div>
          <div class="check-name">${c.name}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="check-badge">${label}</div>
          <div class="chevron">▼</div>
        </div>
      </div>
      <div class="check-body">
        <div class="check-value">${escapeHtml(c.value)}</div>
        <div class="check-tip">${c.tip}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  document.getElementById('resultsSection').classList.remove('hidden');
  document.getElementById('howSection').classList.add('hidden');
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCard(header) {
  const card = header.closest('.check-card');
  card.classList.toggle('open');
}

// ─── UI Helpers ────────────────────────────
function setLoading(on) {
  document.getElementById('loadingSection').classList.toggle('hidden', !on);
  document.getElementById('auditBtn').disabled = on;
}

function hideResults() {
  document.getElementById('resultsSection').classList.add('hidden');
}

function setProgress(pct, text) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('loadingText').textContent = text;
}

function showError(msg) {
  // Remove old error if any
  clearError();
  const div = document.createElement('div');
  div.id = 'errorBox';
  div.style.cssText = `
    max-width:640px; margin:16px auto 0; padding:14px 18px;
    background:#fee2e2; border:1px solid #fca5a5; border-radius:10px;
    color:#991b1b; font-size:14px; white-space:pre-wrap; line-height:1.6;
  `;
  div.innerHTML = `<strong>⚠ Error</strong><br>${escapeHtml(msg)}`;
  document.querySelector('.search-box').insertAdjacentElement('afterend', div);
}

function clearError() {
  const old = document.getElementById('errorBox');
  if (old) old.remove();
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Export Functions ──────────────────────
function exportJSON() {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seo-audit.json';
  a.click();
}

function copyReport() {
  if (!lastReport) return;
  const lines = [
    `SEO Audit Report — ${lastReport.url}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    ...lastReport.checks.map(c =>
      `[${c.status.toUpperCase()}] ${c.name}\n  ${c.value}\n  Tip: ${c.tip}`
    )
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    alert('Report copied to clipboard!');
  });
}

function printReport() {
  window.print();
}
