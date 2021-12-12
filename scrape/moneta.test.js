const fn = require("./moneta")

describe("moneta normalize", () => {
  test("normalize payee", () => {
    // Strip city suffix
    expect(fn.normalizePayee("CHLEBA BRNO            BRNO          CZE")).toBe("CHLEBA BRNO")
    expect(fn.normalizePayee("REBELBEAN ZET          BRNO          CZE")).toBe("REBELBEAN ZET")
    
    // But be careful with payment gates.
    expect(fn.normalizePayee("GOPAY  *BEHEJSEPSEM.CZ behejsepsem.c CZE")).toBe("behejsepsem.cz")
    expect(fn.normalizePayee("GOPAY  *KOLORKY.CZ     kolorky.cz    CZE")).toBe("kolorky.cz")
    expect(fn.normalizePayee("SumUp  *Morning Invest Brno          CZE")).toBe("Morning Invest")
  })
})