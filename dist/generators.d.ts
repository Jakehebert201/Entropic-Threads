import Decimal from "break_eternity.js";
type Dec = InstanceType<typeof Decimal>;
export type GeneratorConfig = {
    tier: number;
    name: string;
    baseCost: Dec;
    producesTier: number | null;
    prodRate: Dec;
};
export type GeneratorState = {
    units: Dec;
    bought: number;
};
export declare const GEN_CFG: GeneratorConfig[];
export declare function newGeneratorState(): GeneratorState[];
export {};
//# sourceMappingURL=generators.d.ts.map