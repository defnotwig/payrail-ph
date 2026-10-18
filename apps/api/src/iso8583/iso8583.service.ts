import { Injectable, BadRequestException } from "@nestjs/common";

export interface IsoFieldDefinition {
  fieldNumber: number;
  name: string;
  type: "FIXED_NUMERIC" | "FIXED_ALPHA" | "LLVAR_NUMERIC" | "LLVAR_ALPHA" | "LLLVAR_ALPHA";
  length: number;
}

export const ISO_FIELD_SPECS: Record<number, IsoFieldDefinition> = {
  2: { fieldNumber: 2, name: "Primary Account Number (PAN)", type: "LLVAR_NUMERIC", length: 19 },
  3: { fieldNumber: 3, name: "Processing Code", type: "FIXED_NUMERIC", length: 6 },
  4: { fieldNumber: 4, name: "Amount, Transaction", type: "FIXED_NUMERIC", length: 12 },
  7: { fieldNumber: 7, name: "Transmission Date & Time", type: "FIXED_NUMERIC", length: 10 },
  11: {
    fieldNumber: 11,
    name: "Systems Trace Audit Number (STAN)",
    type: "FIXED_NUMERIC",
    length: 6,
  },
  12: { fieldNumber: 12, name: "Time, Local Transaction", type: "FIXED_NUMERIC", length: 6 },
  13: { fieldNumber: 13, name: "Date, Local Transaction", type: "FIXED_NUMERIC", length: 4 },
  18: { fieldNumber: 18, name: "Merchant Category Code (MCC)", type: "FIXED_NUMERIC", length: 4 },
  37: {
    fieldNumber: 37,
    name: "Retrieval Reference Number (RRN)",
    type: "FIXED_ALPHA",
    length: 12,
  },
  39: { fieldNumber: 39, name: "Response Code", type: "FIXED_ALPHA", length: 2 },
  41: { fieldNumber: 41, name: "Card Acceptor Terminal ID", type: "FIXED_ALPHA", length: 8 },
  42: {
    fieldNumber: 42,
    name: "Card Acceptor Identification Code",
    type: "FIXED_ALPHA",
    length: 15,
  },
  49: { fieldNumber: 49, name: "Currency Code, Transaction", type: "FIXED_NUMERIC", length: 3 },
  62: { fieldNumber: 62, name: "Private Field / QR Ph Data", type: "LLLVAR_ALPHA", length: 999 },
};

export interface IsoParsedMessage {
  mti: string;
  mtiDescription: string;
  bitmapHex: string;
  bitmapBits: string;
  fields: Record<number, { name: string; value: string; raw: string }>;
  rawHex: string;
}

@Injectable()
export class Iso8583Service {
  private getMtiDescription(mti: string): string {
    switch (mti) {
      case "0100":
        return "Authorization Request (Cardholder validation)";
      case "0110":
        return "Authorization Response (Issuer approved/declined)";
      case "0200":
        return "Financial Transaction Request (Purchase / Debit)";
      case "0210":
        return "Financial Transaction Response (Purchase confirmed / declined)";
      case "0400":
        return "Reversal Request (Transaction cancelled or timed out)";
      case "0410":
        return "Reversal Response (Reversal acknowledged)";
      case "0800":
        return "Network Management Request (Echo test / Sign-on)";
      case "0810":
        return "Network Management Response (Echo test ACK)";
      default:
        return `Custom / Unknown MTI (${mti})`;
    }
  }

  /**
   * Packs an ISO 8583 message into a wire-ready ASCII/Hex string.
   */
  pack(
    mti: string,
    fields: Record<number, string>,
  ): { rawString: string; rawHex: string; bitmapHex: string } {
    if (!/^\d{4}$/.test(mti)) {
      throw new BadRequestException(`Invalid MTI '${mti}'. Must be 4 numeric digits.`);
    }

    // Build 64-bit primary bitmap
    const bits: boolean[] = new Array(65).fill(false);
    for (const fieldNumStr of Object.keys(fields)) {
      const fieldNum = parseInt(fieldNumStr, 10);
      if (fieldNum >= 1 && fieldNum <= 64) {
        bits[fieldNum] = true;
      }
    }

    // Convert 64 bits to 16 hex characters
    let bitmapHex = "";
    for (let i = 1; i <= 64; i += 4) {
      const nibble =
        (bits[i] ? 8 : 0) + (bits[i + 1] ? 4 : 0) + (bits[i + 2] ? 2 : 0) + (bits[i + 3] ? 1 : 0);
      bitmapHex += nibble.toString(16).toUpperCase();
    }

    let payload = mti + bitmapHex;

    // Append fields in ascending order
    const sortedFieldNums = Object.keys(fields)
      .map((k) => parseInt(k, 10))
      .filter((n) => n >= 2 && n <= 64)
      .sort((a, b) => a - b);

    for (const fieldNum of sortedFieldNums) {
      const spec = ISO_FIELD_SPECS[fieldNum];
      const val = fields[fieldNum];

      if (!spec || val === undefined) {
        continue;
      }

      switch (spec.type) {
        case "FIXED_NUMERIC": {
          const numStr = val.replace(/\D/g, "").padStart(spec.length, "0");
          payload += numStr.slice(-spec.length);
          break;
        }
        case "FIXED_ALPHA": {
          payload += val.padEnd(spec.length, " ").slice(0, spec.length);
          break;
        }
        case "LLVAR_NUMERIC":
        case "LLVAR_ALPHA": {
          const lenPrefix = val.length.toString().padStart(2, "0");
          payload += lenPrefix + val;
          break;
        }
        case "LLLVAR_ALPHA": {
          const lenPrefix = val.length.toString().padStart(3, "0");
          payload += lenPrefix + val;
          break;
        }
      }
    }

    const rawHex = Buffer.from(payload, "ascii").toString("hex");
    return { rawString: payload, rawHex, bitmapHex };
  }

