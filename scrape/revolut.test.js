const fn = require('./revolut')

describe("revolut normalize", () => {
  test("normalize currency", () => {
    expect(fn.normalizeRow({
      "createdDate": 1635916609014,
      "account": {
        "id": "50474439-23cb-48c1-ae3a-e43e14fdc4ab",
        "type": "CURRENT"
      }      ,
      "merchant": {
        "name": "Aws Emea",
      },
      "currency": "USD",
      "amount": -38,
      "counterpart": {
        "amount": -38,
        "currency": "USD"
      },
    })).toMatchObject({
      account: 'Revolut jz USD',
      amount: -0.38 * 22.40, // USD to CZK
      currency: 'USD',
      'amount in currency': -0.38,
    })
  })
})