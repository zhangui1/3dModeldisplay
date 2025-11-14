const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 添加对更多3D文件格式的MIME类型支持
// 直接在express.static中设置合适的MIME类型

const app = express();
const port = process.env.PORT || 3000;
const dataFilePath = path.join(__dirname, 'data', 'models.json');
const backgroundsFilePath = path.join(__dirname, 'data', 'backgrounds.json');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// 确保模型和图片目录存在
const modelsDir = path.join(__dirname, 'public', 'models');
const imagesDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// 示例PLY点云文件创建函数已移除，不再创建示例模型

// 此函数已删除 - 不再添加自动示例模型
function checkAndAddPointCloudSample(models) {
    // 不再添加示例模型，直接返回原始数据
    return models;
}

// 初始化模型数据文件
if (!fs.existsSync(dataFilePath)) {
    // 确保模型和图片目录存在
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 创建空的初始数据，不再添加示例模型
    const initialData = [];
    
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
    
    console.log('已创建空的模型数据文件');
}

// 初始化背景图数据文件
if (!fs.existsSync(backgroundsFilePath)) {
    // 确保图片目录存在（背景图也存储在images目录）
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 创建空的初始数据
    const initialData = [];
    
    fs.writeFileSync(backgroundsFilePath, JSON.stringify(initialData, null, 2));
    
    console.log('已创建空的背景图数据文件');
}

// 配置文件存储
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (file.fieldname === 'modelFile') {
            cb(null, modelsDir);
        } else if (file.fieldname === 'thumbnailFile' || file.fieldname === 'backgroundFile') {
            cb(null, imagesDir);
        }
    },
    filename: function(req, file, cb) {
        // 使用时间戳确保文件名唯一
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// 中间件
app.use(cors());
app.use(express.json());

// 配置静态文件服务，添加3D文件格式的MIME类型支持
app.use(express.static('public', {
  setHeaders: (res, path) => {
    // 为不同的3D模型格式设置MIME类型
    const ext = path.split('.').pop().toLowerCase();
    switch(ext) {
      case 'gltf':
        res.setHeader('Content-Type', 'model/gltf+json');
        break;
      case 'glb':
        res.setHeader('Content-Type', 'model/gltf-binary');
        break;
      case 'obj':
        res.setHeader('Content-Type', 'model/obj');
        break;
      case 'stl':
        res.setHeader('Content-Type', 'model/stl');
        break;
      case 'ply':
        res.setHeader('Content-Type', 'model/ply');
        break;
      case 'fbx':
        res.setHeader('Content-Type', 'model/fbx');
        break;
      case 'sog':
        res.setHeader('Content-Type', 'application/json');
        break;
    }
  }
}));

app.use('/admin', express.static('admin'));

// 重定向/public/index.html到/index.html
app.get('/public/index.html', (req, res) => {
    res.redirect('/index.html');
});

// API路由
// 获取所有模型
app.get('/api/models', (req, res) => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        res.json(models);
    } catch (error) {
        console.error('Error reading models data:', error);
        res.status(500).json({ message: '获取模型数据失败' });
    }
});

