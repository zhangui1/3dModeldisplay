// plyControlsExtension.js - 为PLY高斯点云模型添加控制功能（全屏、重置视角、自动旋转）

import * as THREE from 'three';

// 存储控制状态
let autoRotateEnabled = true; // 默认开启自动旋转
let autoRotateInterval = null;
const AUTO_ROTATE_SPEED = 0.005; // 正值表示从右到左顺时针旋转，与标准模型保持一致

/**
 * 初始化PLY模型的控制按钮功能
 * @param {Object} viewer - GaussianSplats3D查看器实例
 */
export function initPlyControls(viewer) {
  if (!viewer) return;
  
  // 绑定控制按钮事件
  const autoRotateBtn = document.getElementById('auto-rotate');
  const resetCameraBtn = document.getElementById('reset-camera');
  const fullscreenBtn = document.getElementById('fullscreen');
  
  // 移除可能存在的旧事件监听器
  if (autoRotateBtn) {
    const newAutoRotateBtn = autoRotateBtn.cloneNode(true);
    autoRotateBtn.parentNode.replaceChild(newAutoRotateBtn, autoRotateBtn);
    newAutoRotateBtn.addEventListener('click', () => toggleAutoRotate(viewer));
  }
  
  // 默认启动自动旋转
  toggleAutoRotate(viewer);
  updateAutoRotateButtonState();
  
  if (resetCameraBtn) {
    const newResetCameraBtn = resetCameraBtn.cloneNode(true);
    resetCameraBtn.parentNode.replaceChild(newResetCameraBtn, resetCameraBtn);
    newResetCameraBtn.addEventListener('click', () => {
      // 按下按钮时变为蓝色背景
      newResetCameraBtn.classList.add('active');
      newResetCameraBtn.style.backgroundColor = '#1e88e5';
      
      // 重置相机视角
      resetCameraView(viewer);
      
      // 一段时间后恢复按钮样式
      setTimeout(() => {
        newResetCameraBtn.classList.remove('active');
        newResetCameraBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      }, 300);
    });
  }
  
  if (fullscreenBtn) {
    const newFullscreenBtn = fullscreenBtn.cloneNode(true);
    fullscreenBtn.parentNode.replaceChild(newFullscreenBtn, fullscreenBtn);
    newFullscreenBtn.addEventListener('click', () => toggleFullscreen(viewer));
  }
  
  // 添加键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r') toggleAutoRotate(viewer);
    if (e.key === 'c') resetCameraView(viewer);
    if (e.key === 'f') toggleFullscreen(viewer);
  });
  
  console.log('PLY控制按钮功能已初始化');
}

/**
 * 切换自动旋转
 * @param {Object} viewer - GaussianSplats3D查看器实例
 */
export function toggleAutoRotate(viewer) {
  if (!viewer || !viewer.camera) return;
  
  autoRotateEnabled = !autoRotateEnabled;
  updateAutoRotateButtonState();
  
  if (autoRotateEnabled) {
    // 启动自动旋转
    if (autoRotateInterval) clearInterval(autoRotateInterval);
    
    autoRotateInterval = setInterval(() => {
      // 围绕Y轴旋转场景，使用负值实现逆时针旋转（从左到右）
      if (viewer.threeScene && viewer.getSplatMesh() && viewer.getSplatMesh().scenes && viewer.getSplatMesh().scenes[0]) {
        const scene = viewer.getSplatMesh().scenes[0];
        scene.rotation.y += AUTO_ROTATE_SPEED;
        viewer.forceRenderNextFrame(); // 强制渲染下一帧
      }
    }, 16); // 约60fps
    
    console.log('PLY模型自动旋转已开启');
  } else {
    // 停止自动旋转
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
    console.log('PLY模型自动旋转已关闭');
  }
}

/**
 * 重置相机视角
 * @param {Object} viewer - GaussianSplats3D查看器实例
 */
