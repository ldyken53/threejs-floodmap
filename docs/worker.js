// import * as $ from 'jquery'

// console.log('hi')

//self is a reference to worker and worker object is global object to this script
// onmessage = function (message) {
//     console.log(message)
//     unzipFolder()
// }

function unzipFolder() {
    var readFile = function () {
        $('#status').html('<br/>')
        var url = $('#urlToLoad').val()
        var doneReading = function (zip) {
            extractEntries(zip)
        }

        var zipFile = new ZipFile(url, doneReading)
    }

    // this function extracts the entries from an instantiated zip
    function extractEntries(zip) {
        $('#report').accordion('destroy')

        // clear
        $('#report').html('')

        var extractCb = function (id) {
            // this callback is invoked with the entry name, and entry text
            // in my demo, the text is just injected into an accordion panel.
            return function (entryName, entryText) {
                var content = entryText.replace(new RegExp('\\n', 'g'), '<br/>')
                $('#' + id).html(content)
                $('#status').append('extract cb, entry(' + entryName + ')  id(' + id + ')<br/>')
                $('#report').accordion('destroy')
                $('#report').accordion({ collapsible: true, active: false })
            }
        }

        // for each entry in the zip, extract it.
        for (var i = 0; i < zip.entries.length; i++) {
            var entry = zip.entries[i]

            var entryInfo = '<h4><a>' + entry.name + '</a></h4>\n<div>'

            // contrive an id for the entry, make it unique
            var randomId = 'id-' + Math.floor(Math.random() * 1000000000)

            entryInfo +=
                "<span class='inputDiv'><h4>Content:</h4><span id='" +
                randomId +
                "'></span></span></div>\n"

            // insert the info for one entry as the last child within the report div
            $('#report').append(entryInfo)

            // extract asynchronously
            entry.extract(extractCb(randomId))
        }
    }
}
