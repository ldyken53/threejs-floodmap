import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from "./shaders/terrain-shader"
import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import cv, { Mat } from 'opencv-ts'

var data : number[] = [];
async function getElevationData() {
    const height_data_response = await fetch("./stl/elevation.json");
  
    if (!height_data_response.ok) {
      const message = `An error has occured: ${height_data_response.status}`;
      throw new Error(message);
    }
    data = await height_data_response.json();
    console.log(data);
}
getElevationData();

const scene = new THREE.Scene()
const blurs = [0, 1, 2];
const zs = [100, 200, 300, 400, 500];
// const blurs = [0];
// const zs = [100];
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

var canvas = document.createElement('canvas');
canvas.width = 4104;
canvas.height = 1856;
var annotationTexture = new THREE.Texture(canvas);
var context = canvas.getContext('2d');

const gui = new GUI();
var params = {blur: 0, z: 100, triPlanarMapping: 0, minCanny: 50, maxCanny: 100, canny: 0, annotation: 0};
var uniforms = {
    z: {value: params.z},
    triPlanar: {value: params.triPlanarMapping},
    diffuseTexture: { type: "t", value: new THREE.Texture() },
    annotationTexture: { type: "t", value: annotationTexture },
    edgeTexture: {type: "t", value: new THREE.Texture() },
    canny: {value: params.canny},
    annotation: {value: params.annotation}
};
gui.add(params, "blur", 0, 2, 1).onFinishChange(() => {scene.remove(scene.children[0]); scene.add(meshes[`z${params.z}blur${params.blur}`])});
gui.add(params, "z", 100, 500, 100).onFinishChange(() => {scene.remove(scene.children[0]); uniforms.z.value = params.z; scene.add(meshes[`z${params.z}blur${params.blur}`])});
gui.add(params, "triPlanarMapping", 0, 1, 1).onFinishChange(() => {uniforms.triPlanar.value = params.triPlanarMapping});
gui.add(params, "canny", 0, 2, 1).onFinishChange(() => {uniforms.canny.value = params.canny});
gui.add(params, "annotation", 0, 1, 1).onFinishChange(() => {uniforms.annotation.value = params.annotation});
gui.add(params, "minCanny", 50, 500, 10).onFinishChange(() => { 
    cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
    cv.imshow("streamCanvas", edge);
    edgeTexture = new THREE.CanvasTexture(canvas);
    uniforms.edgeTexture.value = edgeTexture;
});
gui.add(params, "maxCanny", 100, 550, 10).onFinishChange(() => {
    cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
    cv.imshow("streamCanvas", edge);
    edgeTexture = new THREE.CanvasTexture(canvas);
    uniforms.edgeTexture.value = edgeTexture;
});

var edgeTexture = new THREE.Texture();
var canvas = document.getElementById("streamCanvas") as HTMLCanvasElement;
var ctx = canvas.getContext('2d')!;
var base_image = new Image();
base_image.src = 'img/satelliteblur0.png';
var satSource : Mat, edge : Mat;
base_image.onload = function(){
  ctx.drawImage(base_image, 0, 0);
  satSource = cv.imread("streamCanvas");
  edge = satSource.clone();
  cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
  cv.imshow("streamCanvas", edge);
  edgeTexture = new THREE.CanvasTexture(canvas);
  uniforms.edgeTexture.value = edgeTexture;
}

function BFS(point : THREE.Vector3) {
    context!.fillStyle = "red";
    var visited = new Map();
    var stack = [];
    var x = Math.trunc(point.x);
    var y = 1856 - Math.ceil(point.y);
    visited.set(`${x}, ${y}`, 1);
    stack.push(x, y);
    while (stack.length > 0) {
        y = stack.pop()!;
        x = stack.pop()!;
        context!.fillRect(x, y, 1, 1);
        var value = data[x + y * 4104];
        if (data[(x + 1) + y * 4104] <= value) {
            if (!visited.get(`${x + 1}, ${y}`)) {
                visited.set(`${x + 1}, ${y}`, 1);
                stack.push(x + 1, y);
            }
        }
        if (data[(x - 1) + y * 4104] <= value) {
            if (!visited.get(`${x - 1}, ${y}`)) {
                visited.set(`${x - 1}, ${y}`, 1);
                stack.push(x - 1, y);
            }
        }
        if (data[x + (y + 1) * 4104] <= value) {
            if (!visited.get(`${x}, ${y + 1}`)) {
                visited.set(`${x}, ${y + 1}`, 1);
                stack.push(x, y + 1);
            }
        }
        if (data[x + (y - 1) * 4104] <= value) {
            if (!visited.get(`${x}, ${y - 1}`)) {
                visited.set(`${x}, ${y - 1}`, 1);
                stack.push(x, y - 1);
            }
        }
        if (data[(x + 1) + (y + 1) * 4104] <= value) {
            if (!visited.get(`${x + 1}, ${y + 1}`)) {
                visited.set(`${x + 1}, ${y + 1}`, 1);
                stack.push(x + 1, y + 1);
            }
        }
        if (data[(x - 1) + (y + 1) * 4104] <= value) {
            if (!visited.get(`${x - 1}, ${y + 1}`)) {
                visited.set(`${x - 1}, ${y + 1}`, 1);
                stack.push(x - 1, y + 1);
            }
        }
        if (data[(x - 1) + (y - 1) * 4104] <= value) {
            if (!visited.get(`${x - 1}, ${y - 1}`)) {
                visited.set(`${x - 1}, ${y - 1}`, 1);
                stack.push(x - 1, y - 1);
            }
        }
        if (data[(x + 1) + (y - 1) * 4104] <= value) {
            if (!visited.get(`${x + 1}, ${y - 1}`)) {
                visited.set(`${x + 1}, ${y - 1}`, 1);
                stack.push(x + 1, y - 1);
            }
        }

    }
    annotationTexture.needsUpdate = true;
    uniforms.annotationTexture.value = annotationTexture;
}

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster(); 
const onMouseMove = (event : MouseEvent) => {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
};
const onFPress = (event : KeyboardEvent) => {
    if (event.key == 'f') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
    
        BFS(intersects[0].point);
    }
}
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('keydown', onFPress);


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