import { Context, Schema } from 'koishi';
export declare const name = "campfire";
declare module 'koishi' {
    interface Tables {
        material: MaterialEntry;
        material_attribute: MaterialAttribute;
        material_alias: MaterialAlias;
        food: FoodEffect;
        material_skill: MaterialSkill;
        fortune: FortuneEntry;
        user_cooldown: UserCooldown;
        user_currency: UserCurrency;
        gacha_records: GachaRecord;
        greedy_chest: GreedyChestEntry;
        equipment: EquipmentEntry;
    }
    interface User {
        equipmentDraft?: {
            type: string;
            materials: any[];
        };
    }
}
interface MaterialEntry {
    id: number;
    name: string;
    type: '材料' | '食材' | '杂物' | '时装' | '英灵';
    materialType: string;
    grade: number;
    slots: number;
    description: string;
    image: string;
    merit?: number;
    price?: number;
    satiety?: number;
    moisture?: number;
}
interface MaterialAttribute {
    id: number;
    materialId: number;
    starLevel: number;
    attrName: string;
    attrValue: number;
}
interface MaterialAlias {
    id: number;
    materialId: number;
    alias: string;
}
interface FoodEffect {
    id: number;
    materialId: number;
    dishType: '便当' | '罐头' | '药剂' | '全部';
    effectType: '基础加成' | '特殊加成';
    effectSubType: string;
    value: number;
    stackValue: number;
}
interface MaterialSkill {
    id: number;
    materialId: number;
    skillName: string;
    description: string;
    effect: string;
    image: string;
}
interface FortuneEntry {
    id: number;
    level: number;
    description: string;
    isSpecial: boolean;
}
interface UserCooldown {
    id: number;
    userId: string;
    lastUsed: Date;
}
interface UserCurrency {
    userId: string;
    love: number;
    diamond: number;
    gold: number;
    crystal: number;
}
interface GachaRecord {
    userId: string;
    totalPulls: number;
    pityCounter: {
        探险热潮: number;
        动物派对: number;
        沙滩派对: number;
    };
}
interface GreedyChestEntry {
    userId: string;
    slots: string[];
    finished: boolean;
    createdAt: Date;
}
export interface Config {
    greedyChestRates?: {
        gold: number;
        greed: number;
        diamond: number;
        lucky: number;
    };
    attrNameMappings?: Record<string, string>;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
export declare const using: readonly ["puppeteer"];
export declare const inject: string[];
interface EquipmentEntry {
    id: number;
    userId: string;
    type: string;
    materials: any[];
    mainAttributes: Record<string, number>;
    createdAt: Date;
}
export {};
