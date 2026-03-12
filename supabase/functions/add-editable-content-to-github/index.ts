/**
 * add-editable-content-to-github/index.ts  v3
 *
 * Wraps hardcoded JSX text nodes in <EditableContent> by URL.
 *
 * Request body:
 *   { "urls": ["/", "/products", "/portfolio"] }
 *
 * For each URL the function:
 *   1. Maps the URL to its page file via the hardcoded route map (mirrors App.tsx).
 *   2. Recursively resolves all local imports in that file AND every imported
 *      component/util under src/ (hooks, contexts, components — anything with
 *      a relative path starting with ./ or ../).
 *      Skips: node_modules, EditableContent itself, non-TSX/JSX files.
 *   3. Scans every resolved file for hardcoded JSX text nodes ONLY inside
 *      return(...) blocks (so TypeScript generics/logic are never touched).
 *   4. Wraps found text with <EditableContent contentKey="…" fallback="…" />.
 *   5. Commits all changed files in one GitHub commit.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ─── Route map (mirrors src/App.tsx) ─────────────────────────────────────────
// Maps URL pattern → repo-relative page file path.
// Patterns with :param are matched as prefixes (we strip the param part).
const ROUTE_MAP: Array<{ pattern: string; file: string; label: string }> = [
  { pattern: "/",                file: "src/pages/HomePage.tsx",          label: "Forside" },
  { pattern: "/products",        file: "src/pages/ProductsPage.tsx",       label: "Produkter" },
  { pattern: "/product/",        file: "src/pages/ProductPage.tsx",        label: "Produkt-detalje" },
  { pattern: "/portfolio",       file: "src/pages/PortfolioPage.tsx",      label: "Portfolio" },
  { pattern: "/search",          file: "src/pages/SearchPage.tsx",         label: "Søg" },
  { pattern: "/auth",            file: "src/pages/AuthPage.tsx",           label: "Login / Opret konto" },
  { pattern: "/login",           file: "src/pages/Login.tsx",              label: "Login (gammel)" },
  { pattern: "/terms",           file: "src/pages/Terms.tsx",              label: "Vilkår" },
  { pattern: "/policies",        file: "src/pages/Policies.tsx",           label: "Privatpolitik" },
  { pattern: "/coverage",        file: "src/pages/CoverageAreasPage.tsx",  label: "Dækningsområder" },
  { pattern: "/simple-request",  file: "src/pages/SimpleRequestPage.tsx",  label: "Simpel forespørgsel" },
  { pattern: "/donate/",         file: "src/pages/DonationPage.tsx",       label: "Donation" },
  { pattern: "/booking/",        file: "src/pages/BookingPage.tsx",        label: "Booking" },
  { pattern: "/booking-success", file: "src/pages/BookingSuccessPage.tsx", label: "Booking-bekræftelse" },
  { pattern: "/payment",         file: "src/pages/PaymentPage.tsx",        label: "Betaling" },
  { pattern: "/ratings",         file: "src/pages/RatingsPage.tsx",        label: "Anmeldelser" },
  { pattern: "/profile",         file: "src/pages/ProfilePage.tsx",        label: "Profil" },
  { pattern: "/buy-credits",     file: "src/pages/BuyCreditsPage.tsx",     label: "Køb credits" },
  // Always-present global layout files
  { pattern: "__navbar__",       file: "src/components/NavBar.tsx",        label: "NavBar (global)" },
  { pattern: "__footer__",       file: "src/components/Footer.tsx",        label: "Footer (global)" },
];

interface RequestBody {
  urls?: string[];
  listRoutes?: boolean; // if true, just return the route map — no scanning
}

interface AddResult {
  scannedFiles: number;
  modifiedFiles: string[];
  addedKeys: Array<{ key: string; fallback: string; file: string }>;
  skippedFiles: string[];
  commitSha: string | null;
  commitUrl: string | null;
  errors: string[];
  routes?: Array<{ url: string; label: string; pageFile: string }>;
}

// ─── URL → page file resolution ───────────────────────────────────────────────
function resolveUrlToFile(url: string): string | null {
  // Exact match first
  for (const r of ROUTE_MAP) {
    if (!r.pattern.startsWith("__") && r.pattern === url) return r.file;
  }
  // Prefix match for parameterised routes
  for (const r of ROUTE_MAP) {
    if (!r.pattern.startsWith("__") && r.pattern.endsWith("/") && url.startsWith(r.pattern)) return r.file;
  }
  return null;
}

// ─── Recursive import resolver ────────────────────────────────────────────────

/**
 * Given a file's source and its repo-relative path, extract all relative local
 * imports and resolve them to repo-relative paths.
 *
 * Only resolves .tsx / .ts / .jsx / .js files under src/.
 * Skips: node_modules, EditableContent, contexts/, hooks/ (no JSX to wrap).
 */
