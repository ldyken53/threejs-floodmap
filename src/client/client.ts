import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import * as TWEEN from '@tweenjs/tween.js'
import { terrainShader } from './shaders/terrain-shader'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import axios from 'axios'
import {
    init,
    sessionData,
    initVis,
    gameState,
    logMyState,
    getLocalCordinate,
    readstateFile,
    toggleAnnoation,
} from './util'
import { terrainDimensions } from './constants'
import './styles/style.css'
import * as tiff from 'tiff'

let Developer = false
let overRideControl = false
var data: Float32Array
if (window.location.hash) {
    var region = window.location.hash[window.location.hash.search('region') + 7]
    console.log(region)
} else {
    var region = '1'
}
const regionDimensions = terrainDimensions[region]
let _fetchData: any
let mesh: THREE.Mesh
fetch(`img/elevation${region}.tiff`).then((res) =>
    res.arrayBuffer().then(function (arr) {
        var tif = tiff.decode(arr)
        data = tif[0].data as Float32Array
    })
)
window.onload = init

const scene = new THREE.Scene()
// const blurs = [0, 1, 2];
// const zs = [100, 200, 300, 400, 500];

const pers = [0.02, 0.04, 0.06, 0.08, 0.1]
// const pers = [0.06]
var meshes: { [key: string]: Mesh } = {}
let eventFunction: any
let _readstateFile: () => {}
if (Developer) {
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'none'
    eventFunction = {
        BFS_Down: (x: number, y: number) => BFSHandler(x, y),
        BFS_Hill: (x: number, y: number) => BFS2Handler(x, y),
        brushClear: (x: number, y: number) => brushClearHandler(x, y),
        brushAnnotationred: (x: number, y: number) => brushAnnotationHandler('r', 'red', x, y),
        brushAnnotationblue: (x: number, y: number) => brushAnnotationHandler('t', 'blue', x, y),
        polygonSelector: (x: number, y: number) => polygonSelectionHandler(x, y),
        polygonFill: (x: number, y: number) => polygonFillHandler(),
        polygonFill2: (x: number, y: number) => polygonFill2Handler(),
        segmentationred: (x: number, y: number) => segAnnotationHandler('s', 'red', x, y),
        segmentationblue: (x: number, y: number) => segAnnotationHandler('s', 'blue', x, y),
        connectedsegmentationred: (x: number, y: number) =>
            connectedSegAnnotationHandler('d', 'red', x, y),
        connectedsegmentationblue: (x: number, y: number) =>
            connectedSegAnnotationHandler('d', 'blue', x, y),
        resetAll: (x: number, y: number) => clearAllHandler(),
    }
    _readstateFile = async () => {
        const array = await readstateFile()
        type eventKey = keyof typeof eventFunction
        let startUp = array[0].start
        let _cameraPosition = startUp.cameraPosition
        let _target = startUp.targetPosition
        camera.position.set(_cameraPosition.x, _cameraPosition.y, _cameraPosition.z)
        controls.target.set(_target.x, _target.y, _target.z)
        controls.update()
        for (let i = 1, _length = array.length; i < _length; i++) {
            let event = array[i].mouseEvent
            let _cameraPosition = event.cameraPosition
            let _target = event.targetPosition
            camera.position.set(_cameraPosition.x, _cameraPosition.y, _cameraPosition.z)
            controls.target.set(_target.x, _target.y, _target.z)
            controls.update()
            let x, y
            if (event.x == undefined) {
                x = 0
                y = 0
            } else {
                x = event.x
                y = event.y
            }
            let _action = event.label as eventKey
            eventFunction[_action](x, y)
        }
    }
}

// var persToSegs : {[key: number]: number} = {
//     20: 242,
//     30: 116,
//     40: 56,
//     50: 34
// };
// var persToIndex : {[key: number]: number} = {
//     20: 0,
//     30: 1,
//     40: 2,
//     50: 3
// };
// var segsToPixels = Array(pers.length);
// var segDatas = Array(pers.length);

