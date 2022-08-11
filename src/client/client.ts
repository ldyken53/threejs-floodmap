import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from "./shaders/terrain-shader"
import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'

const scene = new THREE.Scene()
const blurs = [0, 1, 2];
const zs = [100, 200, 300, 400, 500];
var meshes : {[key:string]: Mesh}= {};

// const light = new THREE.SpotLight()
// light.position.set(4000, 4000, 20)
// scene.add(light)
// const ambient = new THREE.AmbientLight( 0x404040 ); // soft white light
// scene.add( ambient );

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
)
camera.position.set(2000, 1000, 1000);

const renderer = new THREE.WebGLRenderer()
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target = new THREE.Vector3(2000,1000,-2000);

const satelliteTexture = new THREE.TextureLoader().load('./satellite.png');
// scene.background = satelliteTexture;

const uvTexture = new THREE.TextureLoader().load('./img/grid.png');
// scene.background = uvTexture;

const material = new THREE.MeshStandardMaterial({
    map: uvTexture,
});

const boxG = new THREE.BoxGeometry(100, 100, 100);
const boxM = new THREE.MeshStandardMaterial({
    map: uvTexture,
});
const box = new THREE.Mesh(boxG, boxM);
// scene.add(box);
const gui = new GUI();
var params = {blur: 0, z: 100, triPlanarMapping: 0};
var uniforms = {
    z: {value: params.z},
    triPlanar: {value: params.triPlanarMapping},
    diffuseTexture: { type: "t", value: new THREE.Texture() },
};
gui.add(params, "blur", 0, 2, 1).onFinishChange(() => {scene.remove(scene.children[0]); scene.add(meshes[`z${params.z}blur${params.blur}`])});
gui.add(params, "z", 100, 500, 100).onFinishChange(() => {scene.remove(scene.children[0]); uniforms.z.value = params.z; scene.add(meshes[`z${params.z}blur${params.blur}`])});
gui.add(params, "triPlanarMapping", 0, 1, 1).onFinishChange(() => {uniforms.triPlanar.value = params.triPlanarMapping});

const satelliteLoader = new THREE.TextureLoader();
satelliteLoader.load(
    "./img/satelliteblur0.png",
    function (texture) {
      uniforms.diffuseTexture.value = texture;
      const meshMaterial = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: terrainShader._VS,
        fragmentShader: terrainShader._FS,
      });
      const terrainLoader = new STLLoader()
      blurs.forEach(blur => {
        zs.forEach(z => {
            terrainLoader.load(
                `stl/elev${z}blur${blur}.stl`,
                function (geometry) {
                    geometry.computeBoundingBox();
                    geometry.computeVertexNormals();
      
                    const mesh = new THREE.Mesh(geometry, meshMaterial);
                    mesh.receiveShadow = true;
                    mesh.castShadow = true;
                    mesh.position.set(0, 0, -100);
                    console.log(mesh);
                    meshes[`z${z}blur${blur}`] = mesh;
                    if (blur == 0 && z == 100) {
                        scene.add(mesh);
                        console.log(scene);
                    }
                },
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
                },
                (error) => {
                    console.log(error)
                }
            )
        });
      });
    },
    undefined,
    function (err) {
      console.error("An error happened.");
    }
  );

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

const stats = Stats()
document.body.appendChild(stats.dom)

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    render()

    stats.update()
}

function render() {
    renderer.render(scene, camera)
}

animate()