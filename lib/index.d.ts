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
    }
}
interface MaterialEntry {
    id: number;
    name: string;
    type: '材料' | '食材' | '杂物';
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
export interface Config {
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context): void;
export declare const using: readonly ["puppeteer"];
export declare const inject: string[];
export {};