function extractLocalImports(source: string, fromPath: string): string[] {
  const dir = fromPath.split("/").slice(0, -1).join("/"); // e.g. "src/pages"
  const imports: string[] = [];

  // Match:  import … from './foo'  OR  import('./foo')
  const re = /(?:import\s+[^'"]*from\s+|import\s*\()\s*['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    let rel = m[1]; // e.g. "../components/Footer"

    // Resolve relative to fromPath's directory
    const parts = dir.split("/");
    for (const seg of rel.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== ".") parts.push(seg);
    }
    let resolved = parts.join("/"); // e.g. "src/components/Footer"

    // Add .tsx extension if missing
    if (!/\.(tsx?|jsx?)$/.test(resolved)) resolved += ".tsx";

    // Only process src/ files; skip EditableContent and non-component paths
    if (!resolved.startsWith("src/")) continue;
    if (resolved.includes("EditableContent")) continue;
    if (resolved.includes("/contexts/")) continue;   // no JSX to wrap in contexts
    if (resolved.includes("/hooks/")) continue;       // no JSX to wrap in hooks
    if (resolved.includes("/utils/")) continue;       // no JSX to wrap in utils
    if (resolved.includes("/types")) continue;
    if (!/(\.tsx|\.jsx)$/.test(resolved)) continue;  // only JSX/TSX

    imports.push(resolved);
  }
  return imports;
}

/**
 * Starting from `rootFile`, recursively collect all locally-imported component
 * files. Returns the full set including `rootFile`.
 * `fileContents` is a pre-fetched map of path → source (to avoid double-fetch).
 */
async function resolveAllDeps(
  rootFile: string,
  fetchFile: (path: string) => Promise<{ content: string; sha: string } | null>,
  fileContents: Map<string, { content: string; sha: string }>,
): Promise<Set<string>> {
  const visited = new Set<string>();
  const queue = [rootFile];

  while (queue.length > 0) {
    const filePath = queue.shift()!;
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    if (!fileContents.has(filePath)) {
      const fetched = await fetchFile(filePath);
      if (fetched) fileContents.set(filePath, fetched);
      else continue; // file doesn't exist (e.g. .tsx tried but actual is .ts)
    }

    const { content } = fileContents.get(filePath)!;
    const deps = extractLocalImports(content, filePath);
    for (const dep of deps) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  return visited;
}

// ─── Key derivation ────────────────────────────────────────────────────────────
function deriveKey(text: string, filePath: string, existingKeys: Set<string>): string {
  const stem = filePath
    .replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
    .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const words = text.trim().toLowerCase()
    .replace(/[æ]/g, "ae").replace(/[ø]/g, "oe").replace(/[å]/g, "aa")
    .replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5).join("-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");

  let key = `${stem}-${words}`.slice(0, 80);
  if (existingKeys.has(key)) {
    let i = 2;
    while (existingKeys.has(`${key}-${i}`)) i++;
    key = `${key}-${i}`;
  }
  existingKeys.add(key);
  return key;
}

// ─── JSX return block finder ──────────────────────────────────────────────────
function findReturnBlocks(source: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const returnRe = /\breturn\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = returnRe.exec(source)) !== null) {
    const openParen = m.index + m[0].length - 1;
    let depth = 1, i = openParen + 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === '"' || ch === "'") {
        const q = ch; i++;
        while (i < source.length && source[i] !== q) { if (source[i] === "\\") i++; i++; }
      } else if (ch === "`") {
        i++;
        while (i < source.length && source[i] !== "`") { if (source[i] === "\\") i++; i++; }
      }
      i++;
    }
    if (depth === 0) blocks.push({ start: openParen, end: i - 1 });
  }
  return blocks;
}

