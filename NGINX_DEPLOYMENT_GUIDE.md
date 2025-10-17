# Nginx 部署指南 - 3D 模型展示平台

## 📋 部署步骤

### 1️⃣ 上传配置文件到服务器

```bash
# 方式 A: 使用 SCP 上传
scp nginx-3d-model.conf user@your-server:/tmp/

# 方式 B: 直接在服务器上创建
ssh user@your-server
sudo nano /etc/nginx/sites-available/3d-model-display
# 然后粘贴配置文件内容
```

---

### 2️⃣ 修改配置文件中的路径

**重要！** 必须修改以下路径为你的实际路径：

```bash
# 编辑配置文件
sudo nano /etc/nginx/sites-available/3d-model-display
```

**需要修改的地方：**

1. **第 4 行**：`server_name your-domain.com;`
   - 改为你的域名或服务器 IP
   - 例如：`server_name 123.45.67.89;` 或 `server_name example.com;`

2. **第 34 行**：`alias /path/to/3dModeldisplay/public/models/;`
   - 改为你的实际项目路径
   - 例如：`alias /home/user/3dModeldisplay/public/models/;`

3. **第 76 行**：`alias /path/to/3dModeldisplay/public/images/;`
   - 改为：`alias /home/user/3dModeldisplay/public/images/;`

4. **第 97 行**：`alias /path/to/3dModeldisplay/public/css/;`
   - 改为：`alias /home/user/3dModeldisplay/public/css/;`

5. **第 104 行**：`alias /path/to/3dModeldisplay/public/js/;`
   - 改为：`alias /home/user/3dModeldisplay/public/js/;`

**快速查找项目路径：**
```bash
cd ~/3dModeldisplay
pwd
# 输出类似：/home/username/3dModeldisplay
```

---

### 3️⃣ 移动配置文件到正确位置

```bash
# 如果从 /tmp 上传的
sudo mv /tmp/nginx-3d-model.conf /etc/nginx/sites-available/3d-model-display

# 设置正确的权限
sudo chmod 644 /etc/nginx/sites-available/3d-model-display
```

---

### 4️⃣ 启用配置文件

```bash
# 创建符号链接到 sites-enabled
sudo ln -s /etc/nginx/sites-available/3d-model-display /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default
```

---

### 5️⃣ 测试配置文件

```bash
# 测试 Nginx 配置语法
sudo nginx -t

# 应该看到：
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**如果报错，常见问题：**
- 路径不存在：检查 `alias` 路径是否正确
- 语法错误：检查是否有拼写错误
- 权限问题：确保 nginx 用户可以访问目录

---

### 6️⃣ 重启 Nginx

```bash
# 方式 A: 重新加载配置（推荐，不中断服务）
sudo systemctl reload nginx

# 方式 B: 完全重启
sudo systemctl restart nginx

# 检查 Nginx 状态
sudo systemctl status nginx
```

---

### 7️⃣ 设置目录权限

确保 Nginx 可以访问你的文件：

```bash
# 进入项目目录
cd /home/user/3dModeldisplay

# 设置正确的权限
sudo chmod -R 755 public/
sudo chown -R www-data:www-data public/

# 或者保持当前用户所有权，但给予 nginx 读取权限
sudo chmod -R 755 public/
```

---

## 🧪 验证部署

### 测试 1: 检查基本访问

```bash
# 测试首页
curl -I http://your-server-ip/

# 应该返回 200 OK
```

### 测试 2: 检查 Range 请求支持（关键！）

```bash
# 找一个实际的 PLY 文件测试
curl -I -H "Range: bytes=0-1023" http://your-server-ip/models/modelFile-xxx.ply

# ✅ 应该看到：
# HTTP/1.1 206 Partial Content
# Accept-Ranges: bytes
# Content-Range: bytes 0-1023/总大小
# Access-Control-Allow-Origin: *

# ❌ 如果看到 200 OK 而不是 206，说明 Range 请求未生效
```

### 测试 3: 浏览器测试

1. 打开浏览器访问：`http://your-server-ip/`
2. 打开开发者工具 (F12) -> Network 标签页
3. 加载一个 PLY 模型
4. 查看 PLY 文件的请求：
   - **Request Headers** 应该有：`Range: bytes=0-xxxxx`
   - **Response Headers** 应该有：`Accept-Ranges: bytes`
   - **Status Code** 应该是：`206 Partial Content`

