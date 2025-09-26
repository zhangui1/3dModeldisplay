// main.js — 多格式3D模型加载器（支持 OBJ / PLY / SPLAT / KSPLAT / SPZ / GLB / GLTF / STL / FBX / SOG）
// 引入模块
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as PlyViewer from './plyViewer.js';
import * as SplatsViewer from './splatsViewer.js';
import * as StandardViewer from './standardViewer.js';

// 场景、相机、渲染器和控制器
let scene, camera, renderer, controls;
let models = [];
let currentModelIndex = 0;
let loadedModels = {};
let isLoading = false;
let autoRotate = true; // 默认开启自动旋转
let wireframeMode = false;

// 控制按钮状态
const BUTTON_STATES = {
  autoRotate: true,
  fullscreen: false
};

const CONFIG = {
  modelView: { 
    autoRotateSpeed: 0.3, // 正值表示从右到左顺时针旋转，调整为更符合人类习惯的速度
    minDistance: 0.1, 
    maxDistance: 5000 
  },
  safety: { defaultSphereRadius: 10, defaultBoxSize: 20 }
};

window.addEventListener('load', init);
window.addEventListener('resize', onWindowResize);
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function init() {
  // 添加加载动画
  showLoading();
  
  // 初始化自动旋转状态
  autoRotate = true; // 默认开启自动旋转
  
  initScene();
  loadModelsList().then(() => {
    if (models.length) {
      createThumbnails();
      loadModel(models[currentModelIndex]);
      updateModelInfo(models[currentModelIndex]);
    }
  });

  // 初始化控制按钮
  initControlButtons();
  
  // 注意：语言切换已移至languageSwitch.js单独处理
}

function showLoading(text = '加载中...') {
  let loadingOverlay = document.querySelector('.loading-overlay');
  
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    
    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(loadingText);
    document.body.appendChild(loadingOverlay);
  }
  
  document.querySelector('.loading-text').textContent = text;
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

function initControlButtons() {
  // 导航控制
  const prev = document.getElementById('prev-model');
  const next = document.getElementById('next-model');
  if (prev) prev.addEventListener('click', showPreviousModel);
  if (next) next.addEventListener('click', showNextModel);
  
  // 模型控制面板
  resetControlButtons();
  
  // 键盘快捷键
  window.addEventListener('keydown', (e) => {
    if (e.key === 'w') toggleWireframeMode();
    if (e.key === 'r') toggleAutoRotate();
    if (e.key === 'c') resetCameraForCurrentModel();
    if (e.key === 'f') toggleFullscreen();
  });
}

