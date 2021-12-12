/* eslint-disable no-await-in-loop, no-console */
const moment = require("moment");

async function login(client, { birthday /*:string*/, user, password}) {
  console.log(arguments);
  await client.url("https://ib.airbank.cz");
  
  /* Email */
  /* === */
  await (await client.$("input[name^=\"authFlow:login\"]")).setValue(user);
  await client.keys("Enter");

  /* Date of birth */
  /* === */
  [dob_year, dob_month, dob_day] = birthday.split('-');
  
  await (await client.$("input[name^=\"authFlow:authPanel:dateOfBirth\"]")).waitForExist({timeout: 5000});
  await (await client.$("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:day\"]")).setValue(dob_day);
  await (await client.$("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:month\"]")).setValue(dob_month);
  await (await client.$("input[name=\"authFlow:authPanel:dateOfBirth:componentWrapper:component:year\"]")).setValue(dob_year);
  await client.keys("Enter");

  /* Password */
  /* === */
  await (await client.$("input[type=\"password\"]")).setValue(password);
  await client.keys("Enter");

  await (await client.$(".cmpLoaderOver")).waitForDisplayed({reverse: true});
}

// Assumes `client` is already logged in.
async function scrape (client, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts /* array of account indices to fetch */,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY");
  const toParsed = moment(to).format("DD.MM.YYYY");

  /* Accounts List */
  /* === */
  await (await client.$("span=Účty a karty")).click();
  await (await client.$("(//*[@class=\"layoutMainMenu\"]//a)[2]")).click();
  await (await client.$(".cmpLoaderOver")).waitForDisplayed({reverse: true});

  const accounts = await client.$$("#jsLayoutAccounts .tab");
  const numAccounts = accounts.length;
    
  // Iterate over all accounts.
  // eslint-disable-next-line guard-for-in, no-restricted-syntax, no-plusplus
  for (let i = 0; i < numAccounts; i++) {
    let elAccount = await client.$(`#jsLayoutAccounts .tab:nth-child(${i+1})`);
    let accountName = await elAccount.getText();
    
    if (debugGetOnlyAccounts && !(i in debugGetOnlyAccounts)) {
      console.warn(`Skipping account "${accountName}" becacuse in debugGetOnlyAccounts`);
      continue;
    }
    
    if (accountName.match(/Založit běžný účet/)) continue; // skip "New Account" tab.
    
    // Open the account
    await elAccount.click();
    await (await client.$(".cmpLoaderOver")).waitForDisplayed({ reverse: true });

    // Get balance
    // const balance = client.$(".numberPrimary").getText()
    // // 12 345,67 CZK => 12345,67CZK
    // const balanceClean = balance.replace(/\s/g, "")
    // console.log("💰💰💰 BALANCE", balanceClean)

    await (await client.$("span=Historie plateb")).click();
    await (await client.$(".cmpLoaderOver")).waitForDisplayed({ reverse: true });

    // Try to find filter; it may not be available for external accounts, so ignore those.
    try {
      await (await client.$("span=Podrobné vyhledávání")).waitForDisplayed({timeout: 1000});
    } catch (e) {
      console.warn("Skipping account", accountName);
      continue;
    }

    // Detailed search
    await (await client.$("span=Podrobné vyhledávání")).click();
    await (await client.$(".cmpLoaderOver")).waitForDisplayed({ reverse: true });

    await (await client.$("[name=\"stateOrForm:formContent:dateFrom:componentWrapper:component\"]")).setValue(fromParsed);
    await (await client.$("[name=\"stateOrForm:formContent:dateTo:componentWrapper:component\"]")).setValue(toParsed);
    await client.keys("Enter");

    await (await client.$(".cmpLoaderOver")).waitForDisplayed({ reverse: true });

    // TODO: Assert results

    // Download exported file
    await (await client.$("span=Exportovat")).click();
    await (await client.$("span=Exportní soubor jsme vytvořili")).waitForExist(10 * 1000);
    await client.pause(3000); // TODO: Consider removing after being pretty stable
    
    // Nothing exported, close dialog and ignore
    if (await (await client.$("span=Historie plateb je prázdná")).isExisting()) {
      console.warn("No payment found for account", accountName);
      await (await client.$(".ui-dialog .cmpDialogButtons a.ui-button")).click();
      await client.pause(1000); // TODO: Consider removing after being pretty stable
      continue;
    }
    
    await (await client.$(".ui-dialog .cmpDialogButtons a.ui-button")).click();
    await client.pause(1000); // TODO: Consider removing after being pretty stable
    await (await client.$(".ui-dialog-titlebar-close")).click();
    await (await client.$(".cmpLoaderOver")).waitForDisplayed({ reverse: true });
  }
}

async function logout(client) {
  await (await client.$('span=Odhlásit')).click();
  await client.acceptAlert();
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
