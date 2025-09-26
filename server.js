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

// 创建示例PLY点云文件
function createSamplePLYFile() {
    const plyPath = path.join(modelsDir, 'sample_cloud.ply');
    
    // 生成一个简单的PLY文件，包含颜色和坐标信息
    const header = [
        'ply',
        'format ascii 1.0',
        'element vertex 8',  // 8个顶点组成一个立方体的点云
        'property float x',
        'property float y',
        'property float z',
        'property uchar red',
        'property uchar green',
        'property uchar blue',
        'end_header'
    ];
    
    // 创建一个立方体的顶点，并加上RGB颜色
    const vertices = [
        '-0.5 -0.5 -0.5 255 0 0',  // 红色
        '0.5 -0.5 -0.5 0 255 0',   // 绿色
        '-0.5 0.5 -0.5 0 0 255',   // 蓝色
        '0.5 0.5 -0.5 255 255 0',  // 黄色
        '-0.5 -0.5 0.5 255 0 255', // 品红色
        '0.5 -0.5 0.5 0 255 255',  // 青色
        '-0.5 0.5 0.5 128 128 128', // 灰色
        '0.5 0.5 0.5 255 255 255'   // 白色
    ];
    
    const plyContent = [...header, ...vertices].join('\n');
    fs.writeFileSync(plyPath, plyContent);
    
    return plyPath;
}

// 检查PLY模型 - 不再强制添加示例
function checkAndAddPointCloudSample(models) {
    // 注释掉自动生成示例 PLY 的功能，避免影响其他PLY模型的加载
    /*
    // 检查是否已有PLY格式模型
    const hasPlyModel = models.some(model => model.format.toLowerCase() === 'ply');
    
    if (!hasPlyModel) {
        // 创建点云样本
        const plyPath = createSamplePLYFile();
        
        // 创建缩略图
        const thumbPath = path.join(imagesDir, 'thumb_cloud.svg');
        fs.writeFileSync(thumbPath, createSvgThumbnail('#22aadd', '点云模型'));
        
        // 添加到模型列表
        const newModel = {
            id: models.length > 0 ? Math.max(...models.map(m => m.id)) + 1 : 1,
            name: '多彩点云模型',
            description: '这是一个简单的点云模型示例，包含8个不同颜色的点。',
            path: '/models/sample_cloud.ply',
            format: 'ply',
            thumbnail: '/images/thumb_cloud.svg',
            order: models.length + 1
        };
        
        models.push(newModel);
        fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
        console.log('已添加PLY点云示例模型');
    }
    */
    
    return models;
}