function isInReturnBlock(pos: number, blocks: Array<{ start: number; end: number }>): boolean {
  return blocks.some(b => pos > b.start && pos < b.end);
}

// ─── Text checks ──────────────────────────────────────────────────────────────
function isWorthWrapping(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (!/[a-zA-ZæøåÆØÅ]/.test(t)) return false;
  if (/^[A-Z][a-zA-Z]+</.test(t)) return false;   // TypeScript generic
  if (/^\d/.test(t)) return false;
  if (t.includes("=>") || t.includes("&&") || t.includes("||")) return false;
  if (/^[a-z][a-zA-Z]+\(/.test(t)) return false;  // fn call fragment
  if (/[;{}=]/.test(t)) return false;
  return true;
}

function isJSXCloseAngle(source: string, anglePos: number): boolean {
  const lookback = source.slice(Math.max(0, anglePos - 400), anglePos);
  return /<([A-Za-z][A-Za-z0-9.]*)[^>]*>\s*$/.test(lookback);
}

function isInsideEditableContent(source: string, pos: number): boolean {
  const before = source.slice(Math.max(0, pos - 2000), pos);
  const lastEC = before.lastIndexOf("<EditableContent");
  if (lastEC === -1) return false;
  const afterEC = before.slice(lastEC);
  return !(/^<EditableContent[^>]*\/\s*>/.test(afterEC)) && !afterEC.includes("</EditableContent>");
}

// ─── Core transform ───────────────────────────────────────────────────────────
function wrapTextNodes(
  source: string,
  filePath: string,
  existingKeys: Set<string>,
): { result: string; addedKeys: Array<{ key: string; fallback: string }> } {
  const addedKeys: Array<{ key: string; fallback: string }> = [];
  const returnBlocks = findReturnBlocks(source);
  if (returnBlocks.length === 0) return { result: source, addedKeys };

  type Replacement = { start: number; end: number; replacement: string; key: string; fallback: string };
  const replacements: Replacement[] = [];
  const seenTexts = new Set<string>();

  // Pattern A: >text< — bare JSX text between tags (single line, no code chars)
  const patternA = />([^\S\n]*)([^\S\n]*[^<>{};=()\n]+?)([^\S\n]*)(?=\n?\s*<)/g;
  let m: RegExpExecArray | null;
  while ((m = patternA.exec(source)) !== null) {
    const text = m[2];
    const trimmed = text.trim();
    if (!isWorthWrapping(trimmed)) continue;
    if (seenTexts.has(trimmed)) continue;
    if (!isInReturnBlock(m.index, returnBlocks)) continue;
    if (!isJSXCloseAngle(source, m.index)) continue;
    if (isInsideEditableContent(source, m.index)) continue;

    const lookback = source.slice(Math.max(0, m.index - 200), m.index + 1);
    const tagMatch = lookback.match(/<([a-zA-Z][a-zA-Z0-9.]*)[^>]*>\s*$/);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      if (["script","style","code","pre","svg","path","circle","rect","polyline",
           "line","polygon","img","input","textarea","select","editablecontent"].includes(tag)) continue;
    }

    const lineStart = source.lastIndexOf("\n", m.index) + 1;
    const lineEnd   = source.indexOf("\n", m.index);
    const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (/\bconst\b|\blet\b|\bvar\b|\bif\b|\belse\b/.test(line)) continue;

    seenTexts.add(trimmed);
    const key = deriveKey(trimmed, filePath, existingKeys);
    const escaped = trimmed.replace(/"/g, "&quot;");
    const textStart = m.index + 1 + m[1].length;
    const textEnd   = textStart + text.length;
    replacements.push({ start: textStart, end: textEnd, replacement: `<EditableContent contentKey="${key}" fallback="${escaped}" />`, key, fallback: trimmed });
  }

  // Pattern B: {"string"} — string literal as JSX child
  const patternB = /\{(["'])([^"'\n{}<>]{3,}[a-zA-ZæøåÆØÅ][^"'\n{}<>]*)\1\}/g;
  while ((m = patternB.exec(source)) !== null) {
    const trimmed = m[2].trim();
    if (!isWorthWrapping(trimmed)) continue;
    if (seenTexts.has(trimmed)) continue;
    if (!isInReturnBlock(m.index, returnBlocks)) continue;
    if (isInsideEditableContent(source, m.index)) continue;

    const charBefore = source.slice(Math.max(0, m.index - 5), m.index).trim();
    if (charBefore.endsWith("=")) continue;

    const lookback = source.slice(Math.max(0, m.index - 300), m.index);
    const lastOpen = lookback.lastIndexOf("<");
    if (lastOpen !== -1 && !lookback.slice(lastOpen).includes(">")) continue; // inside attr

    seenTexts.add(trimmed);
    const key = deriveKey(trimmed, filePath, existingKeys);
    const escaped = trimmed.replace(/"/g, "&quot;");
    replacements.push({ start: m.index, end: m.index + m[0].length, replacement: `<EditableContent contentKey="${key}" fallback="${escaped}" />`, key, fallback: trimmed });
  }

  if (replacements.length === 0) return { result: source, addedKeys };

  replacements.sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
    addedKeys.push({ key: r.key, fallback: r.fallback });
  }
  return { result, addedKeys };
}

// ─── Import injection ──────────────────────────────────────────────────────────
function ensureEditableContentImport(source: string, filePath: string): string {
  if (/import\s+EditableContent\s+from/.test(source)) return source;
  const parts = filePath.split("/"); parts.pop();
  const depth = parts.length - 1;
  const relPrefix = depth === 0 ? "./" : "../".repeat(depth);
  const importLine = `import EditableContent from '${relPrefix}components/EditableContent';\n`;
  const lastImport = [...source.matchAll(/^import\s+[^\n]+\n/gm)].pop();
  if (lastImport) {
    const at = lastImport.index! + lastImport[0].length;
    return source.slice(0, at) + importLine + source.slice(at);
  }
  return importLine + source;
}

// ─── GitHub helpers ────────────────────────────────────────────────────────────
async function ghRequest(path: string, token: string, method = "GET", body?: unknown): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "flai-add-editable/3.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function getFile(owner: string, repo: string, path: string, branch: string, token: string): Promise<{ content: string; sha: string } | null> {
  const res = await ghRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`File fetch failed ${path}: ${res.status}`);
  const data = await res.json();
  const raw = atob(data.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  return { content: new TextDecoder("utf-8").decode(bytes), sha: data.sha };
}

