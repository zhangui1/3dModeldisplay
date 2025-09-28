// standardViewer.js - 处理标准格式(GLTF/GLB、OBJ、STL、FBX、SOG)的模块 - 使用ES模块方式实现

// 导入THREE核心库和所需加载器
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/**
 * 加载GLTF/GLB格式模型
 * @param {string} path - 模型文件路径
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadGltfModel(path, modelId, onProgress, options = {}) {
  const { 
    scene, 
    onSuccess = () => {}, 
    onError = () => {},
    hideLoading = () => {}
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      // 使用ES模块方式创建GLTFLoader
      const gltfLoader = new GLTFLoader();
      
      // 设置DRACO解码器（如果需要）
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      dracoLoader.setDecoderConfig({ type: 'js' });
      gltfLoader.setDRACOLoader(dracoLoader);
      
      gltfLoader.load(path, (gltf) => {
        try {
          const object = createRenderableFromLoadResult(gltf.scene);
          if (!object) throw new Error('无法创建渲染对象');
          
          // 应用方向修正以确保模型正立
          correctModelOrientation(object, 'glb');
          
          // 添加到场景
          scene.add(object);
          
          // 调用成功回调并解析Promise
          const result = {
            object,
            modelId,
            format: path.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf'
          };
          
          onSuccess(result);
          resolve(result);
          
        } catch (e) {
          console.error('处理GLTF/GLB模型时出错', e);
          onError(e.message || 'GLTF/GLB 处理错误');
          reject(e);
        } finally {
          hideLoading();
        }
      }, onProgress, (error) => {
        console.error('加载GLTF/GLB模型失败', error);
        onError(error.message || 'GLTF/GLB 加载失败');
        hideLoading();
        reject(error);
      });
    } catch (e) {
      console.error('创建GLTFLoader失败', e);
      onError(e.message || 'GLTF/GLB 加载器初始化错误');
      hideLoading();
      reject(e);
    }
  });
}

/**
 * 加载OBJ格式模型
 * @param {string} path - 模型文件路径
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadObjModel(path, modelId, onProgress, options = {}) {
  const { 
    scene, 
    onSuccess = () => {}, 
    onError = () => {},
    hideLoading = () => {}
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      // 使用ES模块方式创建OBJLoader
      const objLoader = new OBJLoader();
      
      objLoader.load(path, (result) => {
        try {
          const object = createRenderableFromLoadResult(result);
          if (!object) throw new Error('无法创建渲染对象');
          
          // 应用方向修正以确保模型正立
          correctModelOrientation(object, 'obj');
          
          // 添加到场景
          scene.add(object);
          
          // 调用成功回调并解析Promise
          const resultObj = {
            object,
            modelId,
            format: 'obj'
          };
          
          onSuccess(resultObj);
          resolve(resultObj);
          
        } catch (e) {
          console.error('处理OBJ模型时出错', e);
          onError(e.message || 'OBJ 处理错误');
          reject(e);
        } finally {
          hideLoading();
        }
      }, onProgress, (error) => {
        console.error('加载OBJ模型失败', error);
        onError(error.message || 'OBJ 加载失败');
        hideLoading();
        reject(error);
      });
    } catch (e) {
      console.error('OBJ加载器初始化失败', e);
      onError(e.message || 'OBJ 加载器初始化错误');
      hideLoading();
      reject(e);
    }
  });
}

/**
 * 加载STL格式模型
 * @param {string} path - 模型文件路径
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadStlModel(path, modelId, onProgress, options = {}) {
  const { 
    scene, 
    onSuccess = () => {}, 
    onError = () => {},
    hideLoading = () => {}
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      // 使用ES模块方式创建STLLoader
      const stlLoader = new STLLoader();
      
      stlLoader.load(path, (geometry) => {
        try {
          // 创建标准材质，保持与场景光照交互
          const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.2,
            roughness: 0.8,
            flatShading: true,
            side: THREE.DoubleSide
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // STL模型通常需要调整方向和缩放
          correctModelOrientation(mesh, 'stl');
          
          // 添加到场景
          scene.add(mesh);
          
          // 调用成功回调并解析Promise
          const result = {
            object: mesh,
            modelId,
            format: 'stl'
          };
          
          onSuccess(result);
          resolve(result);
          
        } catch (e) {
          console.error('处理STL模型时出错', e);
          onError(e.message || 'STL 处理错误');
          reject(e);
        } finally {
          hideLoading();
        }
      }, onProgress, (error) => {
        console.error('加载STL模型失败', error);
        onError(error.message || 'STL 加载失败');
        hideLoading();
        reject(error);
      });
    } catch (e) {
      console.error('STL加载器初始化失败', e);
      onError(e.message || 'STL 加载器初始化错误');
      hideLoading();
      reject(e);
    }
  });
}

/**
 * 加载FBX格式模型
 * @param {string} path - 模型文件路径
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadFbxModel(path, modelId, onProgress, options = {}) {
  const { 
    scene, 
    onSuccess = () => {}, 
    onError = () => {},
    hideLoading = () => {}
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      // 使用ES模块方式创建FBXLoader
      const fbxLoader = new FBXLoader();
      
      fbxLoader.load(path, (fbxObject) => {
        try {
          // FBX可能需要缩放调整
          fbxObject.scale.setScalar(0.01); // 根据模型情况调整缩放比例
          
          // 应用方向修正
          correctModelOrientation(fbxObject, 'fbx');
          
          // 可选：遍历所有子对象设置阴影
          fbxObject.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              // 如果材质不佳，可以替换为标准材质
              if (child.material) {
                const stdMaterial = new THREE.MeshStandardMaterial();
                // 尝试保留原始材质的颜色和纹理
                if (child.material.map) stdMaterial.map = child.material.map;
                if (child.material.color) stdMaterial.color = child.material.color;
                // 更改材质为PBR标准材质
                child.material = stdMaterial;
              }
            }
          });
          
          // 添加到场景
          scene.add(fbxObject);
          
          // 调用成功回调并解析Promise
          const result = {
            object: fbxObject,
            modelId,
            format: 'fbx'
          };
          
          onSuccess(result);
          resolve(result);
          
        } catch (e) {
          console.error('处理FBX模型时出错', e);
          onError(e.message || 'FBX 处理错误');
          reject(e);
        } finally {
          hideLoading();
        }
      }, onProgress, (error) => {
        console.error('加载FBX模型失败', error);
        onError(error.message || 'FBX 加载失败');
        hideLoading();
        reject(error);
      });
    } catch (e) {
      console.error('FBX加载器初始化失败', e);
      onError(e.message || 'FBX 加载器初始化错误');
      hideLoading();
      reject(e);
    }
  });
}

/**
 * 加载SOG格式模型
 * @param {string} path - 模型文件路径
 * @param {string|number} modelId - 模型ID
 * @param {Function} onProgress - 加载进度回调
 * @param {Object} options - 额外选项
 * @returns {Promise} - 返回Promise对象
 */
