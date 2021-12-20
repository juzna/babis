/* eslint-disable no-await-in-loop, no-console */
const moment = require("moment");
const puppeteer = require('puppeteer')
const fs = require("fs");


async function clickOnText(page, elementType, text) {
  const [button] = await page.$x(`//${elementType}[contains(., '${text}')]`)
  await button.click()
  return button
}


/**
 * Log in as given user; may need to confirm MFA on the registered phone.
 *
 * @param {puppeteer.Page} page
 * @param country
 * @param phone
 * @param pin
 * @returns {Promise<void>}
 */
async function login(page, {country, phone, pin}) {
  console.log("Logging in to Revolut")
  await page.goto("https://app.revolut.com/start")
  await page.waitForTimeout(500)

  // Phone number
  console.log("Entering phone number")
  await page.type('form input', country.substr(0, 6))
  await (await page.$x(`//div[text()="${country}"]`))[0].click()
  await page.type('input[name="phoneNumber"]', phone)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)

  // PIN
  console.log("Entering pin")
  for (const digit of pin.split('')) await page.keyboard.press(digit)

  // Wait for MFA to finish
  console.log("Waiting for MFA")
  await page.waitForXPath('//button[contains(., "Accounts")]', {timeout: 60 * 1000})
  console.log("... MFA confirmed")
}


/**
 * Scrape for all transactions.
 * 
 * @param {puppeteer.Page} page
 * @returns {Promise<*>} Returns JSON of all payments.
 */
async function scrape(page) {
  // Open all accounts and catch an XHR request.
  let resp = (await Promise.all([
    page.goto('https://app.revolut.com/home/accounts?accountId=all_accounts'),
    page.waitForResponse((resp) => resp.url().match(/\/transactions\/last\b/), {timeout: 5 * 1000}),
  ]))[1]
  return await resp.json()
}


async function scrapeToJson(page, file_suffix) {
  let j = await scrape(page)
  fs.writeFileSync(`./output/revolut_${file_suffix}.json`, JSON.stringify(j, null, 2))
}

/**
 * @param {puppeteer.Page} page
 * @returns {Promise<void>}
 */
async function logout(page) {
  await page.click('nav[data-testid=sideNav] button')
  await page.waitForTimeout(1000)
  await clickOnText(page, 'a', 'Log out')
}


// From `/wallet` endpoint.
const accountNames = {
  "8366f141-250b-46f9-967c-3b62430f18c7": "Revolut jz CZK",
  "c7495d4d-1811-44b3-b0e0-354d596ae177": "Revolut jz EUR",
  "6a21e583-1d85-426e-b613-fd5f7fa76a29": "Revolut jz GBP",
  "50474439-23cb-48c1-ae3a-e43e14fdc4ab": "Revolut jz USD",
}

// FIXME: Some better way to do this.
const ratesToCzk = {
  'USD': 22.40,
  'GBP': 29.71,
  'EUR': 25.35,
}


/**
 * Example:
 *   {
 *     "id": "6184fcc4-19f0-ac8c-a8d0-71a8ea84ad2f",
 *     "legId": "76150cf2-b9af-423e-8c48-f6d8f6638819",
 *     "type": "CARD_PAYMENT",
 *     "state": "COMPLETED",
 *     "startedDate": 1636105412077,
 *     "updatedDate": 1636191097738,
 *     "completedDate": 1636191097734,
 *     "createdDate": 1636105412412,
 *     "currency": "CZK",
 *     "amount": -153969,
 *     "fee": 0,
 *     "balance": 55788,
 *     "description": "Maksutu*reima Europe O",
 *     "tag": "shopping",
 *     "category": "shopping",
 *     "account": {
 *       "id": "3515db25-d88e-420a-b0bc-2a9a458b1ec2",
 *       "type": "CURRENT"
 *     },
 *     "suggestions": [],
 *     "countryCode": "FI",
 *     "rate": 0.0394300391,
 *     "merchant": {
 *       "id": "63038723246",
 *       "merchantId": "0ea7edcc-e49c-431b-bb92-dd2633a8a563",
 *       "scheme": "MASTERCARD",
 *       "name": "Maksutu*reima.com",
 *       "mcc": "5641",
 *       "category": "shopping",
 *       "city": "Vantaa",
 *       "country": "FI",
 *       "address": "Karhum{entie 3, 01530, Vantaa, FI",
 *       "state": "FI",
 *       "postcode": "01530"
 *     },
 *     "counterpart": {
 *       "amount": -6071,
 *       "currency": "EUR"
 *     },
 *     "card": {
 *       "id": "adfefcba-9b31-411b-8ea2-9e2430b804e9",
 *       "lastFour": "1739"
 *     },
 *     "ratings": {
 *       "userRating": 0
 *     },
 *     "eCommerce": true,
 *     "localisedDescription": {
 *       "key": "transaction.description.card.payment.to.merchant",
 *       "params": [
 *         {
 *           "key": "name",
 *           "value": "Maksutu*reima.com"
 *         }
 *       ]
 *     }
 *   }
 * @param {object} t
 * @param {string} accountPrefix
 * @returns {*}
 */
function normalizeRow(t, accountPrefix = '') {
  return {
    date: moment(t.createdDate).format('YYYY-MM-DD'),
    account: accountNames[t.account.id] ?? `${accountPrefix} ${t.currency}`.trim(),
    payee: t.counterpart?.account ? accountNames[t.counterpart.account.id] : (t.merchant?.name ?? t.description),
    note: t.counterpart?.account ? t.description : (t.comment ?? ''),
    amount: (t.amount / 100.0 * (t.currency === 'CZK' ? 1.0 : ratesToCzk[t.currency])).toFixed(2),
    currency: t.currency === 'CZK' ? null : t.currency,
    "amount in currency": t.currency === 'CZK' ? null : t.amount / 100.0,
  }
}

async function normalizeFile(file) {
  let m = file.match(/revolut_(.+)\.json/);
  if (!m) return // not recognized
  let accountPrefix = m[1]

  let txs = JSON.parse(fs.readFileSync(file))
  txs = txs.filter((t) => t.state === 'COMPLETED')
  
  return txs.map((row) => normalizeRow(row, `Revolut ${accountPrefix}`))
}


module.exports = {
  login,
  scrape,
  scrapeToJson,
  logout,
  normalizeRow,
  normalizeFile,
}