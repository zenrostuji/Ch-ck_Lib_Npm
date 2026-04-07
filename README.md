<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D14.0-brightgreen?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.18-000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/license-ISC-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/version-1.0.0-purple?style=for-the-badge" />
</p>

<h1 align="center">📦 NPM Library Reporter</h1>

<p align="center">
  <strong>Công cụ phân tích, kiểm tra bảo mật và đánh giá mức độ sử dụng<br/>tất cả thư viện npm trong project của bạn — hiển thị trên giao diện web trực quan.</strong>
</p>

<p align="center">
  <code>node index.js /path/to/your/project</code> → mở <code>http://localhost:3838</code>
</p>

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **📊 Phân tích thư viện** | Quét tất cả `dependencies`, `devDependencies`, `peerDependencies` — hiển thị phiên bản, ngày phát hành, ngày cập nhật, lượt tải, license, tác giả |
| **🛡️ Kiểm tra bảo mật (CVE)** | Truy vấn [OSV.dev](https://osv.dev) để phát hiện lỗ hổng bảo mật cho từng package — hiển thị mức độ nghiêm trọng, CVE ID, phiên bản bị ảnh hưởng |
| **🌳 Cây phụ thuộc** | Hiển thị dependency tree đệ quy (tối đa 5 cấp) kèm trạng thái bảo mật cho từng node — phát hiện circular dependency |
| **🔍 Phát hiện sử dụng thực tế** | Quét toàn bộ source code để xác định thư viện nào đang thực sự được `import`/`require` — chỉ ra file & dòng code cụ thể |
| **🌓 Dark / Light Theme** | Chuyển đổi giao diện sáng/tối, lưu trữ preference vào localStorage |
| **📈 Biểu đồ thống kê** | Top sub-dependencies, phân bố loại dependency, top weekly downloads |
| **📤 Export CSV** | Xuất toàn bộ dữ liệu ra file CSV với đầy đủ thông tin |
| **🔄 Đổi project nhanh** | Nhập đường dẫn project khác trực tiếp trên giao diện mà không cần restart server |

---

## 🖼️ Giao diện

```
┌─────────────────────────────────────────────────────────────────────┐
│  🟣 NPM Library Reporter    my-project v1.2.0         🌙  📤  🔍  │
├─────────────────────────────────────────────────────────────────────┤
│  📁 Project path: [D:\my-project                    ] [Đổi project]│
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┤
│ 45   │ 30   │ 12   │  3   │ 187  │  2   │  5   │  8   │  3        │
│ Tổng │ Deps │ Dev  │ Peer │ Sub  │ Lỗi  │ CVE  │ Affected│ Unused │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴────────────┤
│  [Top Sub-Deps Chart]  [Dep Distribution]  [Top Downloads Chart]   │
├────────────────────────────────────────────────────────────────────-┤
│ Thư viện    │ Version │ Bảo mật    │ Sử dụng   │ Phát hành │ ...  │
│ express     │ v4.18.2 │ 🟢 An toàn │ ✅ 12 files│ 2014      │ ...  │
│ lodash      │ v4.17.2 │ 🔴 3 CVE   │ ❌ Không   │ 2012      │ ...  │
└─────────────────────────────────────────────────────────────────────┘
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

Nhấn nút **Phân tích** để bắt đầu quét. Kết quả sẽ hiển thị:
1. Thống kê tổng quan (stat cards)
2. Biểu đồ phân bố
3. Bảng chi tiết từng thư viện (bảo mật + sử dụng)
4. Click **Chi tiết** để xem CVE, dependency tree, import locations

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/project-info` | Thông tin project (name, version, số deps) |
| `GET` | `/api/packages-list` | Danh sách tất cả packages |
| `GET` | `/api/analyze` | Phân tích đầy đủ tất cả packages |
| `GET` | `/api/package/:name` | Thông tin chi tiết 1 package |
| `GET` | `/api/cve/:name` | Check CVE cho 1 package |
| `GET` | `/api/cve-all` | Check CVE cho tất cả packages |
| `GET` | `/api/dep-tree/:name?depth=3` | Cây phụ thuộc (depth 1-5) |
| `GET` | `/api/usage` | Kiểm tra sử dụng thực tế tất cả packages |
| `GET` | `/api/usage/:name` | Kiểm tra sử dụng 1 package |
| `POST` | `/api/set-project` | Đổi project path (`{ "projectPath": "..." }`) |

---

## 🛡️ Chi tiết tính năng bảo mật

### Kiểm tra CVE
- Sử dụng **OSV.dev API** (Google Open Source Vulnerabilities)
- Phân loại mức độ: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`
- Hiển thị: CVE ID, mô tả, phiên bản bị ảnh hưởng, ngày phát hiện, link tham khảo
- Badge màu trong bảng: 🔴 critical / 🟠 high / 🟡 medium / 🟢 safe

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

---

## 🎨 Giao diện

- **Dark theme** (mặc định) và **Light theme** — chuyển đổi bằng nút toggle
- Toàn bộ icon là **inline SVG** (Feather icon style) — không dùng emoji, không font icon
- **Responsive** — co giãn theo màn hình
- CSS Variables để dễ tùy chỉnh màu sắc
- Modal chi tiết với cuộn mượt, blur overlay

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
| **axios** | HTTP client gọi npm registry & OSV.dev API |
| **p-limit** | Giới hạn concurrent requests (tránh rate limit) |
| **chalk** | Terminal output có màu |
| **ora** | Terminal spinner |

---

## 💡 Tips

- **DevDependencies thường không dùng trực tiếp** trong source code (ESLint, Prettier, TypeScript...) — badge "Không dùng" cho devDeps là bình thường
- **Dependency tree depth** có thể tăng lên 5 qua query param `?depth=5` nhưng sẽ chậm hơn nhiều
- **CVE data** được cache trong memory — restart server để refresh
- Dùng **Export CSV** để lưu báo cáo offline

---

<p align="center">
  <sub>Built with ❤️ using Node.js + Express — No frontend framework needed</sub>
</p>
