import { Camera } from 'three'
import { startUp } from './client'
const pixelCount = 7617024

interface sessionDataType {
    name: string
    sessionStart: Date | null
    sessionEnd: Date | null
    'totalSessionTime_M:S:MS': string
    wasCompleted: boolean
    annotatedPixelCount: number
    numberofClick: number
    numberofUndo: number
    numberofReset: number
}

interface gameEventType {
    label: string
    clickPosition?: THREE.Vector2
    keyPressed?: string
    brushSize?: number
    x?: number
    y?: number
    linePoints?: Array<number>
    aspectRatio: number
    cameraPosition: THREE.Vector3
    time: Date
}

interface gameStateType {
    [key: string]: gameEventType
}

const sessionData: sessionDataType = {
    name: 'Pravin',
    sessionStart: null,
    sessionEnd: null,
    'totalSessionTime_M:S:MS': '0:0:0',
    wasCompleted: false,
    annotatedPixelCount: 0,
    numberofClick: 0,
    numberofUndo: 0,
    numberofReset: 0,
}

// vector.applyMatrix(camera.matrixWorld)

const gameState: Array<gameStateType> = []

function logMyState(
    key: string,
    event: string,
    camera: THREE.PerspectiveCamera,
    pointer?: THREE.Vector2,
    x?: number,
    y?: number,
    brushSize?: number,
    linePoints?: Array<number>
) {
    let tempS: string = `${key} pressed in ${event}`

    let stateData
    if (brushSize != undefined) {
        stateData = {
            label: tempS,
            clickPosition: pointer,
            keyPressed: key,
            x: x,
            y: y,
            aspectRatio: camera.aspect,
            cameraPosition: camera.position.clone(),
            time: new Date(),
        }
    }

    if (linePoints != undefined) {
        stateData = {
            label: tempS,
            aspectRatio: camera.aspect,
            keyPressed: key,
            cameraPosition: camera.position.clone(),
            time: new Date(),
            linePoints: linePoints,
        }
    } else {
        stateData = {
            label: tempS,
            clickPosition: pointer,
            keyPressed: key,
            x: x,
            y: y,
            aspectRatio: camera.aspect,
            cameraPosition: camera.position.clone(),
            time: new Date(),
            brushSize: brushSize,
        }
    }
    gameState.push({ mouseEvent: stateData })
}

function download(filename: string, text: string) {
    var element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
    element.setAttribute('download', filename)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}

function convertToSecMins(millisecond: number) {
    const minutes = Math.floor(millisecond / 60000)
    const seconds = ((millisecond % 60000) / 1000).toFixed(0)
    const milliseconds = (millisecond % 1000).toFixed(0)
    return minutes + ':' + (+seconds < 10 ? '0' : '') + seconds + ':' + milliseconds
}

function resetCamera(controls: any) {
    controls.reset()
    return controls
}

function startSession(event: Event) {
    event.preventDefault()
    ;(event.target as HTMLButtonElement).style.display = 'none'
    sessionData.sessionStart = new Date()
    startUp()
}

function endSession(event: Event) {
    event.preventDefault()
    ;(event.target as HTMLButtonElement).style.display = 'none'
    sessionData.sessionEnd = new Date()
    sessionData.wasCompleted = false
    let totalSessionTime = Math.abs(
        sessionData.sessionStart!.valueOf() - sessionData.sessionEnd!.valueOf()
    )
    sessionData['totalSessionTime_M:S:MS'] = convertToSecMins(totalSessionTime)
    if (sessionData.annotatedPixelCount > 0.9 * pixelCount) {
        sessionData.wasCompleted = true
    }
}

function downloadSession(event: Event) {
    ;(document.getElementById('download') as HTMLElement).style.display = 'none'
    const _data = JSON.stringify(gameState)
    const _fileName = 'session_' + sessionData.name + '.json'
    download(_fileName, _data)
}

function hideModal() {
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'none'
    ;(document.getElementById('ui-menu') as HTMLElement).style.display = 'block'
    let userId = (document.getElementById('studentId') as HTMLInputElement).value
    sessionData.name = userId
}

function init() {
    document.getElementById('start')?.addEventListener('click', startSession)
    document.getElementById('end')?.addEventListener('click', endSession)
    document.getElementById('download')?.addEventListener('click', downloadSession)
    document.getElementById('exploration')?.addEventListener('click', hideModal)
}

function initVis() {
    ;(document.getElementById('loader') as HTMLElement).style.display = 'none'
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'block'
}

export { resetCamera, startSession, endSession, init, initVis, sessionData, gameState, logMyState }
