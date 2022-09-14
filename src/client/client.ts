import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from "./shaders/terrain-shader"
import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import cv, { Mat } from 'opencv-ts'

var data : number[] = [];
var elevImage = new Image();
elevImage.src = 'img/elevation.png';
var elevateCanvas = document.getElementById("elevateCanvas") as HTMLCanvasElement;
var ctx = elevateCanvas.getContext('2d')!;
elevImage.onload = function(){
  ctx.drawImage(elevImage, 0, 0);
  var tempData = Array.from(ctx.getImageData(0, 0, elevImage.width, elevImage.height).data);
  for (var i = 0; i < tempData.length; i+=4) {
    data.push(tempData[i]);
  }
}

const scene = new THREE.Scene()
// const blurs = [0, 1, 2];
// const zs = [100, 200, 300, 400, 500];
const blurs = [0];
const zs = [500];
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
var params = {blur: 0, z: 500, triPlanarMapping: 0, minCanny: 500, maxCanny: 550, canny: 0, annotation: 1, brushSize: 5};
var uniforms = {
    z: {value: params.z},
    triPlanar: {value: params.triPlanarMapping},
    diffuseTexture: { type: "t", value: new THREE.Texture() },
    annotationTexture: { type: "t", value: annotationTexture },
    edgeTexture: {type: "t", value: new THREE.Texture() },
    canny: {value: params.canny},
    annotation: {value: params.annotation}
};
const meshFolder = gui.addFolder("Mesh Settings");
const viewFolder = gui.addFolder("View Settings");
const cannyFolder = gui.addFolder("Edge Detection Settings");
meshFolder.add(params, "blur", 0, 2, 1).onFinishChange(() => {scene.remove(scene.children[0]); scene.add(meshes[`z${params.z}blur${params.blur}`])});
meshFolder.add(params, "z", 100, 500, 100).onFinishChange(() => {scene.remove(scene.children[0]); uniforms.z.value = params.z; scene.add(meshes[`z${params.z}blur${params.blur}`])});
viewFolder.add(params, "triPlanarMapping", 0, 1, 1).onFinishChange(() => {uniforms.triPlanar.value = params.triPlanarMapping});
cannyFolder.add(params, "canny", 0, 2, 1).onFinishChange(() => {uniforms.canny.value = params.canny});
viewFolder.add(params, "annotation", 0, 1, 1).onFinishChange(() => {uniforms.annotation.value = params.annotation});
viewFolder.add(params, "brushSize", 1, 50, 1);
cannyFolder.add(params, "minCanny", 50, 500, 10).onFinishChange(() => { 
    cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
    cv.imshow("streamCanvas", edge);
    edgeTexture = new THREE.CanvasTexture(canvas);
    uniforms.edgeTexture.value = edgeTexture;
    edgeData = edge.data;
});
cannyFolder.add(params, "maxCanny", 100, 550, 10).onFinishChange(() => {
    cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
    cv.imshow("streamCanvas", edge);
    edgeTexture = new THREE.CanvasTexture(canvas);
    uniforms.edgeTexture.value = edgeTexture;
    edgeData = edge.data;
});
viewFolder.open();
meshFolder.open();

var edgeTexture = new THREE.Texture();
var canvas = document.getElementById("streamCanvas") as HTMLCanvasElement;
var ctx = canvas.getContext('2d')!;
var base_image = new Image();
base_image.src = 'img/satelliteblur0.png';
var satSource : Mat, edge : Mat, edgeData : Uint8Array;
base_image.onload = function(){
  ctx.drawImage(base_image, 0, 0);
  satSource = cv.imread("streamCanvas");
  edge = satSource.clone();
  cv.Canny(satSource, edge, params.minCanny, params.maxCanny);
  cv.imshow("streamCanvas", edge);
  edgeTexture = new THREE.CanvasTexture(canvas);
  uniforms.edgeTexture.value = edgeTexture;
  edgeData = edge.data;
}

