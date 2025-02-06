import { Context, Schema } from 'koishi';
export declare const name = "campfire";
declare module 'koishi' {
    interface Tables {
        material: MaterialEntry;
        material_attribute: MaterialAttribute;
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
export interface Config {
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context): void;
export {};
