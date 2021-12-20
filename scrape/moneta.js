/* eslint-disable no-await-in-loop, no-console */
const moment = require("moment");
const puppeteer = require('puppeteer')
const fs = require("fs");
const parseCsv = require("csv-parse/lib/sync");
const iconv = require("iconv-lite");
const {raceWithIndex} = require("../lib/helpers");
const Apify = require("apify");


async function clickOnText(page, elementType, text) {
  const [button] = await page.waitForXPath(`//${elementType}[contains(., '${text}')]`, {timeout: 3000})
  await button.click()
  return button
}


/**
 * Log in as given user; may need to confirm MFA on the registered phone.
 * 
 * @param {puppeteer.Page} page
 * @param {string} user
 * @param {string} password
 * @returns {Promise<void>}
 */
async function login(page, {user, password}) {
  console.log("Logging in to Moneta")
  await page.goto("https://ib.moneta.cz/")
  await page.waitForTimeout(2000)

  // Username + password
  console.log("Entering username & password")
  await page.type("input[name=ibId]", user, {delay: 100})
  await page.type("input[name=password]", password, {delay: 200})
  // await Apify.utils.puppeteer.saveSnapshot(page, {key: 'moneta-login', saveHtml: true})
  await page.keyboard.press("Enter", {delay: 100})

  // Check for error of MFA request.
  let [i, el] = await raceWithIndex([
    page.waitForXPath('//div[contains(., "Některý ze zadaných údajů nebyl správný")]'),
    page.waitForXPath('//div[contains(., "Potvrďte oznámení v aplikaci Smart Banka")]'),
  ])
  if (i === 0) throw new Error('Credentials are not valid')
  
  // Wait for MFA to finish.
  console.log("Waiting for MFA")
  await page.waitForXPath('//span[contains(., "Odhlásit")]', {timeout:60*1000})
  console.log("... MFA confirmed")

  // Close new messages modal dialog.
  if ((await page.$x('//button[contains(., "Zpět na seznam zpráv")]')).length) {
    await page.click('button[data-testid=close-priority-modal-button]')
  }
  
  // Go to old internet banking which supports CSV export
  console.log("Redirect to old internet banking")
  await clickOnText(page,'span', 'Původní Internet Banka')
  await clickOnText(page,'a', 'Přesměrovat')
  await page.waitForSelector('img[alt=karty]')
  await page.waitForTimeout(500)
  console.log("Logged in")
}


/**
 * Scrape bank statement from cards.
 *
 * Assumes `page` is already logged in.
 *
 * @param {puppeteer.Page} page
 * @param {string} from
 * @param {string} to
 * @param debugGetOnlyAccounts array of account indices to fetch
 * @returns {Promise<void>}
 */
async function scrapeCards(page, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts /* array of account indices to fetch */,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY")
  const toParsed = moment(to).format("DD.MM.YYYY")

  // Go to "Cards" section
  await page.click('img[alt=karty]')
  await page.waitForSelector('#cardsList_2_1')
  
  const cards = await page.$$("#cardsList_2_1 tr a")
  for (let i = 0; i < cards.length; i++) {
    // hck: back to karty
    if (i > 0) {
      await page.click('img[alt=karty]')
      await page.waitForSelector('#cardsList_2_1')
    }

    let elCard = (await page.$$("#cardsList_2_1 tr a"))[i]
    let cardNumber = await page.evaluate((el) => el.textContent.trim(), elCard)
    
    if (debugGetOnlyAccounts && !debugGetOnlyAccounts.includes(i)) {
      console.warn(`Skipping account "${cardNumber}" because in debugGetOnlyAccounts`)
      continue
    }
    console.log(`Processing card ${cardNumber}`)
    
    await page.waitForTimeout(1000)
    await elCard.click()
    await page.waitForTimeout(1000)
    await page.waitForXPath('//span[contains(., "Číslo karty")]')
     
    const els = await page.$$('#ib-app-card-transactions form input')
    let el
    if (els[6]) { // credit card 
      await els[5].type(fromParsed)
      await els[6].type(toParsed)
      el = els[6]
    } else {
      await els[2].type(fromParsed)
      await els[3].type(toParsed)
      el = els[3]
    }
    
    // blur to trigger refresh
    await page.keyboard.press('Tab')
    await page.waitForTimeout(5 * 1000)
    // await page.waitForNetworkIdle({idleTime: 1000})
    
    await page.evaluate(() => scrollBy(0, 600))
    await page.waitForTimeout(500)

    await clickOnText(page, 'span', 'Export do Excelu')
    await page.waitForTimeout(1000)
    await clickOnText(page, 'span', 'Stáhnout')
    await page.waitForTimeout(1000)
    
    await page.waitForTimeout(5 * 1000)
  }
}