const persLoader = new THREE.TextureLoader()
// var persTextures : {[key: number]: THREE.Texture} = { };
// var persCanvas = document.getElementById("streamCanvas") as HTMLCanvasElement;
// var persctx = persCanvas.getContext('2d')!;
// pers.forEach((thresh, i) => {
//    persLoader.load(
//         `./img/pers${thresh}.png`,
//         function (texture) {
//           persTextures[thresh] = texture;
//           if (thresh == 50) {
//             uniforms.persTexture.value = texture;
//           }
//         },
//         undefined,
//         function (err) {
//           console.error("An error happened.");
//         }
//     );
//     segDatas[i] = [];
//     segsToPixels[i] = {};
//     var persImage = new Image();
//     persImage.src = `img/pers${pers[i]}.png`;
//     persImage.onload = function(){
//         try {
//             persctx.drawImage(persImage, 0, 0);
//             var tempData = Array.from(persctx.getImageData(0, 0, persImage.width, persImage.height).data);
//             for (var x = 0; x < tempData.length; x+=4) {
//                 segDatas[i].push(tempData[x]);
//                 if (segsToPixels[i][tempData[x]]) {
//                     segsToPixels[i][tempData[x]].push(x / 4);
//                 } else {
//                     segsToPixels[i][tempData[x]] = [x / 4];
//                 }
//             }
//         } catch (error) {
//             console.log(error);
//         }
//     }
// });
var segsToPixels2: {
    [key: number]: {
        [key: number]: Array<number>
    }
} = {}
var persDatas: {
    [key: number]: Int16Array
} = {}

var persTextures: { [key: number]: THREE.Texture } = {}
var segsMax: { [key: number]: number } = {}
async function getPersistence() {
    // axios
    //     .get(`http://localhost:5000/test`)
    console.time('process')
    for (var i = 0; i < pers.length; i++) {
        await fetch(`img/segmentation_region${region}_pers${pers[i]}`)
            .then((r) => r.arrayBuffer())
            .then((response) => {
                persDatas[pers[i]] = new Int16Array(response)
                // segsMax[pers[i]] = response.data[pers[i]].max
                // persDatas[pers[i]] = response.data[pers[i]].array
                var max = 0
                var imageData = new Uint8Array(4 * persDatas[pers[i]].length)
                segsToPixels2[pers[i]] = {}
                for (var x = 0; x < persDatas[pers[i]].length; x++) {
                    var segID = persDatas[pers[i]][x]
                    if (segID > max) {
                        max = segID
                    }
                    imageData[x * 4] = Math.floor(segID / 1000)
                    imageData[x * 4 + 1] = Math.floor((segID % 1000) / 100)
                    imageData[x * 4 + 2] = Math.floor((segID % 100) / 10)
                    imageData[x * 4 + 3] = segID % 10
                    if (segsToPixels2[pers[i]][segID]) {
                        segsToPixels2[pers[i]][segID].push(x)
                    } else {
                        segsToPixels2[pers[i]][segID] = [x]
                    }
                }
                segsMax[pers[i]] = max
                persTextures[pers[i]] = new THREE.DataTexture(
                    imageData,
                    regionDimensions[0],
                    regionDimensions[1]
                )
                persTextures[pers[i]].needsUpdate = true
                if (pers[i] == Math.round(params.pers * 100) / 100) {
                    uniforms.persTexture.value = persTextures[pers[i]]
                    uniforms.segsMax.value = segsMax[pers[i]]
                }
            })
            .catch((error) => {
                console.log(error)
            })
    }
    console.timeEnd('process')

    if (Developer) {
        _readstateFile()
    }
}
getPersistence()
persLoader.load(
    './img/rainbow.png',
    function (texture) {
        uniforms.colormap.value = texture
    },
    undefined,
    function (err) {
        console.error('An error happened.')
    }
)
// const light = new THREE.SpotLight()
// light.position.set(4000, 4000, 20)
// scene.add(light)
// const ambient = new THREE.AmbientLight( 0x404040 ); // soft white light
// scene.add( ambient );

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(regionDimensions[0] / 2, regionDimensions[1] / 2, 1000)

const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true })
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true

document.body.appendChild(renderer.domElement)

let controls = new OrbitControls(camera, renderer.domElement)
controls.target = new THREE.Vector3(regionDimensions[0] / 2, regionDimensions[1] / 2, -2000)
controls.dampingFactor = 1.25
controls.enableDamping = true

var canvas = document.createElement('canvas')
canvas.width = regionDimensions[0]
canvas.height = regionDimensions[1]
var annotationTexture = new THREE.Texture(canvas)
var context = canvas.getContext('2d')

const gui = new GUI({ width: window.innerWidth / 5 })
var params = {
    blur: 0,
    dimension: true,
    annotation: true,
    brushSize: 5,
    pers: 0.06,
    persShow: false,
    guide: 0,
    flood: true,
    dry: false,
    annoation: 'lighten',
}
// var persIndex = persToIndex[params.pers];

