const chokidar = require('chokidar')
const path = require('path')

module.exports = class Watcher {
  constructor(options) {
    const { onReady, onTrigger, onCollectFiles, onError } = options
    this.onReady = onReady
    this.onTrigger = onTrigger
    this.onCollectFiles = onCollectFiles
    this.onError = onError
  }

  async watch() {
    // Collect files to watch
    let files = await this.onCollectFiles()

    // Initialize watcher
    this.watcher = chokidar.watch(files, {
      persistent: true,
      ignoreInitial: true,
      atomic: 500,
    })

    // Bind variables locally
    let watcher = this.watcher
    let onTrigger = this.onTrigger
    let onCollectFiles = this.onCollectFiles
    let onError = this.onError
    let onReady = this.onReady

    watcher.on('ready', async () => {
      // Notify listeners that we're watching
      onReady()

      // Trigger once when ready
      await onTrigger(undefined)
    })

    watcher.on('error', error => {
      onError(error)
    })

    watcher.on('all', async (eventType, file) => {
      try {
        // Collect watch all new files to watch
        let newFiles = await onCollectFiles()

        // Collect watched files, if there are any
        let watchedFiles = []

        let watched = watcher.getWatched()
        watchedFiles = Object.keys(watched).reduce(
          (files, dirname) =>
            watched[dirname].reduce((files, filename) => {
              files.push(path.resolve(path.join(dirname, filename)))
              return files
            }, files),
          [],
        )

        let diff = (xs, ys) => ({
          added: ys.filter(y => xs.indexOf(y) < 0),
          removed: xs.filter(x => ys.indexOf(x) < 0),
        })

        // Diff previously watched files and new files; then remove and
        // add files from/to the watcher accordingly
        let filesDiff = diff(watchedFiles, newFiles)
        watcher.unwatch(filesDiff.removed)
        watcher.add(filesDiff.added)

        // Run the trigger callback
        await onTrigger(file)
      } catch (e) {
        onError(e)
      }
    })
  }

  close() {
    if (this.watcher !== undefined) {
      this.watcher.close()
    }
  }
}