export function loadSogModel(path, modelId, onProgress, options = {}) {
  const { 
    scene, 
    onSuccess = () => {}, 
    onError = () => {},
    hideLoading = () => {}
  } = options;
  
  return new Promise((resolve, reject) => {
    try {
      let progressInterval = null;
      
      // 显示加载进度
      if (onProgress) {
        // 由于fetch API不提供进度信息，这里模拟一个进度条
        let progress = 0;
        progressInterval = setInterval(() => {
          progress += 10;
          if (progress <= 90) {
            onProgress({ lengthComputable: true, loaded: progress, total: 100 });
          } else {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }, 200);
      }
      
      // 使用fetch API加载SOG文件
      fetch(path)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          try {
            if (!data || !data.objects) {
              throw new Error('无效的SOG格式文件');
            }
            
            // 创建一个组来包含所有对象
            const group = new THREE.Group();
            
            // 解析SOG数据并创建对象
            data.objects.forEach(obj => {
              let mesh;
              
              if (obj.type === 'mesh' && obj.geometry) {
                // 创建几何体
                const geometry = new THREE.BufferGeometry();
                
                // 添加位置数据
                if (obj.geometry.vertices) {
                  const vertices = new Float32Array(obj.geometry.vertices);
                  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                }
                
                // 添加索引数据
                if (obj.geometry.indices) {
                  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(obj.geometry.indices), 1));
                }
                
                // 计算法线
                geometry.computeVertexNormals();
                
                // 创建材质
                let material;
                if (obj.material) {
                  material = new THREE.MeshStandardMaterial({
                    color: obj.material.color ? new THREE.Color(obj.material.color) : 0xcccccc,
                    metalness: obj.material.metalness || 0.2,
                    roughness: obj.material.roughness || 0.8,
                    side: THREE.DoubleSide
                  });
                } else {
                  material = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    side: THREE.DoubleSide
                  });
                }
                
                mesh = new THREE.Mesh(geometry, material);
                
                // 设置变换
                if (obj.transform) {
                  if (obj.transform.position) mesh.position.fromArray(obj.transform.position);
                  if (obj.transform.rotation) mesh.rotation.fromArray(obj.transform.rotation);
                  if (obj.transform.scale) mesh.scale.fromArray(obj.transform.scale);
                }
                
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);
              }
            });
            
            // 应用方向修正
            correctModelOrientation(group, 'sog');
            
            // 添加到场景
            scene.add(group);
            
            // 清理进度间隔
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            
            // 调用成功回调并解析Promise
            const result = {
              object: group,
              modelId,
              format: 'sog'
            };
            
            onSuccess(result);
            resolve(result);
            
          } catch (e) {
            console.error('处理SOG数据时出错', e);
            onError(e.message || 'SOG 数据处理错误');
            reject(e);
          } finally {
            hideLoading();
            // 清理进度间隔
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
          }
        })
        .catch(error => {
          console.error('加载SOG文件失败', error);
          onError(error.message || 'SOG 文件加载错误');
          hideLoading();
          // 清理进度间隔
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          reject(error);
        });
    } catch (e) {
      console.error('SOG加载器初始化失败', e);
      onError(e.message || 'SOG 加载器初始化错误');
      hideLoading();
      reject(e);
    }
  });
}