// 重置控制按钮，确保事件监听器正确绑定
function resetControlButtons() {
  const autoRotateBtn = document.getElementById('auto-rotate');
  const resetCameraBtn = document.getElementById('reset-camera');
  const fullscreenBtn = document.getElementById('fullscreen');
  
  // 移除可能存在的旧事件监听器 - 通过克隆元素实现
  if (autoRotateBtn) {
    const newAutoRotateBtn = autoRotateBtn.cloneNode(true);
    if (autoRotateBtn.parentNode) {
      autoRotateBtn.parentNode.replaceChild(newAutoRotateBtn, autoRotateBtn);
      newAutoRotateBtn.addEventListener('click', () => {
        // 变化按钮视觉状态
        if (!autoRotate) {
          newAutoRotateBtn.classList.add('active');
          newAutoRotateBtn.style.backgroundColor = '#1e88e5';
        } else {
          newAutoRotateBtn.classList.remove('active');
          newAutoRotateBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
        
        // 切换自动旋转状态
        toggleAutoRotate();
      });
    }
    
    // 初始状态设置
    updateAutoRotateButtonState();
  }
  
  if (resetCameraBtn) {
    const newResetCameraBtn = resetCameraBtn.cloneNode(true);
    if (resetCameraBtn.parentNode) {
      resetCameraBtn.parentNode.replaceChild(newResetCameraBtn, resetCameraBtn);
      newResetCameraBtn.addEventListener('click', () => {
        // 按下按钮时变为蓝色背景
        newResetCameraBtn.classList.add('active');
        newResetCameraBtn.style.backgroundColor = '#1e88e5';
        
        // 重置相机视角
        resetCameraForCurrentModel();
        
        // 一段时间后恢复按钮样式
        setTimeout(() => {
          newResetCameraBtn.classList.remove('active');
          newResetCameraBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }, 300);
      });
    }
  }
  
  if (fullscreenBtn) {
    const newFullscreenBtn = fullscreenBtn.cloneNode(true);
    if (fullscreenBtn.parentNode) {
      fullscreenBtn.parentNode.replaceChild(newFullscreenBtn, fullscreenBtn);
      newFullscreenBtn.addEventListener('click', () => {
        // 切换全屏前改变按钮视觉状态
        if (!document.fullscreenElement) {
          newFullscreenBtn.classList.add('active');
          newFullscreenBtn.style.backgroundColor = '#1e88e5';
        } else {
          newFullscreenBtn.classList.remove('active');
          newFullscreenBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
        
        // 切换全屏
        toggleFullscreen();
      });
    }
  }
  
  console.log('控制按钮已重置并绑定事件');
}

// 为当前模型重置相机
function resetCameraForCurrentModel() {
  const m = loadedModels[models[currentModelIndex]?.id];
  if (m && m.object) {
    console.log('重置相机视角', m);
    resetCameraForModel(m.object);
  } else if (m && m.type === 'gaussian-splats' && m.viewer) {
    // 如果是高斯点云模型，使用其专用的重置函数
    console.log('重置高斯点云相机视角');
    const plyControls = PlyViewer.getViewer();
    if (plyControls && typeof plyControls.resetCameraView === 'function') {
      plyControls.resetCameraView();
    }
  } else {
    console.warn('找不到当前模型，无法重置视角');
  }
}

// 语言切换功能已移至languageSwitch.js
function initLanguageSwitch() {
  console.log('语言切换功能已移至languageSwitch.js');
  // 此函数保留为空以保持兼容性，实际功能在languageSwitch.js中实现
}

function toggleFullscreen() {
  // 获取模型容器 - 根据模型类型选择合适的容器
  let container;
  
  // 判断当前模型类型
  const m = loadedModels[models[currentModelIndex]?.id];
  if (m && m.type === 'gaussian-splats') {
    // 高斯点云模型使用专用容器
    container = document.getElementById('viewer-container');
  } 
  
  // 如果没有找到专用容器，使用默认的模型容器
  if (!container) {
    container = document.querySelector('.model-container') || document.getElementById('model-canvas');
  }
  
  if (!container) {
    console.error('找不到可全屏的容器');
    return;
  }
  
  // 获取全屏按钮
  const fullscreenBtn = document.getElementById('fullscreen');
  
  if (!document.fullscreenElement) {
    // 进入全屏
    console.log('进入全屏模式', container);
    try {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
      
      // 更新按钮样式
      if (fullscreenBtn) {
        fullscreenBtn.classList.add('active');
        fullscreenBtn.style.backgroundColor = '#1e88e5';
      }
    } catch (e) {
      console.error('进入全屏失败:', e);
    }
  } else {
    // 退出全屏
    console.log('退出全屏模式');
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      
      // 更新按钮样式
      if (fullscreenBtn) {
        fullscreenBtn.classList.remove('active');
        fullscreenBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      }
    } catch (e) {
      console.error('退出全屏失败:', e);
    }
  }
  
  // 全屏切换后重新渲染
  setTimeout(() => {
    // 重新调整大小
    onWindowResize();
    // 强制重新渲染一次
    if (renderer) renderer.render(scene, camera);
  }, 300);
}

// 处理全屏变化事件
function handleFullscreenChange() {
  const fullscreenBtn = document.getElementById('fullscreen');
  if (!fullscreenBtn) return;
  
  if (document.fullscreenElement) {
    // 进入全屏状态
    fullscreenBtn.classList.add('active');
    fullscreenBtn.style.backgroundColor = '#1e88e5';
    BUTTON_STATES.fullscreen = true;
  } else {
    // 退出全屏状态
    fullscreenBtn.classList.remove('active');
    fullscreenBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    BUTTON_STATES.fullscreen = false;
  }
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  
  // 检测是否为移动设备，以便进行性能优化
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 0, 5);

  const canvas = document.getElementById('model-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 根据设备性能调整像素比
  const pixelRatio = Math.min(window.devicePixelRatio, 2); // 限制最大像素比为2，以避免性能问题
  renderer.setPixelRatio(pixelRatio);
  // 使用新版THREE.js的颜色空间设置
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // 增强光照系统以提供更适合的模型展示效果
  // 主环境光照，模拟天空反射
  const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x202530, 0.6);
  scene.add(hemiLight);
  
  // 主光源，头顶斜上方光照，提供主要光照和阴影
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.7);
  mainLight.position.set(1, 3, 2);
  mainLight.castShadow = true; // 启用阴影投射
  // 设置阴影参数以提高质量
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.1;
  mainLight.shadow.camera.far = 500;
  scene.add(mainLight);
  
  // 辅助光源，用于补光与边缘照亮
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-2, -1, 1);
  scene.add(fillLight);
  
  // 第三个光源，用于从侧面照亮，增强立体感
  const sideLight = new THREE.DirectionalLight(0xffffee, 0.4);
  sideLight.position.set(2, 0, -1);
  scene.add(sideLight);
  
  // 环境光，提供更好的基础光照
  const ambientLight = new THREE.AmbientLight(0x404050, 0.5);
  scene.add(ambientLight);
  
  // 启用渲染器的阴影功能
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 软阴影

  // 初始化OrbitControls 使用ES模块方式
  try {
    // 直接使用导入的OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = CONFIG.modelView.minDistance;
    controls.maxDistance = CONFIG.modelView.maxDistance;
    controls.autoRotate = autoRotate; // 确保自动旋转开启
    controls.autoRotateSpeed = CONFIG.modelView.autoRotateSpeed; // 使用负值实现从左到右逆时针旋转
    
    // 提供全角度的360度旋转控制，允许用户从任何角度观察模型
    controls.minPolarAngle = 0; // 允许完全的上方观察
    controls.maxPolarAngle = Math.PI; // 允许完全的下方观察
    controls.enablePan = true; // 启用平移
    controls.enableZoom = true; // 启用缩放
    controls.enableRotate = true; // 启用旋转
    controls.minAzimuthAngle = -Infinity; // 无水平旋转限制
    controls.maxAzimuthAngle = Infinity; // 无水平旋转限制
    
    // 设置初始相机位置为正面观察 - 正对模型
    camera.position.set(0, 1, 5); // 使用Z轴作为正视方向，Y轴向上，略微从上方观察
    controls.update();
  } catch (e) {
    console.error('OrbitControls初始化失败', e);
    controls = {
      update: function() {},  // 提供一个空的update方法以避免错误
      target: new THREE.Vector3(),
      autoRotate: false
    };
  }

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  
  // 确保每帧都检查自动旋转状态
  if (controls) {
    controls.autoRotate = autoRotate;
    controls.update();
  }
  
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