---

## 🔧 故障排除

### 问题 1: 403 Forbidden

**原因**：权限不足

**解决**：
```bash
# 检查目录权限
ls -la /home/user/3dModeldisplay/public/

# 设置正确的权限
sudo chmod -R 755 /home/user/3dModeldisplay/public/

# 检查 SELinux（CentOS/RHEL）
sudo setenforce 0  # 临时禁用测试
```

### 问题 2: 404 Not Found

**原因**：路径配置错误

**解决**：
```bash
# 检查文件是否存在
ls /home/user/3dModeldisplay/public/models/

# 检查 Nginx 配置中的 alias 路径是否正确
sudo nano /etc/nginx/sites-available/3d-model-display
```

### 问题 3: 仍然返回 200 而不是 206

**原因**：Range 请求未正确配置

**解决**：
```bash
# 确保配置文件中有这一行
# add_header Accept-Ranges bytes always;

# 检查是否有其他配置覆盖了这个设置
sudo nginx -T | grep -i "accept-ranges"
```

### 问题 4: 模型加载卡在 0%

**原因 A**：Range 请求不支持（见问题 3）

**原因 B**：CORS 问题

**解决**：
```bash
# 检查响应头
curl -I http://your-server-ip/models/your-file.ply

# 应该看到：
# Access-Control-Allow-Origin: *
# Access-Control-Expose-Headers: Accept-Ranges, Content-Length, Content-Range
```

### 问题 5: Nginx 启动失败

**查看错误日志**：
```bash
sudo tail -f /var/log/nginx/error.log

# 或
sudo journalctl -u nginx -f
```

---

## 📊 性能优化建议

### 1. 启用 Gzip 压缩（主配置文件）

编辑 `/etc/nginx/nginx.conf`：

```nginx
http {
    # ... 其他配置 ...
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";
}
```

### 2. 增加文件描述符限制

```bash
# 编辑系统限制
sudo nano /etc/security/limits.conf

# 添加：
* soft nofile 65536
* hard nofile 65536

# 编辑 Nginx 配置
sudo nano /etc/nginx/nginx.conf

# 在 events 块中添加：
events {
    worker_connections 4096;
}
```

### 3. 启用 HTTP/2（需要 HTTPS）

安装 Let's Encrypt 证书后，修改配置：
```nginx
listen 443 ssl http2;
```

---

## 🔒 安全建议

### 1. 安装 SSL 证书（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian
sudo yum install certbot python3-certbot-nginx  # CentOS

# 自动配置 SSL
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 2. 限制上传速率（防止滥用）

在 server 块中添加：
```nginx
# 限制上传速率为 10MB/s
limit_rate 10m;
```

### 3. 添加防火墙规则

```bash
# UFW (Ubuntu)
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 📝 日志监控

### 查看访问日志
```bash
sudo tail -f /var/log/nginx/3d-model-access.log
```

### 查看错误日志
```bash
sudo tail -f /var/log/nginx/3d-model-error.log
```

### 分析日志
```bash
# 统计访问最多的文件
sudo cat /var/log/nginx/3d-model-access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -20

# 统计 HTTP 状态码
sudo cat /var/log/nginx/3d-model-access.log | awk '{print $9}' | sort | uniq -c | sort -rn
```

---

## ✅ 部署检查清单

- [ ] 修改配置文件中的域名/IP
- [ ] 修改配置文件中的所有路径
- [ ] 上传配置文件到服务器
- [ ] 创建符号链接到 sites-enabled
- [ ] 测试 Nginx 配置（nginx -t）
- [ ] 设置正确的目录权限
- [ ] 重启 Nginx
- [ ] 测试 Range 请求支持（curl -I -H "Range..."）
- [ ] 浏览器测试模型加载
- [ ] 检查 CORS 响应头
- [ ] 查看错误日志确认无错误
- [ ] （可选）安装 SSL 证书

---

## 🆘 需要帮助？

如果部署过程中遇到问题，请提供：
1. 完整的错误信息
2. Nginx 错误日志内容
3. curl 测试的完整输出
4. 浏览器控制台的错误信息

---

**祝部署顺利！** 🚀

