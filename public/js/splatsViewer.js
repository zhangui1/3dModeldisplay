// splatsViewer.js - 专门处理其他高斯点云格式(splat、ksplat、spz)的模块
// 基于GaussianSplats3D库实现，与build目录中的实现完全一致

import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

// 全局变量
let viewer = null;
let currentFile = null;

/**
 * 加载其他高斯点云格式模型（splat、ksplat、spz）
 * @param {string} path - 模型文件路径或File对象
 * @param {string|number} modelId - 模型ID，用于标识
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadSplatModel(path, modelId, onProgress, options = {}) {
  const { 
    onSuccess = () => {},
    onError = () => {},
    showLoading = () => {},
    hideLoading = () => {},
    onCleanup = () => {},
    format = null // 可选的格式参数，如果未提供则从文件扩展名推断
  } = options;
  
  return new Promise(async (resolve, reject) => {
    try {
      console.log('开始加载高斯点云模型:', path);
      
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
        
        // 如果提供了format参数，则使用它，否则从文件扩展名推断
        fileType = format || fileType;
        
        // 检查文件类型，确定加载格式
        let splatFormat;
        if (fileType === 'splat') {
          splatFormat = GaussianSplats3D.SceneFormat.Splat;
        } else if (fileType === 'ksplat') {
          splatFormat = GaussianSplats3D.SceneFormat.KSplat;
        } else if (fileType === 'spz') {
          splatFormat = GaussianSplats3D.SceneFormat.Spz;
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
          'format': splatFormat, // 显式指定文件格式
          'progressiveLoad': fileType === 'splat' || fileType === 'ksplat',
          'showLoadingUI': false,
          'splatAlphaRemovalThreshold': 5, // 透明度阈值
          'onProgress': (progress) => {
            // 静默加载，不显示任何加载提示
            if (onProgress) {
              onProgress({ lengthComputable: true, loaded: progress, total: 100 });
            }
          }
        });
        
        // 强制立即渲染一次
        viewer.forceRenderNextFrame();
        
        // 确保查看器已启动
        if (!viewer.selfDrivenModeRunning) {
          viewer.start();
        }
        
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
 * 根据文件格式选择加载方法
 * @param {string} path - 模型文件路径或File对象
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadByFormat(path, modelId, format, onProgress, options = {}) {
  format = format.toLowerCase();
  
  if (format === 'splat' || format === 'ksplat' || format === 'spz') {
    return loadSplatModel(path, modelId, onProgress, { ...options, format });
  } else {
    return Promise.reject(new Error(`splatsViewer不支持的格式: ${format}`));
  }
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
    
    // 创建GaussianSplats3D查看器，与build中的配置完全相同
    viewer = new GaussianSplats3D.Viewer({
      'rootElement': viewerContainerElement,
      'cameraUp': [0, 1, 0],
      'initialCameraPosition': [0, 2, 8],
      'initialCameraLookAt': [0, 0, 0],
      'useBuiltInControls': true,
      'selfDrivenMode': true,
      'dynamicScene': true,
      'sphericalHarmonicsDegree': 1, // 调整球谐系数的阶数
      'renderMode': GaussianSplats3D.RenderMode.Always, // 始终渲染
      'sharedMemoryForWorkers': false, // 禁用SharedArrayBuffer
      'gpuAcceleratedSort': false // 使用CPU排序避免共享内存问题
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
        
         // 遍历点采样
         for (let i = 0; i < splatCount; i += step) {
           const center = splatMesh.getSplatCenter(i, true);
           if (center) {
             yMin = Math.min(yMin, center.y);
             yMax = Math.max(yMax, center.y);
             pointCount++;
           }
           if (pointCount >= sampleSize) break;
         }
         
         // 获取模型的边界框
         const boundingBox = new THREE.Box3();
         const tempVector = new THREE.Vector3();
         
         for (let i = 0; i < splatCount; i += step) {
           const center = splatMesh.getSplatCenter(i, true);
           if (center) {
             tempVector.copy(center);
             boundingBox.expandByPoint(tempVector);
           }
           if (i/step >= sampleSize) break;
        }
        
        // 检查模型是否倒置并调整
        if (yMin < -yMax && Math.abs(yMin) > 1) {
          // 模型可能倒置，旋转180度
          scene.rotation.x = Math.PI;
          scene.position.y = -scene.position.y;
          console.log('已自动校正模型方向');
        }
        
        // 计算边界盒的大小和中心
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // 调整相机位置以适配整个模型
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2; // 设置适当的距离，以确保整个模型可见
        
        // 将相机指向模型中心
        if (viewer.controls) {
          viewer.controls.target.copy(center);
        }
        
        // 调整相机位置
        const cameraDirection = new THREE.Vector3(1, 0.5, 1).normalize();
        viewer.camera.position.copy(center).addScaledVector(cameraDirection, distance);
        viewer.camera.lookAt(center);
        
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
    const debugInfo = `调试信息:\n相机位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n场景对象数: ${viewer.threeScene ? viewer.threeScene.children.length : 0}\n点数: ${splatCount.toLocaleString()}`;
    showDebugMessage(debugInfo);
  }
}

/**
 * 显示调试信息
 * @param {string} message - 显示的信息
 */
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
    // 如果存在高斯点云查看器，销毁它
    if (viewer) {
      try {
        // 安全地移除可能的DOM元素
        const viewerContainer = document.getElementById('viewer-container');
        if (viewerContainer) {
          try {
            // 使用更安全的方式移除元素
            viewerContainer.remove();
          } catch (e) {
            console.warn('无法直接移除查看器容器，尝试使用removeChild', e);
            try {
              // 备用方法，如果元素真的有父节点
              if (viewerContainer.parentNode) {
                viewerContainer.parentNode.removeChild(viewerContainer);
              }
            } catch (e2) {
              console.warn('移除查看器容器失败，可能已被其他代码移除', e2);
            }
          }
        }
        
        // 确保先停止渲染循环
        if (viewer.selfDrivenModeRunning) {
          viewer.stop();
        }
        
        // 使用setTimeout允许渲染循环完全停止后再处理销毁
        setTimeout(() => {
          try {
            // 获取rootElement引用（在dispose之前）
            const rootElement = document.getElementById('viewer-container');
            
            // 如果有场景，先尝试移除
            if (viewer.getSceneCount && viewer.getSceneCount() > 0) {
              try {
                viewer.removeSplatScene(0);
              } catch (sceneError) {
                console.warn('移除场景失败:', sceneError);
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
            try {
              viewer.dispose();
              console.log('高斯点云查看器已销毁');
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
            
            // 无论dispose是否成功，手动清理rootElement
            if (rootElement && rootElement.parentNode) {
              try {
                rootElement.parentNode.removeChild(rootElement);
              } catch (cleanupError) {
                // 静默失败
              }
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
          
          resolve();
        }, 100);
      } catch (e) {
        console.error('销毁高斯点云查看器出错', e);
        viewer = null;
        currentFile = null;
        resolve();
      }
    } else {
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
  loadSplatModel,
  loadByFormat,
  cleanup,
  getViewer
};
