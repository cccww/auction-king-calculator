# 🚀 Vercel 部署步骤指南

## 准备工作

✅ 您的代码已上传到 GitHub：https://github.com/cccww/auction-king-calculator

---

## 步骤 1：访问 Vercel 并登录

1. 打开浏览器，访问：https://vercel.com/
2. 点击右上角的 "Sign Up" 或 "Log In"
3. 选择 "Continue with GitHub" 登录
4. 授权 Vercel 访问您的 GitHub 账号

---

## 步骤 2：导入项目

1. 登录成功后，点击 **"Add New..."** → **"Project"**
2. 在 "Import Git Repository" 中，找到 `cccww/auction-king-calculator`
3. 点击 **"Import"** 按钮

---

## 步骤 3：配置项目

Vercel 会自动检测到这是一个 Vite/React 项目，配置应该是：

- **Project Name**：`auction-king-calculator`（可以自己改）
- **Framework Preset**：`Vite`（自动识别）
- **Root Directory**：`./`（保持默认）
- **Build Command**：`npm run build`（自动填充）
- **Output Directory**：`dist`（自动填充）
- **Environment Variables**：（不需要配置）

确认无误后，点击 **"Deploy"** 按钮！

---

## 步骤 4：等待部署完成

⏱️ 大约需要 1-3 分钟，请耐心等待...

部署过程中您会看到：
- 各种状态更新
- 构建日志（如果想看的话）

---

## 步骤 5：恭喜部署成功！

部署完成后，您会看到：
- 🎉 "Congratulations!" 页面
- 您的网站地址，例如：`https://auction-king-calculator.vercel.app`

点击这个地址，立即可以访问您的竞拍之王计算器！

---

## 📱 手机访问

获得公网地址后，在手机浏览器中输入地址即可访问！

---

## 🔄 自动更新

以后当您：
1. 在本地修改代码
2. `git push` 到 GitHub
3. Vercel 会**自动重新部署**！

---

## ❓ 常见问题

### Q：部署失败怎么办？
A：查看 Vercel 提供的错误日志，通常是构建错误，根据提示修复即可。

### Q：部署后数据还在吗？
A：数据存储在用户浏览器的 localStorage 中，每个设备独立存储，完全正常！

---

## 💡 其他部署平台

如果不想用 Vercel，也可以用：
- Netlify（和 Vercel 类似，也支持 GitHub 一键部署）
- Cloudflare Pages
- GitHub Pages

---

**祝您部署成功！** 🎉🎉
