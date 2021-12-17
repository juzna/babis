const Apify = require('apify');
const yaml = require("js-yaml");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const {normalizeAll} = require("./lib/normalize");


Apify.main(async () => {
  const {
    from, // 2021-10-15
    user,
    bank,
  } = await Apify.getInput() || {}
  
  const config = yaml.load(process.env.CONFIG ?? fs.readFileSync('config.yaml', 'utf8'))

  // Check config vs input.
  if (!config.users[user]) throw new Error('Unknown user, not in config')
  if (!config.users[user][bank]) throw new Error('Unknown bank, not in config for user')
  
  // Start browser; needs a different way on Apify platform ¯\_(ツ)_/¯.
  console.log('Starting browser')
  let browser
  if (process.env.USER === 'juzna') {
    browser = await puppeteer.launch({
      headless: false,
      args: [`--window-size=1280,600`],
      defaultViewport: {
        width: 1280,
        height: 600,
      }
    })
  } else {
    browser = await Apify.launchPuppeteer()
  }
  
  const page = await browser.newPage()

  // Set download directory; experimental.
  const downloadPath = path.resolve(__dirname, './output')
  fs.mkdirSync(downloadPath, {recursive: true})
  await page._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
  })  

  console.log('Scraping bank')
  const bankModule = require(`./scrape/${bank}`)
  await bankModule.login(page, config.users[user][bank])
  await bankModule.scrape(page, {from})
  await bankModule.logout(page)
  console.log('Scraping finished')
  
  console.log('Normalizing rows and pushing data')
  for await (const [file, rows] of normalizeAll(downloadPath, bankModule.normalizeFile)) {
    await Apify.pushData(rows)
    console.log('Processed file', file)
  }
})