var uniforms = {
    z: { value: 500 },
    diffuseTexture: { type: 't', value: new THREE.Texture() },
    annotationTexture: { type: 't', value: annotationTexture },
    persTexture: { type: 't', value: new THREE.Texture() },
    colormap: { type: 't', value: new THREE.Texture() },
    annotation: { value: 1 },
    segsMax: { type: 'f', value: 0 },
    persShow: { value: 0 },
    hoverValue: { type: 'f', value: 0 },
    guide: { value: params.guide },
    dimensions: { type: 'vec2', value: regionDimensions },
    dry: { type: 'bool', value: params.dry },
    flood: { type: 'bool', value: params.flood },
}
const viewFolder = gui.addFolder('Settings')

// viewFolder
//     .add(params, 'flood')
//     .onChange(() => {
//         params.dry = !params.flood
//         viewFolder.updateDisplay()
//     })
//     .name('Annotate Flood')

// viewFolder
//     .add(params, 'dry')
//     .onChange(() => {
//         params.flood = !params.dry
//         viewFolder.updateDisplay()
//     })
//     .name('Annotate Dry Area')
viewFolder
    .add(params, 'dimension')
    .onChange(() => {
        scene.remove(scene.children[0])
        if (params.dimension) {
            uniforms.z.value = 500
            scene.add(meshes[3])
        } else {
            uniforms.z.value = 0
            scene.add(meshes[2])
        }
    })
    .name('3D View')
viewFolder
    .add(params, 'annotation')
    .onChange(() => {
        if (params.annotation) {
            uniforms.annotation.value = 1
        } else {
            uniforms.annotation.value = 0
        }
    })
    .name('Show Annotation')
viewFolder
    .add(params, 'pers', 0.02, 0.1, 0.02)
    .onFinishChange(() => {
        uniforms.persTexture.value = persTextures[Math.round(params.pers * 100) / 100]
        uniforms.segsMax.value = segsMax[Math.round(params.pers * 100) / 100]
    })
    .name('Segmentation Detail')
viewFolder
    .add(params, 'persShow')
    .onChange(() => {
        if (params.persShow) {
            uniforms.persShow.value = 2
        } else {
            uniforms.persShow.value = 0
        }
    })
    .name('Show Borders')
// viewFolder.add(params, 'brushSize', 1, 50, 1)
viewFolder
    .add(
        {
            x: () => {
                camera.position.set(regionDimensions[0] / 2, regionDimensions[1] / 2, 2000)
                controls.target = new THREE.Vector3(
                    regionDimensions[0] / 2,
                    regionDimensions[1] / 2,
                    -2000
                )
            },
        },
        'x'
    )
    .name('Camera to Birds Eye View')
viewFolder
    .add(
        {
            x: () => {
                camera.position.set(-500, regionDimensions[1] / 2, 500)
                camera.up.set(0, 0, 1)
                controls.dispose()
                controls = new OrbitControls(camera, renderer.domElement)
                controls.target = new THREE.Vector3(
                    regionDimensions[0] / 2,
                    regionDimensions[1] / 2,
                    -1000
                )
            },
        },
        'x'
    )
    .name('Camera to Left View')
viewFolder
    .add(
        {
            x: () => {
                camera.position.set(regionDimensions[0] + 500, regionDimensions[1] / 2, 500)
                camera.up.set(0, 0, 1)
                controls.dispose()
                controls = new OrbitControls(camera, renderer.domElement)
                controls.target = new THREE.Vector3(
                    regionDimensions[0] / 2,
                    regionDimensions[1] / 2,
                    -1000
                )
            },
        },
        'x'
    )
    .name('Camera to Right View')
viewFolder
    .add(
        {
            x: () => {
                camera.position.set(regionDimensions[0] / 2, regionDimensions[1] + 500, 500)
                camera.up.set(0, 0, 1)
                controls.dispose()
                controls = new OrbitControls(camera, renderer.domElement)
                controls.target = new THREE.Vector3(
                    regionDimensions[0] / 2,
                    regionDimensions[1] / 2,
                    -1000
                )
            },
        },
        'x'
    )
    .name('Camera to Top View')
viewFolder
    .add(
        {
            x: () => {
                camera.position.set(regionDimensions[0] / 2, -500, 500)
                camera.up.set(0, 0, 1)
                controls.dispose()
                controls = new OrbitControls(camera, renderer.domElement)
                controls.target = new THREE.Vector3(
                    regionDimensions[0] / 2,
                    regionDimensions[1] / 2,
                    -1000
                )
            },
        },
        'x'
    )
    .name('Camera to Bottom View')