/**
 * 从加载结果创建可渲染对象
 * @param {Object} result - 加载结果
 * @returns {THREE.Object3D|null} - 返回THREE.Object3D对象或null
 */
function createRenderableFromLoadResult(result) {
  if (!result) return null;
  
  // 如果结果是几何体
  if (result.isBufferGeometry) {
    // 创建标准材质
    const material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.2,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(result, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  // 如果结果是Object3D（包含模型的场景等）
  if (result.isObject3D) {
    const group = new THREE.Group();
    
    result.traverse(child => {
      // 处理网格对象
      if (child.isMesh) {
        // 确保所有网格都可以投射和接收阴影
        child.castShadow = true;
        child.receiveShadow = true;
        
        // 保留原始几何体和材质，但可能需要改进材质质量
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              // 确保材质可以接收阴影
              mat.shadowSide = THREE.FrontSide;
              mat.needsUpdate = true;
            });
          } else {
            child.material.shadowSide = THREE.FrontSide;
            child.material.needsUpdate = true;
          }
        }
        
        // 添加到组中
        group.add(child.clone());
      }
    });
    
    // 如果没有处理任何mesh，直接返回原始对象的克隆
    if (group.children.length === 0) {
      return result.clone();
    }
    
    return group;
  }
  
  return null;
}

/**
 * 为不同类型的模型进行方向调整，确保模型正立显示
 * @param {THREE.Object3D} object - THREE.Object3D对象
 * @param {string} format - 模型格式
 */
