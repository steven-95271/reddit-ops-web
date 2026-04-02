# GitHub Pages 配置指南

> 为 Reddit Ops 项目启用 GitHub Pages 文档网站。

---

## 🎯 目标

将 `docs/` 目录部署为独立的文档网站：
- **网站地址**: https://steven-95271.github.io/reddit-ops-web/
- **docs/index.md** → 成为网站首页

---

## 📸 配置步骤（带截图指引）

### Step 1: 进入仓库 Settings

访问：`https://github.com/steven-95271/reddit-ops-web/settings`

找到左侧菜单的 **Pages**：

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                               │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  General     │  [Page content area]                     │
│  Access     │                                          │
│  ⭐ Pages   ←─── 点击这里                              │
│  Branches   │                                          │
│  Tags       │                                          │
│ hooks       │                                          │
│  ...        │                                          │
│             │                                          │
└──────────────┴──────────────────────────────────────────┘
```

---

### Step 2: 配置 Source

在 **Build and Deployment** 部分：

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Pages                                           │
│  Your site is ready to be published at                 │
│  https://steven-95271.github.io/reddit-ops-web/           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Build and deployment                            │   │
│  │                                                 │   │
│  │ Source                                          │   │
│  │ ┌───────────────────────────────────────────┐ │   │
│  │ │ ● Deploy from a branch              ← 选择 │ │   │
│  │ │ ○ GitHub Actions                           │ │   │
│  │ └───────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Branch                                          │   │
│  │                                                 │   │
│  │ ┌──────────┐    ┌──────────┐                  │   │
│  │ │ main    ▼ │    │ /docs  ▼ │  ← 选择这两个  │   │
│  │ └──────────┘    └──────────┘                  │   │
│  │                                                 │   │
│  │ [Save]  ← 点击保存                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**正确配置**：
1. ✅ **Source**: `Deploy from a branch`
2. ✅ **Branch**: `main` + `/docs` folder
3. ✅ 点击 **Save**

---

### Step 3: 等待部署

```
⏱️ 部署状态：待部署（首次可能需要 2-5 分钟）

部署完成后会显示：
✅ "Your site is published at https://steven-95271.github.io/reddit-ops-web/"
```

---

## 🌐 部署完成后访问

### 网站结构

| URL | 对应文件 |
|-----|----------|
| https://steven-95271.github.io/reddit-ops-web/ | docs/index.md |
| https://steven-95271.github.io/reddit-ops-web/workflow/overview | docs/workflow/overview.md |
| https://steven-95271.github.io/reddit-ops-web/workflow/p1-config | docs/workflow/p1-config.md |
| ... | ... |

---

## ❓ 常见问题

### Q1: 部署失败怎么办？

**检查项**：
1. ✅ 确认 Source 选择的是 **main** / **/docs**
2. ✅ 确认 `docs/` 目录存在且包含 `index.md`
3. ✅ 等待 5 分钟后刷新页面

### Q2: 404 错误？

**原因**：`docs/index.md` 不存在或格式不对

**解决**：
```bash
# 确认 docs/index.md 存在
ls docs/

# 确认文件内容正常
head docs/index.md
```

### Q3: Mermaid 不渲染？

**GitHub Pages 原生支持 Mermaid**，无需额外配置。

如果图表不显示，检查：
1. 文件是否以 `.md` 结尾
2. Mermaid 代码块是否使用正确格式：
   ```markdown
   ```mermaid
   flowchart TB
       ...
   ```
   ```

---

## 🎨 自定义域名（可选）

如果你有自定义域名（如 `docs.oladance.com`）：

### Step 1: 添加 CNAME

在 `docs/` 目录创建 `CNAME` 文件：
```
docs/CNAME
内容：docs.oladance.com
```

### Step 2: DNS 配置

在你的域名 DNS 中添加：
```
CNAME  docs.oladance.com  steven-95271.github.io
```

### Step 3: GitHub 配置

在 Settings → Pages → Custom domain 中输入 `docs.oladance.com`

---

## 🚀 快速验证

部署完成后，在浏览器打开：

```
https://steven-95271.github.io/reddit-ops-web/
```

你应该能看到：
- ✅ 文档首页
- ✅ 流程图正确渲染
- ✅ 可点击导航链接

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. GitHub Pages 设置页面的截图
2. 错误信息（如有）
3. `docs/` 目录的文件列表