viewFolder.open()
// meshFolder.open()

var recentFills: Array<Array<number>> = []
var recentPolys: Array<Array<number>> = []

function segSelect(x: number, y: number) {
    recentPolys.push([])
    recentFills.push([])
    var value = persDatas[Math.round(params.pers * 100) / 100][x + y * regionDimensions[0]]
    var pixels = segsToPixels2[Math.round(params.pers * 100) / 100][value]
    for (var i = 0; i < pixels.length; i++) {
        var x = pixels[i] % regionDimensions[0]
        var y = regionDimensions[1] - 1 - Math.floor(pixels[i] / regionDimensions[0])
        recentFills[recentFills.length - 1].push(x, y)
        context!.fillRect(x, y, 1, 1)
    }
    sessionData.annotatedPixelCount = sessionData.annotatedPixelCount + pixels.length
    annotationTexture.needsUpdate = true
}

function connectedSegSelect(x: number, y: number, color: string) {
    recentFills.push([])
    recentPolys.push([])
    visited = new Map()
    BFS(x, y, 'BFS_Segment', color)
}

const searchFunction = {
    BFS_Down: {
        E: (x: number, y: number, value: number) => data[x + 1 + y * regionDimensions[0]] <= value,
        W: (x: number, y: number, value: number) => data[x - 1 + y * regionDimensions[0]] <= value,
        N: (x: number, y: number, value: number) =>
            data[x + (y + 1) * regionDimensions[0]] <= value,
        S: (x: number, y: number, value: number) =>
            data[x + (y - 1) * regionDimensions[0]] <= value,
        EN: (x: number, y: number, value: number) =>
            data[x + 1 + (y + 1) * regionDimensions[0]] <= value,
        WN: (x: number, y: number, value: number) =>
            data[x - 1 + (y + 1) * regionDimensions[0]] <= value,
        SW: (x: number, y: number, value: number) =>
            data[x - 1 + (y - 1) * regionDimensions[0]] <= value,
        SE: (x: number, y: number, value: number) =>
            data[x + 1 + (y - 1) * regionDimensions[0]] <= value,
    },
    BFS_Hill: {
        E: (x: number, y: number, value: number) => data[x + 1 + y * regionDimensions[0]] >= value,
        W: (x: number, y: number, value: number) => data[x - 1 + y * regionDimensions[0]] >= value,
        N: (x: number, y: number, value: number) =>
            data[x + (y + 1) * regionDimensions[0]] >= value,
        S: (x: number, y: number, value: number) =>
            data[x + (y - 1) * regionDimensions[0]] >= value,
        EN: (x: number, y: number, value: number) =>
            data[x + 1 + (y + 1) * regionDimensions[0]] >= value,
        WN: (x: number, y: number, value: number) =>
            data[x - 1 + (y + 1) * regionDimensions[0]] >= value,
        SW: (x: number, y: number, value: number) =>
            data[x - 1 + (y - 1) * regionDimensions[0]] >= value,
        SE: (x: number, y: number, value: number) =>
            data[x + 1 + (y - 1) * regionDimensions[0]] >= value,
    },
    BFS_Segment: {
        E: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x + 1 + y * regionDimensions[0]] ==
            value,
        W: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x - 1 + y * regionDimensions[0]] ==
            value,
        N: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x + (y + 1) * regionDimensions[0]] ==
            value,
        S: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x + (y - 1) * regionDimensions[0]] ==
            value,
        EN: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x + 1 + (y + 1) * regionDimensions[0]] ==
            value,
        WN: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x - 1 + (y + 1) * regionDimensions[0]] ==
            value,
        SW: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x - 1 + (y - 1) * regionDimensions[0]] ==
            value,
        SE: (x: number, y: number, value: number) =>
            persDatas[Math.round(params.pers * 100) / 100][x + 1 + (y - 1) * regionDimensions[0]] ==
            value,
    },
}

const valueFunction = {
    BFS_Down: (x: number, y: number) => data[x + y * regionDimensions[0]],
    BFS_Hill: (x: number, y: number) => data[x + y * regionDimensions[0]],
    BFS_Segment: (x: number, y: number) =>
        persDatas[Math.round(params.pers * 100) / 100][x + y * regionDimensions[0]],
}