async function loadModelsList() {
  try {
    const res = await fetch('/api/models', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    models = await res.json();
  } catch (e) {
    console.warn('无法获取模型列表', e);
    models = [];
  }
}

function showLoadingIndicator(text = '加载中...') {
  removeLoading();
  const d = document.createElement('div');
  d.id = 'loading-indicator';
  d.textContent = text;
  d.style.position = 'absolute';
  d.style.left = '50%';
  d.style.top = '50%';
  d.style.transform = 'translate(-50%,-50%)';
  d.style.padding = '8px 12px';
  d.style.background = 'rgba(0,0,0,0.7)';
  d.style.color = '#fff';
  d.style.borderRadius = '6px';
  document.querySelector('.model-container')?.appendChild(d);
}

function removeLoading() {
  console.log('执行加载提示清理...');

  // 1. 移除loading-indicator元素
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    try {
      if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      } else {
        loadingIndicator.remove();
      }
      console.log('成功移除loading-indicator');
    } catch (e) {
      console.warn('移除loading-indicator失败', e);
      // 备用方案：隐藏元素
      loadingIndicator.style.display = 'none';
    }
  }
  
  // 2. 查找并清除所有可能的加载进度条
  const progressSelectors = [
    '.progressBarOuterContainer', 
    '.progressBarBox',
    '.loading-progress',
    '.progress-container',
    '.progress-bar',
    '.loading-overlay:not(.hide)',
    '[id^="loading"]', // 所有以loading开头的id
    '[class*="loading"]', // 所有class中包含loading的元素
    '[class*="progress"]' // 所有class中包含progress的元素
  ];
  
  // 3. 立即查找并移除所有进度指示器
  try {
    const allProgressElements = document.querySelectorAll(progressSelectors.join(', '));
    console.log(`找到${allProgressElements.length}个可能的加载指示器`);
    
    if (allProgressElements.length > 0) {
      allProgressElements.forEach(el => {
        try {
          if (el && el.parentNode) {
            console.log('移除进度指示器:', el.className || el.id || el.tagName);
            el.parentNode.removeChild(el);
          } else if (el) {
            el.remove();
          }
        } catch (err) {
          console.warn('移除进度指示器失败，改为隐藏', err);
          try {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
          } catch (styleErr) {
            console.warn('无法隐藏元素', styleErr);
          }
        }
      });
    }
  } catch (e) {
    console.warn('清理进度指示器时出错', e);
  }
  
  // 4. 设置延时清理，以捕获可能延迟出现的进度条
  setTimeout(() => {
    try {
      const lateProgressElements = document.querySelectorAll(progressSelectors.join(', '));
      if (lateProgressElements.length > 0) {
        console.log('延时清理发现的进度指示器数量:', lateProgressElements.length);
        lateProgressElements.forEach(el => {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          } else if (el) {
            el.remove();
          }
        });
      }
    } catch (e) {
      console.warn('延时清理进度指示器时出错', e);
    }
    
    // 确保主加载遮罩也被隐藏
    hideLoading();
  }, 200); // 延长一点时间以确保能捕获到所有延迟出现的指示器
  
  // 5. 立即隐藏主加载遮罩
  hideLoading();
  
  console.log('加载提示清理完成');
}

