/* eslint-disable no-await-in-loop, no-console */
const moment = require("moment")
const puppeteer = require("puppeteer")


async function clickOnText(page, elementType, text) {
  const [button] = await page.$x(`//${elementType}[contains(., '${text}')]`)
  await button.click()
  return button
}


/**
 * @param {puppeteer.Page} page
 * @param {object} options
 * @returns {Promise<void>}
 */
async function waitForSpinnerFinished(page, options={}) {
  await page.waitForSelector(".cmpLoaderOver", {hidden: true, ...options})
}


/**
 * Log in as given user; may need to confirm MFA on the registered phone.
 * 
 * @param {puppeteer.Page} page
 * @param {string} birthday
 * @param {string} user
 * @param {string }password
 * @returns {Promise<void>}
 */
async function login(page, { birthday, user, password}) {
  await page.goto("https://ib.airbank.cz")
  
  /* Email */
  await page.type("input[name^=\"authFlow:login\"]", user)
  await page.keyboard.press("Enter")
  await waitForSpinnerFinished(page, {timeout: 60 * 1000})

  /* Date of birth */
  if ( ! await page.$('input[type="password"]')) {  // sometimes it skips this step and goes straight to password
    const [dob_year, dob_month, dob_day] = birthday.split('-')
    await page.waitForSelector("input[name^=\"authFlow:authPanel:dateOfBirth\"]", {timeout: 5000})
    await page.type("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:day\"]", dob_day)
    await page.type("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:month\"]", dob_month)
    await page.type("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:year\"]", dob_year)
    await page.keyboard.press("Enter")
  }

  /* Password */
  await page.waitForSelector('input[type="password"]', {timeout: 15000})
  await page.type("input[type=\"password\"]", password)
  await page.keyboard.press("Enter");

  await page.waitForSelector(".cmpLoaderOver", {visible: false})
}

/**
 * Scrape bank statement.
 * 
 * Assumes `page` is already logged in.
 * 
 * @param {puppeteer.Page} page
 * @param {string} from
 * @param {string} to
 * @param debugGetOnlyAccounts array of account indices to fetch
 * @returns {Promise<void>}
 */
async function scrape (page, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY")
  const toParsed = moment(to).format("DD.MM.YYYY")

  /* Accounts List */
  if (await page.$('.mntNavHome:not(.selected)')) {
    await page.click('.mhtNavHome a')
    await page.waitForTimeout(1000)
  }
  await page.click('.mhtNavAccounts a')
  await page.waitForTimeout(1000)
  await waitForSpinnerFinished(page);

  const accounts = await page.$$("#jsLayoutAccounts .tab")
  const numAccounts = accounts.length;
    
  // Iterate over all accounts.
  // eslint-disable-next-line guard-for-in, no-restricted-syntax, no-plusplus
  for (let i = 0; i < numAccounts; i++) {
    let elAccount = await page.$(`#jsLayoutAccounts .tab:nth-child(${i+1}) .name`)
    let accountName = await page.evaluate((el) => el.textContent.trim(), elAccount)
    
    if (debugGetOnlyAccounts && !debugGetOnlyAccounts.includes(i)) {
      console.warn(`Skipping account "${accountName}" because in debugGetOnlyAccounts`)
      continue
    }
    console.log(`Processing account ${accountName}`)
    
    if (accountName.match(/Založit běžný účet/)) continue; // skip "New Account" tab.
    
    // Open the account
    await elAccount.click();
    await waitForSpinnerFinished(page);

    // Go to Payment history
    await clickOnText(page, 'span', "Historie plateb")
    await waitForSpinnerFinished(page);

    // Try to find filter; it may not be available for external accounts, so ignore those.
    try {
      await page.waitForXPath("//span[contains(., 'Podrobné vyhledávání')]", {timeout: 1000})
    } catch (e) {
      console.warn("Skipping account because history search is not available", accountName)
      continue
    }

    // Detailed search
    await clickOnText(page, 'span', "Podrobné vyhledávání")
    await waitForSpinnerFinished(page);

    await page.evaluate((el, val) => el.value = val, await page.$('[name="stateOrForm:formContent:dateFrom:componentWrapper:component"]'), fromParsed)
    await page.evaluate((el, val) => el.value = val, await page.$("[name=\"stateOrForm:formContent:dateTo:componentWrapper:component\"]"), toParsed)
    await page.keyboard.press("Enter")
    await waitForSpinnerFinished(page);
    
    // TODO: Assert results

    // Export to a file
    await clickOnText(page, 'span', "Exportovat")
    await page.waitForTimeout(1000)
    
    // Nothing exported, close dialog and ignore
    if ((await page.$x("//span[contains(., 'Historie plateb je prázdná')]")).length) {
      console.warn("No payment found for account", accountName);
      await page.click(".ui-dialog .cmpDialogButtons a.ui-button")
      await page.waitForTimeout(1000); // TODO: Consider removing after being pretty stable
      continue;
    }
    await page.waitForXPath('//span[contains(., "Exportní soubor jsme vytvořili")]', {timeout: 10 * 1000})
    
    // Doownload file
    await page.click(".ui-dialog .cmpDialogButtons a.ui-button")
    await page.waitForTimeout(1000); // TODO: Consider removing after being pretty stable
    await page.click(".ui-dialog-titlebar-close")
    await waitForSpinnerFinished(page);
  }
}

