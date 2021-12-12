/* eslint-disable no-unused-vars */
const fs = require("fs");
const mkdirp = require("mkdirp");
const yaml = require("js-yaml");

const selenium = require("./lib/selenium");
const browser = require("./lib/browser");
const normalize = require("./lib/normalize");

const airbank = require("./scrape/airbank");
const moneta = require("./scrape/moneta");
const csob = require("./scrape/csob");


// Read config.
// { users: { <name>: { <bank>: {credentials } } }
const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));

const OUTPUT_DIR = `${process.cwd()}/output`;

(async () => {
  mkdirp.sync(OUTPUT_DIR);

  // await selenium.install()
  // await selenium.start()
  //
  // const client = await browser.init({}); //{ outputDir: OUTPUT_DIR })
  //
  // await airbank.login(client, u['airbank'])
  //
  //
  //
  // await airbank.scrape(client, {
  //   user: process.env.AIRBANK_USER,
  //   pass: process.env.AIRBANK_PASS,
  //   from: "2021-04-15",
  //   birthdate: {
  //     day: process.env.BIRTHDAY_DAY,
  //     month: process.env.BIRTHDAY_MONTH,
  //     year: process.env.BIRTHDAY_YEAR,
  //   },
  // })

  // await moneta.scrape(client, {
  //   user: process.env.MONETA_USER,
  //   pass: process.env.MONETA_PASS,
  //   from: "2021-03-19",
  // })

  // Not ready for it's prime time yet
  // await csob.scrape(client, {
  //   user: process.env.CSOB_USER,
  //   pass: process.env.CSOB_PASS,
  // })

  normalize()
  console.log("🎉 Done")
})()