const fillFunction = {
    BFS_Down: (x: number, y: number) => [x, regionDimensions[1] - 1 - y],
    BFS_Hill: (x: number, y: number) => [x, regionDimensions[1] - 1 - y],
    BFS_Segment: (x: number, y: number) => [x, regionDimensions[1] - 1 - y],
}

var visited = new Map()
function BFS(x: number, y: number, direction: string, color: string) {
    context!.fillStyle = color
    var stack = []
    visited.set(`${x}, ${y}`, 1)
    stack.push(x, y)
    type ObjectKey = keyof typeof searchFunction
    let _direction = direction as ObjectKey
    while (stack.length > 0) {
        y = stack.pop()!
        x = stack.pop()!
        let [fillX, fillY] = fillFunction[_direction](x, y)
        context!.fillRect(fillX, fillY, 1, 1)
        recentFills[recentFills.length - 1].push(fillX, fillY)
        var value = valueFunction[_direction](x, y)
        if (searchFunction[_direction].E(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x + 1}, ${y}`, 1)
                stack.push(x + 1, y)
            }
        }
        if (searchFunction[_direction].W(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y}`, 1)
                stack.push(x - 1, y)
            }
        }
        if (searchFunction[_direction].N(x, y, value)) {
            if (!visited.get(`${x}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x}, ${y + 1}`, 1)
                stack.push(x, y + 1)
            }
        }
        if (searchFunction[_direction].S(x, y, value)) {
            if (!visited.get(`${x}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x}, ${y - 1}`, 1)
                stack.push(x, y - 1)
            }
        }
        if (searchFunction[_direction].EN(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x + 1}, ${y + 1}`, 1)
                stack.push(x + 1, y + 1)
            }
        }
        if (searchFunction[_direction].WN(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y + 1}`, 1)
                stack.push(x - 1, y + 1)
            }
        }
        if (searchFunction[_direction].SW(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y - 1}`, 1)
                stack.push(x - 1, y - 1)
            }
        }
        if (searchFunction[_direction].SE(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x + 1}, ${y - 1}`, 1)
                stack.push(x + 1, y - 1)
            }
        }
    }
    annotationTexture.needsUpdate = true
    // uniforms.annotationTexture.value = annotationTexture;
}

function fpart(x: number) {
    return x - Math.floor(x)
}
function rfpart(x: number) {
    return 1 - fpart(x)
}

var guide = false
const pointer = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const onMouseMove = (event: MouseEvent) => {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}
var polyPoints: Array<number> = []
const state = {
    BFS: true,
    segmentation: true,
    brushSelection: { clear: true, select: true },
    polygonSelection: true,
    segEnabled: true,
}

function performRayCasting() {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var point = intersects[0].point
    var x = Math.trunc(point.x)
    var y = Math.ceil(point.y)
    return [x, y]
}

function hoverHandler() {
    let [x, y] = performRayCasting()
    let localId = persDatas[Math.round(params.pers * 100) / 100][x + y * regionDimensions[0]]
    console.log(localId)
    uniforms.hoverValue.value = localId
    params.guide = 1
    uniforms.guide.value = params.guide
}

function BFSHandler(x: number, y: number) {
    logMyState('f', 'BFS_Down', camera, pointer, x, y)
    visited = new Map()
    recentFills.push([])
    recentPolys.push([])
    BFS(x, y, 'BFS_Down', 'red')
}

function BFS2Handler(x: number, y: number) {
    logMyState('f', 'BFS_Hill', camera, pointer, x, y)
    visited = new Map()
    recentFills.push([])
    recentPolys.push([])
    BFS(x, y, 'BFS_Hill', 'blue')
}

function brushClearHandler(x: number, y: number) {
    context!.clearRect(
        x - Math.floor(params.brushSize / 2),
        y - Math.floor(params.brushSize / 2),
        params.brushSize,
        params.brushSize
    )

    sessionData.annotatedPixelCount -= params.brushSize * params.brushSize
    annotationTexture.needsUpdate = true
    uniforms.annotationTexture.value = annotationTexture
    logMyState('e', 'brushClear', camera, pointer, x, y, params.brushSize)
}

function brushAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color !!')
        return
    }

    context!.fillStyle = color
    context!.fillRect(
        x - Math.floor(params.brushSize / 2),
        y - Math.floor(params.brushSize / 2),
        params.brushSize,
        params.brushSize
    )
    sessionData.annotatedPixelCount += params.brushSize * params.brushSize
    annotationTexture.needsUpdate = true
    uniforms.annotationTexture.value = annotationTexture
    logMyState(key, 'brushAnnotation' + color, camera, pointer, x, y, params.brushSize)
}