export function resetCameraView(viewer) {
  if (!viewer || !viewer.camera || !viewer.controls) return;
  
  try {
    console.log('正在重置PLY模型相机视角...');
    
    // 获取模型边界和中心
    if (viewer.getSplatMesh && viewer.getSplatMesh()) {
      const splatMesh = viewer.getSplatMesh();
      const boundingBox = new THREE.Box3();
      
      // 确保有点数据
      const splatCount = splatMesh.getSplatCount();
      if (splatCount <= 0) {
        console.warn('无法获取点云数据，使用默认重置');
        defaultResetCamera(viewer);
        return;
      }
      
      // 获取所有点的边界框
      const tempVector = new THREE.Vector3();
      const step = Math.max(1, Math.floor(splatCount / 1000)); // 最多采样1000个点
      
      for (let i = 0; i < splatCount; i += step) {
        try {
          const center = splatMesh.getSplatCenter(i);
          if (center && typeof center === 'object' && 'x' in center) {
            tempVector.copy(center);
            boundingBox.expandByPoint(tempVector);
          }
        } catch (e) {
          // 忽略错误，继续处理
          continue;
        }
      }
      
      // 计算边界盒的大小和中心
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      // 计算合适的相机距离 - 与标准模型保持一致的视图
      const maxDim = Math.max(size.x, size.y, size.z);
      const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
      const fov = viewer.camera.fov * (Math.PI / 180);
      
      // 使用更大的系数，确保显示整个模型
      let cameraDistance = Math.abs(diagonal / (2 * Math.tan(fov / 2))) * 3.0;
      cameraDistance = Math.max(cameraDistance, Math.max(maxDim * 3.0, 5));
      
      // 设置相机位置
      const direction = new THREE.Vector3(1, 0.5, 1).normalize();
      viewer.camera.position.copy(center).addScaledVector(direction, cameraDistance);
      
      // 设置相机看向中心点
      if (viewer.controls.target) {
        viewer.controls.target.copy(center);
      }
      
      // 更新相机
      viewer.camera.lookAt(center);
      viewer.controls.update();
      viewer.forceRenderNextFrame();
      
      console.log('PLY模型相机视角已重置', {
        center: center,
        size: size,
        cameraDistance: cameraDistance,
        position: viewer.camera.position
      });
    } else {
      defaultResetCamera(viewer);
    }
  } catch (error) {
    console.error('重置相机视角时出错:', error);
    defaultResetCamera(viewer);
  }
}

/**
 * 默认的相机重置方法
 * @param {Object} viewer - GaussianSplats3D查看器实例
 */
function defaultResetCamera(viewer) {
  if (!viewer || !viewer.camera) return;
  
  // 使用与自动计算相机位置相一致的默认值
  viewer.camera.position.set(0, 1, 5);
  if (viewer.controls && viewer.controls.target) {
    viewer.controls.target.set(0, 0, 0);
  }
  viewer.camera.lookAt(0, 0, 0);
  if (viewer.controls) {
    viewer.controls.update();
  }
  viewer.forceRenderNextFrame();
}

/**
 * 切换全屏模式
 * @param {Object} viewer - GaussianSplats3D查看器实例
 */
export function toggleFullscreen(viewer) {
  if (!viewer) return;
  
  // 获取查看器容器和全屏按钮
  const container = document.getElementById('viewer-container');
  const fullscreenBtn = document.getElementById('fullscreen');
  
  if (!container) {
    console.error('找不到查看器容器');
    return;
  }
  
  try {
    if (!document.fullscreenElement) {
      console.log('进入全屏模式');
      // 进入全屏
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
        fullscreenBtn.style.backgroundColor = '#1e88e5'; // 蓝色背景
      }
    } else {
      console.log('退出全屏模式');
      // 退出全屏
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
    }
    
    // 全屏切换后重新渲染帧
    setTimeout(() => {
      if (viewer.forceRenderNextFrame) {
        viewer.forceRenderNextFrame();
      }
    }, 300);
    
  } catch (error) {
    console.error('切换全屏模式时出错:', error);
  }
}

/**
 * 更新自动旋转按钮状态
 */
function updateAutoRotateButtonState() {
  const autoRotateBtn = document.getElementById('auto-rotate');
  if (!autoRotateBtn) return;
  
  if (autoRotateEnabled) {
    autoRotateBtn.classList.add('active');
    autoRotateBtn.style.backgroundColor = '#1e88e5'; // 明确使用蓝色背景
  } else {
    autoRotateBtn.classList.remove('active');
    autoRotateBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  }
}

/**
 * 清理控制功能
 */
export function cleanup() {
  // 停止自动旋转
  if (autoRotateInterval) {
    clearInterval(autoRotateInterval);
    autoRotateInterval = null;
  }
  autoRotateEnabled = false;
  updateAutoRotateButtonState();
}

export default {
  initPlyControls,
  toggleAutoRotate,
  resetCameraView,
  toggleFullscreen,
  cleanup
};
