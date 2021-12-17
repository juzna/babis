const fs = require("fs")
const parseCsv = require("csv-parse/lib/sync")
const stringifyCsv = require("csv-stringify/lib/sync")
const util = require("util")
const glob = require("glob").sync
const iconv = require("iconv-lite")

/* eslint-disable quote-props */
const PATTERNS = {
  "AirBank Rewards": "Air Bank | Odměny za placení | Připsání odměn",
  "Albert": "ALBERT VAM DEKUJE",
  "Apple Services": "APPLE.COM/BILL",
  "Billa": "BILLA, spol. s r. o.",
  "Gas": "CS EUROOIL KRENOVICE",
  "Rohlik": "DEKUJEME, ROHLIK.CZ",
  "Dm": "dm drogerie markt s.r.o.",
  "JetBrains Sub": /^JetBrains/,
  "Pharmacy": /^LEKARNA/,
  "Lidl": "LIDL DEKUJE ZA NAKUP",
  "Makro": "MAKRO, spol. s r.o.",
  "MND (Electricity)": /^MND A.S./,
  "OBRAZ - Obránci zvířat": /^OBRAZ - Obránci zvíř/,
  "Steam": /STEAM GAMES/,
  "Ring Sub": /^RING MONTHLY PLAN/,
  "Apartment fund": /^Společenství pro dům/,
  "T-Mobile": "T-MOBILE CZ",
  "Vodafone (UPC) internet": "Vodafone Czech Republic a.s.",
  "Sklizeno": /^SKLIZENO/,
}
/* eslint-enable quote-props */

function _clean(x) {
  for (const [val, pattern] of Object.entries(PATTERNS)) {
    if (typeof pattern === "string") {
      if (x === pattern) return val
    } else if (typeof pattern === "object") { // RegExp
      if (pattern.test(x)) return val
    }
  }
  return x
}

function clean(transactions) {
  return transactions.map(x => Object.assign(
    {},
    x,
    { description: _clean(x.description) },
  ))
}


/**
 * 
 * @param {string} downloadPath
 * @param {Function<>} normalizeFileFunc
 * @returns {Promise<void>}
 */
async function* normalizeAll(downloadPath, normalizeFileFunc) {
  const files = glob("output/*")
  for (const file of files) {
    if (file.includes("_normalized")) continue
    
    let normalized = await normalizeFileFunc(file)
    if (!normalized) continue  // file not recognized?
    
    normalized = normalized.sort((a, b) => (a.date > b.date ? 1 : -1))

    normalized = clean(normalized)
    yield [file, normalized]
  }
}

async function normalizeAllToTsv(downloadPath, normalizeFileFunc) {
  for await ([file, normalized] of  normalizeAll(downloadPath, normalizeFileFunc)) {
    const csvStringified = stringifyCsv(normalized, {
      header: true,
      quoted: false,
      delimiter: "\t",
      columns: ['month', 'date', 'account', 'action', 'payee', 'note', 'category', 'amount', 'currency', 'amount in currency']
    })
    fs.writeFileSync(file.replace(/.\w+$/, "_normalized.tsv"), csvStringified)

    console.log('Normalized', file)
  }
}

module.exports = {
  normalizeAll,
  normalizeAllToTsv,
};
