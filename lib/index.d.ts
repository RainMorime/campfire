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
        user_profile: UserProfile;
        user_inventory: UserInventory;
        island: Island;
        action: Action;
        user_island_status: UserIslandStatus;
        island_settlement: IslandSettlement;
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
    energy: number;
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
interface UserProfile {
    userId: string;
    nickname: string;
    createdAt: Date;
}
interface UserInventory {
    userId: string;
    nickname: string;
    items: Array<{
        materialId: number;
        name: string;
        type: string;
        starLevel?: number;
        quantity: number;
    }>;
    updatedAt: Date;
}
interface Island {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    players: string[];
}
interface Action {
    name: string;
    cost: number;
    rewards: {
        times: number;
        pool: Array<{
            item: string;
            weight: number;
            starLevel?: number;
        }>;
    };
}
interface UserIslandStatus {
    userId: string;
    islandId: string;
    currentAction: string;
    lastActionTime: Date;
    remainingActions: number;
    actionHistory: Array<{
        name: string;
        rewards: Array<{
            item: string;
            quantity: number;
        }>;
    }>;
}
interface IslandSettlement {
    userId: string;
    islandId: string;
    actionHistory: Array<{
        name: string;
        times: number;
        rewards: Array<{
            item: string;
            quantity: number;
        }>;
    }>;
    settledAt: Date;
}
export interface Config {
    greedyChestRates?: {
        gold: number;
        greed: number;
        diamond: number;
        lucky: number;
    };
    attrNameMappings?: Record<string, string>;
    messageRecall?: {
        enable: boolean;
        recallTime: number;
    };
    island?: {
        spawnInterval: number;
        maxIslands: number;
        islandLifespan: number;
        maxPlayers: number;
        actionInterval: number;
        entryCost: number;
    };
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
