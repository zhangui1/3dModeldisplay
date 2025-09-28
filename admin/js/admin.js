// 全局变量
let models = [];
let currentFilter = 'all';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化函数
function init() {
    // 加载模型列表
    loadModelsList();
    
    // 添加事件监听
    document.getElementById('uploadBtn').addEventListener('click', uploadModel);
    document.getElementById('saveEditBtn').addEventListener('click', saveModelChanges);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteModel);
    document.getElementById('confirmBatchDeleteBtn').addEventListener('click', batchDeleteModels);
    document.getElementById('searchBtn').addEventListener('click', searchModels);
    
    // 筛选事件
    const filterLinks = document.querySelectorAll('[data-filter]');
    filterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentFilter = e.target.getAttribute('data-filter');
            filterModels();
        });
    });
}

// 加载模型列表
async function loadModelsList() {
    try {
        // 显示加载状态
        document.getElementById('modelList').innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">正在加载...</span>
                </div>
                <p class="mt-2">正在从服务器加载模型数据...</p>
            </div>
        `;
        
        // 使用API获取模型列表
        const response = await fetch('/api/models');
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 解析JSON数据
        models = await response.json();
        renderModelList(models);
    } catch (error) {
        console.error('加载模型列表失败:', error);
        
        // 显示错误状态
        document.getElementById('modelList').innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
                <p class="mt-2">加载模型数据失败，请刷新页面或稍后重试。</p>
                <button class="btn btn-primary mt-2" onclick="loadModelsList()">
                    <i class="bi bi-arrow-clockwise"></i> 重试
                </button>
            </div>
        `;
    }
}