// 清理场景和资源
function clearSceneModels() {
  // 清理PLY高斯点云查看器
  PlyViewer.cleanup();
  
  // 清除场景中的其他对象
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const o = scene.children[i];
    if (o.isLight) continue;
    if (o.userData && o.userData.keep) continue;
    scene.remove(o);
  }
}

// 加载模型 - 主入口
function loadModel(modelData) {
  if (!modelData) return;
  if (isLoading) return;
  
  isLoading = true;
  showLoading('正在加载模型...');
  showLoadingIndicator('正在加载模型...');
  clearSceneModels();
  
  const format = (modelData.format || '').toLowerCase();
  const path = modelData.path.startsWith('/') ? modelData.path : ('/' + modelData.path);
  
  // 如果已经加载过该模型，直接使用缓存
  if (loadedModels[modelData.id]) {
    if (loadedModels[modelData.id].type === 'gaussian-splats') {
      // 如果是已加载的高斯点云模型，需要重新加载
      if (format === 'ply') {
        loadPlyModel(path, modelData.id)
          .then(() => {
            removeLoading();
            isLoading = false;
          })
          .catch((error) => {
            console.error('处理PLY模型时出错', error);
            handleError(error.message || 'PLY处理错误');
            removeLoading();
            isLoading = false;
          });
        return;
      } 
      else if (format === 'splat' || format === 'ksplat' || format === 'spz') {
        loadSplatModel(path, modelData.id)
          .then(() => {
            removeLoading();
            isLoading = false;
          })
          .catch((error) => {
            console.error(`处理${format}模型时出错`, error);
            handleError(error.message || `${format}处理错误`);
            removeLoading();
            isLoading = false;
          });
        return;
      }
    }
    
    scene.add(loadedModels[modelData.id].object);
    resetCameraForModel(loadedModels[modelData.id].object);
    
    // 重新设置控制按钮，确保功能正常
    resetControlButtons();
    
    // 确保自动旋转设置生效
    if (controls) {
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = CONFIG.modelView.autoRotateSpeed;
    }
    
    removeLoading();
    isLoading = false;
    return;
  }
  
  // 错误处理函数
  const handleError = (msg) => {
    removeLoading();
    isLoading = false;
    showErrorOverlay(msg);
    delete loadedModels[modelData.id];
  };
  
  // 进度回调函数
  const onProgress = (xhr) => {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100;
      
      // 当进度为100%时，立即移除加载指示器
      if (percentComplete >= 100) {
        // 立即移除加载提示
        removeLoading();
      } else {
        // 更新加载进度
        showLoading(`加载中: ${Math.round(percentComplete)}%`);
        showLoadingIndicator(`加载中: ${Math.round(percentComplete)}%`);
      }
    }
  };
  
  try {
    // 根据文件格式选择相应的加载器
    switch (format) {
      case 'ply':
        // 使用高斯点云PLY加载器
        loadPlyModel(path, modelData.id, onProgress)
          .then(() => {
            removeLoading();
            isLoading = false;
          })
          .catch((error) => {
            console.error('处理PLY模型时出错', error);
            handleError(error.message || 'PLY处理错误');
            removeLoading();
            isLoading = false;
          });
        break;
        
      case 'splat':
      case 'ksplat':
      case 'spz':
        // 使用其他高斯点云格式加载器
        loadSplatModel(path, modelData.id, onProgress)
          .then(() => {
            removeLoading();
            isLoading = false;
          })
          .catch((error) => {
            console.error(`处理${format}模型时出错`, error);
            handleError(error.message || `${format}处理错误`);
            removeLoading();
            isLoading = false;
          });
        break;
        
      case 'glb':
      case 'gltf':
      case 'obj':
      case 'stl':
      case 'fbx':
      case 'sog':
        // 使用标准格式加载器
        StandardViewer.loadByFormat(path, modelData.id, format, onProgress, {
          scene,
          onSuccess: (result) => {
            loadedModels[modelData.id] = result;
            resetCameraForModel(result.object);
            
            // 重新设置控制按钮，确保功能正常
            resetControlButtons();
            
            // 确保自动旋转设置生效
            if (controls) {
              controls.autoRotate = autoRotate;
              controls.autoRotateSpeed = CONFIG.modelView.autoRotateSpeed;
            }
            
            removeLoading();
            isLoading = false;
          },
          onError: (errorMsg) => {
            handleError(errorMsg);
            removeLoading();
            isLoading = false;
          },
          hideLoading: removeLoading
        }).catch((error) => {
          console.error(`处理${format}模型时出错`, error);
          handleError(error.message || `${format}处理错误`);
          removeLoading();
          isLoading = false;
        });
        break;
        
      default:
        handleError(`不支持的文件格式: ${format}`);
        break;
    }
  } catch (e) {
    console.error('loadModel 函数出错', e);
    handleError(e.message || '未知错误');
  }
}

