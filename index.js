#!/usr/bin/env node

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit');
const semver = require('semver');

const app = express();
const PORT = process.env.PORT || 3838;

// Đường dẫn project npm cần phân tích (truyền qua CLI hoặc mặc định là thư mục hiện tại)
let TARGET_PROJECT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

// GitHub mode: khi phân tích từ GitHub URL thay vì local path
let githubMode = false;
let githubPackageJson = null;
let githubRepoInfo = null; // { owner, repo, branch, url }

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Cache để tránh gọi API trùng lặp
const cache = new Map();
const cveCache = new Map();
const usageCache = new Map();

/**
 * Lấy thông tin package từ npm registry
 */
async function fetchPackageInfo(name) {
  if (cache.has(name)) return cache.get(name);

  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    const versions = Object.keys(data.time || {}).filter(
      (v) => v !== 'created' && v !== 'modified'
    );

    const latestVersion = data['dist-tags']?.latest || versions[versions.length - 1];
    const latestMeta = data.versions?.[latestVersion] || {};

    const info = {
      name: data.name,
      description: data.description || '',
      latestVersion,
      created: data.time?.created || null,
      modified: data.time?.modified || null,
      latestPublished: data.time?.[latestVersion] || null,
      homepage: latestMeta.homepage || data.homepage || '',
      license: latestMeta.license || '',
      author:
        (typeof latestMeta.author === 'string'
          ? latestMeta.author
          : latestMeta.author?.name) || '',
      repository: latestMeta.repository?.url || '',
      totalVersions: versions.length,
      dependencies: Object.keys(latestMeta.dependencies || {}),
      devDependencies: Object.keys(latestMeta.devDependencies || {}),
      peerDependencies: Object.keys(latestMeta.peerDependencies || {}),
      keywords: (data.keywords || []).slice(0, 8),
      npmUrl: `https://www.npmjs.com/package/${data.name}`,
      weeklyDownloads: null,
    };

    // Lấy số lượt tải tuần
    try {
      const dlRes = await axios.get(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
        { timeout: 8000 }
      );
      info.weeklyDownloads = dlRes.data?.downloads ?? null;
    } catch (_) {}

    cache.set(name, info);
    return info;
  } catch (err) {
    const fallback = {
      name,
      description: '',
      latestVersion: 'unknown',
      created: null,
      modified: null,
      latestPublished: null,
      homepage: '',
      license: '',
      author: '',
      repository: '',
      totalVersions: 0,
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      keywords: [],
      npmUrl: `https://www.npmjs.com/package/${name}`,
      weeklyDownloads: null,
      error: err.message,
    };
    cache.set(name, fallback);
    return fallback;
  }
}

/**
 * Đọc package.json của project mục tiêu (local hoặc GitHub)
 */
function readTargetPackageJson(projectPath) {
  if (githubMode && githubPackageJson) {
    return githubPackageJson;
  }
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Không tìm thấy package.json tại: ${pkgPath}`);
  }
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

/**
 * Parse GitHub URL thành { owner, repo, branch, subdir }
 * Hỗ trợ:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch
 *   https://github.com/owner/repo/tree/branch/subdir/path
 *   github.com/owner/repo
 */
function parseGithubUrl(url) {
  // Chuẩn hoá: bỏ trailing slash, .git
  let cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  // Thêm https:// nếu thiếu
  if (cleaned.startsWith('github.com')) cleaned = 'https://' + cleaned;

  try {
    const urlObj = new URL(cleaned);
    if (urlObj.hostname !== 'github.com') return null;

    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1];
    let branch = 'main';
    let subdir = '';

    // /tree/branch/optional/subdir/path
    if (parts[2] === 'tree' && parts.length >= 4) {
      branch = parts[3];
      if (parts.length > 4) {
        subdir = parts.slice(4).join('/');
      }
    }

    return { owner, repo, branch, subdir };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch package.json từ GitHub repo (hỗ trợ subdir)
 */
async function fetchGithubPackageJson(owner, repo, branch, subdir) {
  // Thử branch được chỉ định, nếu thất bại thử 'master'
  const branches = [branch];
  if (branch === 'main') branches.push('master');

  const prefix = subdir ? subdir + '/' : '';

  for (const br of branches) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(br)}/${prefix}package.json`;
      const { data } = await axios.get(rawUrl, { timeout: 15000 });
      return { data, branch: br };
    } catch (err) {
      if (err.response?.status === 404 && br !== branches[branches.length - 1]) continue;
      if (err.response?.status === 404) {
        throw new Error(`Không tìm thấy package.json trong repo ${owner}/${repo}${subdir ? '/' + subdir : ''} (đã thử branch: ${branches.join(', ')})`);
      }
      throw err;
    }
  }
}