function polygonSelectionHandler(x: number, y: number) {
    console.log('t')
    polyPoints.push(x, y)
    context!.fillStyle = 'red'
    context!.fillRect(x - 2, regionDimensions[1] - 1 - y - 2, 4, 4)
    logMyState('p', 'polygonSelector', camera, pointer, x, y, params.brushSize)
    sessionData.annotatedPixelCount += 16 //follow this with the line selection to minimize the double counting
    annotationTexture.needsUpdate = true
}

function polygonFillHandler() {
    context!.fillStyle = 'red'
    context!.beginPath()
    logMyState('o', 'polygonFill', camera, undefined, undefined, undefined, undefined, polyPoints)
    recentPolys.push(polyPoints)
    context!.moveTo(polyPoints[0], regionDimensions[1] - 1 - polyPoints[1])
    for (var i = 2; i < polyPoints.length; i += 2) {
        context!.lineTo(polyPoints[i], regionDimensions[1] - 1 - polyPoints[i + 1])
        context!.clearRect(polyPoints[i] - 2, regionDimensions[1] - 1 - polyPoints[i + 1] - 2, 4, 4)
    }
    context!.closePath()
    context!.fill()
    sessionData.numberofClick++
    var linePixels: Array<number> = []
    for (var i = 0; i < polyPoints.length; i += 2) {
        var x0 = polyPoints[i]
        var y0 = polyPoints[i + 1]
        var x1, y1
        if (i + 2 == polyPoints.length) {
            x1 = polyPoints[0]
            y1 = polyPoints[1]
        } else {
            x1 = polyPoints[i + 2]
            y1 = polyPoints[i + 3]
        }
        var steep: boolean = Math.abs(y1 - y0) > Math.abs(x1 - x0)
        if (steep) {
            ;[x0, y0] = [y0, x0]
            ;[x1, y1] = [y1, x1]
        }
        if (x0 > x1) {
            ;[x0, x1] = [x1, x0]
            ;[y0, y1] = [y1, y0]
        }
        var dx = x1 - x0
        var dy = y1 - y0
        var gradient
        if (dx == 0) {
            gradient = 1
        } else {
            gradient = dy / dx
        }
        var xend = x0
        var yend = y0
        var xpxl1 = xend
        var ypxl1 = yend
        if (steep) {
            linePixels.push(ypxl1, xpxl1)
            linePixels.push(ypxl1 + 1, xpxl1)
        } else {
            linePixels.push(xpxl1, ypxl1)
            linePixels.push(xpxl1, ypxl1 + 1)
        }
        var intery = yend + gradient
        xend = x1
        yend = y1
        var xpxl2 = xend
        var ypxl2 = yend
        if (steep) {
            linePixels.push(ypxl2, xpxl2)
            linePixels.push(ypxl2 + 1, xpxl2)
        } else {
            linePixels.push(xpxl2, ypxl2)
            linePixels.push(xpxl2, ypxl2 + 1)
        }
        if (steep) {
            for (var x = xpxl1 + 1; x < xpxl2; x++) {
                linePixels.push(Math.floor(intery), x)
                linePixels.push(Math.floor(intery) + 1, x)
                intery = intery + gradient
            }
        } else {
            for (var x = xpxl1 + 1; x < xpxl2; x++) {
                linePixels.push(x, Math.floor(intery))
                linePixels.push(x, Math.floor(intery) + 1)
                intery = intery + gradient
            }
        }
    }
    recentFills.push([])
    visited = new Map()
    for (var i = 0; i < linePixels.length; i += 2) {
        BFS(linePixels[i], linePixels[i + 1], 'BFS_Down', 'red')
    }
    polyPoints = []
    annotationTexture.needsUpdate = true
}

