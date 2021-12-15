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
  await page.goto("https://app.revolut.com/start")
  await page.waitForTimeout(500)

  // Phone number  
  await page.type('form input', country.substr(0, 6))
  await (await page.$x(`//div[text()="${country}"]`))[0].click()
  await page.type('input[name="phoneNumber"]', phone)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)

  // PIN
  for (const digit of pin.split('')) await page.keyboard.press(digit)

  // Wait for MFA to finish
  await page.waitForXPath('//button[contains(., "Accounts")]', {timeout: 60 * 1000})
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

module.exports = {
  login,
  scrape,
  scrapeToJson,
  logout,
}