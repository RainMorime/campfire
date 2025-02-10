var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_path = require("path");
var import_url = require("url");
var name = "campfire";
var blacklist = [];
var Config = import_koishi.Schema.object({});
function apply(ctx) {
  ctx.model.extend("material", {
    id: "unsigned",
    name: "string",
    type: "string",
    materialType: "string",
    grade: "unsigned",
    slots: "unsigned",
    description: "text",
    image: "string",
    merit: "unsigned",
    price: "unsigned",
    satiety: "integer",
    moisture: "integer"
  }, {
    autoInc: true,
    primary: "id"
  });
  ctx.model.extend("material_attribute", {
    id: "unsigned",
    materialId: "unsigned",
    starLevel: "unsigned",
    attrName: "string",
    attrValue: "float"
  }, {
    autoInc: true,
    foreign: {
      materialId: ["material", "id"]
    }
  });
  ctx.model.extend("material_alias", {
    id: "unsigned",
    materialId: "unsigned",
    alias: "string"
  }, {
    autoInc: true,
    foreign: {
      materialId: ["material", "id"]
    }
  });
  ctx.model.extend("food", {
    id: "unsigned",
    materialId: "unsigned",
    dishType: "string",
    effectType: "string",
    effectSubType: "string",
    value: "float",
    stackValue: "float"
  }, {
    autoInc: true,
    foreign: {
      materialId: ["material", "id"]
    }
  });
  ctx.model.extend("material_skill", {
    id: "unsigned",
    materialId: "unsigned",
    skillName: "string",
    description: "text",
    effect: "text",
    image: "string"
  }, {
    autoInc: true,
    foreign: {
      materialId: ["material", "id"]
    }
  });
  async function findMaterialByNameOrAlias(name2) {
    const aliasEntry = await ctx.database.get("material_alias", { alias: name2 });
    if (aliasEntry.length > 0) {
      return ctx.database.get("material", { id: aliasEntry[0].materialId });
    }
    return ctx.database.get("material", { name: [name2] });
  }
  __name(findMaterialByNameOrAlias, "findMaterialByNameOrAlias");
  ctx.command("查询价格 <name:string>", "查询物品价格信息").action(async (_, name2) => {
    if (!name2) return "请输入物品名称";
    const [item] = await findMaterialByNameOrAlias(name2);
    if (!item) return "未找到该物品";
    const output = [];
    const imagePath = (0, import_path.resolve)(__dirname, item.image);
    output.push(import_koishi.h.image((0, import_url.pathToFileURL)(imagePath).href));
    let info = `物品名称：${item.name}`;
    if (item.merit !== void 0 && item.merit !== null && item.merit > 0) {
      info += `
所需功勋：${item.merit}`;
    }
    info += `
参考价格：${item.price || "暂无"}`;
    output.push(info);
    return output.join("\n");
  });
  ctx.command("图鉴 <name>", "查询物品图鉴").action(async (_, name2) => {
    if (!name2) return "请输入要查询的物品名称";
    const [item] = await findMaterialByNameOrAlias(name2);
    if (!item) return "未找到该物品";
    const output = [];
    const imagePath = (0, import_path.resolve)(__dirname, item.image);
    output.push(import_koishi.h.image((0, import_url.pathToFileURL)(imagePath).href));
    let info = `【${item.name}】`;
    info += `｜类型：${item.type}·${item.materialType}`;
    if (item.grade > 0) info += `｜阶级：${item.grade}阶`;
    if (item.slots > 0) info += `｜占用：${item.slots}格`;
    if (item.type === "食材") {
      info += `｜饱食+${item.satiety || 0} 水分+${item.moisture || 0}`;
    }
    info += `
📝 ${item.description}`;
    if (item.type === "材料") {
      const attributes = await ctx.database.get("material_attribute", {
        materialId: item.id,
        starLevel: { $gte: 1, $lte: 5 }
      });
      const starOutput = [];
      for (let star = 1; star <= 5; star++) {
        const starAttrs = attributes.filter((a) => a.starLevel === star);
        if (starAttrs.length === 0) continue;
        const attrText = starAttrs.map((a) => `${a.attrName} ${a.attrValue}`).join("｜");
        starOutput.push(`⭐${star} → ${attrText}`);
      }
      if (starOutput.length > 0) {
        info += `
🔧 属性成长：
${starOutput.join("\n")}`;
      }
    }
    output.push(info);
    return output.join("\n");
  });
  ctx.command("材料图鉴").subcommand(".create <name:string> <type:string> <materialType:string> <grade:number> <slots:number> <description:text> <image:string>", "创建新材料", {
    authority: 2
  }).action(async (_, name2, type, materialType, grade, slots, description, image) => {
    const validTypes = ["材料", "食材", "杂物"];
    if (!validTypes.includes(type)) {
      return `类型必须为：${validTypes.join("/")}`;
    }
    const MType = type;
    if (slots < 1) {
      return "格子数必须大于 0";
    }
    const existing = await ctx.database.get("material", { name: [name2] });
    if (existing.length) {
      return "该名称的材料已存在";
    }
    const material = await ctx.database.create("material", {
      name: name2,
      type: MType,
      materialType,
      // 使用转换后的类型
      grade,
      slots,
      description,
      image
    });
    return `材料 ${name2} (ID:${material.id}) 创建成功！`;
  });
  ctx.command("材料图鉴").subcommand(".materialExtend <name:string> <...args:string>", "扩展材料属性数值", {
    authority: 5
  }).usage("参数：材料名称 属性1 数值1 属性2 数值2 ...").example("材料图鉴.materialExtend 菌丝 法强 3 体力 4 耐力 3 3 6 4 3 7 4 4 9 5 5 10 6").action(async (_, name2, ...args) => {
    const attrMap = /* @__PURE__ */ new Map();
    let currentAttr = "";
    args.forEach((arg) => {
      if (isNaN(Number(arg))) {
        currentAttr = arg;
        attrMap.set(currentAttr, []);
      } else {
        if (!currentAttr) return;
        attrMap.get(currentAttr).push(Number(arg));
      }
    });
    const [material] = await ctx.database.get("material", { name: [name2] });
    if (!material) return `材料 ${name2} 不存在`;
    if (material.type !== "材料") return `该物品类型为 ${material.type}，仅支持材料类型`;
    const attrs = Array.from(attrMap.keys());
    if (attrs.length === 0) return "至少需要指定一个属性";
    const totalValues = attrs.reduce((sum, attr) => sum + attrMap.get(attr).length, 0);
    if (totalValues !== attrs.length * 5) {
      return `需要每个属性提供5个数值（对应1-5星），当前总数：${totalValues}，应有：${attrs.length * 5}`;
    }
    const entries = [];
    for (let starLevel = 1; starLevel <= 5; starLevel++) {
      attrs.forEach((attr) => {
        const values = attrMap.get(attr);
        const value = values[starLevel - 1];
        entries.push({
          materialId: material.id,
          starLevel,
          attrName: attr,
          attrValue: value
        });
      });
    }
    try {
      await Promise.all(
        entries.map((entry) => ctx.database.create("material_attribute", entry))
      );
    } catch (err) {
      console.error("属性扩展失败:", err);
      return "创建失败，请检查控制台日志";
    }
    const output = [
      `成功为 ${name2}(${material.id}) 设置属性数值：`,
      ...entries.map(
        (e) => `${material.id} ${e.starLevel}星 ${e.attrName} ${e.attrValue}`
      ),
      `共配置 ${entries.length} 条属性数值`
    ];
    return output.join("\n");
  });
  ctx.command("材料属性").subcommand(".add <materialId:number> <starLevel:number> <attrName:string> <attrValue:number>", "添加属性", {
    authority: 2
  }).example("材料属性.add 1 5 攻击力 120").action(async (_, materialId, starLevel, attrName, attrValue) => {
    const material = await ctx.database.get("material", { id: materialId });
    if (!material.length) {
      return "指定的材料不存在";
    }
    await ctx.database.create("material_attribute", {
      materialId,
      starLevel,
      attrName,
      attrValue
    });
    return `已为材料 ${material[0].name} 添加 ${starLevel} 星属性：${attrName}=${attrValue}`;
  });
  ctx.command("模拟精工锭 <stars:number> <materials:text>", "模拟精工锭合成").usage("格式：模拟精工锭 星级 材料1x数量 材料2x数量 ...").example("模拟精工锭 5 兽核x1 精铁矿x3 星尘x2").action(async (_, stars, materials) => {
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async (entry) => {
      const match = entry.match(/^(.+?)x(\d+)$/);
      if (!match) return null;
      const materialName = match[1].trim();
      const count = parseInt(match[2]);
      const [material] = await findMaterialByNameOrAlias(materialName);
      return material ? {
        original: entry,
        name: material.name,
        // 使用正式名称
        count,
        materialData: material
      } : null;
    })).then((list) => list.filter(Boolean));
    if (materialEntries.length < 2) {
      return "至少需要两个材料进行合成，格式：材料名x数量";
    }
    const missingList = materialEntries.filter((entry) => !entry.materialData).map((entry) => entry.original);
    if (missingList.length > 0) {
      return `以下材料不存在：${missingList.join(", ")}`;
    }
    const materialsData = materialEntries.map((entry) => entry.materialData);
    const attributes = await ctx.database.select("material_attribute").where({
      materialId: materialsData.map((m) => m.id),
      starLevel: stars
      // 直接使用传入的 stars 参数
    }).execute();
    const missingStarMaterials = materialsData.filter(
      (material) => !attributes.some((attr) => attr.materialId === material.id)
    );
    if (missingStarMaterials.length > 0) {
      return `以下材料缺少 ${stars} 星级属性：${missingStarMaterials.map((m) => m.name).join(", ")}`;
    }
    const firstGrade = materialsData[0].grade;
    const invalidTier = materialsData.some((data) => data.grade !== firstGrade);
    if (invalidTier) {
      const tierList = [...new Set(materialsData.map((m) => m.grade))];
      return `材料阶级不一致，存在以下阶级：${tierList.join(", ")}`;
    }
    const hasCore = materialsData.some((data) => data.materialType === "兽核");
    if (!hasCore) {
      return "合成必须包含兽核材料";
    }
    let totalSlots = 0;
    for (const entry of materialEntries) {
      const material = materialsData.find((m) => m.name === entry.name);
      totalSlots += material.slots * entry.count;
    }
    if (totalSlots !== 15) {
      return `材料总格子数应为15，当前为${totalSlots}`;
    }
    const attributeMap = /* @__PURE__ */ new Map();
    for (const attr of attributes) {
      const materialEntry = materialEntries.find(
        (entry) => entry.name === materialsData.find((m) => m.id === attr.materialId)?.name
      );
      const contribution = attr.attrValue * (materialEntry?.count || 1);
      const current = attributeMap.get(attr.attrName) || 0;
      attributeMap.set(attr.attrName, current + contribution);
    }
    const allAttributes = Array.from(attributeMap.entries());
    const selectCount = Math.min(
      Math.floor(Math.random() * 3) + 1,
      allAttributes.length
    );
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount);
    let multiplier = 1;
    switch (selected.length) {
      case 1:
        multiplier = 0.3;
        break;
      case 2:
        multiplier = 0.8 * 0.3;
        break;
      case 3:
        multiplier = 0.6 * 0.3;
        break;
    }
    const finalAttributes = selected.map(([name2, totalValue]) => {
      const finalValue = Math.ceil(totalValue * multiplier);
      return { name: name2, totalValue, finalValue };
    });
    const output = [
      "",
      "🔥 精工锭合成模拟结果 🔥",
      `目标星级：${stars}⭐`,
      `材料阶级：${firstGrade}阶`,
      `使用材料：${materialEntries.map((m) => `${m.name}x${m.count}`).join(" + ")}`,
      `总格子数：${totalSlots}/15`,
      "",
      "【属性计算过程】",
      `原始属性总和（已考虑材料数量）：`,
      ...Array.from(attributeMap.entries()).map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      "",
      `随机选择 ${selected.length} 条属性进行强化：`,
      ...finalAttributes.map(
        (attr) => `${attr.name}: ${attr.totalValue.toFixed(2)} × ${multiplier.toFixed(2)} ≈ ${attr.finalValue}`
      ),
      "",
      "【最终加成效果】",
      ...finalAttributes.map((attr) => `+ ${attr.finalValue} ${attr.name}`)
    ];
    return output.join("\n");
  });
  ctx.command("挂榜 <userId> <qqNumber> <behavior>", "将用户列入黑名单").action((_, userId, qqNumber, behavior) => {
    const qqNumberAsNumber = Number(qqNumber);
    const existingEntry = blacklist.find((entry) => entry.userId === userId);
    if (existingEntry) {
      if (!existingEntry.qqNumbers.includes(qqNumberAsNumber)) {
        existingEntry.qqNumbers.push(qqNumberAsNumber);
      }
    } else {
      blacklist.push({
        userId,
        qqNumbers: [qqNumberAsNumber],
        behavior
      });
    }
    return `已成功挂榜 ${userId} QQ号${qqNumber}`;
  });
  ctx.command("查询 <query>", "查询用户是否在黑名单中").action((_, query) => {
    const matchingEntries = blacklist.filter(
      (entry) => entry.userId === query || entry.qqNumbers.includes(Number(query))
    );
    if (matchingEntries.length > 0) {
      const output = matchingEntries.map((entry) => {
        return `该用户为黑名单用户！用户ID：${entry.userId} QQ号：${entry.qqNumbers.join(" ")} 行为：${entry.behavior}`;
      }).join("\n");
      return output;
    } else {
      return `该用户未被记载！交易前请核实对方身份。`;
    }
  });
  ctx.command("删除黑名单 <query>", "从黑名单中删除用户").action((_, query) => {
    const index = blacklist.findIndex(
      (entry) => entry.userId === query || entry.qqNumbers.includes(Number(query))
    );
    if (index !== -1) {
      blacklist.splice(index, 1);
      return `已成功删除黑名单中的 ${query}`;
    } else {
      return `未找到匹配的黑名单记录，无法删除。`;
    }
  });
  ctx.command("材料别名").subcommand(".add <materialName:string> <alias:string>", "添加材料别名", {
    authority: 2
  }).action(async (_, materialName, alias) => {
    const [material] = await ctx.database.get("material", { name: [materialName] });
    if (!material) return `材料 ${materialName} 不存在`;
    const existing = await ctx.database.get("material_alias", { alias });
    if (existing.length) return "该别名已被使用";
    await ctx.database.create("material_alias", {
      materialId: material.id,
      alias
    });
    return `已为 ${materialName} 添加别名：${alias}`;
  });
  ctx.command("材料别名").subcommand(".remove <alias:string>", "删除材料别名", {
    authority: 2
  }).action(async (_, alias) => {
    const result = await ctx.database.remove("material_alias", { alias });
    return result ? `已删除别名：${alias}` : "别名不存在";
  });
  ctx.command("烹饪 <dishType:string> <materials:text>", "制作料理").usage("格式：烹饪 料理类型 食材1x数量 食材2x数量 ... (共6个食材)").example("烹饪 便当 胡萝卜x2 牛肉x3 大米x1").action(async (_, dishType, materials) => {
    let totalCount = 0;
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async (entry) => {
      const match = entry.match(/^(.+?)x(\d+)$/);
      if (!match) return null;
      const materialName = match[1].trim();
      const count = parseInt(match[2]);
      totalCount += count;
      const [material] = await findMaterialByNameOrAlias(materialName);
      if (!material || material.type !== "食材") return null;
      return { material, count };
    })).then((list) => list.filter(Boolean));
    if (totalCount !== 6) {
      return "需要精确使用6个食材进行烹饪（总数量为6）";
    }
    let totalSatiety = 0, totalMoisture = 0;
    materialEntries.forEach((entry) => {
      totalSatiety += (entry.material.satiety || 0) * entry.count;
      totalMoisture += (entry.material.moisture || 0) * entry.count;
    });
    let healthMultiplier = 1, staminaMultiplier = 1, timeMultiplier = 1;
    const specialEffects = /* @__PURE__ */ new Map();
    const foodEffects = await ctx.database.get("food", {
      materialId: materialEntries.map((e) => e.material.id)
    });
    foodEffects.forEach((effect) => {
      const entries = materialEntries.filter((e) => e.material.id === effect.materialId);
      const totalCount2 = entries.reduce((sum, e) => sum + e.count, 0);
      if (effect.effectType === "基础加成") {
        switch (effect.effectSubType) {
          case "生命":
            healthMultiplier += effect.value * totalCount2 / 100;
            break;
          case "体力":
            staminaMultiplier += effect.value * totalCount2 / 100;
            break;
          case "秒数":
            timeMultiplier += effect.value * totalCount2 / 100;
            break;
        }
      } else {
        const key = effect.effectSubType;
        const current = specialEffects.get(key) || 0;
        specialEffects.set(key, current + effect.stackValue * totalCount2);
      }
    });
    let totalSeconds = 60 + Math.floor(totalMoisture / 30);
    let instantHealth = 0, instantStamina = 0;
    let baseHealth = 0, baseStamina = 0;
    switch (dishType) {
      case "便当":
        instantHealth = Math.floor((40 + totalSatiety * 13) * healthMultiplier);
        instantStamina = Math.floor((20 + totalMoisture * 6) * staminaMultiplier);
        totalSeconds = Math.floor(totalSeconds * timeMultiplier);
        break;
      case "罐头":
        baseHealth = Math.floor((6 + totalSatiety * 1.1) * healthMultiplier);
        baseStamina = Math.floor((2 + totalMoisture * 0.75) * staminaMultiplier);
        totalSeconds = Math.floor(totalSeconds * timeMultiplier);
        break;
    }
    const output = [
      "🍳 烹饪结果 🍳",
      `料理类型：${dishType}`,
      `总饱食度：${totalSatiety}`,
      `总水分：${totalMoisture}`,
      "",
      "【基础加成】",
      `生命效果倍率：${(healthMultiplier * 100).toFixed(0)}%`,
      `体力效果倍率：${(staminaMultiplier * 100).toFixed(0)}%`,
      `持续时间倍率：${(timeMultiplier * 100).toFixed(0)}%`,
      ""
    ];
    if (dishType === "便当") {
      output.push(
        `瞬间回复生命：${Math.floor(instantHealth)}`,
        `瞬间回复体力：${Math.floor(instantStamina)}`
      );
    } else if (dishType === "罐头") {
      output.push(
        `持续时长：${totalSeconds}秒`,
        `每5秒回复生命：${Math.floor(baseHealth)}`,
        `每5秒回复体力：${Math.floor(baseStamina)}`,
        `总计回复：${Math.floor(baseHealth * totalSeconds / 5)}生命 / ${Math.floor(baseStamina * totalSeconds / 5)}体力`
      );
    }
    output.push(
      "",
      "【特殊加成】",
      ...Array.from(specialEffects.entries()).map(([type, value]) => {
        if (type === "烹饪时长") return `☆ 持续时间 +${value}秒`;
        return `☆ ${type}：${value}`;
      })
    );
    return output.join("\n");
  });
  ctx.command("材料技能 <name:string>", "查询材料技能").action(async (_, name2) => {
    const [material] = await findMaterialByNameOrAlias(name2);
    if (!material) return "材料不存在";
    const skills = await ctx.database.get("material_skill", { materialId: material.id });
    if (skills.length === 0) return "该材料没有关联技能";
    const output = [
      `材料：${material.name} 技能列表`,
      ...skills.map((skill) => {
        const image = import_koishi.h.image((0, import_url.pathToFileURL)((0, import_path.resolve)(__dirname, skill.image)).href);
        return [
          image,
          `技能名称：${skill.skillName}`,
          `描述：${skill.description}`,
          `效果：${skill.effect}`
        ].join("\n");
      })
    ];
    return output.join("\n\n");
  });
  ctx.command("材料技能").subcommand(".add <materialName:string> <skillName:string> <description:text> <effect:text> <image:string>", "添加材料技能", {
    authority: 2
  }).action(async (_, materialName, skillName, description, effect, image) => {
    const [material] = await findMaterialByNameOrAlias(materialName);
    if (!material) return "材料不存在";
    await ctx.database.create("material_skill", {
      materialId: material.id,
      skillName,
      description,
      effect,
      image
    });
    return `已为 ${materialName} 添加技能：${skillName}`;
  });
  ctx.command("材料技能").subcommand(".remove <materialName:string> <skillName:string>", "删除材料技能", {
    authority: 2
  }).action(async (_, materialName, skillName) => {
    const [material] = await findMaterialByNameOrAlias(materialName);
    if (!material) return "材料不存在";
    const result = await ctx.database.remove("material_skill", {
      materialId: material.id,
      skillName
    });
    return result ? `已删除技能：${skillName}` : "技能不存在";
  });
  ctx.command("数据库管理").subcommand(".删除 <table:string>", "删除数据库表", {
    authority: 5
  }).action(async (_, table) => {
    const validTables = [
      "material",
      "material_attribute",
      "material_alias",
      "food",
      "material_skill"
    ];
    if (!validTables.includes(table)) {
      return `无效数据库表名，可用选项：${validTables.join(", ")}`;
    }
    try {
      await ctx.database.drop(table);
      return `已成功删除 ${table} 数据库表`;
    } catch (err) {
      console.error("数据库删除失败:", err);
      return `删除 ${table} 表失败，请检查控制台日志`;
    }
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