// 添加新模型
app.post('/api/models', upload.fields([
    { name: 'modelFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
]), (req, res) => {
    try {
        const { name, description, order, backgroundId } = req.body;
        
        if (!name || !req.files.modelFile || !req.files.thumbnailFile) {
            return res.status(400).json({ message: '缺少必要的字段' });
        }
        
        const modelFile = req.files.modelFile[0];
        const thumbnailFile = req.files.thumbnailFile[0];
        
        // 获取文件格式
        const format = path.extname(modelFile.originalname).substring(1);
        
        // 读取现有数据
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        
        // 创建新模型
        const newModel = {
            id: models.length > 0 ? Math.max(...models.map(m => m.id)) + 1 : 1,
            name,
            description,
            path: '/models/' + modelFile.filename,
            format,
            thumbnail: '/images/' + thumbnailFile.filename,
            order: parseInt(order) || models.length + 1,
            backgroundId: backgroundId ? parseInt(backgroundId) : null
        };
        
        // 添加到列表
        models.push(newModel);
        
        // 按顺序排序
        models.sort((a, b) => a.order - b.order);
        
        // 保存数据
        fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
        
        res.status(201).json(newModel);
    } catch (error) {
        console.error('Error adding model:', error);
        res.status(500).json({ message: '添加模型失败' });
    }
});

// 更新模型
app.put('/api/models/:id', upload.fields([
    { name: 'thumbnailFile', maxCount: 1 }
]), (req, res) => {
    try {
        const modelId = parseInt(req.params.id);
        const { name, description, order, backgroundId } = req.body;
        
        // 读取现有数据
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        
        // 查找模型索引
        const index = models.findIndex(m => m.id === modelId);
        
        if (index === -1) {
            return res.status(404).json({ message: '未找到模型' });
        }
        
        // 准备更新对象
        const updatedModel = {
            ...models[index],
            name: name || models[index].name,
            description: description || models[index].description,
            order: parseInt(order) || models[index].order,
            backgroundId: backgroundId ? parseInt(backgroundId) : (backgroundId === '' ? null : models[index].backgroundId)
        };
        
        // 如果上传了新缩略图
        if (req.files && req.files.thumbnailFile) {
            // 删除旧缩略图文件
            const oldThumbnailPath = path.join(__dirname, 'public', models[index].thumbnail);
            if (fs.existsSync(oldThumbnailPath)) {
                fs.unlinkSync(oldThumbnailPath);
            }
            
            const thumbnailFile = req.files.thumbnailFile[0];
            updatedModel.thumbnail = '/images/' + thumbnailFile.filename;
        }
        
        // 更新模型
        models[index] = updatedModel;
        
        // 按顺序排序
        models.sort((a, b) => a.order - b.order);
        
        // 保存数据
        fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
        
        res.json(updatedModel);
    } catch (error) {
        console.error('Error updating model:', error);
        res.status(500).json({ message: '更新模型失败' });
    }
});

// 删除模型
app.delete('/api/models/:id', (req, res) => {
    try {
        const modelId = parseInt(req.params.id);
        
        // 读取现有数据
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        
        // 查找模型索引
        const index = models.findIndex(m => m.id === modelId);
        
        if (index === -1) {
            return res.status(404).json({ message: '未找到模型' });
        }
        
        // 删除模型文件
        const modelPath = path.join(__dirname, 'public', models[index].path);
        if (fs.existsSync(modelPath)) {
            fs.unlinkSync(modelPath);
        }
        
        // 删除缩略图文件
        const thumbnailPath = path.join(__dirname, 'public', models[index].thumbnail);
        if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }
        
        // 从数组中移除
        models.splice(index, 1);
        
        // 保存数据
        fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
        
        res.json({ message: '模型已删除' });
    } catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ message: '删除模型失败' });
    }
});

// 更新模型顺序
app.post('/api/models/reorder', (req, res) => {
    try {
        const { modelId, newPosition } = req.body;
        
        // 读取现有数据
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        
        // 查找模型索引
        const index = models.findIndex(m => m.id === parseInt(modelId));
        
        if (index === -1) {
            return res.status(404).json({ message: '未找到模型' });
        }
        
        // 暂存模型
        const model = models[index];
        
        // 计算新位置
        const oldPosition = index;
        const targetPosition = parseInt(newPosition);
        
        // 重新排序
        if (targetPosition > oldPosition) {
            // 向下移动
            for (let i = oldPosition; i < targetPosition; i++) {
                models[i] = models[i + 1];
            }
        } else {
            // 向上移动
            for (let i = oldPosition; i > targetPosition; i--) {
                models[i] = models[i - 1];
            }
        }
        
        // 放置到新位置
        models[targetPosition] = model;
        
        // 更新顺序号
        models.forEach((model, idx) => {
            model.order = idx + 1;
        });
        
        // 保存数据
        fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
        
        res.json(models);
    } catch (error) {
        console.error('Error reordering models:', error);
        res.status(500).json({ message: '重新排序失败' });
    }
});

// 批量删除模型
app.post('/api/models/batch-delete', (req, res) => {
    try {
        const { format } = req.body;
        
        if (!format) {
            return res.status(400).json({ message: '缺少必要的格式参数' });
        }
        
        // 读取现有数据
        const data = fs.readFileSync(dataFilePath, 'utf8');
        const models = JSON.parse(data);
        
        // 筛选要删除的模型
        let modelsToDelete;
        let remainingModels;
        
        if (format === 'all') {
            modelsToDelete = [...models];
            remainingModels = [];
        } else {
            modelsToDelete = models.filter(model => 
                model.format.toLowerCase() === format.toLowerCase()
            );
            remainingModels = models.filter(model => 
                model.format.toLowerCase() !== format.toLowerCase()
            );
        }
        
        if (modelsToDelete.length === 0) {
            return res.status(404).json({ message: '未找到符合条件的模型' });
        }
        
        // 删除文件
        modelsToDelete.forEach(model => {
            // 删除模型文件
            const modelPath = path.join(__dirname, 'public', model.path);
            if (fs.existsSync(modelPath)) {
                fs.unlinkSync(modelPath);
            }
            
            // 删除缩略图文件
            const thumbnailPath = path.join(__dirname, 'public', model.thumbnail);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
        });
        
        // 更新顺序号
        remainingModels.forEach((model, idx) => {
            model.order = idx + 1;
        });
        
        // 保存数据
        fs.writeFileSync(dataFilePath, JSON.stringify(remainingModels, null, 2));
        
        res.json({ 
            message: '批量删除成功', 
            deletedCount: modelsToDelete.length,
            remainingCount: remainingModels.length
        });
    } catch (error) {
        console.error('Error batch deleting models:', error);
        res.status(500).json({ message: '批量删除模型失败' });
    }
});