async function commitFiles(
  owner: string, repo: string, branch: string, token: string,
  files: Array<{ path: string; content: string; sha: string }>,
  message: string,
): Promise<{ sha: string; url: string } | null> {
  if (!files.length) return null;
  const bRes = await ghRequest(`/repos/${owner}/${repo}/branches/${branch}`, token);
  if (!bRes.ok) throw new Error(`Branch lookup failed: ${bRes.status}`);
  const bd = await bRes.json();
  const parentSha = bd.commit.sha;
  const baseTree  = bd.commit.commit.tree.sha;

  const treeEntries = await Promise.all(files.map(async f => {
    const bytes = new TextEncoder().encode(f.content);
    const b64   = btoa(String.fromCharCode(...Array.from(bytes)));
    const blobRes = await ghRequest(`/repos/${owner}/${repo}/git/blobs`, token, "POST", { content: b64, encoding: "base64" });
    if (!blobRes.ok) throw new Error(`Blob failed ${f.path}: ${blobRes.status}`);
    return { path: f.path, mode: "100644", type: "blob", sha: (await blobRes.json()).sha };
  }));

  const tRes = await ghRequest(`/repos/${owner}/${repo}/git/trees`, token, "POST", { base_tree: baseTree, tree: treeEntries });
  if (!tRes.ok) throw new Error(`Tree failed: ${tRes.status}`);
  const newTree = (await tRes.json()).sha;

  const cRes = await ghRequest(`/repos/${owner}/${repo}/git/commits`, token, "POST", {
    message, tree: newTree, parents: [parentSha],
    author: { name: "Flai Deploy Bot", email: "deploy-bot@flai.dk", date: new Date().toISOString() },
  });
  if (!cRes.ok) throw new Error(`Commit failed: ${cRes.status}`);
  const cd = await cRes.json();

  const rRes = await ghRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, "PATCH", { sha: cd.sha });
  if (!rRes.ok) throw new Error(`Ref update failed: ${rRes.status}`);
  return { sha: cd.sha, url: `https://github.com/${owner}/${repo}/commit/${cd.sha}` };
}