/**
 * Tìm tất cả package.json trong GitHub repo (dùng GitHub Tree API)
 */
async function discoverGithubPackageJsons(owner, repo, branch) {
  const branches = [branch];
  if (branch === 'main') branches.push('master');

  for (const br of branches) {
    try {
      const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(br)}?recursive=1`;
      const { data } = await axios.get(treeUrl, { timeout: 20000, headers: { 'Accept': 'application/vnd.github.v3+json' } });
      const pkgFiles = (data.tree || []).filter(
        (item) => item.type === 'blob' && item.path.endsWith('/package.json')
      );
      // Trả về danh sách thư mục chứa package.json (bỏ root)
      const subdirs = pkgFiles.map((f) => f.path.replace(/\/package\.json$/, ''));
      // Kiểm tra có package.json ở root không
      const hasRoot = (data.tree || []).some((item) => item.type === 'blob' && item.path === 'package.json');
      return { subdirs, hasRoot, branch: br };
    } catch (err) {
      if (err.response?.status === 404 && br !== branches[branches.length - 1]) continue;
      throw err;
    }
  }
}

// ─── API Endpoints ───────────────────────────────────────────────────────────

/** Thông tin dự án đang phân tích */
app.get('/api/project-info', (req, res) => {
  try {
    const pkg = readTargetPackageJson(TARGET_PROJECT);
    const projectSource = githubMode
      ? `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`
      : TARGET_PROJECT;
    res.json({
      success: true,
      projectPath: projectSource,
      name: pkg.name || (githubMode ? githubRepoInfo.repo : path.basename(TARGET_PROJECT)),
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      totalDeps: Object.keys(pkg.dependencies || {}).length,
      totalDevDeps: Object.keys(pkg.devDependencies || {}).length,
      totalPeerDeps: Object.keys(pkg.peerDependencies || {}).length,
      isGithub: githubMode,
      githubUrl: githubMode ? `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}` : null,
      githubBranch: githubMode ? githubRepoInfo.branch : null,
      githubSubdir: githubMode ? (githubRepoInfo.subdir || '') : null,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/** Danh sách packages cần phân tích */
app.get('/api/packages-list', (req, res) => {
  try {
    const pkg = readTargetPackageJson(TARGET_PROJECT);
    const deps = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
      name,
      requiredVersion: version,
      type: 'dependencies',
    }));
    const devDeps = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
      name,
      requiredVersion: version,
      type: 'devDependencies',
    }));
    const peerDeps = Object.entries(pkg.peerDependencies || {}).map(([name, version]) => ({
      name,
      requiredVersion: version,
      type: 'peerDependencies',
    }));
    res.json({ success: true, packages: [...deps, ...devDeps, ...peerDeps] });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/** Fetch thông tin chi tiết từng package (streaming JSON) */
app.get('/api/analyze', async (req, res) => {
  try {
    const pkg = readTargetPackageJson(TARGET_PROJECT);

    const allDeps = [
      ...Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
        name,
        requiredVersion: version,
        type: 'dependencies',
      })),
      ...Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
        name,
        requiredVersion: version,
        type: 'devDependencies',
      })),
      ...Object.entries(pkg.peerDependencies || {}).map(([name, version]) => ({
        name,
        requiredVersion: version,
        type: 'peerDependencies',
      })),
    ];

    const limit = pLimit(5); // tối đa 5 request song song
    const results = await Promise.all(
      allDeps.map(({ name, requiredVersion, type }) =>
        limit(async () => {
          const info = await fetchPackageInfo(name);
          return { ...info, requiredVersion, depType: type };
        })
      )
    );

    res.json({ success: true, packages: results, analyzedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Fetch thông tin 1 package đơn lẻ */
app.get('/api/package/:name(*)', async (req, res) => {
  try {
    const info = await fetchPackageInfo(req.params.name);
    res.json({ success: true, package: info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Thay đổi project path runtime */
app.post('/api/set-project', (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ success: false, error: 'Thiếu projectPath' });
  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(path.join(resolved, 'package.json'))) {
    return res.status(400).json({
      success: false,
      error: `Không tìm thấy package.json tại: ${resolved}`,
    });
  }
  TARGET_PROJECT = resolved;
  githubMode = false;
  githubPackageJson = null;
  githubRepoInfo = null;
  cache.clear();
  cveCache.clear();
  usageCache.clear();
  res.json({ success: true, projectPath: resolved });
});

/** Thay đổi sang GitHub repo */
app.post('/api/set-github', async (req, res) => {
  const { githubUrl, subdir: bodySubdir } = req.body;
  if (!githubUrl) return res.status(400).json({ success: false, error: 'Thiếu githubUrl' });

  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      error: 'URL GitHub không hợp lệ. Ví dụ: https://github.com/owner/repo',
    });
  }

  // Ưu tiên subdir từ body, nếu không thì lấy từ URL
  const subdir = (bodySubdir != null ? bodySubdir : parsed.subdir) || '';

  try {
    const result = await fetchGithubPackageJson(parsed.owner, parsed.repo, parsed.branch, subdir);
    githubPackageJson = result.data;
    githubRepoInfo = {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: result.branch,
      subdir: subdir,
      url: githubUrl,
    };
    githubMode = true;
    cache.clear();
    cveCache.clear();
    usageCache.clear();
    res.json({
      success: true,
      owner: parsed.owner,
      repo: parsed.repo,
      branch: result.branch,
      subdir: subdir,
      projectName: githubPackageJson.name || parsed.repo,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/** Tìm tất cả thư mục chứa package.json trong GitHub repo */
app.post('/api/github-discover', async (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) return res.status(400).json({ success: false, error: 'Thiếu githubUrl' });

  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      error: 'URL GitHub không hợp lệ.',
    });
  }

  try {
    const result = await discoverGithubPackageJsons(parsed.owner, parsed.repo, parsed.branch);
    res.json({
      success: true,
      owner: parsed.owner,
      repo: parsed.repo,
      branch: result.branch,
      hasRoot: result.hasRoot,
      subdirs: result.subdirs,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── CVE / Vulnerability Check (OSV.dev API) ─────────────────────────────────

/**
 * Kiểm tra 1 version cụ thể có bị ảnh hưởng bởi 1 vuln hay không
 * Dựa vào affected[].ranges[].events (introduced / fixed / last_affected)
 */
function isVersionAffectedByVuln(vuln, pkgName, version) {
  if (!version || !vuln.affected) return null; // không xác định được
  const cleanVer = semver.coerce(version);
  if (!cleanVer) return null;

  const found = vuln.affected.find(
    (a) => a.package?.name === pkgName && a.package?.ecosystem === 'npm'
  );
  if (!found) return null;

  // Nếu có danh sách versions cụ thể
  if (found.versions && found.versions.length > 0) {
    return found.versions.includes(cleanVer.version);
  }

  // Kiểm tra theo ranges
  if (!found.ranges || found.ranges.length === 0) return null;

  for (const range of found.ranges) {
    if (range.type !== 'ECOSYSTEM' && range.type !== 'SEMVER') continue;
    const events = range.events || [];

    let introduced = null;
    let fixed = null;
    let lastAffected = null;

    for (const ev of events) {
      if (ev.introduced !== undefined) introduced = ev.introduced;
      if (ev.fixed !== undefined) fixed = ev.fixed;
      if (ev.last_affected !== undefined) lastAffected = ev.last_affected;
    }

    // introduced = "0" nghĩa là tất cả versions
    const introVer = introduced === '0' ? '0.0.0' : introduced;
    const introSemver = introVer ? semver.coerce(introVer) : null;

    if (introSemver && semver.lt(cleanVer, introSemver)) continue; // version trước khi lỗi được introduce

    if (fixed) {
      const fixedSemver = semver.coerce(fixed);
      if (fixedSemver && semver.gte(cleanVer, fixedSemver)) continue; // đã fix
      // Version nằm giữa introduced và fixed => bị ảnh hưởng
      return true;
    }

    if (lastAffected) {
      const lastSemver = semver.coerce(lastAffected);
      if (lastSemver && semver.lte(cleanVer, lastSemver)) return true;
      continue;
    }

    // Chỉ có introduced, không có fixed => vẫn bị ảnh hưởng
    if (introSemver && semver.gte(cleanVer, introSemver)) return true;
  }

  return false;
}

/**
 * Fetch CVE/vulnerability data cho 1 package từ OSV.dev
 */
async function fetchVulnerabilities(name) {
  if (cveCache.has(name)) return cveCache.get(name);

  try {
    const { data } = await axios.post(
      'https://api.osv.dev/v1/query',
      { package: { name, ecosystem: 'npm' } },
      { timeout: 15000 }
    );

    const vulns = (data.vulns || []).map((v) => ({
      id: v.id,
      summary: v.summary || v.details?.slice(0, 300) || '',
      details: v.details || '',
      severity: extractSeverity(v),
      published: v.published || null,
      modified: v.modified || null,
      aliases: (v.aliases || []).filter((a) => a.startsWith('CVE-')),
      affectedVersions: extractAffectedVersions(v, name),
      fixedVersions: extractFixedVersions(v, name),
      references: (v.references || []).map((r) => ({
        type: r.type,
        url: r.url,
      })),
      withdrawn: v.withdrawn || null,
      _raw_affected: v.affected || [], // giữ raw data để check version
    }));

    const result = {
      name,
      totalVulns: vulns.length,
      vulns,
      hasCritical: vulns.some((v) => v.severity === 'CRITICAL'),
      hasHigh: vulns.some((v) => v.severity === 'HIGH'),
    };

    cveCache.set(name, result);
    return result;
  } catch (err) {
    const fallback = { name, totalVulns: 0, vulns: [], hasCritical: false, hasHigh: false, error: err.message };
    cveCache.set(name, fallback);
    return fallback;
  }
}

/**
 * Thêm thông tin version-specific cho CVE result
 * - Kiểm tra từng CVE xem version đang dùng có bị ảnh hưởng không
 * - Tách ra: vulns affecting used version vs fixed/not-affecting
 */
function enrichCveWithVersion(cveResult, pkgName, usedVersion) {
  if (!usedVersion || !cveResult.vulns || cveResult.vulns.length === 0) {
    return {
      ...cveResult,
      usedVersion: usedVersion || null,
      affectingUsedVersion: [],
      fixedForUsedVersion: [],
      unknownForUsedVersion: [],
      activeVulnCount: 0,
    };
  }

  const affecting = [];
  const fixed = [];
  const unknown = [];

  for (const vuln of cveResult.vulns) {
    const rawVuln = { affected: vuln._raw_affected };
    const isAffected = isVersionAffectedByVuln(rawVuln, pkgName, usedVersion);

    const vulnOut = { ...vuln };
    delete vulnOut._raw_affected; // không gửi raw data về client

    if (isAffected === true) {
      vulnOut.affectsUsedVersion = true;
      affecting.push(vulnOut);
    } else if (isAffected === false) {
      vulnOut.affectsUsedVersion = false;
      fixed.push(vulnOut);
    } else {
      vulnOut.affectsUsedVersion = null; // không xác định
      unknown.push(vulnOut);
    }
  }

  return {
    name: cveResult.name,
    totalVulns: cveResult.totalVulns,
    hasCritical: cveResult.hasCritical,
    hasHigh: cveResult.hasHigh,
    usedVersion,
    activeVulnCount: affecting.length,
    affectingUsedVersion: affecting,
    fixedForUsedVersion: fixed,
    unknownForUsedVersion: unknown,
    allVulns: [...affecting, ...unknown, ...fixed], // sắp xếp: ảnh hưởng trước
  };
}

function extractSeverity(vuln) {
  // Thử lấy từ severity array
  if (vuln.severity?.length) {
    for (const s of vuln.severity) {
      if (s.type === 'CVSS_V3' && s.score) {
        // Parse CVSS vector string for score
        const match = s.score.match(/CVSS:[\d.]+\/AV:\w/);
        if (match) {
          // Extract base score from severity
          const scoreNum = parseCvssScore(s.score);
          if (scoreNum >= 9) return 'CRITICAL';
          if (scoreNum >= 7) return 'HIGH';
          if (scoreNum >= 4) return 'MEDIUM';
          return 'LOW';
        }
      }
    }
  }
  // Thử từ database_specific
  if (vuln.database_specific?.severity) {
    return vuln.database_specific.severity.toUpperCase();
  }
  // Thử từ ecosystem_specific
  if (vuln.ecosystem_specific?.severity) {
    return vuln.ecosystem_specific.severity.toUpperCase();
  }
  return 'UNKNOWN';
}

function parseCvssScore(vector) {
  // Rough parse: tìm metric trong vector
  // Nếu có AV:N => network, higher risk
  try {
    const parts = vector.split('/');
    let score = 5; // default medium
    for (const p of parts) {
      if (p === 'AV:N') score += 1.5;
      if (p === 'AC:L') score += 1;
      if (p === 'PR:N') score += 1;
      if (p === 'UI:N') score += 0.5;
      if (p === 'S:C') score += 1;
      if (p === 'C:H') score += 0.5;
      if (p === 'I:H') score += 0.5;
      if (p === 'A:H') score += 0.5;
    }
    return Math.min(score, 10);
  } catch {
    return 5;
  }
}

function extractAffectedVersions(vuln, pkgName) {
  if (!vuln.affected) return [];
  const found = vuln.affected.find(
    (a) => a.package?.name === pkgName && a.package?.ecosystem === 'npm'
  );
  if (!found || !found.ranges) return [];
  return found.ranges.map((r) => {
    const events = (r.events || []).map((e) => {
      if (e.introduced) return `>= ${e.introduced}`;
      if (e.fixed) return `< ${e.fixed}`;
      if (e.last_affected) return `<= ${e.last_affected}`;
      return '';
    }).filter(Boolean);
    return events.join(', ');
  });
}

function extractFixedVersions(vuln, pkgName) {
  if (!vuln.affected) return [];
  const found = vuln.affected.find(
    (a) => a.package?.name === pkgName && a.package?.ecosystem === 'npm'
  );
  if (!found || !found.ranges) return [];
  const fixedVersions = [];
  for (const range of found.ranges) {
    for (const ev of (range.events || [])) {
      if (ev.fixed) fixedVersions.push(ev.fixed);
    }
  }
  return fixedVersions;
}

/** API: check CVE cho 1 package (optional: ?version=x.x.x) */
app.get('/api/cve/:name(*)', async (req, res) => {
  try {
    const result = await fetchVulnerabilities(req.params.name);
    const version = req.query.version || null;
    if (version) {
      const enriched = enrichCveWithVersion(result, req.params.name, version);
      return res.json({ success: true, ...enriched });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** API: check CVE cho tất cả packages trong project (version-aware) */
app.get('/api/cve-all', async (req, res) => {
  try {
    const pkg = readTargetPackageJson(TARGET_PROJECT);
    const allDeps = [
      ...Object.entries(pkg.dependencies || {}).map(([n, v]) => ({ name: n, version: v })),
      ...Object.entries(pkg.devDependencies || {}).map(([n, v]) => ({ name: n, version: v })),
      ...Object.entries(pkg.peerDependencies || {}).map(([n, v]) => ({ name: n, version: v })),
    ];

    const limit = pLimit(8);
    const results = await Promise.all(
      allDeps.map(({ name, version }) =>
        limit(async () => {
          const raw = await fetchVulnerabilities(name);
          return enrichCveWithVersion(raw, name, version);
        })
      )
    );

    const totalVulns = results.reduce((a, r) => a + r.totalVulns, 0);
    const totalActiveVulns = results.reduce((a, r) => a + r.activeVulnCount, 0);
    const affectedPackages = results.filter((r) => r.totalVulns > 0);
    const activeAffectedPackages = results.filter((r) => r.activeVulnCount > 0);

    res.json({
      success: true,
      totalPackages: allDeps.length,
      totalVulns,
      totalActiveVulns,
      affectedCount: affectedPackages.length,
      activeAffectedCount: activeAffectedPackages.length,
      packages: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Dependency Tree ──────────────────────────────────────────────────────────

/** API: Build dependency tree (max depth configurable) */
app.get('/api/dep-tree/:name(*)', async (req, res) => {
  const maxDepth = Math.min(parseInt(req.query.depth) || 3, 5);
  const visited = new Set();

  async function buildTree(name, depth) {
    if (depth > maxDepth || visited.has(name)) {
      return { name, circular: visited.has(name), children: [], depth };
    }
    visited.add(name);

    const info = await fetchPackageInfo(name);
    const cve = await fetchVulnerabilities(name);

    const node = {
      name,
      version: info.latestVersion,
      description: info.description?.slice(0, 80) || '',
      license: info.license || '',
      totalVulns: cve.totalVulns,
      hasCritical: cve.hasCritical,
      hasHigh: cve.hasHigh,
      depth,
      children: [],
    };

    if (depth < maxDepth && info.dependencies.length > 0) {
      const limit = pLimit(4);
      node.children = await Promise.all(
        info.dependencies.map((dep) => limit(() => buildTree(dep, depth + 1)))
      );
    }

    return node;
  }

  try {
    const tree = await buildTree(req.params.name, 0);
    res.json({ success: true, tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Usage Detection ──────────────────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
]);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.vscode', '.idea',
]);

/**
 * Quét toàn bộ source files trong project, tìm require/import
 */
function scanProjectUsage(projectPath) {
  const cacheKey = projectPath;
  if (usageCache.has(cacheKey)) return usageCache.get(cacheKey);

  const usageMap = {}; // packageName -> { files: Set, importStatements: [] }

  function walkDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        scanFile(fullPath, projectPath);
      }
    }
  }

  function scanFile(filePath, projectRoot) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }
    const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

    // Patterns to match:
    // require('package'), require("package")
    // import ... from 'package', import 'package'
    // import(...) dynamic
    const patterns = [
      /require\(\s*['"]([^.\/][^'"]*)['"]\s*\)/g,
      /import\s+.*?\s+from\s+['"]([^.\/][^'"]*)['"]/g,
      /import\s+['"]([^.\/][^'"]*)['"]/g,
      /import\(\s*['"]([^.\/][^'"]*)['"]\s*\)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let pkgName = match[1];
        // Scoped packages: @scope/name
        if (pkgName.startsWith('@')) {
          const parts = pkgName.split('/');
          pkgName = parts.length >= 2 ? parts[0] + '/' + parts[1] : pkgName;
        } else {
          pkgName = pkgName.split('/')[0];
        }

        if (!usageMap[pkgName]) {
          usageMap[pkgName] = { files: new Set(), statements: [] };
        }
        usageMap[pkgName].files.add(relPath);
        if (usageMap[pkgName].statements.length < 5) {
          usageMap[pkgName].statements.push({
            file: relPath,
            code: match[0].slice(0, 120),
          });
        }
      }
    }
  }

  walkDir(projectPath);

  // Convert Sets to arrays
  const result = {};
  for (const [pkg, data] of Object.entries(usageMap)) {
    result[pkg] = {
      fileCount: data.files.size,
      files: [...data.files].slice(0, 20),
      statements: data.statements,
    };
  }

  usageCache.set(cacheKey, result);
  return result;
}

/** API: Check usage cho tất cả packages */
app.get('/api/usage', (req, res) => {
  // Usage scanning không khả dụng khi dùng GitHub mode (không có local files)
  if (githubMode) {
    return res.json({
      success: true,
      totalScanned: 0,
      usedCount: 0,
      unusedCount: 0,
      packages: [],
      isGithub: true,
      note: 'Usage scanning không khả dụng cho GitHub repos (không có source code local)',
    });
  }
  try {
    const pkg = readTargetPackageJson(TARGET_PROJECT);
    const allDeps = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ];

    const usageMap = scanProjectUsage(TARGET_PROJECT);

    const results = allDeps.map((name) => {
      const usage = usageMap[name];
      return {
        name,
        isUsed: !!usage,
        fileCount: usage?.fileCount || 0,
        files: usage?.files || [],
        statements: usage?.statements || [],
      };
    });

    const usedCount = results.filter((r) => r.isUsed).length;
    const unusedCount = results.filter((r) => !r.isUsed).length;

    res.json({
      success: true,
      totalScanned: allDeps.length,
      usedCount,
      unusedCount,
      packages: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** API: Check usage cho 1 package */
app.get('/api/usage/:name(*)', (req, res) => {
  try {
    const usageMap = scanProjectUsage(TARGET_PROJECT);
    const usage = usageMap[req.params.name];
    res.json({
      success: true,
      name: req.params.name,
      isUsed: !!usage,
      fileCount: usage?.fileCount || 0,
      files: usage?.files || [],
      statements: usage?.statements || [],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start Server (auto-kill old process if port in use) ──────────────────────

function printBanner() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         NPM Library Reporter - Đang chạy         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  URL:     http://localhost:${PORT}                  ║`);
  console.log(`║  Project: ${TARGET_PROJECT.slice(0, 40).padEnd(40)} ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Mở trình duyệt tại: \x1b[36mhttp://localhost:' + PORT + '\x1b[0m');
  console.log('  Dừng server: Ctrl + C');
  console.log('');
}

function startServer() {
  const server = app.listen(PORT, () => printBanner());

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\x1b[33m⚠ Port ${PORT} đang bị chiếm. Đang tự động giải phóng...\x1b[0m`);
      const { execSync } = require('child_process');
      try {
        // Tìm PID chiếm port
        const output = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
            console.log(`\x1b[32m✓ Đã kill process cũ (PID ${pid})\x1b[0m`);
          } catch {}
        }
        // Chờ 1 giây rồi thử lại
        setTimeout(() => {
          app.listen(PORT, () => printBanner());
        }, 1000);
      } catch (e) {
        console.error(`\x1b[31m✗ Không thể giải phóng port ${PORT}. Hãy tắt thủ công hoặc dùng port khác:\x1b[0m`);
        console.error(`  PORT=${PORT + 1} node index.js`);
        process.exit(1);
      }
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer();