// 加载PLY高斯点云模型
async function loadPlyModel(path, modelId, onProgress) {
  return PlyViewer.loadPlyModel(path, modelId, onProgress, {
    onSuccess: (result) => {
      loadedModels[modelId] = result;
    },
    onError: (errorMsg) => {
      showErrorOverlay(errorMsg || 'PLY模型加载失败');
    },
    showLoading,
    hideLoading,
    animate
  });
}

// 加载其他高斯点云格式模型(splat, ksplat, spz)
async function loadSplatModel(path, modelId, onProgress) {
  return SplatsViewer.loadSplatModel(path, modelId, onProgress, {
    onSuccess: (result) => {
      loadedModels[modelId] = result;
    },
    onError: (errorMsg) => {
      showErrorOverlay(errorMsg || '高斯点云模型加载失败');
    },
    showLoading,
    hideLoading,
    animate
  });
}

// 重置相机以适应模型，确保显示全景并居中
function resetCameraForModel(object) {
  if (!object) return;
  
  // 确保矩阵已更新
  object.updateMatrixWorld(true);
  
  // 计算包围盒
  const box = new THREE.Box3().setFromObject(object);
  
  // 如果包围盒无效，使用默认值
  if (box.isEmpty() || !isFinite(box.min.x) || isNaN(box.min.x)) {
    box.min.set(-CONFIG.safety.defaultBoxSize / 2, -CONFIG.safety.defaultBoxSize / 2, -CONFIG.safety.defaultBoxSize / 2);
    box.max.set(CONFIG.safety.defaultBoxSize / 2, CONFIG.safety.defaultBoxSize / 2, CONFIG.safety.defaultBoxSize / 2);
  }
  
  // 计算包围盒大小和中心
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // 检查模型是否倒置 - 重置相机时再次检查
  if (center.y < -size.y * 0.3) {
    console.log('重置相机: 检测到模型可能倒置');
  }
  
  // 将模型移动到世界坐标原点中心 - 确保居中显示
  // 检查模型中心是否与原点有明显偏差
  if ((object.parent === scene) && 
      (Math.abs(center.x) > 0.01 || Math.abs(center.y) > 0.01 || Math.abs(center.z) > 0.01)) {
    // 如果模型中心不在坐标原点附近，则调整位置使其居中
    const offset = center.clone();
    object.position.sub(offset);
    object.updateMatrixWorld(true);
    console.log('模型已重新居中，原中心点:', offset, '新位置:', object.position);
    
    // 重新计算包围盒和中心
    box.setFromObject(object);
    box.getCenter(center);
    box.getSize(size);
  }
  
  // 计算相机的最佳位置，确保显示全景
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  
  // 检查模型是否过大/过小或有异常比例
  const isModelTooSmall = maxDim < 1.0;
  const isModelTooLarge = maxDim > 1000;
  const isModelPartial = size.x < 0.1 || size.y < 0.1 || size.z < 0.1;
  const isModelImbalanced = (size.x / size.y > 10 || size.y / size.x > 10 || 
                             size.z / size.y > 10 || size.y / size.z > 10);
  
  // 根据模型大小情况进行适当缩放
  if (isModelTooLarge || isModelTooSmall) {
    // 计算合适的缩放比例 - 目标是让模型有一个合理的尺寸(10-20个单位大小)
    let targetSize = 10; // 期望的模型最大尺寸
    let scaleFactor;
    
    if (isModelTooLarge) {
      scaleFactor = targetSize / maxDim;
      console.log(`模型过大(${maxDim})，缩放至${scaleFactor}倍`);
    } else {
      scaleFactor = targetSize / maxDim;
      console.log(`模型过小(${maxDim})，放大至${scaleFactor}倍`);
    }
    
    // 应用缩放
    object.scale.multiplyScalar(scaleFactor);
    object.updateMatrixWorld(true);
    
    // 重新计算包围盒和尺寸
    box.setFromObject(object);
    box.getCenter(center);
    box.getSize(size);
    
    console.log('模型已重新缩放，新尺寸:', {width: size.x, height: size.y, depth: size.z});
  }
  
  // 根据模型情况调整安全系数，使模型显示适合的大小
  const safetyFactor = isModelPartial ? 3.0 : 
                       isModelImbalanced ? 2.0 : 
                       1.5; // 减小系数，使模型在视图中显示更大
  
  // 增加安全系数，确保完全显示模型（从3D对角线计算，比只使用maxDim更准确）
  const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
  let cameraDistance = Math.abs(diagonal / (2 * Math.tan(fov / 2))) * safetyFactor;
  
  cameraDistance = Math.max(cameraDistance, 2); // 确保最小距离
  cameraDistance = Math.min(cameraDistance, 1000); // 确保最大距离不会过大
  
  console.log('模型尺寸:', {width: size.x, height: size.y, depth: size.z, diagonal, cameraDistance});
  
  // 为不规则模型使用更好的视角
  let cameraPosition;
  if (isModelImbalanced) {
    // 对于不规则模型，尝试找到更好的观察角度
    const xzRatio = size.x / size.z;
    const angleX = xzRatio > 5 ? 0.3 : (xzRatio < 0.2 ? 0.7 : 0.5);
    const angleZ = xzRatio > 5 ? 0.7 : (xzRatio < 0.2 ? 0.3 : 0.5);
    
    cameraPosition = new THREE.Vector3(
      center.x + cameraDistance * angleX, 
      center.y + cameraDistance * 0.5,  // 降低高度以更好地观察高大模型
      center.z + cameraDistance * angleZ
    );
    console.log('使用不规则模型相机位置', {x: angleX, z: angleZ});
  } else {
    // 普通模型使用标准45度俯视角
    cameraPosition = new THREE.Vector3(
      center.x + cameraDistance * 0.5, 
      center.y + cameraDistance * 0.5,  // 保持45度角观察
      center.z + cameraDistance * 0.5
    );
  }
  
  // 平滑过渡到新的相机位置
  const startPosition = camera.position.clone();
  const targetPosition = cameraPosition;
  const startTarget = controls.target.clone();
  const endTarget = center.clone();
  const duration = 1000; // 1秒过渡时间
  const startTime = Date.now();
  
  function animateCamera() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // 使用easeOutCubic缓动函数
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // 插值计算当前位置
    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    controls.target.lerpVectors(startTarget, endTarget, easeProgress);
    
    // 更新相机和控制器
    camera.lookAt(controls.target);
    controls.update();
    
    // 强制渲染
    if (renderer) renderer.render(scene, camera);
    
    // 如果动画未完成，继续
    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    }
  }
  
  // 开始动画
  animateCamera();
  
  // 调整相机参数以适应模型大小
  camera.near = Math.max(cameraDistance / 100, 0.01);
  camera.far = Math.max(cameraDistance * 100, 5000); 
  camera.updateProjectionMatrix();
  
  // 设置控制器的距离限制
  controls.minDistance = cameraDistance * 0.1;  // 允许更近距离放大
  controls.maxDistance = cameraDistance * 5.0;   // 允许更远距离缩小
  
  controls.update();
}