  /**
   * Unpacks a raw ASCII ISO 8583 string into structured data elements.
   */
  unpack(rawString: string): IsoParsedMessage {
    if (rawString.length < 20) {
      throw new BadRequestException(
        "Raw ISO message too short. Minimum header length is 20 chars.",
      );
    }

    const mti = rawString.slice(0, 4);
    const bitmapHex = rawString.slice(4, 20);

    // Convert hex bitmap to 64-bit boolean array
    let bitmapBits = "";
    const activeFields: number[] = [];

    for (let i = 0; i < 16; i++) {
      const char = bitmapHex[i];
      if (!char) {
        throw new BadRequestException("Bitmap hex shorter than 16 characters.");
      }
      const nibble = parseInt(char, 16);
      if (Number.isNaN(nibble)) {
        throw new BadRequestException(`Invalid hex character in bitmap: ${char}`);
      }
      const binary4 = nibble.toString(2).padStart(4, "0");
      bitmapBits += binary4;

      for (let bitIdx = 0; bitIdx < 4; bitIdx++) {
        if (binary4[bitIdx] === "1") {
          activeFields.push(i * 4 + bitIdx + 1);
        }
      }
    }

    let cursor = 20;
    const parsedFields: Record<number, { name: string; value: string; raw: string }> = {};

    for (const fieldNum of activeFields) {
      if (fieldNum === 1) {
        // Secondary bitmap indicator
        continue;
      }

      const spec = ISO_FIELD_SPECS[fieldNum];
      if (!spec) {
        throw new BadRequestException(
          `Field ${fieldNum} is active in bitmap but lacks a specification parser.`,
        );
      }

      let value = "";
      let rawChunk = "";

      switch (spec.type) {
        case "FIXED_NUMERIC":
        case "FIXED_ALPHA": {
          if (cursor + spec.length > rawString.length) {
            throw new BadRequestException(
              `Unexpected EOF parsing field ${fieldNum} at cursor ${cursor}.`,
            );
          }
          value = rawString.slice(cursor, cursor + spec.length);
          rawChunk = value;
          cursor += spec.length;
          break;
        }
        case "LLVAR_NUMERIC":
        case "LLVAR_ALPHA": {
          const lenStr = rawString.slice(cursor, cursor + 2);
          const len = parseInt(lenStr, 10);
          cursor += 2;
          if (cursor + len > rawString.length) {
            throw new BadRequestException(`Invalid LLVAR length ${len} for field ${fieldNum}.`);
          }
          value = rawString.slice(cursor, cursor + len);
          rawChunk = lenStr + value;
          cursor += len;
          break;
        }
        case "LLLVAR_ALPHA": {
          const lenStr = rawString.slice(cursor, cursor + 3);
          const len = parseInt(lenStr, 10);
          cursor += 3;
          if (cursor + len > rawString.length) {
            throw new BadRequestException(`Invalid LLLVAR length ${len} for field ${fieldNum}.`);
          }
          value = rawString.slice(cursor, cursor + len);
          rawChunk = lenStr + value;
          cursor += len;
          break;
        }
      }

      parsedFields[fieldNum] = {
        name: spec.name,
        value,
        raw: rawChunk,
      };
    }

    return {
      mti,
      mtiDescription: this.getMtiDescription(mti),
      bitmapHex,
      bitmapBits,
      fields: parsedFields,
      rawHex: Buffer.from(rawString, "ascii").toString("hex"),
    };
  }

  /**
   * Helper to build a standard QR Ph / Card Purchase Request (0200)
   */
  createSamplePurchase0200(
    amountMinor: number,
    stan: string,
    terminalId: string,
    reference: string,
  ): IsoParsedMessage {
    const amountStr = amountMinor.toString().padStart(12, "0");
    const stanStr = stan.padStart(6, "0");
    const now = new Date();
    const mmddhhmmss =
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0") +
      now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0") +
      now.getSeconds().toString().padStart(2, "0");
    const hhmmss = mmddhhmmss.slice(4);
    const mmdd = mmddhhmmss.slice(0, 4);

    const packed = this.pack("0200", {
      3: "000000", // Purchase / Goods & Services
      4: amountStr,
      7: mmddhhmmss,
      11: stanStr,
      12: hhmmss,
      13: mmdd,
      18: "5399", // General Merchandise MCC
      37: reference.slice(0, 12).padEnd(12, "0"),
      41: terminalId.slice(0, 8).padEnd(8, " "),
      42: "PAYRAILMERCH001",
      49: "608", // PHP currency code
      62: `REF=${reference}`,
    });

    return this.unpack(packed.rawString);
  }
}
