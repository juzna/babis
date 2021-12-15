const fs = require('fs')
const yaml = require('js-yaml')
const puppeteer = require('puppeteer')

var fromDate = '2021-10-25';  // <------- SET THIS

config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));


function reload(module) {
  let id = require.resolve(module)
  if (id in require.cache) delete require.cache[id]
  return require(module)
}

(async function() {

  const browser = await puppeteer.launch({
    headless: false, args: [`--window-size=1280,600`],
    defaultViewport: {
      width: 1280,
      height: 600,
    }
  })
  const page = await browser.newPage()
  
  
// delete require.cache[require.resolve('./scrape/airbank')]

// juzna airbank
  await reload('./scrape/airbank').login(page, config.users.juzna.airbank)
  await reload('./scrape/airbank').scrape(page, {from: fromDate})
  await reload('./scrape/airbank').logout(page)

// juzna moneta
  await (reload('./scrape/moneta')).login(page, config.users.juzna.moneta)
  await (reload('./scrape/moneta')).scrapeCards(page, {from: fromDate})
  await (reload('./scrape/moneta')).scrapeAccounts(page, {from: fromDate})


  await require('./scrape/moneta').logout()


// ewik airbank
  await (require('./scrape/airbank')).login(client, config.users.ewik.airbank)
  await (require('./scrape/airbank')).scrape(client, {from: fromDate})

// ewik moneta
  await (require('./scrape/moneta')).login(client, s.config.users.ewik.moneta)
  await (require('./scrape/moneta')).scrapeCards(client, {from: fromDate})
  await (require('./scrape/moneta')).scrapeAccounts(client, {from: fromDate})


  await require('./lib/normalize').normalizeAll()

})()