function polygonFill2Handler() {
    context!.fillStyle = 'blue'
    context!.beginPath()
    logMyState('o', 'polygonFill2', camera, undefined, undefined, undefined, undefined, polyPoints)
    recentPolys.push(polyPoints)
    context!.moveTo(polyPoints[0], regionDimensions[1] - 1 - polyPoints[1])
    for (var i = 2; i < polyPoints.length; i += 2) {
        context!.lineTo(polyPoints[i], regionDimensions[1] - 1 - polyPoints[i + 1])
        context!.clearRect(polyPoints[i] - 2, regionDimensions[1] - 1 - polyPoints[i + 1] - 2, 4, 4)
    }
    context!.closePath()
    context!.fill()
    sessionData.numberofClick++
    var linePixels: Array<number> = []
    for (var i = 0; i < polyPoints.length; i += 2) {
        var x0 = polyPoints[i]
        var y0 = polyPoints[i + 1]
        var x1, y1
        if (i + 2 == polyPoints.length) {
            x1 = polyPoints[0]
            y1 = polyPoints[1]
        } else {
            x1 = polyPoints[i + 2]
            y1 = polyPoints[i + 3]
        }
        var steep: boolean = Math.abs(y1 - y0) > Math.abs(x1 - x0)
        if (steep) {
            ;[x0, y0] = [y0, x0]
            ;[x1, y1] = [y1, x1]
        }
        if (x0 > x1) {
            ;[x0, x1] = [x1, x0]
            ;[y0, y1] = [y1, y0]
        }
        var dx = x1 - x0
        var dy = y1 - y0
        var gradient
        if (dx == 0) {
            gradient = 1
        } else {
            gradient = dy / dx
        }
        var xend = x0
        var yend = y0
        var xpxl1 = xend
        var ypxl1 = yend
        if (steep) {
            linePixels.push(ypxl1, xpxl1)
            linePixels.push(ypxl1 + 1, xpxl1)
        } else {
            linePixels.push(xpxl1, ypxl1)
            linePixels.push(xpxl1, ypxl1 + 1)
        }
        var intery = yend + gradient
        xend = x1
        yend = y1
        var xpxl2 = xend
        var ypxl2 = yend
        if (steep) {
            linePixels.push(ypxl2, xpxl2)
            linePixels.push(ypxl2 + 1, xpxl2)
        } else {
            linePixels.push(xpxl2, ypxl2)
            linePixels.push(xpxl2, ypxl2 + 1)
        }
        if (steep) {
            for (var x = xpxl1 + 1; x < xpxl2; x++) {
                linePixels.push(Math.floor(intery), x)
                linePixels.push(Math.floor(intery) + 1, x)
                intery = intery + gradient
            }
        } else {
            for (var x = xpxl1 + 1; x < xpxl2; x++) {
                linePixels.push(x, Math.floor(intery))
                linePixels.push(x, Math.floor(intery) + 1)
                intery = intery + gradient
            }
        }
    }
    recentFills.push([])
    visited = new Map()
    for (var i = 0; i < linePixels.length; i += 2) {
        BFS(linePixels[i], linePixels[i + 1], 'BFS_Hill', 'blue')
    }
    polyPoints = []
    annotationTexture.needsUpdate = true
}

function segAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color')
        return
    }
    context!.fillStyle = color
    logMyState(key, 'segmentation' + color, camera, pointer, x, y)
    segSelect(x, y)
}

function connectedSegAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color')
        return
    }
    logMyState(key, 'connectedsegmentation' + color, camera, pointer, x, y)
    connectedSegSelect(x, y, color)
}

function clearAllHandler() {
    var lastPixels = recentFills.pop()!
    for (var i = 0; i < lastPixels.length; i += 2) {
        context!.clearRect(lastPixels[i], lastPixels[i + 1], 1, 1)
    }
    var lastPoly = recentPolys.pop()!
    if (lastPoly[0]) {
        context!.moveTo(lastPoly[0], regionDimensions[1] - 1 - lastPoly[1])
        for (var i = 2; i < lastPoly.length; i += 2) {
            context!.lineTo(lastPoly[i], regionDimensions[1] - 1 - lastPoly[i + 1])
        }
        context!.closePath()
        context!.globalCompositeOperation = 'destination-out'
        context!.fillStyle = 'blue'
        context!.fill()
        // second pass, the actual painting, with the desired color
        context!.globalCompositeOperation = 'source-over'
        context!.fillStyle = 'rgba(0,0,0,0)'
        context!.fill()
    }
    annotationTexture.needsUpdate = true
    logMyState('z', 'resetAll', camera, undefined, undefined, undefined)
}

