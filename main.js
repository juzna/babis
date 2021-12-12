const fs = require("fs")
const yaml = require('js-yaml')

var fromDate = '2021-07-16';  // <------- SET THIS

config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));

const s = require('./server')
var client = await s.getUserBrowserSession('juzna')

// delete require.cache[require.resolve('./scrape/airbank')]

// juzna airbank
await (require('./scrape/airbank')).login(client, config.users.juzna.airbank)
await (require('./scrape/airbank')).scrape(client, {from: fromDate})

// juzna moneta
await (require('./scrape/moneta')).login(client, s.config.users.juzna.moneta)
await (require('./scrape/moneta')).scrapeCards(client, {from: fromDate})
await (require('./scrape/moneta')).scrapeAccounts(client, {from: fromDate})


await require('./scrape/airbank').logout()
await require('./scrape/moneta').logout()


// ewik airbank
await (require('./scrape/airbank')).login(client, config.users.ewik.airbank)
await (require('./scrape/airbank')).scrape(client, {from: fromDate})

// ewik moneta
await (require('./scrape/moneta')).login(client, s.config.users.ewik.moneta)
await (require('./scrape/moneta')).scrapeCards(client, {from: fromDate})
await (require('./scrape/moneta')).scrapeAccounts(client, {from: fromDate})


await require('./lib/normalize').normalizeAll()