// src/types/break-eternity-shim.d.ts
declare module "break_eternity.js" {
    // Minimal surface we actually use. Add more methods as you need them.
    export default class Decimal {
      constructor(value?: number | string | Decimal);
      static pow10(value: number): Decimal;
  
      add(n: number | string | Decimal): Decimal;
      sub(n: number | string | Decimal): Decimal;
      mul(n: number | string | Decimal): Decimal;
      div(n: number | string | Decimal): Decimal;
      pow(n: number | string): Decimal;
  
      greaterThan(n: number | string | Decimal): boolean;
      greaterThanOrEqualTo(n: number | string | Decimal): boolean;
      lessThan(n: number | string | Decimal): boolean;
      lessThanOrEqualTo(n: number | string | Decimal): boolean;
      equals(n: number | string | Decimal): boolean;
  
      toString(): string;
      toNumber(): number;
    }
  }
  
