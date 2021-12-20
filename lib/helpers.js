function appendToFilename (filename, string) {
  const dotIndex = filename.lastIndexOf(".")
  if (dotIndex === -1) return filename + string
  return filename.substring(0, dotIndex) + string + filename.substring(dotIndex)
}
exports.appendToFilename = appendToFilename

/**
 * @type {<T>(promises: Promise<T>[]) => Promise<[number, T]>}
 */
async function raceWithIndex(promises) {
  return await Promise.race(
    promises.map(async (p, i) => p.then(val => ([i, val])))
  )
}
exports.raceWithIndex = raceWithIndex