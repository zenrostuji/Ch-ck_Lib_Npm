<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D14.0-brightgreen?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.18-000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/license-ISC-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/version-1.1.0-purple?style=for-the-badge" />
</p>

<h1 align="center">📦 NPM Library Reporter</h1>

<p align="center">
  <strong>Công cụ phân tích, kiểm tra bảo mật (version-aware) và đánh giá mức độ sử dụng<br/>tất cả thư viện npm trong project — hỗ trợ cả local path và GitHub URL.</strong>
</p>

<p align="center">
  <code>node index.js /path/to/your/project</code> → mở <code>http://localhost:3838</code>
</p>

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **📊 Phân tích thư viện** | Quét tất cả `dependencies`, `devDependencies`, `peerDependencies` — hiển thị phiên bản, ngày phát hành, ngày cập nhật, lượt tải, license, tác giả |
| **🛡️ Kiểm tra bảo mật (CVE)** | Truy vấn [OSV.dev](https://osv.dev) để phát hiện lỗ hổng bảo mật — **so sánh chính xác với phiên bản đang dùng** để xác định CVE nào còn ảnh hưởng, CVE nào đã fix |
| **🔒 Version-aware CVE** | Dùng `semver` để kiểm tra từng CVE có ảnh hưởng version trong `package.json` hay không — phân loại: `CÒN LỖI` · `ĐÃ FIX` · `Không xác định` |
| **🌳 Cây phụ thuộc** | Hiển thị dependency tree đệ quy (tối đa 5 cấp) kèm trạng thái bảo mật cho từng node — phát hiện circular dependency |
| **🔍 Phát hiện sử dụng thực tế** | Quét toàn bộ source code để xác định thư viện nào đang thực sự được `import`/`require` — chỉ ra file & dòng code cụ thể |
| **🐙 Hỗ trợ GitHub URL** | Nhập link GitHub repo để phân tích trực tiếp — tự động fetch `package.json` từ repo (hỗ trợ cả branch `main` và `master`) |
| **🌓 Dark / Light Theme** | Chuyển đổi giao diện sáng/tối, lưu trữ preference vào localStorage |
| **📈 Biểu đồ thống kê** | Top sub-dependencies, phân bố loại dependency, top weekly downloads |
| **📤 Export CSV** | Xuất toàn bộ dữ liệu ra file CSV với đầy đủ thông tin |
| **🔄 Đổi project nhanh** | Chuyển đổi giữa Local path và GitHub URL trực tiếp trên giao diện |

---

## 🖼️ Giao diện

### Dashboard — Phân tích từ GitHub

```
┌─────────────────────────────────────────────────────────────────────┐
│  🟣 NPM Library Reporter    🐙 webtruyen-backend v1.0.0   ☀ 📤 🔍│
├─────────────────────────────────────────────────────────────────────┤
│  [Local] [GitHub]  GitHub URL: [https://github.com/...] [Tải từ GH]│
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│ 10   │  9   │  1   │  0   │ 64   │  0   │  4   │ 19   │  6   │N/A │
│ Tổng │ Deps │ Dev  │ Peer │ Sub  │ Lỗi  │Active│Total │ CVE  │Used │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴─────┤
│ [Top Sub-Deps Chart]  [Dep Distribution]  [Top Downloads Chart]    │
├────────────────────────────────────────────────────────────────────-┤
│ Thư viện    │ Version │ Bảo mật      │ Sử dụng │ Phát hành │ ...  │
│ bcrypt      │ v6.0.0  │ 🟢 ĐÃ FIX    │ —       │ 2011      │ ...  │
│ express     │ v5.2.1  │ 🔴 2 ACTIVE  │ —       │ 2010      │ ...  │
│ helmet      │ v8.1.0  │ 🟢 AN TOÀN   │ —       │ 2012      │ ...  │
│ jsonwebtoken│ v9.0.3  │ 🟢 ĐÃ FIX   │ —       │ 2013      │ ...  │
└─────────────────────────────────────────────────────────────────────┘
```

### Bảng chi tiết thư viện

```
┌─────────────────┬──────────┬─────────────┬──────┬────────────┬─────────────┬──────────────┬────────────┬────────┐
│ THƯ VIỆN        │ PHIÊN BẢN│ BẢO MẬT     │SỬ DỤNG│NGÀY PHÁT HÀNH│CẬP NHẬT     │THƯ VIỆN CON  │DOWNLOADS   │CHI TIẾT│
├─────────────────┼──────────┼─────────────┼──────┼────────────┼─────────────┼──────────────┼────────────┼────────┤
│ bcrypt     DEP  │ ^6.0.0   │ 🟢 ĐÃ FIX  │  —   │ 22/02/2011 │ 12/05/2025  │ node-addon-..│   4.2M     │[Chi tiết]│
│                 │ v6.0.0   │ 1 CVE (đã fix)│    │ 15 năm     │ 11 tháng    │ 2 deps       │   / tuần   │        │
├─────────────────┼──────────┼─────────────┼──────┼────────────┼─────────────┼──────────────┼────────────┼────────┤
│ express    DEP  │ ^4.18.2  │ 🔴 2 ACTIVE │  —   │ 30/12/2010 │ 02/12/2025  │ qs, depd,    │  84.0M     │[Chi tiết]│
│                 │ v5.2.1   │ 3 đã fix    │      │ 15 năm     │ 4 tháng     │ 28 deps      │   / tuần   │        │
└─────────────────┴──────────┴─────────────┴──────┴────────────┴─────────────┴──────────────┴────────────┴────────┘
```

---

## 🚀 Cài đặt & Sử dụng

### 1. Clone & Install

```bash
git clone <repo-url>
cd npm-library-reporter
npm install
```

### 2. Chạy

```bash
# Phân tích project cụ thể
node index.js D:\path\to\your-npm-project

# Hoặc phân tích folder hiện tại (nếu có package.json)
node index.js
```

### 3. Mở trình duyệt

```
http://localhost:3838
```

### 4. Sử dụng

- **Local project**: Nhập đường dẫn thư mục chứa `package.json` → nhấn **Đổi project**
- **GitHub repo**: Chuyển sang tab **GitHub** → nhập URL repo → nhấn **Tải từ GitHub**
  - Hỗ trợ: `https://github.com/owner/repo`, `https://github.com/owner/repo/tree/branch`, `https://github.com/owner/repo/tree/branch/subdir`
  - Nếu repo có nhiều thư mục (ví dụ `frontend/`, `backend/`), nhấn **Tìm package.json** để tìm tất cả vị trí có `package.json` và chọn thư mục cần phân tích
- Nhấn nút **Phân tích** để bắt đầu quét

Kết quả sẽ hiển thị:
1. Thống kê tổng quan (stat cards) — bao gồm **CVE còn ảnh hưởng** vs **Tổng CVE**
2. Biểu đồ phân bố
3. Bảng chi tiết từng thư viện (bảo mật version-aware + sử dụng)
4. Click **Chi tiết** để xem danh sách CVE đầy đủ, dependency tree, import locations

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/project-info` | Thông tin project (name, version, số deps, isGithub, branch, subdir) |
| `GET` | `/api/packages-list` | Danh sách tất cả packages |
| `GET` | `/api/analyze` | Phân tích đầy đủ tất cả packages |
| `GET` | `/api/package/:name` | Thông tin chi tiết 1 package |
| `GET` | `/api/cve/:name?version=x.x.x` | Check CVE cho 1 package (version-aware) |
| `GET` | `/api/cve-all` | Check CVE cho tất cả packages (version-aware, lấy version từ package.json) |
| `GET` | `/api/dep-tree/:name?depth=3` | Cây phụ thuộc (depth 1-5) |
| `GET` | `/api/usage` | Kiểm tra sử dụng thực tế tất cả packages |
| `GET` | `/api/usage/:name` | Kiểm tra sử dụng 1 package |
| `POST` | `/api/set-project` | Đổi project path (`{ "projectPath": "..." }`) |
| `POST` | `/api/set-github` | Tải từ GitHub repo (`{ "githubUrl": "...", "subdir": "backend" }`) |
| `POST` | `/api/github-discover` | Tìm tất cả thư mục chứa package.json trong repo (`{ "githubUrl": "..." }`) |

---

## 🛡️ Chi tiết tính năng bảo mật

### Kiểm tra CVE (Version-Aware)
- Sử dụng **OSV.dev API** (Google Open Source Vulnerabilities)
- Phân loại mức độ: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`
- **So sánh chính xác với phiên bản đang dùng** bằng `semver`:
  - 🔴 **CÒN LỖI** — CVE vẫn ảnh hưởng version trong `package.json`
  - 🟢 **ĐÃ FIX** — CVE đã được patch trong version đang dùng
  - ⚪ **Không xác định** — không đủ data để xác định
- Hiển thị: CVE ID, mô tả, phiên bản bị ảnh hưởng, **version đã fix**, ngày phát hiện, link tham khảo
- Badge màu trong bảng: 🔴 active (còn lỗi) / 🟢 ĐÃ FIX / 🟢 AN TOÀN (không có CVE)
- Modal chi tiết: danh sách đầy đủ CVE, phân nhóm **Còn ảnh hưởng** / **Đã fix** (ẩn mặc định, toggle hiện)

### Cây phụ thuộc
- Đệ quy tối đa **5 cấp** (mặc định 3)
- Mỗi node hiển thị: tên, version, số CVE
- Chấm màu: 🟢 an toàn · 🟡 có CVE · 🔴 có CVE critical
- Phát hiện **circular dependency**
- Click để mở/đóng nhánh

### Phát hiện sử dụng thực tế
Quét các pattern trong source code:
```javascript
require('package-name')       // CommonJS
import ... from 'package'     // ES Module
import 'package'              // Side-effect import
import('package')             // Dynamic import
```

Hỗ trợ file types: `.js` `.jsx` `.ts` `.tsx` `.mjs` `.cjs` `.vue` `.svelte`

Bỏ qua: `node_modules/` `dist/` `build/` `.git/` `.next/` `coverage/`

> **Lưu ý:** Usage scanning chỉ khả dụng với local project. Khi dùng GitHub URL, cột "Sử dụng" sẽ hiện `—` và stat "Không sử dụng" hiện `N/A`.

---

## 🐙 Hỗ trợ GitHub URL

Phân tích thư viện trực tiếp từ bất kỳ GitHub repo công khai nào mà không cần clone về máy.

**Cách dùng:**
1. Chuyển sang tab **GitHub** trên giao diện
2. Nhập URL GitHub repo, ví dụ: `https://github.com/NTL0210/DoAn_webdangtruyen`
3. Nhấn **Tải từ GitHub** → tool sẽ fetch `package.json` từ repo
4. Nhấn **Phân tích** để quét thư viện

**Hỗ trợ các định dạng URL:**
- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch-name`
- `https://github.com/owner/repo/tree/branch-name/subdir/path`
- `github.com/owner/repo`
- `https://github.com/owner/repo.git`

**Hỗ trợ monorepo & thư mục con:**
- Nếu `package.json` nằm trong thư mục con (ví dụ `Backend/`), chỉ định trực tiếp trong URL:
  - `https://github.com/owner/repo/tree/main/Backend`
- Nếu repo có nhiều project (ví dụ `frontend/` và `backend/`):
  1. Nhập URL repo → nhấn nút **Tìm package.json**
  2. Tool sẽ liệt kê tất cả thư mục chứa `package.json`
  3. Click vào thư mục cần phân tích

**Hạn chế khi dùng GitHub:**
- Không quét được usage (import/require) vì không có source code local
- Chỉ hỗ trợ public repos

---

## 🎨 Giao diện

- **Dark theme** (mặc định) và **Light theme** — chuyển đổi bằng nút toggle
- Toàn bộ icon là **inline SVG** (Feather icon style) — không dùng emoji, không font icon
- **Responsive** — co giãn theo màn hình
- CSS Variables để dễ tùy chỉnh màu sắc
- Modal chi tiết với cuộn mượt, blur overlay
- **Tab Local / GitHub** để chuyển đổi nguồn dữ liệu

---

## 📁 Cấu trúc project

```
npm-library-reporter/
├── index.js              # Express server + tất cả API logic
├── package.json          # Dependencies & scripts
├── public/
│   └── index.html        # Single-page dashboard UI
└── README.md
```

---

## ⚙️ Cấu hình

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `PORT` | `3838` | Port của web server |
| `argv[2]` | `process.cwd()` | Đường dẫn project cần phân tích |

```bash
# Đổi port
PORT=4000 node index.js /path/to/project
```

---

## 📦 Dependencies

| Package | Mục đích |
|---------|----------|
| **express** | Web server & static file serving |
| **axios** | HTTP client gọi npm registry, OSV.dev API & GitHub raw content |
| **p-limit** | Giới hạn concurrent requests (tránh rate limit) |
| **semver** | So sánh phiên bản để kiểm tra CVE version-aware |
| **chalk** | Terminal output có màu |
| **ora** | Terminal spinner |

---

## 💡 Tips

- **DevDependencies thường không dùng trực tiếp** trong source code (ESLint, Prettier, TypeScript...) — badge "Không dùng" cho devDeps là bình thường
- **Dependency tree depth** có thể tăng lên 5 qua query param `?depth=5` nhưng sẽ chậm hơn nhiều
- **CVE data** được cache trong memory — restart server để refresh
- **Cột "Bảo mật"** hiện trạng thái dựa trên version đang dùng: `2 active` = còn lỗi, `ĐÃ FIX` = có CVE nhưng version hiện tại đã an toàn
- Dùng **Export CSV** để lưu báo cáo offline
- Muốn kiểm tra nhanh 1 repo trên GitHub? Chỉ cần paste link → Tải → Phân tích

---

<p align="center">
  <sub>Built with ❤️ using Node.js + Express — No frontend framework needed</sub>
</p>