// 渲染模型列表
function renderModelList(modelList) {
    const container = document.getElementById('modelList');
    
    if (modelList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-inbox-fill" style="font-size: 3rem; color: #ccc;"></i>
                <p class="mt-2">暂无模型数据</p>
                <button class="btn btn-primary mt-2" data-bs-toggle="modal" data-bs-target="#uploadModal">
                    <i class="bi bi-plus-lg"></i> 添加第一个模型
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    modelList.forEach((model, index) => {
        html += `
            <div class="row model-item" data-id="${model.id}" data-format="${model.format}">
                <div class="col-1">${index + 1}</div>
                <div class="col-2">
                    <img src="${model.thumbnail}" alt="${model.name}" class="model-thumbnail">
                </div>
                <div class="col-2">${model.name}</div>
                <div class="col-3 text-truncate">${model.description}</div>
                <div class="col-1">
                    <span class="model-format-badge format-${model.format.toLowerCase()}">${model.format.toUpperCase()}</span>
                </div>
                <div class="col-1 order-controls">
                    <button class="btn btn-sm btn-outline-secondary btn-order" onclick="moveModelUp(${model.id})" ${index === 0 ? 'disabled' : ''}>
                        <i class="bi bi-arrow-up"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary btn-order" onclick="moveModelDown(${model.id})" ${index === modelList.length - 1 ? 'disabled' : ''}>
                        <i class="bi bi-arrow-down"></i>
                    </button>
                </div>
                <div class="col-2 text-center">
                    <div class="d-flex justify-content-center">
                        <button class="btn btn-sm btn-primary me-2" onclick="editModel(${model.id})">
                            <i class="bi bi-pencil"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDelete(${model.id})">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 上传新模型
async function uploadModel() {
    // 获取表单数据
    const name = document.getElementById('modelName').value;
    const description = document.getElementById('modelDescription').value;
    const modelFile = document.getElementById('modelFile').files[0];
    const thumbnailFile = document.getElementById('thumbnailFile').files[0];
    const order = document.getElementById('modelOrder').value;
    
    if (!name || !modelFile || !thumbnailFile) {
        alert('请填写必填字段！');
        return;
    }
    
    try {
        // 创建 FormData 对象并添加数据
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('order', order);
        formData.append('modelFile', modelFile);
        formData.append('thumbnailFile', thumbnailFile);
        
        // 显示上传进度提示
        showNotification('正在上传模型文件...', 'info');
        
        // 发送请求到服务器
        const response = await fetch('/api/models', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 关闭模态框
        const modalElement = document.getElementById('uploadModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // 重置表单
        document.getElementById('uploadForm').reset();
        
        // 提示成功
        showNotification('模型上传成功！', 'success');
    } catch (error) {
        console.error('上传失败:', error);
        showNotification('模型上传失败，请重试！', 'danger');
    }
}

// 编辑模型
function editModel(id) {
    // 查找模型
    const model = models.find(m => m.id === id);
    if (!model) return;
    
    // 填充表单
    document.getElementById('editModelId').value = model.id;
    document.getElementById('editModelName').value = model.name;
    document.getElementById('editModelDescription').value = model.description;
    document.getElementById('editModelOrder').value = model.order;
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
}

// 保存模型修改
async function saveModelChanges() {
    const id = parseInt(document.getElementById('editModelId').value);
    const name = document.getElementById('editModelName').value;
    const description = document.getElementById('editModelDescription').value;
    const thumbnailFile = document.getElementById('editThumbnailFile').files[0];
    const order = parseInt(document.getElementById('editModelOrder').value);
    
    try {
        // 创建 FormData 对象并添加数据
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('order', order);
        
        if (thumbnailFile) {
            formData.append('thumbnailFile', thumbnailFile);
        }
        
        // 显示更新进度提示
        showNotification('正在更新模型信息...', 'info');
        
        // 发送请求到服务器
        const response = await fetch(`/api/models/${id}`, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 关闭模态框
        const modalElement = document.getElementById('editModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // 提示成功
        showNotification('模型更新成功！', 'success');
    } catch (error) {
        console.error('更新失败:', error);
        showNotification('模型更新失败，请重试！', 'danger');
    }
}

// 确认删除
function confirmDelete(id) {
    // 查找模型
    const model = models.find(m => m.id === id);
    if (!model) return;
    
    // 设置模态框内容
    document.getElementById('deleteModelId').value = id;
    document.getElementById('deleteModelName').textContent = model.name;
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// 删除模型
async function deleteModel() {
    const id = parseInt(document.getElementById('deleteModelId').value);
    
    try {
        // 显示删除进度提示
        showNotification('正在删除模型...', 'info');
        
        // 发送删除请求到服务器
        const response = await fetch(`/api/models/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await response.json();
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 关闭模态框
        const modalElement = document.getElementById('deleteModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // 提示成功
        showNotification('模型已成功删除！', 'success');
    } catch (error) {
        console.error('删除失败:', error);
        showNotification('模型删除失败，请重试！', 'danger');
    }
}

// 上移模型
async function moveModelUp(id) {
    const index = models.findIndex(m => m.id === id);
    if (index <= 0) return;
    
    try {
        // 发送请求到服务器更新顺序
        const response = await fetch('/api/models/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modelId: id,
                newPosition: index - 1
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 提示成功
        showNotification('模型顺序已更新！', 'success');
    } catch (error) {
        console.error('更新顺序失败:', error);
        showNotification('更新模型顺序失败，请重试！', 'danger');
    }
}

// 下移模型
async function moveModelDown(id) {
    const index = models.findIndex(m => m.id === id);
    if (index === -1 || index >= models.length - 1) return;
    
    try {
        // 发送请求到服务器更新顺序
        const response = await fetch('/api/models/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modelId: id,
                newPosition: index + 1
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 提示成功
        showNotification('模型顺序已更新！', 'success');
    } catch (error) {
        console.error('更新顺序失败:', error);
        showNotification('更新模型顺序失败，请重试！', 'danger');
    }
}

// 搜索模型
function searchModels() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (!searchTerm) {
        renderModelList(models);
        return;
    }
    
    // 筛选匹配的模型
    const filtered = models.filter(model => 
        model.name.toLowerCase().includes(searchTerm) || 
        model.description.toLowerCase().includes(searchTerm)
    );
    
    renderModelList(filtered);
}

// 筛选模型
function filterModels() {
    if (currentFilter === 'all') {
        renderModelList(models);
        return;
    }
    
    // 筛选匹配格式的模型
    const filtered = models.filter(model => 
        model.format.toLowerCase() === currentFilter
    );
    
    renderModelList(filtered);
}

// 模拟上传过程
function simulateUpload() {
    return new Promise((resolve) => {
        // 模拟上传延迟
        setTimeout(() => {
            resolve();
        }, 1000);
    });
}

// 批量删除模型
async function batchDeleteModels() {
    // 获取选中的格式
    const selectedFormat = document.querySelector('input[name="deleteFormat"]:checked').value;
    
    try {
        // 显示删除进度提示
        showNotification('正在批量删除模型...', 'info');
        
        // 筛选要删除的模型
        let modelsToDelete;
        if (selectedFormat === 'all') {
            modelsToDelete = [...models]; // 复制整个数组
        } else {
            modelsToDelete = models.filter(model => 
                model.format.toLowerCase() === selectedFormat.toLowerCase()
            );
        }
        
        if (modelsToDelete.length === 0) {
            showNotification('没有找到符合条件的模型！', 'warning');
            return;
        }
        
        // 发送批量删除请求到服务器
        const response = await fetch('/api/models/batch-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                format: selectedFormat
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 重新加载模型列表
        await loadModelsList();
        
        // 关闭模态框
        const modalElement = document.getElementById('batchDeleteModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // 提示成功
        showNotification(`成功删除了 ${result.deletedCount || modelsToDelete.length} 个模型！`, 'success');
    } catch (error) {
        console.error('批量删除失败:', error);
        showNotification('批量删除失败，请重试！', 'danger');
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `toast align-items-center text-white bg-${type} border-0`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    notification.setAttribute('aria-atomic', 'true');
    
    notification.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // 创建通知容器（如果不存在）
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // 添加通知到容器
    toastContainer.appendChild(notification);
    
    // 显示通知
    const toast = new bootstrap.Toast(notification);
    toast.show();
    
    // 自动移除
    notification.addEventListener('hidden.bs.toast', () => {
        notification.remove();
    });
}