/**
 * Scrape bank statement from accounts.
 *
 * Assumes `page` is already logged in.
 *
 * @param {puppeteer.Page} page
 * @param {string} from
 * @param {string} to
 * @param debugGetOnlyAccounts array of account indices to fetch
 * @returns {Promise<void>}
 */
async function scrapeAccounts(page, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts /* array of account indices to fetch */,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY")
  const toParsed = moment(to).format("DD.MM.YYYY")

  // Go to "Cards" section
  await page.click('img[alt="Moje účty"]')
  await page.waitForSelector('#balanceList_1_1')
  
  const accounts = await page.$$("#balanceList_1_1 tr .account a")
  for (let i = 0; i < accounts.length; i++) {
    // hck: back to accounts
    if (i > 0) {
      // client.pause(3000)
      await page.click('img[alt="Moje účty"]')
      await page.waitForSelector('#balanceList_1_1')
    }
    
    let elAccount = (await page.$$("#balanceList_1_1 tr .account a"))[i]
    let accountNumber = await page.evaluate((el) => el.textContent.trim(), elAccount)

    if (debugGetOnlyAccounts && !debugGetOnlyAccounts.includes(i)) {
      console.warn(`Skipping account "${accountNumber}" because in debugGetOnlyAccounts`)
      continue
    }
    console.log(`Processing account ${accountNumber}`)

    await page.waitForTimeout(1000)
    await elAccount.click()
    await page.waitForTimeout(1000)
    await page.waitForSelector('img[alt="Přehled transakcí"]')
     
    const els = await page.$$('#mainFrm input')
    await els[10].type(fromParsed)
    await els[11].type(toParsed)
    await page.click('img[alt="Zobrazit"]')
    
    await page.waitForTimeout(3000) // wait for reload
    
    await page.click('img[alt="Export do Excelu"]')
    await page.waitForTimeout(1000)
  }
}

async function scrape(page, {from}) {
  await scrapeAccounts(page, {from})
  await scrapeCards(page, {from})
}

async function logout(page) {
  await page.click('img[alt="Odhlášení"]')
}


const c2a = {
  '525471******5700': 'Moneta jz credit',
  '525471******6096': 'Moneta ewik credit',
  '424336******2585': 'Moneta ewik credit', // new card 2021
};

const a2a = {
  '231281807/0600': 'Moneta jz běžný účet',
  '231553622/0600': 'Moneta ewik běžný účet',
};

const payeeUnification = {
  'PŘIJATÁ SPLÁTKA':   'Moneta jz běžný účet',
  'FORZACAFFE S.R.O.': 'forzacaffe s.r.o.',
  'Trimuzi s.r.o.':    'Mitte',
}

