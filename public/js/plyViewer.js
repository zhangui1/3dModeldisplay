// plyViewer.js - 专门处理PLY高斯点云格式的模块
// 基于GaussianSplats3D库实现，与build目录中的实现完全一致

import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as PlyControls from './plyControlsExtension.js';

// 全局变量
let viewer = null;
let currentFile = null;

/**
 * 加载PLY格式的高斯点云模型
 * @param {string} path - 模型文件路径或File对象
 * @param {string|number} modelId - 模型ID，用于标识
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadPlyModel(path, modelId, onProgress, options = {}) {
  const { 
    onSuccess = () => {},
    onError = () => {},
    showLoading = () => {},
    hideLoading = () => {},
    onCleanup = () => {}
  } = options;
  
  return new Promise(async (resolve, reject) => {
    try {
      // 开始加载高斯点云模型
      
      // 清理旧的高斯点云查看器实例
      await cleanup();
      
      // 创建高斯点云查看器的容器
      const modelContainer = document.querySelector('.model-container');
      if (!modelContainer) {
        throw new Error('找不到模型容器元素');
      }
      
      // 创建一个专用的查看器容器，并使其居中
      const viewerContainer = document.createElement('div');
      viewerContainer.id = 'viewer-container';
      viewerContainer.style.position = 'absolute';
      viewerContainer.style.top = '50%'; // 从顶部50%开始
      viewerContainer.style.left = '50%'; // 从左侧50%开始
      viewerContainer.style.width = '100%';
      viewerContainer.style.height = '100%';
      viewerContainer.style.transform = 'translate(-50%, -50%)'; // 中心点对齐
      viewerContainer.style.zIndex = '1'; 
      modelContainer.appendChild(viewerContainer);
      
      // 如果存在原始canvas元素，则隐藏
      const originalCanvas = document.getElementById('model-canvas');
      if (originalCanvas) {
        originalCanvas.style.display = 'none';
      }
      
      // 保存原始animate函数
      if (options.animate) {
        window.originalAnimate = options.animate;
      }
      
      // 初始化查看器
      initViewer();
      
      // 不显示加载提示，只使用页面的加载动画
      
      try {
        // 处理文件路径或File对象
        let fileUrl;
        let fileType;
        let fileName;
        let fileSize;
        
        if (path instanceof File) {
          // 如果传入的是File对象
          currentFile = path;
          fileUrl = URL.createObjectURL(path);
          fileName = path.name;
          fileType = fileName.split('.').pop().toLowerCase();
          fileSize = (path.size / (1024 * 1024)).toFixed(2); // 转换为MB并保留两位小数
        } else if (typeof path === 'string') {
          // 如果传入的是文件路径字符串
          fileUrl = new URL(path, window.location.origin).href;
          fileName = path.split('/').pop();
          fileType = fileName.split('.').pop().toLowerCase();
          currentFile = { path, name: fileName };
          // 获取文件大小
          try {
            const response = await fetch(path, { method: 'HEAD' });
            if (response.ok) {
              const size = response.headers.get('content-length');
              fileSize = (size / (1024 * 1024)).toFixed(2);
            } else {
              fileSize = '未知';
            }
          } catch (error) {
            console.warn('获取文件大小失败:', error);
            fileSize = '未知';
          }
        } else {
          throw new Error('不支持的path参数类型');
        }
        
        // 检查文件类型，确定加载格式
        let format;
        if (fileType === 'ply') {
          format = GaussianSplats3D.SceneFormat.Ply;
        } else if (fileType === 'splat') {
          format = GaussianSplats3D.SceneFormat.Splat;
        } else if (fileType === 'ksplat') {
          format = GaussianSplats3D.SceneFormat.KSplat;
        } else if (fileType === 'spz') {
          format = GaussianSplats3D.SceneFormat.Spz;
        } else {
          throw new Error(`不支持的文件格式: ${fileType}`);
        }
        
        // 不显示加载提示，只使用页面的加载动画
        
        // 在加载新场景前，确保没有其他操作正在进行
        if (viewer.getSceneCount && viewer.getSceneCount() > 0) {
          if (viewer.isLoadingOrUnloading && viewer.isLoadingOrUnloading()) {
            updateStatus('请等待当前操作完成后再试', hideLoading, 'error');
            return;
          }
          // 尝试移除现有场景
          try {
            await viewer.removeSplatScene(0);
          } catch (removeError) {
            console.error('移除场景失败:', removeError);
            // 如果移除失败，则释放旧查看器并创建一个新的
            await viewer.dispose();
            initViewer();
          }
        }
        
        // 加载3D高斯点云数据
        await viewer.addSplatScene(fileUrl, {
          'format': format, // 显式指定文件格式
          'progressiveLoad': false, // 禁用渐进式加载，以支持压缩PLY等特殊格式
          'showLoadingUI': false,
          'splatAlphaRemovalThreshold': 5, // 透明度阈值
          'onProgress': (progress) => {
            // 处理加载进度
            if (onProgress) {
              // 如果进度达到100%，强制立即清理所有加载提示
              if (progress >= 100) {
                // 使用参数传入的hideLoading函数
                if (typeof hideLoading === 'function') {
                  hideLoading();
                }
                
                // 也传递100%的进度给调用方，让调用方也能清理提示
                onProgress({ lengthComputable: true, loaded: 100, total: 100 });
              } else {
                // 否则正常更新进度
                onProgress({ lengthComputable: true, loaded: progress, total: 100 });
              }
            }
          }
        });
        
        // 强制立即渲染一次
        viewer.forceRenderNextFrame();
        
        // 确保查看器已启动
        if (!viewer.selfDrivenModeRunning) {
          viewer.start();
        }
        
        // 初始化PLY控制功能 - 提供全屏、重置视角和自动旋转功能
        PlyControls.initPlyControls(viewer);
        
        // 获取加载后的信息
        const splatCount = viewer.getSplatMesh().getSplatCount();
        // 不显示加载完成提示
        hideLoading();
        
        // 自动调整相机以显示整个模型
        setTimeout(() => {
          try {
            adjustCameraToModel();
          } catch (e) {
            console.error('调整相机位置失败:', e);
          }
        }, 500); // 延时500ms确保模型完全加载
        
        // 清理URL对象
        if (path instanceof File) {
          URL.revokeObjectURL(fileUrl);
        }
        
        // 调用成功回调并解析Promise
        const result = {
          type: 'gaussian-splats',
          viewer: viewer,
          modelId,
          format: fileType,
          count: splatCount
        };
        
        onSuccess(result);
        resolve(result);
        
      } catch (loadError) {
        console.error('加载高斯点云数据失败:', loadError);
        
        // 如果加载失败，恢复原始渲染
        if (originalCanvas) {
          originalCanvas.style.display = 'block';
        }
        
        // 清理资源
        await cleanup();
        
        updateStatus('加载失败: ' + loadError.message, hideLoading, 'error');
        onError(loadError.message || '高斯点云数据加载失败');
        reject(loadError);
      }
      
    } catch (error) {
      console.error('高斯点云查看器初始化失败:', error);
      updateStatus('初始化失败: ' + error.message, hideLoading, 'error');
      onError(error.message || '高斯点云初始化失败');
      reject(error);
    }
  });
}

/**
 * 初始化查看器
 */