// 更新模型信息显示
function updateModelInfo(modelData) {
  if (!modelData) return;
  
  const nameElement = document.getElementById('model-name');
  if (nameElement) nameElement.textContent = modelData.name || '';
  
  const descElement = document.getElementById('model-desc');
  if (descElement) descElement.textContent = modelData.description || '';
  
  // 更新缩略图选中状态
  document.querySelectorAll('.thumbnail').forEach((thumbnail, index) => {
    thumbnail.classList.toggle('active', index === currentModelIndex);
  });
}

// 创建缩略图
function createThumbnails() {
  const container = document.getElementById('thumbnails-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  models.forEach((model, index) => {
    const thumbnailElement = document.createElement('div');
    thumbnailElement.className = 'thumbnail' + (index === currentModelIndex ? ' active' : '');
    
    if (model.thumbnail) {
      thumbnailElement.style.backgroundImage = `url(${model.thumbnail})`;
    }
    
    thumbnailElement.addEventListener('click', () => {
      currentModelIndex = index;
      loadModel(models[currentModelIndex]);
      updateModelInfo(models[currentModelIndex]);
    });
    
    container.appendChild(thumbnailElement);
  });
}

// 切换到上一个模型
function showPreviousModel() {
  if (!models.length) return;
  
  currentModelIndex = (currentModelIndex - 1 + models.length) % models.length;
  loadModel(models[currentModelIndex]);
  updateModelInfo(models[currentModelIndex]);
}

