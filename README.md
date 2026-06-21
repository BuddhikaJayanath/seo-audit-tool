# 🔍 Free SEO Audit Tool

A fully client-side SEO audit tool — no backend, no API keys, no sign-up required. Works by fetching any public URL through a CORS proxy and analysing the HTML.

## ✨ Features

- **Meta Tags** — title, description, robots, canonical
- **Heading Structure** — H1/H2/H3 count and content
- **Open Graph & Twitter Card** tags
- **Image Alt Text** audit
- **Internal / External link** count
- **HTTPS check**
- **Mobile viewport** meta
- **Structured Data** (JSON-LD) detection
- **Language declaration** check
- **Page size** estimate
- **SEO Score** (0–100) with visual ring
- Export JSON, copy report, print

---

## 🚀 Deploy to GitHub Pages (Step-by-Step)

### Step 1 — Create a GitHub Account
Go to [github.com](https://github.com) and sign up if you don't have an account.

### Step 2 — Create a New Repository
1. Click the **+** icon → **New repository**
2. Repository name: `seo-audit-tool` (or any name you like)
3. Set visibility to **Public**
4. **Do NOT** check "Add a README file"
5. Click **Create repository**

### Step 3 — Upload Files
On the empty repository page:
1. Click **uploading an existing file**
2. Drag and drop all 4 files:
   - `index.html`
   - `style.css`
   - `app.js`
   - `favicon.svg`
3. Scroll down, click **Commit changes**

### Step 4 — Enable GitHub Pages
1. Go to your repository **Settings** tab
2. Scroll to **Pages** in the left sidebar
3. Under **Source**, select **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)`
5. Click **Save**

### Step 5 — Your site is live!
After 1–2 minutes, your site will be available at:
```
https://YOUR-USERNAME.github.io/seo-audit-tool/
```

---

## 🛠 Local Development

No build tools needed. Just open `index.html` in a browser, or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .
```

Then visit `http://localhost:8000`

---

## 📁 File Structure

```
seo-audit-tool/
├── index.html    # Main page & UI
├── style.css     # All styles
├── app.js        # SEO audit engine
├── favicon.svg   # Site icon
└── README.md     # This file
```

---

## ⚙️ How It Works

1. User enters a URL
2. Page HTML is fetched via [AllOrigins](https://allorigins.win/) CORS proxy (free, no key needed)
3. HTML is parsed client-side with `DOMParser`
4. 15 SEO checks run against the DOM
5. Results are scored and displayed

---

## 📝 License

MIT — free to use, modify, and deploy.
