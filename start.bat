@echo off
echo 正在安装依赖包...
call npm install
echo 启动服务器...
start "" http://localhost:3000/index.html
start "" http://localhost:3000/admin/index.html
node server.js
