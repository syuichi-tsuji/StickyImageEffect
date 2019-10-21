import * as THREE from "three";
import {
  fragment,
  vertex
} from "./shaders";

function GLManager(data) {
  this.totalEntries = data.length;
  this.loadedEntries = 0;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
  camera.position.z = 5;

  const scene = new THREE.Scene();
  camera.lookAt = scene.position;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  this.render = this.render.bind(this);
  this.textures = data.map((entry, i) =>
    new THREE.TextureLoader().load(
      entry.image,
      this.calculateAspectRatioFactor.bind(this, i)
    )
  );
  this.factors = data.map(d => new THREE.Vector2(1, 1));
  this.currentIndex = 0;
  this.nextIndex = 0;
  this.textureProgress = 0;
  this.camera = camera;
  this.scene = scene;
  this.renderer = renderer;
  this.initialRender = false;
  this.time = 0;
  this.loopRaf = null;
  this.loop = this.loop.bind(this);
}
GLManager.prototype.getViewSize = function () {
  const fovInRadians = (this.camera.fov * Math.PI) / 180;
  const viewSize = Math.abs(
    this.camera.position.z * Math.tan(fovInRadians / 2) * 2
  );

  return viewSize;
};

GLManager.prototype.getPlaneSize = function () {
  const viewSize = this.getViewSize();
  return {
    width: viewSize * 1.5,
    height: viewSize
  };
};
GLManager.prototype.calculateAspectRatioFactor = function (index, texture) {
  const plane = this.getPlaneSize();
  const windowRatio = window.innerWidth / window.innerHeight;
  const rectRatio = (plane.width / plane.height) * windowRatio;
  const imageRatio = texture.image.width / texture.image.height;

  let factorX = 1;
  let factorY = 1;
  if (rectRatio > imageRatio) {
    factorX = 1;
    factorY = (1 / rectRatio) * imageRatio;
  } else {
    factorX = (1 * rectRatio) / imageRatio;
    factorY = 1;
  }

  this.factors[index] = new THREE.Vector2(factorX, factorY);
  if (this.currentIndex === index) {
    this.mesh.material.uniforms.u_textureFactor.value = this.factors[index];
    this.mesh.material.uniforms.u_textureFactor.needsUpdate = true;
  }
  if (this.nextIndex === index) {
    this.mesh.material.uniforms.u_texture2Factor.value = this.factors[index];
    this.mesh.material.uniforms.u_texture2Factor.needsUpdate = true;
  }
  if (this.initialRender) {
    this.loadedEntries++;
    if (this.loadedEntries === this.totalEntries) {
      document.body.classList.remove('loading');
    }
    this.render();
  }
};
// Plane Stuff
GLManager.prototype.createPlane = function () {
  // Calculate bas of Isoceles triangle(camera)
  const viewSize = this.getViewSize();
  const {
    width,
    height
  } = this.getPlaneSize();

  const segments = 60;
  const geometry = new THREE.PlaneBufferGeometry(
    width,
    height,
    segments,
    segments
  );
  const material = new THREE.ShaderMaterial({

    //three.jsの組み込みuniform/attributeの紹介
    //https://qiita.com/gam0022/items/1fe17e93f0cd0432a8b0

    uniforms: {
      u_texture: {
        type: "t",
        value: this.textures[this.currentIndex]
      },
      u_textureFactor: {
        type: "f",
        value: this.factors[this.currentIndex]
      },
      u_texture2: {
        type: "t",
        value: this.textures[this.nextIndex]
      },
      u_texture2Factor: {
        type: "f",
        value: this.factors[this.nextIndex]
      },
      u_textureProgress: {
        type: "f",
        value: this.textureProgress
      },
      u_offset: {
        type: "f",
        value: 8
      },
      // threejsでGLSLをいじるための基礎知識
      //https://qiita.com/kitasenjudesign/items/1657d9556591284a43c8
      //threejsからuniform/attributeを渡すとき指定する文字列(type)
      //https://qiita.com/kitasenjudesign/items/1657d9556591284a43c8#threejs%E3%81%8B%E3%82%89uniformattribute%E3%82%92%E6%B8%A1%E3%81%99%E3%81%A8%E3%81%8D%E6%8C%87%E5%AE%9A%E3%81%99%E3%82%8B%E6%96%87%E5%AD%97%E5%88%97type
      // threejsでShaderMaterialとかを使うと、自分で直接GLSLをいじれる。
      // 拡大縮小
      u_progress: {
        type: "f", //f (float)
        value: 0 // 初期値？
      },
      // 不明
      u_direction: {
        type: "f", //f (float)
        value: 1
      },
      u_effect: {
        type: "f",
        value: 0
      },
      u_time: {
        type: "f",
        value: this.time
      },
      // 波の動き
      u_waveIntensity: {
        type: "f", //f (float)
        value: 0
      },
      u_resolution: {
        type: "v2",
        value: new THREE.Vector2(window.innerWidth, window.innerHeight)
      },
      u_rgbPosition: {
        type: "v2",
        value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)
      },
      u_rgbVelocity: {
        type: "v2",
        value: new THREE.Vector2(0, 0)
      }
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  this.scene.add(mesh);
  this.mesh = mesh;
};
GLManager.prototype.updateTexture = function (newIndex, progress) {
  let didChange = false;
  if (newIndex != null && this.newIndex !== this.currentIndex) {
    this.currentIndex = this.nextIndex;
    this.nextIndex = newIndex;
    this.textureProgress = 0;
    this.mesh.material.uniforms.u_textureProgress.value = 0;
    this.mesh.material.uniforms.u_texture.value = this.textures[
      this.currentIndex
    ];
    this.mesh.material.uniforms.u_textureFactor.value = this.factors[
      this.currentIndex
    ];
    this.mesh.material.uniforms.u_texture2.value = this.textures[newIndex];

    this.mesh.material.uniforms.u_texture2Factor.value = this.factors[newIndex];

    didChange = true;
  }
  if (progress != null && progress !== this.textureProgress) {
    this.mesh.material.uniforms.u_textureProgress.value = progress;
    this.textureProgress = progress;
    didChange = true;
  }

  if (!this.loopRaf && didChange) {
    this.render();
  }
};
GLManager.prototype.updateStickEffect = function ({
  progress,
  direction,
  waveIntensity
}) {
  // ここでエフェクト（３種類？）
  // 画像を縮小拡大させている
  this.mesh.material.uniforms.u_progress.value = progress;
  // ここは不明
  this.mesh.material.uniforms.u_direction.value = direction;
  // ゆらゆらさせている
  this.mesh.material.uniforms.u_waveIntensity.value = waveIntensity;
  // this.render();
};

GLManager.prototype.updateRgbEffect = function ({
  position,
  velocity
}) {
  this.mesh.material.uniforms.u_rgbPosition.value = new THREE.Vector2(
    position.x,
    position.y
  );
  this.mesh.material.uniforms.u_rgbVelocity.value = new THREE.Vector2(
    velocity.x,
    velocity.y
  );

  if (!this.loopRaf) {
    this.render();
  }
};
// Other stuff
GLManager.prototype.render = function () {
  if (!this.initialRender) {
    this.initialRender = true;
  }
  this.renderer.render(this.scene, this.camera);
};
GLManager.prototype.mount = function (container) {
  container.appendChild(this.renderer.domElement);
};
GLManager.prototype.unmount = function () {
  this.mesh.material.dispose();
  this.mesh.geometry.dispose();
  this.mesh = null;
  this.renderer = null;
  this.camera = null;
  this.scene = null;
  this.container = null;
};
GLManager.prototype.onResize = function () {
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  this.mesh.material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth,
    window.innerHeight
  );
  // this.camera.aspect = window.inenrWidth / window.innerHeight;
  // this.camera.updateProjectionMatrix();
  for (var i = 0; i < this.textures.length; i++) {
    if (this.textures[i].image) {
      this.calculateAspectRatioFactor(i, this.textures[i]);
    }
  }

  this.render();
};
GLManager.prototype.scheduleLoop = function () {
  if (this.loopRaf) return;
  this.loop();
};

// ここでエフェクトを繰り返して波の動きを表現
GLManager.prototype.loop = function () {
  this.render();
  this.time += 0.1;
  this.mesh.material.uniforms.u_time.value = this.time;

  this.loopRaf = requestAnimationFrame(this.loop);
};

GLManager.prototype.cancelLoop = function () {
  cancelAnimationFrame(this.loopRaf);
  this.loopRaf = null;
};

export {
  GLManager
};