var visitedFlood = new Map();
function BFS(x : number, y : number) {
    context!.fillStyle = "red";
    // var visited = new Map();
    var stack = [];
    visitedFlood.set(`${x}, ${y}`, 1);
    stack.push(x, y);
    while (stack.length > 0) {
        y = stack.pop()!;
        x = stack.pop()!;
        context!.fillRect(x, y, 1, 1);
        var value = data[x + y * 4104];
        if (data[(x + 1) + y * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y}`)) {
                visitedFlood.set(`${x + 1}, ${y}`, 1);
                stack.push(x + 1, y);
            }
        }
        if (data[(x - 1) + y * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y}`)) {
                visitedFlood.set(`${x - 1}, ${y}`, 1);
                stack.push(x - 1, y);
            }
        }
        if (data[x + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x}, ${y + 1}`)) {
                visitedFlood.set(`${x}, ${y + 1}`, 1);
                stack.push(x, y + 1);
            }
        }
        if (data[x + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x}, ${y - 1}`)) {
                visitedFlood.set(`${x}, ${y - 1}`, 1);
                stack.push(x, y - 1);
            }
        }
        if (data[(x + 1) + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y + 1}`)) {
                visitedFlood.set(`${x + 1}, ${y + 1}`, 1);
                stack.push(x + 1, y + 1);
            }
        }
        if (data[(x - 1) + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y + 1}`)) {
                visitedFlood.set(`${x - 1}, ${y + 1}`, 1);
                stack.push(x - 1, y + 1);
            }
        }
        if (data[(x - 1) + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y - 1}`)) {
                visitedFlood.set(`${x - 1}, ${y - 1}`, 1);
                stack.push(x - 1, y - 1);
            }
        }
        if (data[(x + 1) + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y - 1}`)) {
                visitedFlood.set(`${x + 1}, ${y - 1}`, 1);
                stack.push(x + 1, y - 1);
            }
        }

    }
    annotationTexture.needsUpdate = true;
    // uniforms.annotationTexture.value = annotationTexture;
}
function BFS2(x : number, y : number) {
    context!.fillStyle = "blue";
    var visited = new Map();
    var stack = [];
    visited.set(`${x}, ${y}`, 1);
    stack.push(x, y);
    while (stack.length > 0) {
        y = stack.pop()!;
        x = stack.pop()!;
        context!.fillRect(x, y, 1, 1);
        var value = data[x + y * 4104];
        if (data[(x + 1) + y * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y}`)) {
                visited.set(`${x + 1}, ${y}`, 1);
                stack.push(x + 1, y);
            }
        }
        if (data[(x - 1) + y * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y}`)) {
                visited.set(`${x - 1}, ${y}`, 1);
                stack.push(x - 1, y);
            }
        }
        if (data[x + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x}, ${y + 1}`)) {
                visited.set(`${x}, ${y + 1}`, 1);
                stack.push(x, y + 1);
            }
        }
        if (data[x + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x}, ${y - 1}`)) {
                visited.set(`${x}, ${y - 1}`, 1);
                stack.push(x, y - 1);
            }
        }
        if (data[(x + 1) + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y + 1}`)) {
                visited.set(`${x + 1}, ${y + 1}`, 1);
                stack.push(x + 1, y + 1);
            }
        }
        if (data[(x - 1) + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y + 1}`)) {
                visited.set(`${x - 1}, ${y + 1}`, 1);
                stack.push(x - 1, y + 1);
            }
        }
        if (data[(x - 1) + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y - 1}`)) {
                visited.set(`${x - 1}, ${y - 1}`, 1);
                stack.push(x - 1, y - 1);
            }
        }
        if (data[(x + 1) + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y - 1}`)) {
                visited.set(`${x + 1}, ${y - 1}`, 1);
                stack.push(x + 1, y - 1);
            }
        }

    }
    annotationTexture.needsUpdate = true;
    // uniforms.annotationTexture.value = annotationTexture;
}

function fpart(x : number) {
    return x - Math.floor(x);
}
function rfpart(x : number) {
    return 1 - fpart(x);
}