function correctModelOrientation(object, format) {
  if (!object) return;
  
  // 计算模型的尺寸
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  // 根据文件格式为模型应用适当的旋转以确保模型在屏幕上显示为正立状态
  switch (format.toLowerCase()) {
    case 'obj':
      // 对于OBJ模型进行类似调整
      object.rotation.x = -Math.PI / 2; 
      object.rotation.z = 0;
      break;
      
    case 'glb':
    case 'gltf':
      // GLB/GLTF格式可能需要不同的调整
      object.rotation.x = 0; // GLB通常已经是Y-UP
      object.rotation.y = Math.PI; // 旋转180度使模型正对观察者
      break;
      
    case 'stl':
      // STL模型通常需要旋转为Y轴向上
      object.rotation.x = -Math.PI / 2;
      break;
      
    case 'fbx':
      // FBX模型通常已经是Y轴向上
      // 但有时需要旋转以面向用户
      object.rotation.y = Math.PI;
      break;
      
    case 'sog':
      // SOG模型根据具体情况调整
      object.rotation.x = -Math.PI / 2;
      break;
      
    default:
      // 其他格式，使用航拍模型常见的朝向
      object.rotation.x = -Math.PI / 2;
      object.rotation.z = 0;
      break;
  }
  
  // 特别处理：检查是否为航拍/鸟瞰类模型（通常宽度和长度远大于高度）
  if (size.y < size.x * 0.2 && size.y < size.z * 0.2) {
    // 确保这类模型的朝向正确（顶部向上）
    object.rotation.x = -Math.PI / 2;
    object.rotation.z = 0;
  }
  
  // 检查模型是否倒置 - 使用更完善的算法
  const center = new THREE.Vector3();
  box.getCenter(center);
  
  // 使用多种指标检测模型是否倒置
  let isInverted = false;
  
  // 指标1: 如果模型中心点在Y轴负方向且比例明显，可能倒置
  const centerYRatio = center.y / size.y;
  if (centerYRatio < -0.25) {
    console.log('通过中心点检测到模型可能倒置', centerYRatio);
    isInverted = true;
  }
  
  // 指标2: 检查模型是否有明显的朝下趋势 - 采样顶点分布
  if (object.isObject3D && !isInverted) {
    let bottomPointsCount = 0;
    let topPointsCount = 0;
    let totalSampledPoints = 0;
    
    // 遍历所有子网格收集顶点信息
    object.traverse(child => {
      if (child.isMesh && child.geometry) {
        const vertices = child.geometry.attributes.position;
        if (vertices && vertices.array) {
          // 采样一定数量的顶点
          const stride = Math.max(1, Math.floor(vertices.count / 100)); // 采样最多100个点
          
          for (let i = 0; i < vertices.count; i += stride) {
            const y = vertices.array[i * 3 + 1]; // Y坐标
            
            if (y < center.y - size.y * 0.2) bottomPointsCount++;
            if (y > center.y + size.y * 0.2) topPointsCount++;
            
            totalSampledPoints++;
            if (totalSampledPoints > 500) break; // 限制采样点数
          }
        }
      }
    });
    
    // 如果底部点明显多于顶部点，可能倒置
    if (totalSampledPoints > 10 && bottomPointsCount > topPointsCount * 1.5) {
      console.log('通过顶点分布检测到模型可能倒置', {
        bottom: bottomPointsCount, 
        top: topPointsCount
      });
      isInverted = true;
    }
  }
  
  // 如果检测到倒置，应用翻转校正
  if (isInverted) {
    console.log('应用翻转校正，使模型正立显示');
    
    // 根据模型格式应用不同的翻转策略
    switch (format.toLowerCase()) {
      case 'gltf':
      case 'glb':
        // 重置原有旋转，然后应用新旋转
        object.rotation.set(0, 0, 0);
        object.updateMatrixWorld(true);
        // 按X轴旋转180度使模型正立
        object.rotation.x = Math.PI;
        // 按Y轴旋转180度使模型正面朝向观察者
        object.rotation.y = Math.PI;
        break;
      
      case 'obj':
      case 'stl':
        // 这些格式的模型通常已经进行了适当的旋转，只需翻转
        object.rotateX(Math.PI);
        break;
        
      default:
        // 对其他格式的通用处理
        object.rotateX(Math.PI);
        break;
    }
    
    // 更新变换矩阵
    object.updateMatrixWorld(true);
    console.log('模型翻转校正完成');
  }
  
  // 根据模型尺寸调整缩放比例，确保模型大小适中
  const maxDim = Math.max(size.x, size.y, size.z);
  
  // 定义标准模型的理想尺寸（单位）
  const idealSize = 20;
  
  // 根据模型实际尺寸进行适当缩放
  if (maxDim < 10 || maxDim > 30) {
    const scaleFactor = idealSize / maxDim;
    object.scale.multiplyScalar(scaleFactor);
    // 标准格式模型尺寸调整
  } else {
    // 标准模型通常偏小，即使在合理范围内也适当放大
    const scaleFactor = 1.5;
    object.scale.multiplyScalar(scaleFactor);
    // 标准格式模型适当放大
  }
  
  // 更新变换矩阵确保应用所有更改
  object.updateMatrixWorld(true);
}

// 根据文件扩展名加载对应格式模型
export function loadByFormat(path, modelId, format, onProgress, options) {
  format = format.toLowerCase();
  
  switch (format) {
    case 'gltf':
    case 'glb':
      return loadGltfModel(path, modelId, onProgress, options);
    case 'obj':
      return loadObjModel(path, modelId, onProgress, options);
    case 'stl':
      return loadStlModel(path, modelId, onProgress, options);
    case 'fbx':
      return loadFbxModel(path, modelId, onProgress, options);
    case 'sog':
      return loadSogModel(path, modelId, onProgress, options);
    default:
      return Promise.reject(new Error(`不支持的文件格式: ${format}`));
  }
}

// 暴露模块接口
export default {
  loadGltfModel,
  loadObjModel,
  loadStlModel,
  loadFbxModel,
  loadSogModel,
  loadByFormat
};