function initViewer() {
  try {
    // 获取viewer容器元素
    const viewerContainerElement = document.getElementById('viewer-container');
    if (!viewerContainerElement) {
      throw new Error('找不到viewer-container元素');
    }
    
    // 创建GaussianSplats3D查看器，使用默认设置，后续会根据模型调整相机
    viewer = new GaussianSplats3D.Viewer({
      'rootElement': viewerContainerElement,
      'cameraUp': [0, 1, 0],
      'initialCameraPosition': [0, 1, 5], // 初始相机位置，会在加载完成后自动调整
      'initialCameraLookAt': [0, 0, 0],
      'useBuiltInControls': true,
      'selfDrivenMode': true,
      'dynamicScene': true,
      'sphericalHarmonicsDegree': 1, // 调整球谐系数的阶数
      'renderMode': GaussianSplats3D.RenderMode.Always, // 始终渲染
      'sharedMemoryForWorkers': false, // 禁用SharedArrayBuffer
      'gpuAcceleratedSort': false, // 使用CPU排序避免共享内存问题
      'controls': {
        'enableDamping': true, // 启用阻尼效果
        'dampingFactor': 0.07, // 阻尼系数
        'enablePan': true, // 启用平移
        'enableZoom': true, // 启用缩放
        'enableRotate': true // 启用旋转
      }
    });
    
    // 添加相机控制限制：适用于正面视图模型
    if (viewer.controls) {
      // 水平旋转：左右各90度，可看到左右侧面但看不到背面
      const initialAzimuth = viewer.controls.getAzimuthalAngle ? viewer.controls.getAzimuthalAngle() : 0;
      viewer.controls.minAzimuthAngle = initialAzimuth - Math.PI / 2; // 左侧限制90度
      viewer.controls.maxAzimuthAngle = initialAzimuth + Math.PI / 2; // 右侧限制90度
      
      // 垂直旋转：从顶部到水平线，可看到顶部但看不到底部
      viewer.controls.minPolarAngle = 0; // 顶部（0度，+Y轴方向）
      viewer.controls.maxPolarAngle = Math.PI / 2; // 水平线（90度）
    }
    
    // 标记rootElement，防止库在dispose时移除它
    // 通过在viewerContainerElement上添加一个标记，我们可以在cleanup中手动处理
    viewerContainerElement._manuallyManaged = true;
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeyPress);
    
    // 确保查看器启动
    viewer.start();
    
    return viewer;
  } catch (error) {
    console.error('初始化查看器失败:', error);
    throw error;
  }
}