// ─── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS, status: 204 });

  const result: AddResult = { scannedFiles: 0, modifiedFiles: [], addedKeys: [], skippedFiles: [], commitSha: null, commitUrl: null, errors: [] };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const GITHUB_TOKEN  = Deno.env.get("GITHUB_TOKEN");
    const GITHUB_OWNER  = Deno.env.get("GITHUB_OWNER");
    const GITHUB_REPO   = Deno.env.get("GITHUB_REPO");
    const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return new Response(JSON.stringify({ error: "Missing secrets" }), { status: 500, headers: CORS });
    }

    let body: RequestBody = {};
    try { body = await req.json(); } catch { /* no body */ }

    // ── listRoutes mode: just return the route map ─────────────────────────
    if (body.listRoutes) {
      result.routes = ROUTE_MAP
        .filter(r => !r.pattern.startsWith("__"))
        .map(r => ({ url: r.pattern, label: r.label, pageFile: r.file }));
      return new Response(JSON.stringify(result), { headers: CORS });
    }

    const requestedUrls: string[] = body.urls ?? [];
    if (!requestedUrls.length) {
      return new Response(JSON.stringify({ ...result, error: "Provide urls[] in request body" }), { status: 400, headers: CORS });
    }

    // Add global layout files always included
    const globalFiles = ROUTE_MAP.filter(r => r.pattern.startsWith("__")).map(r => r.file);

    // ── Resolve URLs → page files ─────────────────────────────────────────
    const rootFiles = new Set<string>(globalFiles);
    for (const url of requestedUrls) {
      const f = resolveUrlToFile(url);
      if (f) rootFiles.add(f);
      else result.errors.push(`No route found for URL: ${url}`);
    }

    // ── Resolve all imports recursively ───────────────────────────────────
    const fileContents = new Map<string, { content: string; sha: string }>();
    const fetchFile = (path: string) => getFile(GITHUB_OWNER, GITHUB_REPO, path, GITHUB_BRANCH, GITHUB_TOKEN);

    const allFiles = new Set<string>();
    for (const root of rootFiles) {
      const deps = await resolveAllDeps(root, fetchFile, fileContents);
      for (const d of deps) allFiles.add(d);
    }

    result.scannedFiles = allFiles.size;
    console.log(`Resolved ${allFiles.size} files across ${rootFiles.size} root files`);

    // ── Fetch any files not yet in cache ──────────────────────────────────
    for (const filePath of allFiles) {
      if (!fileContents.has(filePath)) {
        const fetched = await fetchFile(filePath);
        if (fetched) fileContents.set(filePath, fetched);
        else result.skippedFiles.push(filePath);
      }
    }

    // ── Scan and patch ────────────────────────────────────────────────────
    const patchedFiles: Array<{ path: string; content: string; sha: string }> = [];
    const globalKeySet = new Set<string>();

    for (const filePath of allFiles) {
      const cached = fileContents.get(filePath);
      if (!cached) continue;

      const { result: patched, addedKeys } = wrapTextNodes(cached.content, filePath, globalKeySet);
      if (!addedKeys.length) continue;

      const withImport = ensureEditableContentImport(patched, filePath);
      patchedFiles.push({ path: filePath, content: withImport, sha: cached.sha });
      result.modifiedFiles.push(filePath);
      for (const k of addedKeys) result.addedKeys.push({ ...k, file: filePath });
    }

    // ── Commit ────────────────────────────────────────────────────────────
    if (patchedFiles.length > 0) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const msg = `chore(content): wrap ${result.addedKeys.length} text node(s) in <EditableContent> [${now}]\n\n` +
        `URLs: ${requestedUrls.join(", ")}\n\n` +
        `Modified files:\n${result.modifiedFiles.map(f => `  - ${f}`).join("\n")}\n\n` +
        `Added keys:\n${result.addedKeys.map(k => `  - ${k.key}: "${k.fallback.slice(0, 60)}"`).join("\n")}`;
      const commit = await commitFiles(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN, patchedFiles, msg);
      if (commit) { result.commitSha = commit.sha; result.commitUrl = commit.url; }
    }

    return new Response(JSON.stringify(result), { headers: CORS });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    return new Response(JSON.stringify({ ...result, error: msg }), { status: 500, headers: CORS });
  }
});
