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
  ctx.command("查询价格 <name:string>", "查询物品价格信息").action(async (_, name2) => {
    if (!name2) return "请输入物品名称";
    const [item] = await ctx.database.get("material", { name: [name2] }, [
      "name",
      "image",
      "merit",
      "price"
    ]);
    if (!item) return "未找到该物品";
    const output = [];
    const imagePath = (0, import_path.resolve)(__dirname, item.image);
    output.push(import_koishi.h.image((0, import_url.pathToFileURL)(imagePath).href));
    let info = `物品名称：${item.name}`;
    if (item.merit !== void 0 && item.merit !== null) {
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
    const [item] = await ctx.database.get("material", { name: [name2] }, [
      "id",
      "name",
      "type",
      "materialType",
      "grade",
      "slots",
      "description",
      "image",
      "merit",
      "price",
      "satiety",
      "moisture"
    ]);
    if (!item) return "未找到该物品";
    const output = [];
    const imagePath = (0, import_path.resolve)(__dirname, item.image);
    output.push(import_koishi.h.image((0, import_url.pathToFileURL)(imagePath).href));
    let info = `【物品信息】
名称：${item.name}`;
    if (item.grade && item.grade > 0) {
      info += `
材料阶级：${item.grade}阶`;
    }
    if (item.slots && item.slots > 0) {
      info += `
占用格子：${item.slots}格`;
    }
    if (item.type === "材料") {
      const attributes = await ctx.database.get("material_attribute", {
        materialId: item.id,
        starLevel: { $gte: 1, $lte: 5 }
        // 查询1-5星数据
      });
      const starMap = attributes.reduce((map, attr) => {
        const star = attr.starLevel;
        if (!map.has(star)) map.set(star, []);
        map.get(star).push(attr);
        return map;
      }, /* @__PURE__ */ new Map());
      const starOutput = [];
      for (let star = 1; star <= 5; star++) {
        starOutput.push(`
⭐ ${star}星属性：`);
        const attrs = starMap.get(star);
        if (attrs?.length) {
          attrs.forEach((attr) => {
            starOutput.push(`▸ ${attr.attrName}: ${attr.attrValue}`);
          });
        } else {
          starOutput.push("（暂无属性数据）");
        }
      }
      output.push("\n【全星级属性】" + starOutput.join("\n"));
    }
    if (item.type === "食材") {
      info += `
饱食度：${item.satiety || 0}
水分：${item.moisture || 0}`;
    }
    info += `
描述：${item.description}`;
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
  }).subcommand(".materialExtend <name:string> <...attrs:string>", {
    authority: 5
  }).usage("参数：材料名称 属性1 属性2 ...").example("材料图鉴.materialExtend 菌丝 法强 体力 耐力").action(async (_, name2, ...attrs) => {
    const [material] = await ctx.database.get("material", { name: [name2] });
    if (!material) return `材料 ${name2} 不存在`;
    if (material.type !== "材料") return `该物品类型为 ${material.type}，仅支持材料类型`;
    if (attrs.length === 0) return "至少需要一个属性";
    if (new Set(attrs).size !== attrs.length) return "存在重复的属性";
    const entries = [];
    for (let starLevel = 1; starLevel <= 5; starLevel += 1) {
      attrs.forEach((attrName) => {
        entries.push({
          materialId: material.id,
          starLevel,
          attrName,
          attrValue: 0
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
      `成功为 ${name2}(${material.id}) 创建属性模板：`,
      `共生成 ${entries.length} 条属性模板`
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
    const materialEntries = materials.split(/\s+/).map((entry) => {
      const match = entry.match(/^(.+?)x(\d+)$/);
      if (!match) return null;
      return {
        name: match[1].trim(),
        count: parseInt(match[2]),
        original: match[0]
      };
    }).filter(Boolean);
    if (materialEntries.length < 2) {
      return "至少需要两个材料进行合成，格式：材料名x数量";
    }
    const materialsData = await ctx.database.get("material", {
      name: materialEntries.map((m) => m.name)
    });
    const missingList = materialEntries.filter((entry) => !materialsData.some((data) => data.name === entry.name)).map((entry) => entry.original);
    if (missingList.length > 0) {
      return `以下材料不存在：${missingList.join(", ")}`;
    }
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
      const finalValue = Math.round(totalValue * multiplier);
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
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  name
});