function normalizePayee(payee) {
  // Strip city suffix
  payee = payee.replace(/\s{2,}[^\*]+\s+(CZE|LTU)/, '');
  
  // Payment gates, e.g.:
  // GOPAY  *BEHEJSEPSEM.CZ behejsepsem.c CZE
  // GOPAY  *KOLORKY.CZ     kolorky.cz    CZE
  // SumUp  *Morning Invest Brno          CZE
  // SumUp  *Farma Bobule s Zlin          CZE
  if (payee.match(/^(GOPAY|SumUp)/)) {
    payee = payee.substr(8, 14).trim();
    
    // If all uppercase, lower it.
    if (payee === payee.toUpperCase()) payee = payee.toLowerCase();
  }
  
  // Unify common payees
  if (payeeUnification[payee]) payee = payeeUnification[payee];
  
  return payee;
}

function normalizeCardRow(x) {
  // Example:
  //     'Číslo karty': '525471******5700',
  //     'Uskutečnění': '9.1.2021',
  //     'Zúčtování': '11.1.2021',
  //     'Částka': '-264,20',
  //     'Měna': 'CZK',
  //     'Typ transakce': '',
  //     'Popis transakce': 'CHARGEUP               PRAHA 3 - ZIZ CZE',
  //     'Poznámka': '',
  //     'Kategorie': ''
  return {
    date: moment(x['Uskutečnění'], 'DD.MM.YYYY').format('YYYY-MM-DD'),
    account: c2a[x['Číslo karty']],
    payee: normalizePayee(x['Popis transakce']),
    note: x['Poznámka'],
    amount: parseFloat(x['Částka'].replace(',', '.')),
  }
}

function normalizeAccountRow(x) {
  // Example:
  //   'Číslo účtu': '231553622/0600',
  //   'IBAN': 'CZ1306000000000231553622',
  //   'Číslo výpisu': '1',
  //   'Odesláno': '16.07.2021',
  //   'Splatnost': '16.07.2021',
  //   'Částka': '-23669,24',
  //   'Měna': 'CZK',
  //   'Typ transakce': 'Příkaz k úhradě',
  //   'Číslo transakce': '366.17.537854095.1',
  //   'Bankovní reference': '0231553622:20210716:00003:210716I58723701',
  //   'Reference klienta': '',
  //   'Číslo protiúčtu': '301030',
  //   'Název protiúčtu': 'MMB - TECH. ÚČTY',
  //   'Banka protiúčtu': '0600',
  //   'Konstantní symbol': '0000000378',
  //   'Variabilní Symbol': '1007890169',
  //   'Specifický Symbol': '0000000000',
  //   'Popis 1': 'PŘÍKAZ K ÚHRADĚ',
  //   'Popis 2': '',
  //   'Popis 3': '',
  //   'Zpráva pro příjemce': '5254 71** **** 6096',
  //   'Poznámka': '',
  //   'Kategorie': ''
  let payee = x['Název protiúčtu'];
  if (payeeUnification[payee]) payee = payeeUnification[payee];
  
  return {
    date: moment(x['Odesláno'], 'DD.MM.YYYY').format('YYYY-MM-DD'),
    account: a2a[x['Číslo účtu']],
    payee: payee,
    note: x['Zpráva pro příjemce'],
    amount: parseFloat(x['Částka'].replace(',', '.'))
  }
}

async function normalizeFile(file) {
  let opened
  let parsed
  
  // Moneta - credit card
  if (file.includes("export")) {
    opened = fs.readFileSync(file, "utf-8")
    parsed = parseCsv(opened, { columns: true, delimiter: ';', bom: true })
    return parsed.map((row) => normalizeCardRow(row))
  }

  // Moneta - account export
  else if (file.includes("Movements")) {
    opened = iconv.decode(fs.readFileSync(file), "win1250");
    parsed = parseCsv(opened, { columns: true, delimiter: ';' })
    return parsed.map((row) => normalizeAccountRow(row))
  }
}


module.exports = {
  login,
  scrape,
  scrapeAccounts,
  scrapeCards,
  logout,
  normalizePayee,
  normalizeAccountRow,
  normalizeCardRow,
  normalizeFile,
};
