# Babis.js - personal finance under control 👀

<div align="center">
    <big>🚨 Work in progress 🚨</big> 
</div>
<p align="center">
    <small>Do not use or you will regret it</small></center>
</p>

## Motivation

I've tried countless apps for tracking expenses.
Lots of them were excellent, at some things.
But, in the end, just *Good Old Sheets*™ satisfied all my requirements:  

* Semi-automatic imports from bank accounts
  * Full auto doesn't work for me cause:
    * Splitting bills with others and shared orders
    * Splitting payments (e.g. bying Dishwasher & Playstation in one order) 
    * Cashbacks/discounts/...
    * Money transfers – diff bank account, investing accounts, p2p platforms, other currencies
    * Postponed payments (Splitwise, Twisto, ...)
* Payments in different currencies charged in default currency ($5 for Netflix, charged in CZK)
* Notes & TODOs
* Both big-picture overview and possibility of proper deep analysis
* Open format & ability to import/export

## Current workflow

🚨 This is not really meant to be used by others. Maybe just for an inspiration. 

1. (put credentials into .env)
1. Adjust `from` date in index.js
1. Run `index.js`
   * 2FA auth 📱
1. Import `_normalized` files from `/output` into Google Sheets
1. Panic when realizing how much money you spend on coffee 💸