const onKeyPress = (event: KeyboardEvent) => {
    if (event.repeat) {
        return
    }
    // if (event.key == 'Escape') {
    //     camera.position.set(2000, 1000, 1000)
    //     controls.target = new THREE.Vector3(2000, 1000, -2000)
    // } else
    if (event.key == 'm') {
        ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'block'
    } else if (event.key == 'g') {
        hoverHandler()
    } else if (event.key == 'f' && state.BFS) {
        let [x, y] = performRayCasting()
        if (params.flood) {
            BFSHandler(x, y)
        } else {
            BFS2Handler(x, y)
        }
    } else if (event.key == 'e' && state.brushSelection.clear) {
        let [x, y] = performRayCasting()
        y = regionDimensions[1] - y
        brushClearHandler(x, y)
    } else if (event.key == 'r' && state.brushSelection.select && params.flood) {
        let [x, y] = performRayCasting()
        y = regionDimensions[1] - y
        brushAnnotationHandler('r', 'red', x, y)
    } else if (event.key == 't' && state.brushSelection.select && params.dry) {
        let [x, y] = performRayCasting()
        y = regionDimensions[1] - y
        brushAnnotationHandler('t', 'blue', x, y)
    } else if (event.key == 'p' && state.polygonSelection) {
        let [x, y] = performRayCasting()
        // y = regionDimensions[1] - y
        polygonSelectionHandler(x, y)
    } else if (event.key == 'o' && state.polygonSelection) {
        if (params.flood) {
            polygonFillHandler()
        } else {
            polygonFill2Handler()
        }
    } else if (event.key == 's' && state.segEnabled) {
        let [x, y] = performRayCasting()
        if (params.flood) {
            segAnnotationHandler('s', 'red', x, y)
        } else {
            segAnnotationHandler('s', 'blue', x, y)
        }
    } else if (event.key == 'd' && state.segEnabled) {
        let [x, y] = performRayCasting()
        if (params.flood) {
            connectedSegAnnotationHandler('d', 'red', x, y)
        } else {
            connectedSegAnnotationHandler('d', 'blue', x, y)
        }
    } else if (event.key == 'z') {
        clearAllHandler()
    }
}
const onKeyUp = (event: KeyboardEvent) => {
    if (event.key == 'g') {
        params.guide = 0
        uniforms.guide.value = params.guide
    }
}

function startUp() {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyPress)
    window.addEventListener('keyup', onKeyUp)
    document.getElementById('cancel')?.addEventListener('click', () => {
        ;(document.getElementById('uploadForm') as HTMLFormElement).style.display = 'none'
        ;(document.getElementById('download') as HTMLElement).style.display = 'block'
    })
}

const satelliteLoader = new THREE.TextureLoader()
satelliteLoader.load(
    `./img/Region_${region}_RGB.png`,
    function (texture) {
        uniforms.diffuseTexture.value = texture
        const meshMaterial = new THREE.RawShaderMaterial({
            uniforms: uniforms,
            vertexShader: terrainShader._VS,
            fragmentShader: terrainShader._FS,
        })
        const terrainLoader = new STLLoader()
        ;[2, 3].forEach((x) => {
            terrainLoader.load(
                `stl/${x}Dregion${region}.stl`,
                function (geometry) {
                    geometry.computeBoundingBox()
                    geometry.computeVertexNormals()

                    mesh = new THREE.Mesh(geometry, meshMaterial)
                    mesh.receiveShadow = true
                    mesh.castShadow = true
                    mesh.position.set(0, 0, -100)
                    meshes[x] = mesh
                    if (x == 3) {
                        scene.add(mesh)
                        console.log(scene)
                    }
                },
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
                },
                (error) => {
                    console.log(error)
                }
            )
            setTimeout(function () {
                ;(document.getElementById('loader') as HTMLElement).style.display = 'none'
                if (!Developer) {
                    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display =
                        'block'
                }
            }, 2000)
        })
    },
    undefined,
    function (err) {
        console.error('An error happened.')
    }
)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    gui.width = window.innerWidth / 5
    render()
}

function animate() {
    requestAnimationFrame(animate)
    if (!Developer || overRideControl) {
        controls.update()
    }
    TWEEN.update()
    // let position = new THREE.Vector3()
    // camera.getWorldPosition(position)
    render()
}

function render() {
    renderer.render(scene, camera)
}

function startState() {
    let startStateData = {
        label: 'start',
        aspectRatio: camera.aspect,
        cameraPosition: camera.position.clone(),
        targetPosition: controls.target.clone(),
        time: new Date(),
    }
    gameState.push({ start: startStateData })
}

function getCameraLastStage() {
    return {
        position: camera.position.clone(),
        lookAt: controls.target,
    }
}

startState()
animate()

export {
    canvas,
    startUp,
    controls,
    mesh,
    pointer,
    renderer,
    camera,
    TWEEN,
    raycaster,
    scene,
    params,
    uniforms,
}