var erase = false;
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster(); 
const onMouseMove = (event : MouseEvent) => {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    if (erase) {
        // raycaster.setFromCamera(pointer, camera);
        // const intersects = raycaster.intersectObjects(scene.children);
        // var point = intersects[0].point;
        // var x = Math.trunc(point.x);
        // var y = 1856 - Math.ceil(point.y);
        // console.log(x, y);
        // context!.clearRect(x - 2, y - 2, 5, 5);
        // annotationTexture.needsUpdate = true;
        // uniforms.annotationTexture.value = annotationTexture; 
    }
};
var polyPoints : Array<number> = [];
const onKeyPress = (event : KeyboardEvent) => {
    if (event.key == 'f') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var x = Math.trunc(intersects[0].point.x);
        var y = 1856 - Math.ceil(intersects[0].point.y);
        BFS(x, y);
    } else if (event.key == 'd') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var x = Math.trunc(intersects[0].point.x);
        var y = 1856 - Math.ceil(intersects[0].point.y);
        BFS2(x, y);
    } else if (event.key == 'e') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var point = intersects[0].point;
        var x = Math.trunc(point.x);
        var y = 1856 - Math.ceil(point.y);
        context!.clearRect(x - Math.floor(params.brushSize / 2), y - Math.floor(params.brushSize / 2), params.brushSize, params.brushSize);
        annotationTexture.needsUpdate = true;
        uniforms.annotationTexture.value = annotationTexture;     
    } else if (event.key == 'r') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var point = intersects[0].point;
        var x = Math.trunc(point.x);
        var y = 1856 - Math.ceil(point.y);
        context!.fillStyle = "red";
        context!.fillRect(x - Math.floor(params.brushSize / 2), y - Math.floor(params.brushSize / 2), params.brushSize, params.brushSize);
        annotationTexture.needsUpdate = true;
        uniforms.annotationTexture.value = annotationTexture;     
    } else if (event.key == 't') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var point = intersects[0].point;
        var x = Math.trunc(point.x);
        var y = 1856 - Math.ceil(point.y);
        context!.fillStyle = "blue";
        context!.fillRect(x - Math.floor(params.brushSize / 2), y - Math.floor(params.brushSize / 2), params.brushSize, params.brushSize);
        annotationTexture.needsUpdate = true;
        uniforms.annotationTexture.value = annotationTexture;     
    } else if (event.key == 'p') {
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        var point = intersects[0].point;
        var x = Math.trunc(point.x);
        var y = 1856 - Math.ceil(point.y);
        polyPoints.push(x, y);
        context!.fillStyle = "red";
        context!.fillRect(x - 2, y - 2, 4, 4);
        annotationTexture.needsUpdate = true;
    } else if (event.key == 'l') {
        context!.fillStyle = "red";
        context!.beginPath();
        context!.moveTo(polyPoints[0], polyPoints[1]);
        for (var i = 2; i < polyPoints.length; i+=2) {
            context!.lineTo(polyPoints[i], polyPoints[i+1]);
        }
        context!.closePath();
        context!.fill();
        var linePixels : Array<number> = [];
        for (var i = 0; i < polyPoints.length; i+=2) {
            var x0 = polyPoints[i];
            var y0 = polyPoints[i + 1];
            var x1, y1;
            if (i + 2 == polyPoints.length) {
                x1 = polyPoints[0];
                y1 = polyPoints[1];
            } else {
                x1 = polyPoints[i + 2];
                y1 = polyPoints[i + 3];
            }
            var steep : boolean = Math.abs(y1 - y0) > Math.abs(x1 - x0);
            if (steep) {
                [x0, y0] = [y0, x0];
                [x1, y1] = [y1, x1];
            }
            if (x0 > x1) {
                [x0, x1] = [x1, x0];
                [y0, y1] = [y1, y0];
            }
            var dx = x1 - x0;
            var dy = y1 - y0;
            var gradient;
            if (dx == 0) {
                gradient = 1;
            } else {
                gradient = dy / dx;
            }
            var xend = x0;
            var yend = y0;
            var xpxl1 = xend;
            var ypxl1 = yend;
            if (steep) {
                linePixels.push(ypxl1, xpxl1);
                linePixels.push(ypxl1 + 1, xpxl1);
            } else {
                linePixels.push(xpxl1, ypxl1);
                linePixels.push(xpxl1, ypxl1 + 1);
            }
            var intery = yend + gradient;
            xend = x1;
            yend = y1;
            var xpxl2 = xend;
            var ypxl2 = yend;
            if (steep) {
                linePixels.push(ypxl2, xpxl2);
                linePixels.push(ypxl2 + 1, xpxl2);
            } else {
                linePixels.push(xpxl2, ypxl2);
                linePixels.push(xpxl2, ypxl2 + 1);
            }
            if (steep) {
                for (var x = xpxl1 + 1; x < xpxl2; x++) {
                    linePixels.push(Math.floor(intery), x);
                    linePixels.push(Math.floor(intery) + 1, x);
                    intery = intery + gradient;
                }
            } else {
                for (var x = xpxl1 + 1; x < xpxl2; x++) {
                    linePixels.push(x, Math.floor(intery));
                    linePixels.push(x, Math.floor(intery) + 1);
                    intery = intery + gradient;
                }
            }
        }
        for (var i = 0; i < linePixels.length; i+=2){
            BFS(linePixels[i], linePixels[i+1]);
        }
        polyPoints = [];
        annotationTexture.needsUpdate = true;
    }
}
const onKeyUp = (event : KeyboardEvent) => {
    if (event.key == 'e') {
        erase = false;
    }
}
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('keydown', onKeyPress);
window.addEventListener('keyup', onKeyUp);


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
                    if (blur == 0 && z == 500) {
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