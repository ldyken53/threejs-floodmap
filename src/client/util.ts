type sessionDataType = {
    name: string
    sessionStart: Date | null
    sessionEnd: Date | null
    totalSessionTime: number
    wasCompleted: boolean
}

const sessionData: sessionDataType = {
    name: 'Pravin',
    sessionStart: null,
    sessionEnd: null,
    totalSessionTime: 0,
    wasCompleted: false,
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

function resetCamera(controls: any) {
    controls.reset()
    return controls
}

function startSession(event: Event) {
    event.preventDefault()
    ;(event.target as HTMLTextAreaElement).style.display = 'none'
    sessionData.sessionStart = new Date()
}

function endSession(event: Event) {
    event.preventDefault()
    ;(event.target as HTMLTextAreaElement).style.display = 'none'
    sessionData.sessionEnd = new Date()
    sessionData.wasCompleted = false
    sessionData.totalSessionTime = Math.abs(
        sessionData.sessionStart!.valueOf() - sessionData.sessionEnd!.valueOf()
    )
}

function downloadSession(event: Event) {
    ;(document.getElementById('download') as HTMLElement).style.display = 'none'
    const _data = JSON.stringify(sessionData)
    const _fileName = 'session_' + sessionData.name + '.json'
    download(_fileName, _data)
}

function init() {
    document.getElementById('start')?.addEventListener('click', startSession)
    document.getElementById('end')?.addEventListener('click', endSession)
    document.getElementById('download')?.addEventListener('click', downloadSession)
}

export { resetCamera, startSession, endSession, init }