/**
 * @param {puppeteer.Page} page
 * @returns {Promise<void>}
 */
async function logout(page) {
  await clickOnText(page, 'span', 'Odhlásit')
  await page.waitForXPath('//h2[contains(., "Odhlášení proběhlo úspěšně")]')
}


const knowAccountNumbers = {
  '231553622/0600': 'Moneta ewik běžný účet',
  '1771301017/3030': 'Air Bank ewik běžný účet',
  '1771301025/3030': 'Air Bank ewik spořicí účet 1',
  '1774384014/3030': 'Air Bank jz běžný účet',
  '1774384022/3030': 'Air Bank jz spořicí účet 1',
  '1358060002/2700': 'Unicredit',
  
  '3033/2700': '',
}

const c2a = {
  '1771301017': 'Air Bank ewik běžný účet',
  '1771301025': 'Air Bank ewik spořicí účet 1',
  '1774384014': 'Air Bank jz běžný účet',
  '1774384022': 'Air Bank jz spořicí účet 1',
}

function normalize (input, filename) {
  let m = /airbank_(\d+)_[\d_-]+\.csv/.exec(filename)
  let accountNumber = m && m[1]
  let accountName = accountNumber ? c2a[accountNumber] : undefined
  
  return input.map((x) => {
    let desc = []
    
    let payee = knowAccountNumbers[x["Číslo účtu protistrany"]] || x["Název protistrany"];
    
    if (
      x["Typ úhrady"] !== "Platba kartou" &&
      x["Typ úhrady"] !== "Karetní transakce (nezaúčtováno)" &&
      x["Typ úhrady"] !== "Trvalý příkaz" &&
      x["Typ úhrady"] !== "Odchozí úhrada"
  ) {
      desc.push(x["Typ úhrady"])
    }

    if (x["Poznámka pro mne"]) {
      desc.push(x["Poznámka pro mne"])
    }

    if (x["Zpráva pro příjemce"] && !desc.includes(x["Zpráva pro příjemce"])) {
      desc.push(x["Zpráva pro příjemce"])
    }
    
    if (x["Pojmenování příkazu"] && !desc.includes(x["Pojmenování příkazu"])) {
      desc.push(x["Pojmenování příkazu"])
    }

    if (x["Původní měna úhrady"] !== "CZK") {
      desc.push(`(${-parseFloat(x["Původní částka úhrady"])} ${x["Původní měna úhrady"]})`)
    }

    return {
      date: moment(x["Datum provedení"], "DD/MM/YYYY").format("YYYY-MM-DD"),
      account: accountName,
      payee: payee,
      note: desc.join(' | '),
      amount: parseFloat(x["Částka v měně účtu"].replace(',', '.')),
      currency: x["Původní měna úhrady"] !== "CZK" && x["Původní měna úhrady"], 
      'amount in currency': x["Původní měna úhrady"] !== "CZK" && x["Původní částka úhrady"], 
    }
  })
}

module.exports = {
  login,
  logout,
  scrape,
  normalize,
}