// 切换到下一个模型
function showNextModel() {
  if (!models.length) return;
  
  currentModelIndex = (currentModelIndex + 1) % models.length;
  loadModel(models[currentModelIndex]);
  updateModelInfo(models[currentModelIndex]);
}

// 切换线框模式
function toggleWireframeMode() {
  wireframeMode = !wireframeMode;
  
  scene.traverse(object => {
    if (object.isMesh) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.wireframe = wireframeMode);
      } else if (object.material) {
        object.material.wireframe = wireframeMode;
      }
    }
  });
}

// 切换自动旋转
function toggleAutoRotate() {
  autoRotate = !autoRotate;
  
  // 处理标准格式模型
  if (controls) {
    controls.autoRotate = autoRotate;
    
    if (autoRotate) {
      // 确保旋转方向和速度正确
      controls.autoRotateSpeed = CONFIG.modelView.autoRotateSpeed;
      console.log('开启自动旋转，方向：逆时针，速度：', Math.abs(CONFIG.modelView.autoRotateSpeed));
    } else {
      console.log('关闭自动旋转');
    }
  }
  
  // 检查当前模型类型
  const currentModel = loadedModels[models[currentModelIndex]?.id];
  if (currentModel && currentModel.type === 'gaussian-splats' && currentModel.viewer) {
    // 如果是高斯点云模型，还需要使用其专用的自动旋转功能
    const plyViewer = PlyViewer.getViewer();
    if (plyViewer && typeof plyViewer.toggleAutoRotate === 'function') {
      plyViewer.toggleAutoRotate(autoRotate);
    }
  }
  
  // 更新按钮状态
  updateAutoRotateButtonState();
}