/**
 * 更新状态信息
 * @param {string} message - 显示的信息
 * @param {Function} statusCallback - 状态回调函数
 * @param {string} type - 状态类型
 */
function updateStatus(message, statusCallback, type = 'loading') {
  if (typeof statusCallback === 'function') {
    statusCallback(message, type);
  }
  
  // 同时在控制台显示状态
  if (type === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
}

/**
 * 调整相机位置以显示完整的模型
 */
function adjustCameraToModel() {
  if (!viewer) return;
  
  const splatMesh = viewer.getSplatMesh();
  if (splatMesh && splatMesh.scenes && splatMesh.scenes[0]) {
    // 计算模型边界和中心
    const scene = splatMesh.scenes[0];
    
    // 如果模型倒置，调整方向
    if (scene.position) {
      // 检查是否应该调整模型方向
      const splatCount = splatMesh.getSplatCount();
      if (splatCount > 0) {
        // 尝试检测模型朝向和上下方向
        let yMin = Infinity, yMax = -Infinity;
        let pointCount = 0;
        // 采样部分点确定大致朝向
        const sampleSize = Math.min(splatCount, 1000); // 最多采样1000个点
        const step = Math.max(1, Math.floor(splatCount / sampleSize));
        
        // 使用三阶段策略确保获取有效的模型尺寸
        let hasValidPoints = false;
        let boundingBoxValid = false;
        
        // 创建边界框
        const boundingBox = new THREE.Box3();
        
        // 阶段1：使用场景对象的内置方法计算边界框（最快）
        try {
          // 设置一个临时边界框用于验证
          const tempBox = new THREE.Box3().setFromObject(scene);
          
          // 验证边界框是否有效
          const tempSize = new THREE.Vector3();
          tempBox.getSize(tempSize);
          const tempMaxDim = Math.max(tempSize.x, tempSize.y, tempSize.z);
          
          // 只有在边界框尺寸有效时才使用它
          if (tempMaxDim > 0 && isFinite(tempMaxDim) && 
              isFinite(tempBox.min.x) && isFinite(tempBox.max.x) && 
              isFinite(tempBox.min.y) && isFinite(tempBox.max.y) &&
              isFinite(tempBox.min.z) && isFinite(tempBox.max.z)) {
            boundingBox.copy(tempBox);
            hasValidPoints = true;
            boundingBoxValid = true;
          }
        } catch (e) {
          // 静默失败，进入下一阶段
        }
        
        // 阶段2：如果内置方法失败，尝试通过采样点计算（较慢但更可靠）
        if (!boundingBoxValid) {
          try {
            // 扩大样本量以提高准确性
            const increasedSampleSize = Math.min(splatCount, 5000); // 采样更多点
            const increasedStep = Math.max(1, Math.floor(splatCount / increasedSampleSize));
            
            // 使用临时向量和多种验证方法
            const tempVector = new THREE.Vector3();
            const pointPositions = []; // 存储有效点用于后续处理
            let validPointCount = 0;
            
            // 第一遍：收集有效点坐标
            for (let i = 0; i < splatCount; i += increasedStep) {
              try {
                const center = splatMesh.getSplatCenter(i);
                if (center && typeof center === 'object' && 
                    'x' in center && 'y' in center && 'z' in center) {
                  if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
                    // 存储Y轴范围信息
                    yMin = Math.min(yMin, center.y);
                    yMax = Math.max(yMax, center.y);
                    
                    // 存储有效点
                    pointPositions.push({x: center.x, y: center.y, z: center.z});
                    validPointCount++;
                  }
                }
              } catch (e) {
                // 忽略单个点错误
                continue;
              }
              
              // 如果已有足够多的点，提前结束
              if (validPointCount > 200) break;
            }
            
            // 第二遍：计算边界框和排除异常值
            if (validPointCount > 0) {
              hasValidPoints = true;
              
              // 排除明显的异常值
              if (validPointCount > 10) {
                // 计算点的平均位置
                let avgX = 0, avgY = 0, avgZ = 0;
                pointPositions.forEach(p => {
                  avgX += p.x;
                  avgY += p.y;
                  avgZ += p.z;
                });
                avgX /= validPointCount;
                avgY /= validPointCount;
                avgZ /= validPointCount;
                
                // 计算标准差
                let stdDevSum = 0;
                pointPositions.forEach(p => {
                  const dx = p.x - avgX;
                  const dy = p.y - avgY;
                  const dz = p.z - avgZ;
                  stdDevSum += dx*dx + dy*dy + dz*dz;
                });
                const stdDev = Math.sqrt(stdDevSum / validPointCount);
                const threshold = stdDev * 3; // 3个标准差范围
                
                // 使用非异常值点构建边界框
                pointPositions.forEach(p => {
                  const dx = p.x - avgX;
                  const dy = p.y - avgY;
                  const dz = p.z - avgZ;
                  const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  
                  // 仅包括非异常点
                  if (distance <= threshold) {
                    tempVector.set(p.x, p.y, p.z);
                    boundingBox.expandByPoint(tempVector);
                    boundingBoxValid = true;
                  }
                });
              } else {
                // 点过少时直接使用所有点
                pointPositions.forEach(p => {
                  tempVector.set(p.x, p.y, p.z);
                  boundingBox.expandByPoint(tempVector);
                });
                boundingBoxValid = true;
              }
            }
          } catch (e2) {
            // 静默失败，进入下一阶段
          }
        }
        
        // 阶段3：如果前两阶段都失败，使用更适合各种尺寸的默认边界盒
        if (!boundingBoxValid || !hasValidPoints) {
          // 使用适中的默认尺寸，便于处理各种情况
          const defaultSize = 1.0; // 使用单位尺寸1作为基础
          
          // 检查文件名来估计合理的默认尺寸
          const fileName = currentFile?.name || currentFile?.path || '';
          let sizeFactor = 1.0; // 默认使用原始大小
          
          // 根据文件名调整默认大小，但保留原始比例
          if (fileName.toLowerCase().includes('large') || 
              fileName.toLowerCase().includes('big')) {
            sizeFactor = 5.0; // 大型模型使用较大尺寸
          } else if (fileName.toLowerCase().includes('small') || 
                     fileName.toLowerCase().includes('tiny')) {
            sizeFactor = 0.2; // 小型模型使用较小尺寸
          }
          
          // 设置边界盒
          boundingBox.min.set(-defaultSize*sizeFactor/2, -defaultSize*sizeFactor/2, -defaultSize*sizeFactor/2);
          boundingBox.max.set(defaultSize*sizeFactor/2, defaultSize*sizeFactor/2, defaultSize*sizeFactor/2);
          boundingBoxValid = true;
          
          console.log(`使用默认边界盒：尺寸 ${defaultSize * sizeFactor}`);
        }
        
        // 计算模型大小和理想缩放比例
        const sizeForScaling = new THREE.Vector3();
        boundingBox.getSize(sizeForScaling);
        const maxDimForScaling = Math.max(sizeForScaling.x, sizeForScaling.y, sizeForScaling.z);
        
        // 检查计算出的尺寸是否有效
        // 完全不进行缩放，使用原始模型尺寸
        // 无论模型大小如何，都保持原始比例
        scene.scale.set(1, 1, 1); // 始终使用原始大小
        
        // 特殊处理：仅对极端尺寸模型进行缩放调整，确保可见性
        // 对于非常小的模型必须放大，否则完全看不见
        if (maxDimForScaling < 0.01) {
          // 微小模型强制放大
          const scaleUpFactor = Math.min(1.0 / maxDimForScaling, 500);
          scene.scale.multiplyScalar(scaleUpFactor);
          console.log(`特殊处理：微小模型(${maxDimForScaling})放大${scaleUpFactor}倍`);
        } else if (maxDimForScaling < 0.1) {
          // 小模型适当放大
          const scaleUpFactor = Math.min(0.5 / maxDimForScaling, 100);
          scene.scale.multiplyScalar(scaleUpFactor);
          console.log(`特殊处理：小模型(${maxDimForScaling})放大${scaleUpFactor}倍`);
        } else if (maxDimForScaling > 1000) {
          // 超大模型略微缩小
          scene.scale.multiplyScalar(0.2);
          console.log(`特殊处理：超大模型(${maxDimForScaling})缩小到20%`);
        }
        
        
        // 全面增强倒置检测和修正逻辑
        // 使用多种综合方法检测模型方向，确保正确显示
        let needsFlip = false;
        
        // 方法1: 扩展的Y轴范围分析，更敏感地检测倒置情况
        // 1.1: 基本检查 - 下方延展比上方更多
        if (yMin < -yMax && Math.abs(yMin) > 0.5) {
            needsFlip = true;
        }
        // 1.2: 增加检查 - 下方极端值远大于上方
        if (Math.abs(yMin) > Math.abs(yMax) * 2) {
            needsFlip = true;
        }
        
        // 方法2: 彻底的点分布统计分析
        let pointsBelow = 0;
        let pointsAbove = 0;
        let lowYPoints = 0;     // 非常低的点
        let highYPoints = 0;    // 非常高的点
        let centerYPoints = 0;  // 中间区域的点
        
        // 增加采样点数，确保准确性
        const sampleSizeForFlip = Math.min(splatCount, 3000); // 采样更多点
        const sampleStepForFlip = Math.max(1, Math.floor(splatCount / sampleSizeForFlip));
        
        // 计算Y轴的中值和四分位值，用于更准确的统计
        let yValues = [];
        let totalYSum = 0;
        
        // 第一遍扫描：收集Y值样本
        for (let i = 0; i < splatCount; i += sampleStepForFlip * 2) {
            try {
                const center = splatMesh.getSplatCenter(i);
                if (center && typeof center === 'object' && 'y' in center) {
                    if (isFinite(center.y)) {
                        yValues.push(center.y);
                        totalYSum += center.y;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // 计算统计指标
        const yMean = yValues.length > 0 ? totalYSum / yValues.length : 0;
        const yDeviationSum = yValues.reduce((sum, y) => sum + Math.abs(y - yMean), 0);
        const yAvgDeviation = yValues.length > 0 ? yDeviationSum / yValues.length : 1;
        
        // 第二遍扫描：详细分析点的分布
        for (let i = 0; i < splatCount; i += sampleStepForFlip) {
            try {
                const center = splatMesh.getSplatCenter(i);
                if (center && typeof center === 'object' && 'y' in center) {
                    // 基本分类：上半空间vs下半空间
                    if (center.y < 0) pointsBelow++;
                    else pointsAbove++;
                    
                    // 细分类别：极低/极高/中间
                    if (center.y < yMean - yAvgDeviation * 2) {
                        lowYPoints++;
                    } else if (center.y > yMean + yAvgDeviation * 2) {
                        highYPoints++;
                    } else {
                        centerYPoints++;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // 方法2.1: 如果下半空间点数明显多于上半空间
        if (pointsBelow > pointsAbove * 1.25 && pointsBelow > 50) {
            needsFlip = true;
        }
        
        // 方法2.2: 如果极低区域点数明显多于极高区域
        if (lowYPoints > highYPoints * 1.5 && lowYPoints > centerYPoints * 0.8) {
            needsFlip = true;
        }
        
        // 方法3: 观察模型的"底部密度"
        // 假设大多数模型底部比顶部更密集
        // 计算最低20%和最高20%区域的点密度
        
        // 如果底部明显比顶部密集，但Y值显示底部在上方，则需要翻转
        if (lowYPoints > 100 && lowYPoints > highYPoints * 1.2 && yMean < 0) {
            needsFlip = true;
        }
        
        // 方法4: 获取当前模型名称，对特殊模型进行专门处理
        const currentFilePath = currentFile?.path || currentFile?.name || '';
        if (currentFilePath.toLowerCase().includes('landscape') || 
            currentFilePath.toLowerCase().includes('terrain') ||
            currentFilePath.toLowerCase().includes('scan')) {
            // 对于地形模型或扫描模型，使用更严格的检测
            if (pointsBelow > pointsAbove * 1.1) {
                needsFlip = true;
            }
        }
        
        // 执行翻转
        if (needsFlip) {
            // 使用沿X轴180度旋转实现模型翻转
            scene.rotation.x = Math.PI;
            
            // 调整Y轴位置确保正确居中
            scene.position.y = -scene.position.y;
            
            // 修正后再次更新包围盒
            boundingBox.setFromObject(scene);
        }
        
        // 计算边界盒的大小和中心
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // 始终进行居中操作，确保模型处于场景中心
        // 使用更严格的居中阈值，即使轻微偏移也进行校正
        scene.position.sub(center);
        
        // 在缩放之后进行一次额外的居中确认
        // 获取模型当前的世界坐标边界
        const updatedBox = new THREE.Box3().setFromObject(scene);
        const updatedCenter = new THREE.Vector3();
        updatedBox.getCenter(updatedCenter);
        
        // 如果中心点不在(0,0,0)附近，进行第二次校正
        if (updatedCenter.length() > 0.05) {
            scene.position.sub(updatedCenter);
        }
        
        // 更新模型边界以便后续计算
        boundingBox.setFromObject(scene);
        boundingBox.getCenter(center);
        
        // 调整相机位置以适配整个模型 - 使用与重置视角一致的配置
        const cameraMaxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const diagonal = Math.sqrt(modelSize.x * modelSize.x + modelSize.y * modelSize.y + modelSize.z * modelSize.z);
        
        // 安全地计算相机距离
        try {
          const fov = viewer.camera.fov * (Math.PI / 180);
          
          // 防止NaN和无穷大
          let distance = 0;
          if (isFinite(diagonal) && diagonal > 0 && isFinite(fov) && fov > 0) {
            distance = Math.abs(diagonal / (2 * Math.tan(fov / 2))) * 2.0;
          } else {
            distance = 20; // 默认相机距离
          }
          
          // 调整相机距离，使原始尺寸的模型能完整显示在视野内
          // 根据模型的真实大小自动调整相机距离
          const minDistance = Math.max(diagonal * 2, 5); // 确保距离足够远以查看整个模型
          const maxDistance = Math.min(diagonal * 10, 1000); // 允许非常远的视距以适应大型模型
          
          // 根据原始模型尺寸计算适当的距离
          // 针对不同尺寸的模型选择合适的相机位置
          let finalDistance;
          
          if (diagonal > 100) {
              // 特大模型
              finalDistance = diagonal * 2; // 减小相机距离，让大模型更近
          } else if (diagonal > 10) {
              // 中等模型
              finalDistance = diagonal * 3;
          } else if (diagonal < 0.01) {
              // 极微小模型（很难看见的）
              finalDistance = 1; // 使用固定近距离
          } else if (diagonal < 0.1) {
              // 微小模型（很小但可见）
              finalDistance = 2; // 使用固定近距离
          } else if (diagonal < 1.0) {
              // 小尺寸模型
              finalDistance = 3; // 使用固定近距离
          } else {
              // 普通尺寸模型
              finalDistance = Math.max(diagonal * 3, minDistance);
          }
          
          // 对于极小模型，强制使用近距离
          if (maxDimForScaling < 0.1) {
              console.log(`为小模型(${maxDimForScaling})调整相机距离: ${finalDistance}`);
          }
          
          // 确保相机距离在合理范围内
          finalDistance = Math.max(Math.min(finalDistance, maxDistance), minDistance);
          
          // 将相机指向模型中心
          if (viewer.controls) {
            viewer.controls.target.copy(center);
          }
          
          // 使用更佳的观察角度，视角略微降低以便更好地观察放大后的模型
          // 调整观察角度，使其更接近人眼自然观察物体的习惯
          // x增大：更偏向侧面观察；y减小：降低观察角度；z保持：确保正面视图
          const cameraDirection = new THREE.Vector3(1.2, 0.6, 1).normalize();
          viewer.camera.position.copy(center).addScaledVector(cameraDirection, finalDistance);
          viewer.camera.lookAt(center);
          
          // 强制更新相机
          viewer.camera.updateProjectionMatrix();
        } catch (e) {
          console.warn('设置相机位置出错:', e);
          // 设置为默认相机位置
          if (viewer.controls) {
            viewer.controls.target.set(0, 0, 0);
          }
          viewer.camera.position.set(5, 5, 5);
          viewer.camera.lookAt(0, 0, 0);
        }
        
        // 如果使用内置控制器，更新它们
        if (viewer.controls) {
          viewer.controls.update();
        }
      }
    }
    
    // 强制更新和重新渲染
    viewer.forceRenderNextFrame();
    viewer.update();
    viewer.render();
  }
}

/**
 * 处理键盘事件
 * @param {KeyboardEvent} event - 键盘事件对象
 */
function handleKeyPress(event) {
  if (!viewer) return;
  
  // 只保留调试信息按钮(I键)
  if (event.key.toLowerCase() === 'i') {
    // 显示调试信息
    const pos = viewer.camera.position;
    const splatCount = viewer.getSplatMesh().getSplatCount();
    const debugInfo = `调试信息:\n相机位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n场景对象数: ${viewer.threeScene ? viewer.threeScene.children.length : 0}\n点云点数: ${splatCount.toLocaleString()}`;
    showDebugMessage(debugInfo);
  }
}

/**
 * 显示调试信息
 * @param {string} message - 显示的信息
function showDebugMessage(message) {
  const overlayId = 'debug-overlay';
  let overlay = document.getElementById(overlayId);
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.position = 'absolute';
    overlay.style.top = '10px';
    overlay.style.left = '10px';
    overlay.style.padding = '10px';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.color = 'white';
    overlay.style.borderRadius = '5px';
    overlay.style.fontFamily = 'monospace';
    overlay.style.whiteSpace = 'pre-line';
    overlay.style.zIndex = '1000';
    overlay.style.backdropFilter = 'blur(15px)';
    overlay.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    document.body.appendChild(overlay);
  }
  
  overlay.textContent = message;
  
  // 5秒后自动隐藏
  setTimeout(() => {
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }, 5000);
}

/**
 * 清理高斯点云查看器资源
 * @returns {Promise} - 返回Promise对象
 */
export function cleanup() {
  return new Promise((resolve) => {
    // 添加超时保护，确保即使出现未处理的错误也能返回
    const timeoutId = setTimeout(() => {
      console.warn('清理操作超时，强制完成');
      // 重置关键变量
      viewer = null;
      currentFile = null;
      resolve();
    }, 3000); // 3秒后超时
    
    try {
      // 清理PLY控制功能
      if (PlyControls && PlyControls.cleanup) {
        try {
          PlyControls.cleanup();
        } catch (e) {
          console.warn('清理PLY控制功能时出错', e);
        }
      }
    
    // 如果存在高斯点云查看器，销毁它
    if (viewer) {
      try {
        // 先停止渲染循环，确保没有正在进行的渲染任务
        if (viewer.selfDrivenModeRunning) {
          try {
            viewer.stop();
          } catch (stopError) {
            console.warn('停止渲染循环失败', stopError);
          }
        }
        
        // 延迟一点再移除DOM元素，确保渲染循环完全停止
        setTimeout(() => {
          // 安全地移除可能的DOM元素
          try {
            const viewerContainer = document.getElementById('viewer-container');
            
            // 保存更详细的状态以便调试
            const containerExists = !!viewerContainer;
            const hasParentNode = containerExists && !!viewerContainer.parentNode;
            const parentNodeIsValid = hasParentNode && !!viewerContainer.parentNode.removeChild;
            
            // 容器状态检查
            
            // 只有当容器存在且有有效的父节点时才尝试移除
            if (containerExists && hasParentNode && parentNodeIsValid) {
              try {
                // 使用try-catch确保即使删除失败也能继续
                viewerContainer.parentNode.removeChild(viewerContainer);
              } catch (removeError) {
                console.warn('移除查看器容器时出错', removeError);
                
                // 备用移除方式
                try {
                  // 尝试使用Element.remove()方法
                  viewerContainer.remove();
                  console.log('使用备用方法成功移除查看器容器');
                } catch (backupRemoveError) {
                  // 最后尝试通过设置style.display隐藏元素
                  console.warn('备用移除也失败，改为隐藏元素', backupRemoveError);
                  viewerContainer.style.display = 'none';
                }
              }
            } else if (containerExists) {
              // 查看器容器没有有效的父节点，改为隐藏元素
              viewerContainer.style.display = 'none';
            } else {
              // 查看器容器不存在，无需移除
            }
          } catch (containerError) {
            console.warn('处理查看器容器时发生错误', containerError);
          }
          
          // 尝试移除和处理场景
          try {
            // 首先检查viewer是否存在并且有效
            if (viewer) {
              // 获取rootElement引用（在dispose之前）
              const rootElement = document.getElementById('viewer-container');
              
              // 安全地检查和移除场景
              try {
                if (viewer.getSceneCount && typeof viewer.getSceneCount === 'function') {
                  const sceneCount = viewer.getSceneCount();
                  if (sceneCount > 0) {
                    try {
                      viewer.removeSplatScene(0);
                    } catch (sceneError) {
                      console.warn('移除场景失败，但这通常不是问题:', sceneError);
                    }
                  }
                }
                
                // 销毁查看器前，先清理所有可能的UI元素
                try {
                  // 移除所有可能的进度条和加载UI
                  const uiSelectors = [
                    '.progressBarOuterContainer',
                    '.progressBarBox',
                    '.loading-progress',
                    '.progress-container',
                    '[class*="progress"]'
                  ];
                  
                  uiSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                      try {
                        // 检查元素是否还在DOM中
                        if (el && el.parentNode && document.body.contains(el)) {
                          el.parentNode.removeChild(el);
                        }
                      } catch (e) {
                        // 静默失败
                      }
                    });
                  });
                } catch (uiCleanupError) {
                  // 静默失败
                }
                
                // 临时将rootElement移到document.body下，让库能正确dispose
                let originalParent = null;
                let shouldRestoreParent = false;
                
                if (rootElement && rootElement.parentNode !== document.body) {
                  originalParent = rootElement.parentNode;
                  shouldRestoreParent = true;
                  try {
                    // 暂时移到body下
                    document.body.appendChild(rootElement);
                  } catch (moveError) {
                    // 如果移动失败，标记不需要恢复
                    shouldRestoreParent = false;
                  }
                }
                
                // 销毁查看器
                if (typeof viewer.dispose === 'function') {
                  try {
                    viewer.dispose();
                  } catch (disposeError) {
                    // 忽略DOM相关的错误（主要是removeChild错误）
                    if (disposeError.name !== 'NotFoundError' && 
                        disposeError.name !== 'HierarchyRequestError' &&
                        !disposeError.message.includes('removeChild') &&
                        !disposeError.message.includes('not a child')) {
                      console.warn('销毁查看器时出现问题:', disposeError);
                    }
                    // DOM错误静默忽略，因为我们会手动清理
                  }
                }
                
                // 无论dispose是否成功，手动清理rootElement
                if (rootElement && rootElement.parentNode) {
                  try {
                    rootElement.parentNode.removeChild(rootElement);
                  } catch (cleanupError) {
                    // 静默失败
                  }
                }
              } catch (viewerError) {
                console.warn('处理查看器时出错，但程序将继续:', viewerError);
              }
            } else {
              // 查看器已经是null，无需清理
            }
          } catch (e) {
            console.error('销毁高斯点云查看器资源时出错', e);
          }
          
          viewer = null;
          currentFile = null;
          
          // 如果存在原始animate函数，恢复它
          if (window.originalAnimate) {
            if (typeof window.originalAnimate === 'function') {
              // 恢复原始动画循环
              requestAnimationFrame(window.originalAnimate);
            }
            window.originalAnimate = null;
          }
          
          // 恢复原始canvas显示
          const originalCanvas = document.getElementById('model-canvas');
          if (originalCanvas) {
            originalCanvas.style.display = 'block';
          }
          
          // 移除事件监听器
          document.removeEventListener('keydown', handleKeyPress);
          
          // 清除超时定时器并完成Promise
          clearTimeout(timeoutId);
          resolve();
        }, 300); // 增加延迟时间确保异步操作完成
      } catch (e) {
        console.error('销毁高斯点云查看器出错', e);
        viewer = null;
        currentFile = null;
        // 清除超时定时器并完成Promise
        clearTimeout(timeoutId);
        resolve();
      }
    } else {
      // 清除超时定时器并完成Promise
      clearTimeout(timeoutId);
      resolve();
    }
    
    } catch (fatalError) {
      console.error('清理过程中发生严重错误', fatalError);
      // 重置关键变量
      viewer = null;
      currentFile = null;
      // 清除超时定时器并完成Promise
      clearTimeout(timeoutId);
      resolve();
    }
  });
}

/**
 * 获取当前查看器实例
 * @returns {Object|null} 查看器实例或null
 */
export function getViewer() {
  return viewer;
}

// 暴露模块接口
export default {
  loadPlyModel,
  cleanup,
  getViewer
};