// 初始化模型数据文件
if (!fs.existsSync(dataFilePath)) {
    // 创建一个简单的立方体模型作为示例
    const boxGeometryCode = `
{"accessors":[{"bufferView":0,"componentType":5126,"count":24,"max":[0.5,0.5,0.5],"min":[-0.5,-0.5,-0.5],"type":"VEC3"},{"bufferView":1,"componentType":5126,"count":24,"type":"VEC3"},{"bufferView":2,"componentType":5126,"count":24,"type":"VEC2"},{"bufferView":3,"componentType":5123,"count":36,"type":"SCALAR"}],"asset":{"generator":"VSCODE Debugger","version":"2.0"},"bufferViews":[{"buffer":0,"byteLength":288,"byteOffset":0},{"buffer":0,"byteLength":288,"byteOffset":288},{"buffer":0,"byteLength":192,"byteOffset":576},{"buffer":0,"byteLength":72,"byteOffset":768}],"buffers":[{"byteLength":840,"uri":"data:application/octet-stream;base64,AAAAvwAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAvwAAAD8AAAC/AAAAPwAAAD8AAAC/AAAAPwAAAD8AAAA/AAAAPwAAAL8AAAA/AAAAPwAAAD8AAAC/AAAAPwAAAL8AAAC/AAAAPwAAAL8AAAA/AAAAvwAAAL8AAAA/AAAAPwAAAL8AAAC/AAAAvwAAAL8AAAC/AAAAvwAAAL8AAAA/AAAAvwAAAD8AAAA/AAAAvwAAAL8AAAC/AAAAvwAAAD8AAAC/AAAAvwAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAvwAAAL8AAAA/AAAAPwAAAL8AAAA/AAAAvwAAAD8AAAC/AAAAPwAAAD8AAAC/AAAAvwAAAL8AAAC/AAAAPwAAAL8AAAC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAACAPwAAgD8AAIA/AABAPwAAgD8AAIA/AABAPwAAgD8AAAA/AABAPwAAgD8AAAA/AABAPwAAAAAAAIA/AAAAAAAAgD8AAIA/AAAAAAAAQD8AAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AABAPwAAAAAAAIA/AABAPwAAAAAAAIA/AABAPwAAgD4AAIA/AABAPwAAgD4AAIA/AAAAAAAAgD8AAIA/AAAAAAAAgD8AAIA/AAABAAIAAwACAAEABAAFAAYABwAGAAUACAAJAAoACwAKAAkADAANAA4ADwAOAA0AEAARABIAEwASABEAFAAVABYAFwAWABUA"}],"materials":[{"doubleSided":true,"name":"Material","pbrMetallicRoughness":{"baseColorFactor":[0.8,0.2,0.2,1.0],"metallicFactor":0,"roughnessFactor":0.4}}],"meshes":[{"name":"Cube","primitives":[{"attributes":{"NORMAL":1,"POSITION":0,"TEXCOORD_0":2},"indices":3,"material":0}]}],"nodes":[{"mesh":0,"name":"Cube"}],"scene":0,"scenes":[{"name":"Scene","nodes":[0]}]}
    `;

    // 创建缩略图的SVG内容
    const createSvgThumbnail = (color, text) => `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${color}" />
  <text x="100" y="100" font-family="Arial" font-size="24" text-anchor="middle" fill="white">${text}</text>
</svg>
    `;

    // 确保模型和图片目录存在
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 写入立方体模型文件
    fs.writeFileSync(path.join(modelsDir, 'cube.gltf'), boxGeometryCode);

    // 创建缩略图
    fs.writeFileSync(path.join(imagesDir, 'thumb1.svg'), createSvgThumbnail('#ff0000', '3D模型1'));
    fs.writeFileSync(path.join(imagesDir, 'thumb2.svg'), createSvgThumbnail('#00aa00', '3D模型2'));
    fs.writeFileSync(path.join(imagesDir, 'thumb3.svg'), createSvgThumbnail('#0000ff', '3D模型3'));
    fs.writeFileSync(path.join(imagesDir, 'thumb4.svg'), createSvgThumbnail('#aa00aa', '3D模型4'));

    // 创建初始示例数据
    const initialData = [
        {
            id: 1,
            name: '红色立方体',
            description: '这是一个简单的红色立方体模型示例。',
            path: '/models/cube.gltf',
            format: 'gltf',
            thumbnail: '/images/thumb1.svg',
            order: 1
        },
        {
            id: 2,
            name: '绿色立方体',
            description: '这是一个简单的绿色立方体模型示例。',
            path: '/models/cube.gltf',
            format: 'gltf',
            thumbnail: '/images/thumb2.svg',
            order: 2
        },
        {
            id: 3,
            name: '蓝色立方体',
            description: '这是一个简单的蓝色立方体模型示例。',
            path: '/models/cube.gltf',
            format: 'gltf',
            thumbnail: '/images/thumb3.svg',
            order: 3
        },
        {
            id: 4,
            name: '紫色立方体',
            description: '这是一个简单的紫色立方体模型示例。',
            path: '/models/cube.gltf',
            format: 'gltf',
            thumbnail: '/images/thumb4.svg',
            order: 4
        }
    ];
    
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
    
    console.log('已创建示例模型和缩略图');
    
    // 不再自动创建PLY点云示例模型
    // checkAndAddPointCloudSample(initialData);
}

// 配置文件存储
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (file.fieldname === 'modelFile') {
            cb(null, modelsDir);
        } else if (file.fieldname === 'thumbnailFile') {
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
        const { name, description, order } = req.body;
        
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
            order: parseInt(order) || models.length + 1
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
        const { name, description, order } = req.body;
        
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
            order: parseInt(order) || models[index].order
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

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`- Public site: http://localhost:${port}/index.html`);
    console.log(`- Admin site: http://localhost:${port}/admin/index.html`);
});