// 更新自动旋转按钮状态
function updateAutoRotateButtonState() {
  const autoRotateBtn = document.getElementById('auto-rotate');
  if (autoRotateBtn) {
    if (autoRotate) {
      autoRotateBtn.classList.add('active');
      autoRotateBtn.style.backgroundColor = '#1e88e5'; // 明确使用蓝色背景
      BUTTON_STATES.autoRotate = true;
    } else {
      autoRotateBtn.classList.remove('active');
      autoRotateBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      BUTTON_STATES.autoRotate = false;
    }
  }
}

// 显示错误信息
function showErrorOverlay(message) {
  removeLoading();
  
  const errorElement = document.createElement('div');
  errorElement.className = 'model-error-overlay';
  errorElement.textContent = message;
  errorElement.style.position = 'absolute';
  errorElement.style.left = '50%';
  errorElement.style.top = '50%';
  errorElement.style.transform = 'translate(-50%, -50%)';
  errorElement.style.background = 'rgba(0, 0, 0, 0.85)';
  errorElement.style.color = '#fff';
  errorElement.style.padding = '12px 16px';
  errorElement.style.borderRadius = '6px';
  errorElement.style.zIndex = '9999';
  
  document.querySelector('.model-container')?.appendChild(errorElement);
  
  // 8秒后自动移除错误提示
  setTimeout(() => errorElement.remove(), 8000);
}

// 暴露API供调试使用
window._app = { loadModel, models, loadedModels, scene, camera, controls };