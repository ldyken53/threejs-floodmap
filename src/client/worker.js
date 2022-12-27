import { Archive } from 'libarchive.js/main.js'
Archive.init({
    workerUrl: './worker-bundle.js',
})

function intialize() {
    document.getElementById('file').addEventListener('change', async (e) => {
        const file = e.currentTarget.files[0]

        const archive = await Archive.open(file)
        let obj = await archive.extractFiles()

        console.log(obj)
    })
}

export { intialize }
