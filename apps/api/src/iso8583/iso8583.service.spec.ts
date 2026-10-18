import { describe, it, expect } from "vitest";
import { Iso8583Service } from "./iso8583.service";

describe("Iso8583Service", () => {
  const service = new Iso8583Service();

  it("packs and unpacks an ISO 8583 0200 purchase request deterministically", () => {
    const packed = service.pack("0200", {
      3: "000000",
      4: "000000025000", // 250.00 PHP
      11: "654321",
      41: "TERM9999",
      49: "608",
      62: "TESTPAYMENT",
    });

    expect(packed.rawString.startsWith("0200")).toBe(true);
    expect(packed.bitmapHex).toBeDefined();

    const unpacked = service.unpack(packed.rawString);
    expect(unpacked.mti).toBe("0200");
    expect(unpacked.mtiDescription).toContain("Financial Transaction Request");
    expect(unpacked.fields[3]?.value).toBe("000000");
    expect(unpacked.fields[4]?.value).toBe("000000025000");
    expect(unpacked.fields[11]?.value).toBe("654321");
    expect(unpacked.fields[41]?.value).toBe("TERM9999");
    expect(unpacked.fields[49]?.value).toBe("608");
    expect(unpacked.fields[62]?.value).toBe("TESTPAYMENT");
  });

  it("generates a valid sample 0200 transaction with computed timestamps", () => {
    const sample = service.createSamplePurchase0200(150000, "000123", "TERM0001", "REF9988776655");
    expect(sample.mti).toBe("0200");
    expect(sample.fields[4]?.value).toBe("000000150000");
    expect(sample.fields[11]?.value).toBe("000123");
    expect(sample.fields[49]?.value).toBe("608");
  });

  it("rejects invalid MTI and corrupted bitmaps gracefully", () => {
    expect(() => service.pack("200", {})).toThrow("Invalid MTI");
    expect(() => service.unpack("0200ZZZZZZZZZZZZZZZZ")).toThrow("Invalid hex character");
  });
});
