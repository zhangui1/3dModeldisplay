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
      
      // 创建一个专用的查看器容器
      const viewerContainer = document.createElement('div');
      viewerContainer.id = 'viewer-container';
      viewerContainer.style.position = 'absolute';
      viewerContainer.style.top = '0';
      viewerContainer.style.left = '0';
      viewerContainer.style.width = '100%';
      viewerContainer.style.height = '100%';
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
          'progressiveLoad': fileType === 'ply' || fileType === 'splat' || fileType === 'ksplat',
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
    // 创建GaussianSplats3D查看器，使用默认设置，后续会根据模型调整相机
    viewer = new GaussianSplats3D.Viewer({
      'rootElement': document.getElementById('viewer-container'),
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
        'minPolarAngle': 0, // 允许从任意角度查看
        'maxPolarAngle': Math.PI, // 允许从任意角度查看
        'minAzimuthAngle': -Infinity, // 允许无限制水平旋转
        'maxAzimuthAngle': Infinity, // 允许无限制水平旋转
        'enableDamping': true, // 启用阻尼效果
        'dampingFactor': 0.07, // 阻尼系数
        'enablePan': true, // 启用平移
        'enableZoom': true, // 启用缩放
        'enableRotate': true // 启用旋转
      }
    });
    
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
        
        // 使用更安全的方式获取点云数据
        let hasValidPoints = false;
        
        // 创建边界框并直接使用场景对象计算
        const boundingBox = new THREE.Box3();
        try {
          // 尝试直接从场景计算边界框
          boundingBox.setFromObject(scene);
          hasValidPoints = true;
          console.log('通过场景对象计算边界框成功');
        } catch (e) {
          console.warn('通过场景对象计算边界框失败:', e);
          
          // 如果直接计算失败，尝试遍历点云
          try {
            // 备用方式：遍历点采样
            const tempVector = new THREE.Vector3();
            let validPointCount = 0;
            
            for (let i = 0; i < splatCount; i += step) {
              try {
                // 安全地获取点位置
                const center = splatMesh.getSplatCenter(i);
                if (center && typeof center === 'object' && 
                    'x' in center && 'y' in center && 'z' in center) {
                  // 检查值的有效性
                  if (isFinite(center.x) && isFinite(center.y) && isFinite(center.z)) {
                    yMin = Math.min(yMin, center.y);
                    yMax = Math.max(yMax, center.y);
                    tempVector.set(center.x, center.y, center.z);
                    boundingBox.expandByPoint(tempVector);
                    validPointCount++;
                    hasValidPoints = true;
                  }
                }
              } catch (e) {
                // 忽略单个点的错误，继续处理其他点
              }
              
              pointCount++;
              if (pointCount >= sampleSize || validPointCount > 100) break;
            }
            
            console.log(`通过点采样计算边界框: 成功获取${validPointCount}个有效点`);
          } catch (e2) {
            console.warn('点采样计算边界框完全失败:', e2);
          }
        }
        
        // 如果没有有效点，使用默认边界框
        if (!hasValidPoints) {
          console.warn('无法获取有效点数据，使用默认边界框');
          boundingBox.min.set(-10, -10, -10);
          boundingBox.max.set(10, 10, 10);
        }
        
        // 计算模型大小和理想缩放比例
        const sizeForScaling = new THREE.Vector3();
        boundingBox.getSize(sizeForScaling);
        const maxDimForScaling = Math.max(sizeForScaling.x, sizeForScaling.y, sizeForScaling.z);
        
        // 检查计算出的尺寸是否有效
        if (maxDimForScaling <= 0 || !isFinite(maxDimForScaling)) {
          console.warn('计算模型尺寸出错，使用默认值');
          // 使用默认的缩放比例而不是基于尺寸计算
          scene.scale.set(1, 1, 1); // 使用原始大小
        } else {
          // PLY高斯点云模型通常偏大，需要缩小
          const idealSize = 10; // 理想尺寸
          
          // 安全计算缩放因子，避免除以零和无穷大
          let scaleFactor = 1.0; // 默认不缩放
          
          if (maxDimForScaling > 20) {
            // 计算缩放因子，缩小模型
            scaleFactor = idealSize / maxDimForScaling;
            // 限制缩放因子在合理范围
            scaleFactor = Math.max(0.01, Math.min(scaleFactor, 1.0));
            // 应用缩放
            scene.scale.multiplyScalar(scaleFactor);
            // 高斯点云模型缩小
          } else if (maxDimForScaling < 5 && maxDimForScaling > 0.1) {
            // 如果模型过小但不是极小值，适当放大
            scaleFactor = Math.min(idealSize / maxDimForScaling, 10); // 限制最大放大倍数为10倍
            scene.scale.multiplyScalar(scaleFactor);
            // 高斯点云模型放大
          }
        }
        
        // 检查模型是否倒置并调整
        if (yMin < -yMax && Math.abs(yMin) > 1) {
          // 模型可能倒置，旋转180度
          scene.rotation.x = Math.PI;
          scene.position.y = -scene.position.y;
          console.log('已自动校正模型方向');
        }
        
        // 计算边界盒的大小和中心
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // 确保模型居中
        if (Math.abs(center.x) > 0.1 || Math.abs(center.y) > 0.1 || Math.abs(center.z) > 0.1) {
          // 调整位置使模型居中
          scene.position.sub(center);
          console.log('已将高斯点云模型居中:', scene.position);
          // 更新模型边界
          boundingBox.setFromObject(scene);
          boundingBox.getCenter(center);
        }
        
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
          
          // 限制在合理范围内
          const finalDistance = Math.max(Math.min(distance, 100), 5);
          
          console.log('设置相机距离:', finalDistance);
          
          // 将相机指向模型中心
          if (viewer.controls) {
            viewer.controls.target.copy(center);
          }
          
          // 使用更可靠的相机位置
          const cameraDirection = new THREE.Vector3(1, 0.8, 1).normalize();
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
                
                // 销毁查看器
                if (typeof viewer.dispose === 'function') {
                  try {
                    viewer.dispose();
                  } catch (disposeError) {
                    console.warn('销毁查看器时出现问题，但程序将继续:', disposeError);
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