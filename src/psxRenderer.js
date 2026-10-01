import * as THREE from "three";

// Low-res render target + nearest upscale + PSX shader material factory.

const RES_W = 480;
const RES_H = 360;

const VERT = /* glsl */ `
uniform float res;
varying vec3 vNormalV;
varying vec3 vWorldPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  clip.xy = floor(clip.xy / clip.w * res) / res * clip.w;
  gl_Position = clip;
  vNormalV = normalMatrix * normal;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
}
`;

const FRAG = /* glsl */ `
uniform vec3 color;
uniform vec3 lightDir;
uniform float ambient;
uniform float diffuse;
uniform float gradient;
uniform float gradMin;
uniform float gradMax;
varying vec3 vNormalV;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vNormalV);
  float d = max(dot(n, normalize(lightDir)), 0.0);
  vec3 c = color * (ambient + diffuse * d);
  float f = clamp((vWorldPos.y - gradMin) / max(gradMax - gradMin, 0.001), 0.0, 1.0);
  c *= mix(1.0 - gradient, 1.0, f);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const SHARED_GRAD = { min: 0.0, max: 1.9 };

export function makePSXMaterial(colorHex, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(colorHex) },
      lightDir: { value: new THREE.Vector3(0.4, 1.0, 0.7).normalize() },
      ambient: { value: opts.ambient ?? 0.78 },
      diffuse: { value: opts.diffuse ?? 0.26 },
      gradient: { value: opts.gradient ?? 0.16 },
      gradMin: { value: SHARED_GRAD.min },
      gradMax: { value: SHARED_GRAD.max },
      res: { value: opts.res ?? 200.0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
}

export function createPSXRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RES_W, RES_H, false);
  renderer.setClearColor(0x000000, 0);

  const rt = new THREE.WebGLRenderTarget(RES_W, RES_H, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rt.texture } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv); }`,
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

  function render(scene, camera) {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  return { renderer, render, RES_W, RES_H };
}
