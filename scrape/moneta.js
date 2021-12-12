/* eslint-disable no-await-in-loop, no-console */
const moment = require("moment");

async function login(client, {user, password}) {
  await client.url("https://ib.moneta.cz/");

  // Username + password
  await (await client.$("input[name=ibId]")).setValue(user);
  await (await client.$("input[name=password]")).setValue(password);
  await client.keys("Enter");

  // Wait for MFA to finish.
  await (await client.$('span=Odhlásit')).waitForDisplayed();

  // Close new messages modal dialog.
  if ( ! (await client.$('button=Zpět na seznam zpráv')).error) {
    await (await client.$('button[data-testid=close-priority-modal-button]')).click();
  }

  // Go to old internet banking which supports CSV export
  await (await client.$('span=Původní Internet Banka')).click();
  await (await client.$('a=Přesměrovat')).click();
}

async function scrapeCards(client, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts /* array of account indices to fetch */,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY");
  const toParsed = moment(to).format("DD.MM.YYYY");

  // Go to "Cards" section
  await (await client.$('img[alt=karty]')).click();

  await (await client.$('#cardsList_2_1')).waitForDisplayed();
  const cards = await client.$$("#cardsList_2_1 tr a");
  
  for (let i = 0; i < cards.length; i++) {
    // hck: back to karty
    if (i > 0) {
      // client.pause(3000)
      await (await client.$('img[alt=karty]')).click();
      await (await client.$('#cardsList_2_1')).waitForDisplayed();
    }

    if (debugGetOnlyAccounts && !(i in debugGetOnlyAccounts)) {
      console.warn(`Skipping account "${accountName}" becacuse in debugGetOnlyAccounts`);
      continue;
    }

    // indexed from 2 ¯\_(ツ)_/¯
    await (await client.$(`#cardsList_2_1 tr:nth-child(${i + 2}) a`)).click();    
    await (await client.$('span=Číslo karty')).waitForDisplayed();
     
    const els = await client.$$('#ib-app-card-transactions form input');
    let el;
    if (els[6]) { // credit card 
      await els[5].setValue(fromParsed);
      await els[6].setValue(toParsed);
      el = els[6]
    } else {
      await els[2].setValue(fromParsed);
      await els[3].setValue(toParsed);
      el = els[3]
    }
    
    // blur to trigger refresh
    await client.executeScript('arguments[0].dispatchEvent(new Event("blur"))', [el]);
    await client.pause(3000);
    
    await client.executeScript('scrollBy(0, 600)');
    await client.pause(500);

    await (await client.$('span=Export do Excelu')).click();
    await client.pause(1000);
    await (await client.$('span=Stáhnout')).click();
    await client.pause(1000);
    
    await client.pause(10000);
  }
}

async function scrapeAccounts(client, {
  from = moment().subtract(2, "month").format(),
  to = moment().format(),
  debugGetOnlyAccounts /* array of account indices to fetch */,
}) {
  const fromParsed = moment(from).format("DD.MM.YYYY");
  const toParsed = moment(to).format("DD.MM.YYYY");

  // Go to "Cards" section
  await (await client.$('img[alt="Moje účty"]')).click();

  await (await client.$('#balanceList_1_1')).waitForDisplayed();
  const accounts = await client.$$("#balanceList_1_1 tr .account a");
  
  for (let i = 0; i < accounts.length; i++) {
    // hck: back to karty
    if (i > 0) {
      // client.pause(3000)
      await (await client.$('img[alt="Moje účty"]')).click();
      await (await client.$('#balanceList_1_1')).waitForDisplayed();
    }

    if (debugGetOnlyAccounts && !(i in debugGetOnlyAccounts)) {
      console.warn(`Skipping account "${i}" becacuse in debugGetOnlyAccounts`);
      continue;
    }

    // indexed from 2 ¯\_(ツ)_/¯
    await (await client.$(`#balanceList_1_1 tr:nth-child(${i + 2}) .account a`)).click();    
    await (await client.$('img[alt="Přehled transakcí"]')).waitForDisplayed();
     
    const els = await client.$$('#mainFrm input');
    await els[10].setValue(fromParsed);
    await els[11].setValue(toParsed);
    
    await (await client.$('img[alt=Zobrazit]')).click();
    await client.pause(3000); // wait for reload
    
    await (await client.$('img[alt="Export do Excelu"]')).click();
    await client.pause(1000);
  }
}

async function logout(client) {
  await (await client.$('img[alt="Odhlášení"]')).click();
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

function normalize(input) {
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
  return input.map((x) => ({
    date: moment(x['Uskutečnění'], 'DD.MM.YYYY').format('YYYY-MM-DD'),
    account: c2a[x['Číslo karty']],
    payee: normalizePayee(x['Popis transakce']),
    note: x['Poznámka'],
    amount: parseFloat(x['Částka'].replace(',', '.')),
  })) 
}

function normalizeAccounts(input) {
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
  return input.map((x) => {
    let payee = x['Název protiúčtu'];
    if (payeeUnification[payee]) payee = payeeUnification[payee];
    
    return {
      date: moment(x['Odesláno'], 'DD.MM.YYYY').format('YYYY-MM-DD'),
      account: a2a[x['Číslo účtu']],
      payee: payee,
      note: x['Zpráva pro příjemce'],
      amount: parseFloat(x['Částka'].replace(',', '.'))
    }
  }) 
}


module.exports = {
  login,
  scrapeAccounts,
  scrapeCards,
  logout,
  normalize,
  normalizeAccounts,
  normalizePayee,
};