// ========== 背景图API路由 ==========

// 获取所有背景图
app.get('/api/backgrounds', (req, res) => {
    try {
        const data = fs.readFileSync(backgroundsFilePath, 'utf8');
        const backgrounds = JSON.parse(data);
        res.json(backgrounds);
    } catch (error) {
        console.error('Error reading backgrounds data:', error);
        res.status(500).json({ message: '获取背景图数据失败' });
    }
});

// 添加新背景图
app.post('/api/backgrounds', upload.fields([
    { name: 'backgroundFile', maxCount: 1 }
]), (req, res) => {
    try {
        const { name, description, order } = req.body;
        
        if (!req.files.backgroundFile) {
            return res.status(400).json({ message: '缺少必要的字段' });
        }
        
        const backgroundFile = req.files.backgroundFile[0];
        
        // 如果没有提供名称，使用文件名（去掉扩展名）
        const backgroundName = name || backgroundFile.originalname.replace(/\.[^/.]+$/, "");
        
        // 读取现有数据
        const data = fs.readFileSync(backgroundsFilePath, 'utf8');
        const backgrounds = JSON.parse(data);
        
        // 创建新背景图
        const newBackground = {
            id: backgrounds.length > 0 ? Math.max(...backgrounds.map(b => b.id)) + 1 : 1,
            name: backgroundName,
            description: description || '',
            path: '/images/' + backgroundFile.filename,
            order: parseInt(order) || backgrounds.length + 1
        };
        
        // 添加到列表
        backgrounds.push(newBackground);
        
        // 按顺序排序
        backgrounds.sort((a, b) => a.order - b.order);
        
        // 保存数据
        fs.writeFileSync(backgroundsFilePath, JSON.stringify(backgrounds, null, 2));
        
        res.status(201).json(newBackground);
    } catch (error) {
        console.error('Error adding background:', error);
        res.status(500).json({ message: '添加背景图失败' });
    }
});

// 更新背景图
app.put('/api/backgrounds/:id', upload.fields([
    { name: 'backgroundFile', maxCount: 1 }
]), (req, res) => {
    try {
        const backgroundId = parseInt(req.params.id);
        const { name, description, order } = req.body;
        
        // 读取现有数据
        const data = fs.readFileSync(backgroundsFilePath, 'utf8');
        const backgrounds = JSON.parse(data);
        
        // 查找背景图索引
        const index = backgrounds.findIndex(b => b.id === backgroundId);
        
        if (index === -1) {
            return res.status(404).json({ message: '未找到背景图' });
        }
        
        // 准备更新对象
        const updatedBackground = {
            ...backgrounds[index],
            name: name || backgrounds[index].name,
            description: description || backgrounds[index].description,
            order: parseInt(order) || backgrounds[index].order
        };
        
        // 如果上传了新背景图文件
        if (req.files && req.files.backgroundFile) {
            // 删除旧背景图文件
            const oldBackgroundPath = path.join(__dirname, 'public', backgrounds[index].path);
            if (fs.existsSync(oldBackgroundPath)) {
                fs.unlinkSync(oldBackgroundPath);
            }
            
            const backgroundFile = req.files.backgroundFile[0];
            updatedBackground.path = '/images/' + backgroundFile.filename;
        }
        
        // 更新背景图
        backgrounds[index] = updatedBackground;
        
        // 按顺序排序
        backgrounds.sort((a, b) => a.order - b.order);
        
        // 保存数据
        fs.writeFileSync(backgroundsFilePath, JSON.stringify(backgrounds, null, 2));
        
        res.json(updatedBackground);
    } catch (error) {
        console.error('Error updating background:', error);
        res.status(500).json({ message: '更新背景图失败' });
    }
});

// 删除背景图
app.delete('/api/backgrounds/:id', (req, res) => {
    try {
        const backgroundId = parseInt(req.params.id);
        
        // 读取现有数据
        const data = fs.readFileSync(backgroundsFilePath, 'utf8');
        const backgrounds = JSON.parse(data);
        
        // 查找背景图索引
        const index = backgrounds.findIndex(b => b.id === backgroundId);
        
        if (index === -1) {
            return res.status(404).json({ message: '未找到背景图' });
        }
        
        // 删除背景图文件
        const backgroundPath = path.join(__dirname, 'public', backgrounds[index].path);
        if (fs.existsSync(backgroundPath)) {
            fs.unlinkSync(backgroundPath);
        }
        
        // 从数组中移除
        backgrounds.splice(index, 1);
        
        // 保存数据
        fs.writeFileSync(backgroundsFilePath, JSON.stringify(backgrounds, null, 2));
        
        res.json({ message: '背景图已删除' });
    } catch (error) {
        console.error('Error deleting background:', error);
        res.status(500).json({ message: '删除背景图失败' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`- Public site: http://localhost:${port}/index.html`);
    console.log(`- Admin site: http://localhost:${port}/admin/index.html`);
});