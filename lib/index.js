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
  inject: () => inject,
  name: () => name,
  using: () => using
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var import_path = require("path");
var import_url = require("url");
var import_fs = require("fs");
var name = "campfire";
var blacklist = [];
var Config = import_koishi.Schema.object({
  messageRecall: import_koishi.Schema.object({
    enable: import_koishi.Schema.boolean().default(true).description("是否启用消息自动撤回"),
    recallTime: import_koishi.Schema.number().min(5).max(300).step(1).default(30).description("消息自动撤回时间(秒)")
  }).description("消息撤回设置"),
  greedyChestRates: import_koishi.Schema.object({
    gold: import_koishi.Schema.number().min(0).max(100).step(1).default(40).description("金币面出现概率 (%)"),
    greed: import_koishi.Schema.number().min(0).max(100).step(1).default(30).description("贪婪面出现概率 (%)"),
    diamond: import_koishi.Schema.number().min(0).max(100).step(1).default(20).description("钻石面出现概率 (%)"),
    lucky: import_koishi.Schema.number().min(0).max(100).step(1).default(10).description("幸运面出现概率 (%)")
  }).description("贪婪宝箱概率配置"),
  attrNameMappings: import_koishi.Schema.dict(String).description("属性名称映射表（中文 → 英文标识）").role("table", {
    display: "key-value",
    headers: {
      key: { label: "中文属性名" },
      value: { label: "英文标识" }
    }
  }),
  island: import_koishi.Schema.object({
    spawnInterval: import_koishi.Schema.number().default(10).description("岛屿生成间隔(分钟)"),
    maxIslands: import_koishi.Schema.number().default(2).description("最大同时存在岛屿数"),
    islandLifespan: import_koishi.Schema.number().default(30).description("岛屿存在时间(分钟)"),
    maxPlayers: import_koishi.Schema.number().default(6).description("单岛最大人数"),
    actionInterval: import_koishi.Schema.number().default(4).description("动作执行间隔(分钟)"),
    entryCost: import_koishi.Schema.number().default(20).description("上岛消耗精力")
  }).description("岛屿系统配置")
});
function apply(ctx, config) {
  ctx.config = {
    attrNameMappings: {
      ...config.attrNameMappings
      // 保留用户自定义配置
    },
    // 合并其他配置项
    ...config
  };
  console.log("[INIT] 最终配置:", ctx.config.attrNameMappings);
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
  ctx.model.extend("fortune", {
    id: "unsigned",
    level: "unsigned",
    description: "text",
    isSpecial: "boolean"
  }, {
    autoInc: true,
    primary: "id"
  });
  ctx.model.extend("user_cooldown", {
    id: "unsigned",
    userId: "string",
    lastUsed: "timestamp"
  }, {
    autoInc: true,
    primary: "id"
  });
  ctx.model.extend("user_currency", {
    userId: "string",
    love: { type: "unsigned", initial: 0 },
    diamond: { type: "unsigned", initial: 0 },
    gold: { type: "unsigned", initial: 0 },
    crystal: { type: "unsigned", initial: 0 },
    energy: { type: "unsigned", initial: 200 }
    // 新增精力字段
  }, {
    primary: "userId"
  });
  ctx.model.extend("user_profile", {
    userId: "string",
    nickname: "string",
    createdAt: "timestamp"
  }, {
    primary: "userId"
  });
  ctx.model.extend("gacha_records", {
    userId: "string",
    totalPulls: "unsigned",
    pityCounter: "json"
  }, {
    primary: "userId"
  });
  ctx.model.extend("greedy_chest", {
    userId: "string",
    slots: "list",
    finished: "boolean",
    createdAt: "timestamp"
  }, {
    primary: "userId"
  });
  ctx.model.extend("equipment", {
    id: "unsigned",
    userId: "string",
    type: "string",
    materials: "json",
    mainAttributes: "json",
    createdAt: "timestamp"
  }, {
    autoInc: true,
    primary: "id"
  });
  ctx.model.extend("user", {
    equipmentDraft: "json"
  }, {
    primary: "id",
    autoInc: true
  });
  ctx.model.extend("user_inventory", {
    userId: "string",
    nickname: "string",
    items: "json",
    updatedAt: "timestamp"
  }, {
    primary: "userId"
  });
  ctx.model.extend("island", {
    id: "string",
    createdAt: "timestamp",
    expiresAt: "timestamp",
    players: "list"
  }, {
    primary: "id"
  });
  ctx.model.extend("action", {
    name: "string",
    cost: "unsigned",
    rewards: "json"
  }, {
    primary: "name"
  });
  ctx.model.extend("user_island_status", {
    userId: "string",
    islandId: "string",
    currentAction: "string",
    lastActionTime: "timestamp",
    remainingActions: "unsigned",
    actionHistory: "json"
  }, {
    primary: ["userId"]
  });
  ctx.model.extend("island_settlement", {
    userId: "string",
    islandId: "string",
    actionHistory: "json",
    settledAt: "timestamp"
  }, {
    primary: ["userId", "islandId"]
    // 使用复合主键
  });
  initializeActions(ctx);
  startIslandSpawner(ctx);
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
  ctx.command("图鉴 [name]", "查询物品图鉴").option("page", "-p <page:number>").option("star", "-s <星级:number>").option("attr", "-a <属性名>").action(async ({ session, options }, name2) => {
    if (name2 && !options.star && !options.attr) {
      const materials = await findMaterialByNameOrAlias(name2);
      if (materials.length) {
        const material = materials[0];
        const output = [];
        switch (material.type) {
          case "材料":
            output.push(`【${material.name}】`);
            output.push(`类型：${material.materialType}`);
            output.push(`阶级：${material.grade}阶`);
            output.push(`占用：${material.slots}格`);
            if (material.description) output.push(`描述：${material.description}`);
            break;
          case "食材":
            output.push(`🍴【${material.name}】食材`);
            output.push(`饱食度：${material.satiety}`);
            output.push(`水分：${material.moisture}`);
            if (material.description) output.push(`描述：${material.description}`);
            break;
          case "杂物":
            output.push(`📦【${material.name}】杂物`);
            if (material.description) output.push(`描述：${material.description}`);
            break;
          case "时装":
            output.push(`👔【${material.name}】时装`);
            output.push(`扭蛋池：${["探险热潮", "动物派对", "沙滩派对"][material.grade - 1] || "未知"}`);
            if (material.description) output.push(`描述：${material.description}`);
            break;
          case "英灵":
            output.push(`⚔【${material.name}】英灵`);
            if (material.description) output.push(`描述：${material.description}`);
            break;
        }
        if (material.type === "材料") {
          const attributes = await ctx.database.get("material_attribute", {
            materialId: material.id
          });
          if (attributes.length) {
            output.push("\n🔧 属性成长：");
            const starMap = /* @__PURE__ */ new Map();
            attributes.forEach((attr) => {
              const entry = starMap.get(attr.starLevel) || [];
              entry.push(`${attr.attrName} +${attr.attrValue}`);
              starMap.set(attr.starLevel, entry);
            });
            [1, 2, 3, 4, 5].forEach((star) => {
              if (starMap.has(star)) {
                output.push(`⭐${star} → ${starMap.get(star).join("｜")}`);
              }
            });
          }
          const skills = await ctx.database.get("material_skill", {
            materialId: material.id
          });
          if (skills.length) {
            output.push("\n⚔ 技能列表：");
            skills.forEach((skill) => {
              output.push(`${skill.skillName}`);
            });
          }
        }
        if (material.image) {
          const imagePath = (0, import_path.resolve)(__dirname, material.image);
          if ((0, import_fs.existsSync)(imagePath)) {
            output.unshift(import_koishi.h.image((0, import_url.pathToFileURL)(imagePath).href));
          }
        }
        return handleRecallableMessage(session, output.join("\n"), ctx);
      }
    }
    if (options.attr && options.star) {
      const attrName = convertAttrName(ctx, options.attr);
      if (!attrName) return "无效属性名称";
      const attributes = await ctx.database.get("material_attribute", {
        attrName,
        starLevel: options.star
      });
      const materials = await ctx.database.get("material", {
        id: attributes.map((a) => a.materialId),
        type: "材料",
        materialType: { $ne: "兽核" }
      });
      const results = materials.map((m) => ({
        ...m,
        attributes: attributes.filter((a) => a.materialId === m.id)
      })).filter((m) => m.attributes.length > 0).sort(
        (a, b) => b.attributes[0].attrValue / b.slots - a.attributes[0].attrValue / a.slots
      );
      return formatAttributeList(results, attrName, options.star, options.page);
    }
    if (options.attr) {
      const attrName = convertAttrName(ctx, options.attr);
      if (!attrName) return "无效属性名称";
      const attributes = await ctx.database.get("material_attribute", {
        attrName
      });
      const materials = await ctx.database.get("material", {
        id: [...new Set(attributes.map((a) => a.materialId))],
        // 去重
        type: "材料",
        materialType: { $ne: "兽核" }
        // 排除兽核材料
      });
      const results = materials.map((m) => ({
        ...m,
        attributes: attributes.filter((a) => a.materialId === m.id)
      }));
      return formatAttributeList(results, attrName, void 0, options.page);
    }
    const validTypes = ["材料", "食材", "杂物", "时装", "英灵"];
    if (validTypes.includes(name2)) {
      const materials = await ctx.database.get("material", {
        type: name2
        // 添加类型断言
      });
      return formatTypeList(materials, name2, options.page);
    }
    const materialSubTypes = ["碎块", "兽核", "布匹", "丝绳", "残骸"];
    if (materialSubTypes.includes(name2)) {
      const materials = await ctx.database.get("material", {
        materialType: name2,
        type: "材料"
        // 明确为字面量类型
      });
      return formatMaterialTypeList(materials, name2, options.page);
    }
    const gradeMatch = name2?.match(/([一二三四五六七八九十])阶/);
    if (gradeMatch) {
      const grade = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"].indexOf(gradeMatch[1]) + 1;
      const materials = await ctx.database.get("material", {
        grade,
        type: "材料"
      });
      return formatGradeList(materials, grade, options.page);
    }
    return `请选择查询类型：
1. 材料名称：直接输入材料名称
2. 材料类型：材料/食材/杂物/时装/英灵
3. 材料子类：碎块/兽核/布匹/丝绳/残骸
4. 阶级查询：三阶/四阶
5. 属性查询：攻击/法强 + -s 星级`;
  });
  async function formatAttributeList(materials, attrName, star, page = 1) {
    const allEntries = materials.flatMap(
      (m) => m.attributes?.map((attr) => ({
        name: m.name,
        grade: m.grade,
        star: attr.starLevel,
        value: attr.attrValue,
        slots: m.slots
      })) || []
    );
    const sorted = allEntries.sort((a, b) => {
      const perSlotDiff = b.value / b.slots - a.value / a.slots;
      if (perSlotDiff !== 0) return perSlotDiff;
      return b.star - a.star;
    });
    const pageSize = 10;
    const totalPages = Math.ceil(sorted.length / pageSize);
    page = Math.min(page, totalPages);
    const output = [
      `📚 【${attrName}】全星级属性排行`,
      ...sorted.slice((page - 1) * pageSize, page * pageSize).map((entry) => {
        const perSlot = (entry.value / entry.slots).toFixed(1);
        return `${entry.name}｜${entry.grade}阶｜${entry.star}星｜单格:${perSlot}｜总值:${entry.value}`;
      })
    ];
    if (totalPages > 1) {
      output.push(`
第 ${page}/${totalPages} 页，输入"图鉴 -a ${attrName} -p 页码"查看其他页`);
    }
    return output.join("\n");
  }
  __name(formatAttributeList, "formatAttributeList");
  ctx.command("材料图鉴").subcommand(".create <name:string> <type:string> <materialType:string> <grade:number> <slots:number> <description:text> <image:string>", "创建新材料", {
    authority: 2
  }).action(async (_, name2, type, materialType, grade, slots, description, image) => {
    const validTypes = ["材料", "食材", "杂物", "时装", "英灵"];
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
  const assetPath = (0, import_path.resolve)(__dirname, "assets");
  console.log("资源目录路径:", assetPath);
  console.log("字体文件存在:", (0, import_fs.existsSync)((0, import_path.resolve)(assetPath, "fusion_pixel.ttf")));
  console.log("背景图存在:", (0, import_fs.existsSync)((0, import_path.resolve)(assetPath, "baojukuang1_1.png")));
  async function generateResultImage(results, grade, stars) {
    const loadDataURL = /* @__PURE__ */ __name((path) => {
      const data = require("fs").readFileSync(path);
      return `data:image/png;base64,${data.toString("base64")}`;
    }, "loadDataURL");
    const attrMappings = ctx.config.attrNameMappings;
    const resources = {
      background: loadDataURL((0, import_path.resolve)(assetPath, "baojukuang1_1.png")),
      gradeIcon: loadDataURL((0, import_path.resolve)(assetPath, `rare/grade${grade}.png`)),
      starIcon: loadDataURL((0, import_path.resolve)(assetPath, `rare/star${grade}.png`)),
      attrIcons: Object.fromEntries(
        // 使用配置中的映射关系
        Object.entries(attrMappings).map(([chinese, english]) => [
          chinese,
          loadDataURL((0, import_path.resolve)(assetPath, `attr/${english}.png`))
        ])
      ),
      font: loadDataURL((0, import_path.resolve)(assetPath, "fusion_pixel.ttf"))
    };
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            /* 字体定义 */
            @font-face {
                font-family: 'Fusion Pixel';
                src: url('${resources.font}') format('truetype');
            }

            /* 容器布局 */
            .container {
                position: relative;
                width: 160px;      /* 画布宽度 */
                height: 160px;     /* 画布高度 */
                background-image: url('${resources.background}');
                background-size: cover;
                background-position: -4px -8px;
                font-family: 'Fusion Pixel', sans-serif;
                color: #fff;
            }

            /* 阶级图标布局 */
            .grade-icon {
                position: absolute;
                left: 99px;       /* X轴位置 */
                top: 64px;         /* Y轴位置 */
                width: 48px;       /* 图标宽度 */
                height: 8px;       /* 图标高度 */
            }

            /* 星级图标布局 */
            .star-icon {
                position: absolute;
                width: 48px;       /* 单星宽度 */
                height: 8px;      /* 单星高度 */
                top: 64px;         /* Y轴基准位置 */
            }

            /* 属性图标布局 */
            .attr-icon {
                position: absolute;
                width: 16px;       /* 保持显示尺寸不变 */
                height: 16px;
                left: 13px;
                image-rendering: crisp-edges; /* 添加抗锯齿设置 */
            }

            /* 属性文字布局 */
            .attr-text {
                position: absolute;
                font-size: 10px;   /* 字体大小 */
                left: 29px;        /* 文字起始位置 */
                white-space: nowrap;
                filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.5)); /* 文字描边 */
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- 阶级图标 位置固定 -->
            <img class="grade-icon" src="${resources.gradeIcon}">
            
            <!-- 星级图标 动态排列 -->
            ${Array.from({ length: stars }, (_, i) => `
                <img class="star-icon" 
                     src="${resources.starIcon}"
                     style="left: ${99 + i * 7}px"> <!-- 每颗星间隔7px -->
            `).join("")}

            <!-- 属性区域 垂直排列 -->
            ${results.slice(0, 3).map((text, index) => {
      const [name2, value] = text.split("+");
      const yPos = 91 + index * 12;
      return `
                <img class="attr-icon" 
                     src="${resources.attrIcons[name2] || resources.attrIcons.default}"
                     style="top: ${yPos}px;
                            width: 32px;      /* 实际渲染尺寸放大2倍 */
                            height: 32px;
                            transform: scale(0.5); /* 缩小回原始显示尺寸 */
                            transform-origin: top left;">
                <div class="attr-text" style="top: ${yPos + 2}px">${name2}+${value}</div>
                `;
    }).join("")}
        </div>
    </body>
    </html>
    `;
    console.log("字体数据长度:", resources.font.length);
    console.log("背景图数据:", resources.background.slice(0, 50));
    const browser = ctx.puppeteer.browser;
    const page = await browser.newPage();
    try {
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      await page.setViewport({
        width: 160,
        height: 160,
        deviceScaleFactor: 2
        // 关键参数：将分辨率提升2倍
      });
      await new Promise((resolve2) => setTimeout(resolve2, 500));
      const screenshot = await page.screenshot({
        type: "png",
        omitBackground: true,
        clip: {
          x: 0,
          y: 0,
          width: 160,
          height: 160
        }
      });
      return `data:image/png;base64,${screenshot.toString("base64")}`;
    } finally {
      await page.close();
    }
  }
  __name(generateResultImage, "generateResultImage");
  async function processAttributeInput(stars, materials, needImage, grade = 3) {
    const attributes = /* @__PURE__ */ new Map();
    for (const entry of materials.split(/\s+/)) {
      const match = entry.match(/^(.+?)x(\d+)$/);
      if (!match) return { error: `无效属性格式：${entry}` };
      const [_, attrName, valueStr] = match;
      const value = parseInt(valueStr);
      if (!attrNameMap[attrName]) {
        return { error: `请让可约添加新属性：${attrName}，目前可用属性：${Object.keys(attrNameMap).join(" ")}` };
      }
      attributes.set(attrName, value);
    }
    const allAttributes = Array.from(attributes.entries());
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length);
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount);
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1];
    const finalAttributes = selected.map(([name2, value]) => ({
      name: name2,
      finalValue: Math.ceil(value * multiplier)
    }));
    const textOutput = [
      "🔥 精工结果 🔥",
      `目标星级：${stars}⭐`,
      "输入属性：" + Array.from(attributes.entries()).map(([k, v]) => `${k}x${v}`).join(" "),
      "",
      "【属性总和】",
      ...Array.from(attributes.entries()).map(([name2, value]) => `${name2}: ${value}`),
      "",
      "【计算过程】",
      `随机选择 ${selectCount} 条属性 x${multiplier}`,
      ...selected.map(
        ([name2, value], index) => `${name2}: ${value} × ${multiplier} ≈ ${finalAttributes[index].finalValue}`
      )
    ];
    if (needImage) {
      try {
        const imageData = await generateResultImage(
          finalAttributes.map((attr) => `${attr.name}+${attr.finalValue}`),
          grade,
          // 使用传入的阶级参数
          stars
        );
        return { imageData, textOutput };
      } catch (err) {
        console.error("图片生成失败:", err);
        return { error: textOutput.join("\n") };
      }
    }
    return { textOutput };
  }
  __name(processAttributeInput, "processAttributeInput");
  async function processMaterialInput(ctx2, stars, materials, needImage) {
    if (stars === "all") {
      const starAttributes = /* @__PURE__ */ new Map();
      for (let star = 1; star <= 5; star++) {
        const result = await processMaterialInput(ctx2, star, materials, false);
        if ("error" in result) return result;
        const attrMap = /* @__PURE__ */ new Map();
        result.textOutput.join("\n").match(/(\S+): (\d+)/g)?.forEach((match) => {
          const [name2, value] = match.split(": ");
          attrMap.set(name2, parseInt(value));
        });
        starAttributes.set(star, attrMap);
      }
      const baseAttributes = Array.from(starAttributes.get(1).entries());
      const selectCount2 = Math.min(Math.floor(Math.random() * 3) + 1, baseAttributes.length);
      const multiplier2 = [0.3, 0.24, 0.18][selectCount2 - 1];
      const selectedAttrs = baseAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount2).map(([name2]) => name2);
      const results = [];
      for (let star = 1; star <= 5; star++) {
        const currentAttributes = starAttributes.get(star);
        const starResult = {
          star,
          attributes: selectedAttrs.map((name2) => ({
            name: name2,
            value: Math.ceil((currentAttributes.get(name2) || 0) * multiplier2)
          }))
        };
        results.push(starResult);
      }
      const totalResult = selectedAttrs.reduce((acc, name2) => {
        acc[name2] = results.reduce((sum, r) => {
          const attr = r.attributes.find((a) => a.name === name2);
          return sum + (attr ? attr.value : 0);
        }, 0);
        return acc;
      }, {});
      const output = [
        "🔥 全星级精工模拟（真实星级数据） 🔥",
        `使用材料：${materials}`,
        `随机选择 ${selectCount2} 条词条 x${multiplier2}`,
        `选中词条：${selectedAttrs.join("、")}`,
        "━━━━━━━━━━━━━━━━━━",
        ...results.map(
          (r) => `${r.star}⭐：${r.attributes.map((a) => `${a.name}+${a.value}`).join(" ")}`
        ),
        "━━━━━━━━━━━━━━━━━━",
        "属性总和：",
        ...Object.entries(totalResult).map(
          ([name2, total]) => `${name2}: ${total}`
        )
      ];
      return { textOutput: output };
    }
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async (entry) => {
      const match = entry.match(/^(.+?)x(\d+)$/);
      if (!match) return null;
      const materialName = match[1].trim();
      if (attrNameMap[materialName]) {
        return null;
      }
      const [material] = await findMaterialByNameOrAlias(materialName);
      return material ? { material, count: parseInt(match[2]) } : null;
    })).then((list) => list.filter(Boolean));
    if (materialEntries.length < 2) {
      return { error: "材料模式需要至少两个有效材料，格式：材料名x数量（字母x）" };
    }
    const coreEntries = materialEntries.filter(
      (entry) => entry.material.materialType === "兽核"
    );
    const totalCores = coreEntries.reduce((sum, entry) => sum + entry.count, 0);
    if (totalCores !== 1 || coreEntries.some((entry) => entry.count !== 1)) {
      return {
        error: `必须使用且只能使用1个兽核材料，当前使用：${coreEntries.map((e) => `${e.material.name}x${e.count}`).join(" ")} 总数量：${totalCores}个`
      };
    }
    const materialsData = materialEntries.map((entry) => entry.material);
    const firstGrade = materialsData[0].grade;
    const attributes = await ctx2.database.get("material_attribute", {
      materialId: materialsData.map((m) => m.id),
      starLevel: stars
    });
    const totalSlots = materialEntries.reduce((sum, entry) => sum + entry.material.slots * entry.count, 0);
    if (totalSlots !== 15) {
      return { error: `材料总格子数应为15，当前为${totalSlots}` };
    }
    const attributeMap = /* @__PURE__ */ new Map();
    materialEntries.forEach((entry) => {
      const attrs = attributes.filter((a) => a.materialId === entry.material.id);
      attrs.forEach((attr) => {
        const value = (attributeMap.get(attr.attrName) || 0) + attr.attrValue * entry.count;
        attributeMap.set(attr.attrName, value);
      });
    });
    const allAttributes = Array.from(attributeMap.entries());
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length);
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount);
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1];
    const finalAttributes = selected.map(([name2, value]) => ({
      name: name2,
      finalValue: Math.ceil(value * multiplier)
    }));
    const textOutput = [
      "🔥 精工结果 🔥",
      `目标星级：${stars}⭐`,
      `材料阶级：${firstGrade}阶`,
      `使用材料：${materialEntries.map((m) => `${m.material.name}x${m.count}`).join(" ")}`,
      "",
      "【属性总和】",
      ...Array.from(attributeMap.entries()).map(([name2, value]) => `${name2}: ${value}`),
      "",
      "【计算过程】",
      `随机选择 ${selectCount} 条属性 x${multiplier}`,
      ...selected.map(
        ([name2, value], index) => `${name2}: ${value} × ${multiplier} ≈ ${finalAttributes[index].finalValue}`
      )
    ];
    if (needImage) {
      try {
        const imageData = await generateResultImage(
          finalAttributes.map((attr) => `${attr.name}+${attr.finalValue}`),
          firstGrade,
          stars
        );
        return { imageData, textOutput };
      } catch (err) {
        console.error("图片生成失败:", err);
        return { error: textOutput.join("\n") };
      }
    }
    return { textOutput };
  }
  __name(processMaterialInput, "processMaterialInput");
  async function processMixedInput(ctx2, stars, inputs, needImage) {
    const materialParts = [];
    const attributeParts = [];
    inputs.forEach((input) => {
      const [name2] = input.split("x");
      if (Object.keys(attrNameMap).includes(name2)) {
        attributeParts.push(input);
      } else {
        materialParts.push(input);
      }
    });
    const materialResult = await processMaterialInput(ctx2, stars, materialParts.join(" "), false);
    if ("error" in materialResult) return materialResult;
    const attributeResult = await processAttributeInput(stars, attributeParts.join(" "), false);
    if ("error" in attributeResult) return attributeResult;
    const mergedAttributes = /* @__PURE__ */ new Map();
    const materialAttrRegex = /(\S+): (\d+)/g;
    const materialAttrs = /* @__PURE__ */ new Map();
    let match;
    while ((match = materialAttrRegex.exec(materialResult.textOutput.join("\n"))) !== null) {
      const name2 = match[1];
      const value = parseInt(match[2]);
      materialAttrs.set(name2, (materialAttrs.get(name2) || 0) + value);
      mergedAttributes.set(name2, (mergedAttributes.get(name2) || 0) + value);
    }
    const directAttrRegex = /(\S+): (\d+)/g;
    const directAttrs = /* @__PURE__ */ new Map();
    while ((match = directAttrRegex.exec(attributeResult.textOutput.join("\n"))) !== null) {
      const name2 = match[1];
      const value = parseInt(match[2]);
      directAttrs.set(name2, (directAttrs.get(name2) || 0) + value);
      mergedAttributes.set(name2, (mergedAttributes.get(name2) || 0) + value);
    }
    let maxGrade = 0;
    if (materialParts.length > 0) {
      const materials = await Promise.all(materialParts.map(async (part) => {
        const [name2] = part.split("x");
        return (await findMaterialByNameOrAlias(name2))[0];
      }));
      maxGrade = Math.max(...materials.map((m) => m.grade));
    }
    const allAttributes = Array.from(mergedAttributes.entries());
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length);
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount);
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1] || 0;
    const finalAttributes = selected.map(([name2, value]) => ({
      name: name2,
      finalValue: Math.ceil(value / 2 * multiplier)
    }));
    const textOutput = [
      "🔥 混合模式精工结果 🔥",
      `目标星级：${stars}⭐`,
      `最高阶级：${maxGrade || "无材料输入"}`,
      `使用材料：${materialParts.join(" ")}`,
      `输入属性：${attributeParts.join(" ")}`,
      "",
      "【材料转换属性】",
      ...Array.from(materialAttrs.entries()).map(([k, v]) => `${k}: ${v / 2}`),
      "【直接输入属性】",
      ...Array.from(directAttrs.entries()).map(([k, v]) => `${k}: ${v / 2}`),
      "【合并总属性】",
      ...Array.from(mergedAttributes.entries()).map(([k, v]) => `${k}: ${v / 2}`),
      "",
      "【计算过程】",
      `随机选择 ${selectCount} 条属性 x${multiplier.toFixed(2)}`,
      ...selected.map(
        ([name2, value], index) => `${name2}: ${value / 2} x ${multiplier.toFixed(2)} ≈ ${finalAttributes[index].finalValue}`
      )
    ];
    if (needImage) {
      try {
        const imageData = await generateResultImage(
          finalAttributes.map((attr) => `${attr.name}+${attr.finalValue}`),
          maxGrade || 3,
          // 默认3阶
          stars
        );
        return { imageData, textOutput };
      } catch (err) {
        console.error("图片生成失败:", err);
        return { error: textOutput.join("\n") };
      }
    }
    return { textOutput };
  }
  __name(processMixedInput, "processMixedInput");
  ctx.command("模拟精工锭 <inputParams:text>", "模拟合成精工锭").action(async ({ session }, inputParams) => {
    const params = inputParams.split(/\s+/);
    if (params[0] === "all") {
      const materialResult = await processMaterialInput(ctx, "all", params.slice(1).join(" "), false);
      return "error" in materialResult ? materialResult.error : materialResult.textOutput.join("\n");
    }
    let mode = "material";
    const hasAttributes = await Promise.all(params.slice(1).map(async (p) => {
      const [name2] = p.split("x");
      return Object.keys(attrNameMap).includes(name2) || !(await findMaterialByNameOrAlias(name2))[0];
    })).then((results) => results.some(Boolean));
    const hasMaterials = await Promise.all(params.slice(1).map(async (p) => {
      const [name2] = p.split("x");
      return (await findMaterialByNameOrAlias(name2))[0]?.type === "材料";
    })).then((results) => results.some(Boolean));
    if (hasAttributes && hasMaterials) {
      mode = "mixed";
    } else if (hasAttributes) {
      mode = "attribute";
    }
    let result;
    switch (mode) {
      case "attribute":
        if (params.length < 2) return "属性模式需要参数格式：星级 属性1x数值...";
        const stars = parseInt(params[0]);
        const materials = params.slice(1).join(" ");
        if (isNaN(stars) || stars < 1 || stars > 5) return "星级必须为1-5的整数";
        result = await processAttributeInput(stars, materials, false);
        break;
      case "mixed":
        if (params.length < 2) return "混合模式需要参数格式：星级 材料/属性组合...";
        const mixedStars = parseInt(params[0]);
        if (isNaN(mixedStars) || mixedStars < 1 || mixedStars > 5) return "星级必须为1-5的整数";
        result = await processMixedInput(ctx, mixedStars, params.slice(1), false);
        break;
      default:
        if (params.length < 2) return "材料模式需要参数格式：星级 材料1x数量...";
        const materialStars = parseInt(params[0]);
        if (isNaN(materialStars) || materialStars < 1 || materialStars > 5) return "星级必须为1-5的整数";
        result = await processMaterialInput(ctx, materialStars, params.slice(1).join(" "), false);
        break;
    }
    const content = "error" in result ? result.error : result.textOutput.join("\n");
    return handleRecallableMessage(session, content, ctx);
  });
  ctx.command("精工 <inputParams:text>", "正式合成精工锭").action(async ({ session }, inputParams) => {
    const params = inputParams.split(/\s+/);
    let mode = "material";
    const hasAttributes = await Promise.all(params.slice(1).map(async (p) => {
      const [name2] = p.split("x");
      return Object.keys(attrNameMap).includes(name2) || !(await findMaterialByNameOrAlias(name2))[0];
    })).then((results) => results.some(Boolean));
    const hasMaterials = await Promise.all(params.slice(1).map(async (p) => {
      const [name2] = p.split("x");
      return (await findMaterialByNameOrAlias(name2))[0]?.type === "材料";
    })).then((results) => results.some(Boolean));
    if (hasAttributes && hasMaterials) {
      mode = "mixed";
    } else if (hasAttributes) {
      mode = "attribute";
    }
    if (mode === "attribute") {
      if (params.length < 3) return "属性模式需要参数格式：阶级 星级 属性1x数值...";
      const grade = parseInt(params[0]);
      const stars2 = parseInt(params[1]);
      const materials = params.slice(2).join(" ");
      if (isNaN(grade) || grade < 1 || grade > 10) return "阶级必须为1-10的整数";
      if (isNaN(stars2) || stars2 < 1 || stars2 > 5) return "星级必须为1-5的整数";
      const result2 = await processAttributeInput(stars2, materials, true, grade);
      if ("error" in result2) return result2.error;
      return import_koishi.h.image(result2.imageData);
    }
    if (mode === "mixed") {
      if (params.length < 2) return "混合模式需要参数格式：星级 材料/属性组合...";
      const stars2 = parseInt(params[0]);
      if (isNaN(stars2) || stars2 < 1 || stars2 > 5) return "星级必须为1-5的整数";
      const result2 = await processMixedInput(ctx, stars2, params.slice(1), true);
      if ("error" in result2) return result2.error;
      return import_koishi.h.image(result2.imageData);
    }
    if (params.length < 2) return "材料模式需要参数格式：星级 材料1x数量...";
    const stars = parseInt(params[0]);
    if (isNaN(stars) || stars < 1 || stars > 5) return "星级必须为1-5的整数";
    const result = await processMaterialInput(ctx, stars, params.slice(1).join(" "), true);
    if ("error" in result) return result.error;
    return import_koishi.h.image(result.imageData);
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
  const elements = ["草", "冰", "火", "岩"];
  ctx.command("营火签到", "每日签到").userFields(["authority"]).action(async ({ session }) => {
    const userId = session.userId;
    const isAdmin = session.user?.authority >= 4;
    const [profile] = await ctx.database.get("user_profile", { userId });
    if (!profile) {
      return "您还未注册账号哦~\n请使用「注册 昵称」完成注册\n(昵称需为1-12位中英文/数字组合)";
    }
    if (!isAdmin) {
      const lastUsed = await ctx.database.get("user_cooldown", { userId });
      if (lastUsed.length > 0) {
        const lastDate = new Date(lastUsed[0].lastUsed);
        const lastDateCN = new Date(lastDate.getTime() + 8 * 60 * 60 * 1e3);
        const lastDateStr = `${lastDateCN.getUTCFullYear()}-${(lastDateCN.getUTCMonth() + 1).toString().padStart(2, "0")}-${lastDateCN.getUTCDate().toString().padStart(2, "0")}`;
        const nowCN = new Date(Date.now() + 8 * 60 * 60 * 1e3);
        const todayStr = `${nowCN.getUTCFullYear()}-${(nowCN.getUTCMonth() + 1).toString().padStart(2, "0")}-${nowCN.getUTCDate().toString().padStart(2, "0")}`;
        if (lastDateStr === todayStr) {
          return `今天已经占卜过了（上次签到时间：${formatDateCN(lastDate)}），明天再来吧~`;
        }
      }
    }
    const [currency] = await ctx.database.get("user_currency", { userId });
    if (!currency) {
      await ctx.database.create("user_currency", {
        userId,
        love: 0,
        diamond: 0,
        gold: 0,
        crystal: 0,
        energy: 200
      });
    }
    let luckValue = Math.floor(Math.random() * 100) + 1;
    let isSpecial = Math.random() < 0.01;
    if (isSpecial) {
      luckValue = 999;
    }
    const level = isSpecial ? 20 : Math.min(20, Math.ceil(luckValue / 5));
    const [fortune] = await ctx.database.get("fortune", {
      level,
      isSpecial
    }, { limit: 1 });
    const element = elements[Math.floor(Math.random() * elements.length)];
    if (!isAdmin) {
      const nowUTC = /* @__PURE__ */ new Date();
      await ctx.database.upsert("user_cooldown", [{
        userId,
        lastUsed: nowUTC
      }], ["userId"]);
    }
    await ctx.database.upsert("user_currency", [{
      userId,
      diamond: (currency?.diamond || 0) + 2400,
      energy: 200
    }], ["userId"]);
    const [newCurrency] = await ctx.database.get("user_currency", { userId });
    return [
      `✨ 营火签到 ✨`,
      `昵称：${profile.nickname}`,
      `今日元素祝福：${element}`,
      `幸运数值：${luckValue}${isSpecial ? "✨" : ""}`,
      `运势解读：${fortune?.description || "未知运势"}`,
      `
🎁 签到奖励：钻石+2400`,
      `当前余额：💎${newCurrency.diamond}  💰${newCurrency.gold}  💖${newCurrency.love}  ✨${newCurrency.crystal}`,
      `精力值：⚡${newCurrency.energy}/200`
    ].filter(Boolean).join("\n");
  });
  ctx.command("我的余额", "查看账户余额").action(async ({ session }) => {
    const [currency] = await ctx.database.get("user_currency", {
      userId: session.userId
    });
    if (!currency) return "尚未创建账户，请先使用营火签到";
    const [profile] = await ctx.database.get("user_profile", {
      userId: session.userId
    });
    return `💰 账户余额：${profile ? `
昵称：${profile.nickname}` : ""}
💎 钻石：${currency.diamond}
💰 金币：${currency.gold}
💖 爱心：${currency.love}
✨ 幻晶：${currency.crystal}
⚡ 精力：${currency.energy}/200`;
  });
  ctx.command("扭蛋 <type:string>", "进行扭蛋抽卡").option("count", "-c <count:number>", { fallback: 1 }).action(async ({ session, options }, type) => {
    const userId = session.userId;
    const pullCount = type === "十连" ? 10 : 1;
    const cost = 240 * pullCount;
    const [currency] = await ctx.database.get("user_currency", { userId });
    if (!currency || currency.diamond < cost) {
      return `钻石不足，需要${cost}💎（当前余额：${currency?.diamond || 0}💎）`;
    }
    await ctx.database.upsert("user_currency", [{
      userId,
      diamond: currency.diamond - cost
    }], ["userId"]);
    let [record] = await ctx.database.get("gacha_records", { userId });
    if (!record) {
      record = {
        userId,
        totalPulls: 0,
        pityCounter: {
          探险热潮: 0,
          动物派对: 0,
          沙滩派对: 0
        }
      };
      await ctx.database.create("gacha_records", record);
    }
    const results = [];
    for (let i = 0; i < pullCount; i++) {
      results.push(await performGacha(ctx, userId));
    }
    const [newCurrency] = await ctx.database.get("user_currency", { userId });
    const output = [
      "🎉━━━━ 扭蛋结果 ━━━━🎉",
      `消耗钻石：${cost}💎  `
    ];
    results.forEach((r, index) => {
      output.push(`
🔮 第 ${index + 1} 抽 ━━━━━━`);
      if (r.rank === "彩蛋") {
        output.push(
          "✨✨ 袖珍彩蛋触发！✨✨",
          `├─ 主池类型：${r.gachaType}`,
          `└─ 额外奖励：${r.extra.rank}级 ${r.extra.item?.name || "神秘物品"}`
        );
      } else {
        const rankIcon = {
          S: "🌟S级",
          A: "✨A级",
          B: "🔶B级",
          C: "🔷C级",
          D: "⚪D级"
        }[r.rank];
        output.push(
          `${rankIcon} ${r.item?.name || "未知物品"}`,
          `├─ 扭蛋类型：${r.isMini ? "袖珍" : "常规"} ${r.gachaType}`,
          `└─ ${r.isPity ? "✨保底奖励" : "常规掉落"}`
        );
      }
    });
    output.push(
      "\n  ━━━━ 余额信息 ━━━━  ",
      `剩余钻石：💎${newCurrency.diamond}`,
      `累计抽卡：${record.totalPulls + pullCount}次`
    );
    return handleRecallableMessage(session, output.join("\n"), ctx);
  });
  ctx.command("贪婪宝箱 [action]", "贪婪宝箱抽奖").usage('输入"贪婪宝箱"开始/继续抽奖，"贪婪宝箱 结算"提前领取奖励\n测试指令：贪婪宝箱 <面类型> (-t)').option("test", "-t 测试模式（不消耗钻石）").action(async ({ session, options }, action) => {
    const userId = session.userId;
    const costPerPull = options.test ? 0 : 30;
    const [chest] = await ctx.database.get("greedy_chest", { userId });
    const [currency] = await ctx.database.get("user_currency", { userId });
    if (action && ["金币", "贪婪", "钻石", "幸运"].includes(action)) {
      if (!options.test) return "测试模式需要添加 -t 参数";
      const testSlot = action;
      const newSlots = chest?.slots?.length < 3 ? [...chest?.slots || [], testSlot] : [testSlot];
      await ctx.database.upsert("greedy_chest", [{
        userId,
        slots: newSlots,
        finished: newSlots.length >= 3
      }], ["userId"]);
      if (newSlots.length >= 3) {
        const result = await calculateRewards(newSlots, currency);
        await clearUserState(userId);
        return buildOutput(result, newSlots);
      }
      return [
        "🧪━━ 测试模式 ━━🧪",
        `当前槽位：[${newSlots.join("][")}]${"⬜".repeat(3 - newSlots.length)}`,
        "输入指令继续添加测试面，例如：贪婪宝箱 钻石 -t"
      ].join("\n");
    }
    if (action === "结算") {
      if (!chest || chest.finished) return "没有可结算的宝箱";
      if (chest.slots.length === 0) return "尚未开始抽奖";
      const result = await calculateRewards(chest.slots, currency);
      await clearUserState(userId);
      return buildOutput(result, chest.slots, true);
    }
    if (chest && !chest.finished) {
      if (chest.slots.length >= 3) {
        const result = await calculateRewards(chest.slots, currency);
        await clearUserState(userId);
        return buildOutput(result, chest.slots);
      }
      return processNextPull(ctx, userId, chest, currency, costPerPull, action);
    }
    if (!currency || currency.diamond < costPerPull) {
      return `需要${costPerPull}💎（当前余额：${currency?.diamond || 0}💎）`;
    }
    await ctx.database.upsert("greedy_chest", [{
      userId,
      slots: [],
      finished: false,
      createdAt: /* @__PURE__ */ new Date()
    }], ["userId"]);
    return processNextPull(ctx, userId, { slots: [] }, currency, costPerPull, action);
  });
  async function processNextPull(ctx2, userId, chest, currency, cost, testFace) {
    await ctx2.database.upsert("user_currency", [{
      userId,
      diamond: currency.diamond - cost
    }], ["userId"]);
    const newSlot = generateSlot(ctx2, testFace);
    const newSlots = [...chest.slots, newSlot];
    await ctx2.database.upsert("greedy_chest", [{
      userId,
      slots: newSlots,
      finished: newSlots.length >= 3
    }], ["userId"]);
    if (newSlots.length >= 3) {
      const result = await calculateRewards(newSlots, currency);
      await clearUserState(userId);
      return buildOutput(result, newSlots);
    }
    const [newCurrency] = await ctx2.database.get("user_currency", { userId });
    return [
      "🎰━━ 贪婪宝箱 ━━🎰",
      `当前槽位：[${newSlots.join("][")}]${"⬜".repeat(3 - newSlots.length)}`,
      `消耗钻石：${cost}💎 剩余次数：${3 - newSlots.length}`,
      "━━━━━━━━━━━━",
      `输入"贪婪宝箱"继续抽奖 (${3 - newSlots.length}次剩余)`,
      `或输入"贪婪宝箱 结算"提前领取奖励`,
      "━━━━━━━━━━━━",
      `当前余额：💎${newCurrency.diamond}`
    ].join("\n");
  }
  __name(processNextPull, "processNextPull");
  function generateSlot(ctx2, testFace) {
    const rates = ctx2.config.greedyChestRates;
    const total = rates.gold + rates.greed + rates.diamond + rates.lucky;
    const scale = total > 100 ? 100 / total : 1;
    const thresholds = {
      gold: rates.gold * scale / 100,
      greed: (rates.gold + rates.greed) * scale / 100,
      diamond: (rates.gold + rates.greed + rates.diamond) * scale / 100,
      lucky: 1
    };
    if (typeof testFace === "string" && ["金币", "贪婪", "钻石", "幸运"].includes(testFace)) {
      return testFace;
    }
    const rand = Math.random();
    return rand < thresholds.gold ? "金币" : rand < thresholds.greed ? "贪婪" : rand < thresholds.diamond ? "钻石" : "幸运";
  }
  __name(generateSlot, "generateSlot");
  async function calculateRewards(slots, currency) {
    const counts = {
      金币: slots.filter((x) => x === "金币").length,
      贪婪: slots.filter((x) => x === "贪婪").length,
      钻石: slots.filter((x) => x === "钻石").length,
      幸运: slots.filter((x) => x === "幸运").length
    };
    if (counts.贪婪 >= 2 && counts.贪婪 < 3) {
      const thirdSlot = slots[2];
      const validTypes = ["金币", "钻石", "幸运"];
      const slotType = validTypes.find((t) => t === thirdSlot);
      if (slotType) {
        Object.keys(counts).forEach((key) => counts[key] = 0);
        counts[slotType] = 3;
      }
    }
    let goldGained = 0;
    let diamondGained = 0;
    let extraItems = [];
    let reward = "";
    const rand = Math.random();
    const rewardPriority = ["幸运", "钻石", "金币", "贪婪"];
    let finalType = rewardPriority.find((type) => counts[type] >= 1);
    if (finalType === "金币") {
      switch (counts.金币) {
        case 1:
          if (rand < 0.45) {
            reward = "获得金币666";
            goldGained = 666;
          } else if (rand < 0.75) {
            reward = "获得金币888";
            goldGained = 888;
          } else {
            reward = "获得金币1111";
            goldGained = 1111;
          }
          break;
        case 2:
          if (rand < 0.45) {
            reward = "获得金币1666";
            goldGained = 1666;
          } else if (rand < 0.75) {
            reward = "获得金币1888";
            goldGained = 1888;
          } else {
            reward = "获得金币2333";
            goldGained = 2333;
          }
          break;
        case 3:
          if (rand < 0.45) {
            reward = "获得金币3333";
            goldGained = 3333;
          } else if (rand < 0.75) {
            reward = "获得金币6666";
            goldGained = 6666;
          } else {
            reward = "获得金币9999";
            goldGained = 9999;
          }
      }
    } else if (finalType === "钻石") {
      switch (counts.钻石) {
        case 1:
          if (rand < 0.45) {
            reward = "获得钻石33";
            diamondGained = 33;
          } else if (rand < 0.75) {
            reward = "获得钻石66";
            diamondGained = 66;
          } else {
            reward = "获得钻石99";
            diamondGained = 99;
          }
          break;
        case 2:
          if (rand < 0.35) {
            reward = "获得钻石99";
            diamondGained = 99;
          } else if (rand < 0.65) {
            reward = "获得钻石145";
            diamondGained = 145;
          } else if (rand < 0.9) {
            reward = "获得钻石233";
            diamondGained = 233;
          } else {
            reward = "获得钻石350";
            diamondGained = 350;
          }
          break;
        case 3:
          if (rand < 0.45) {
            reward = "获得钻石270";
            diamondGained = 270;
          } else if (rand < 0.75) {
            reward = "获得钻石499";
            diamondGained = 499;
          } else {
            reward = "获得钻石888";
            diamondGained = 888;
          }
      }
    } else if (finalType === "贪婪") {
      switch (counts.贪婪) {
        case 1:
          reward = "再抽一次";
          break;
        case 2:
          reward = "再抽一次";
          break;
        case 3:
          reward = "什么都没有";
      }
    } else if (finalType === "幸运") {
      switch (counts.幸运) {
        case 1:
          if (rand < 0.45) {
            reward = "获得自救卡";
            extraItems.push("自救卡");
          } else if (rand < 0.75) {
            reward = "获得死亡免掉落卡";
            extraItems.push("死亡免掉落卡");
          } else {
            reward = "获得二锅头";
            extraItems.push("二锅头");
          }
          break;
        case 2:
          if (rand < 0.45) {
            reward = "获得袖珍扭蛋：没偷吃";
            extraItems.push("袖珍扭蛋");
          } else if (rand < 0.75) {
            reward = "获得魔法丝线x1";
            extraItems.push("魔法丝线x1");
          } else {
            reward = "获得常驻武器抽奖券x3";
            extraItems.push("常驻武器抽奖券x3");
          }
          break;
        case 3:
          if (rand < 0.45) {
            reward = "获得魔法丝线x5";
            extraItems.push("魔法丝线x5");
          } else if (rand < 0.75) {
            const items = ["电玩金章", "电玩高手", "电玩猫猫"];
            reward = `获得${items[Math.floor(Math.random() * 3)]}`;
            extraItems.push(reward);
          } else {
            reward = "获得可约的香吻";
            extraItems.push("可约的香吻");
          }
      }
    }
    await ctx.database.upsert("user_currency", [{
      userId: currency.userId,
      gold: currency.gold + goldGained,
      diamond: currency.diamond + diamondGained
    }], ["userId"]);
    return { goldGained, diamondGained, extraItems, reward };
  }
  __name(calculateRewards, "calculateRewards");
  function buildOutput(result, slots, isEarly = false) {
    return [
      "🎰━━ 贪婪宝箱 ━━🎰",
      `最终槽位：[${slots.join("][")}]`,
      isEarly ? "⚠ 提前结算 ⚠" : "✅ 抽奖完成 ✅",
      "━━━━━━━━━━━━",
      `🎁 获得奖励：${result.reward}`,
      ...result.extraItems.length > 0 ? ["获得道具：" + result.extraItems.join(" ")] : [],
      "━━━━━━━━━━━━",
      `金币收入：💰${result.goldGained}`,
      `钻石变化：💎${result.diamondGained} (净收益: ${result.diamondGained - 30 * slots.length})`
    ].filter(Boolean).join("\n");
  }
  __name(buildOutput, "buildOutput");
  async function clearUserState(userId) {
    await ctx.database.remove("greedy_chest", { userId });
  }
  __name(clearUserState, "clearUserState");
  ctx.command("材料属性 <name>", "查询材料属性").action(async ({ session }, name2) => {
    const attrName = convertAttrName(ctx, name2);
    const attributes = await ctx.database.get("material_attribute", {
      attrName
    });
  });
  ctx.command("锻造 <equipment> <materials:text>", "制作装备").usage(`可用装备类型：
- 头盔：7碎块 5丝绳 6残骸 8布匹
- 内甲：8碎块 6丝绳 10残骸 9布匹
- 斗篷：7碎块 6丝绳 6残骸 10布匹
- 腿甲：8碎块 6丝绳 6残骸 6布匹
- 靴子：6碎块 6丝绳 6残骸 6布匹
- 戒指：1兽核 10碎块/残骸 8丝绳/布匹
- 项链：1兽核 7碎块/残骸 12丝绳/布匹
- 手镯：1兽核 10碎块/残骸 11丝绳/布匹
- 手套：1兽核 17碎块/残骸 9丝绳/布匹`).example("锻造 头盔 菌丝3x2 丝绳4x1 ...").action(async (_, equipment, materials) => {
    const validEquipments = ["头盔", "内甲", "斗篷", "腿甲", "靴子", "戒指", "项链", "手镯", "手套"];
    if (!validEquipments.includes(equipment)) {
      return `无效装备类型，可用类型：${validEquipments.join(" ")}`;
    }
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async (entry) => {
      const match = entry.match(/^(.+?)(\d+)x(\d+)$/);
      if (!match) return null;
      const [_2, name2, starStr, countStr] = match;
      const star = parseInt(starStr);
      const count = parseInt(countStr);
      const [material] = await findMaterialByNameOrAlias(name2);
      if (!material || material.type !== "材料") return null;
      return {
        material,
        star,
        count,
        slots: material.slots * count
      };
    })).then((list) => list.filter(Boolean));
    let coreCount = 0;
    const materialStats = {
      碎块: 0,
      兽核: 0,
      丝绳: 0,
      残骸: 0,
      布匹: 0
    };
    materialEntries.forEach((entry) => {
      const type = entry.material.materialType;
      if (type === "兽核") coreCount += entry.count;
      if (materialStats.hasOwnProperty(type)) {
        materialStats[type] += entry.slots;
      }
    });
    const requirements = {
      "头盔": { 碎块: 7, 丝绳: 5, 残骸: 6, 布匹: 8 },
      "内甲": { 碎块: 8, 丝绳: 6, 残骸: 10, 布匹: 9 },
      "斗篷": { 碎块: 7, 丝绳: 6, 残骸: 6, 布匹: 10 },
      "腿甲": { 碎块: 8, 丝绳: 6, 残骸: 6, 布匹: 6 },
      "靴子": { 碎块: 6, 丝绳: 6, 残骸: 6, 布匹: 6 },
      "戒指": { core: 1, 碎块残骸: 10, 丝绳布匹: 8 },
      "项链": { core: 1, 碎块残骸: 7, 丝绳布匹: 12 },
      "手镯": { core: 1, 碎块残骸: 10, 丝绳布匹: 11 },
      "手套": { core: 1, 碎块残骸: 17, 丝绳布匹: 9 }
    };
    const req = requirements[equipment];
    let error = "";
    if ("core" in req) {
      if (coreCount !== req.core) error += `需要${req.core}个兽核 `;
      const 碎块残骸 = materialStats.碎块 + materialStats.残骸;
      if (碎块残骸 !== req.碎块残骸) error += `碎块/残骸总格数需要${req.碎块残骸} `;
      const 丝绳布匹 = materialStats.丝绳 + materialStats.布匹;
      if (丝绳布匹 !== req.丝绳布匹) error += `丝绳/布匹总格数需要${req.丝绳布匹}`;
    } else {
      if (materialStats.碎块 !== req.碎块) error += `碎块需要${req.碎块}格 `;
      if (materialStats.丝绳 !== req.丝绳) error += `丝绳需要${req.丝绳}格 `;
      if (materialStats.残骸 !== req.残骸) error += `残骸需要${req.残骸}格 `;
      if (materialStats.布匹 !== req.布匹) error += `布匹需要${req.布匹}格`;
    }
    if (error) return `材料不符合要求：${error.trim()}`;
    const attributes = /* @__PURE__ */ new Map();
    for (const entry of materialEntries) {
      const attrs = await ctx.database.get("material_attribute", {
        materialId: entry.material.id,
        starLevel: entry.star
      });
      attrs.forEach((attr) => {
        const total = attr.attrValue * entry.count || 0;
        attributes.set(attr.attrName, (attributes.get(attr.attrName) || 0) + total);
      });
    }
    const mainAttributes = {
      "头盔": ["生命", "物抗", "法抗"],
      "内甲": ["生命", "物抗"],
      "斗篷": ["生命", "法抗"],
      "腿甲": ["生命", "体力"],
      "靴子": ["生命", "耐力"],
      "戒指": ["生命", "攻击"],
      "项链": ["生命", "法强"],
      "手镯": ["生命", "治疗"],
      "手套": ["生命", "攻击"]
    };
    const correctionFactors = {
      "法强": 4,
      "攻击": 4,
      "治疗": 3,
      "生命": 0.1,
      "法暴": 5,
      "物暴": 5,
      "法暴伤": 2.5,
      "物暴伤": 2.5,
      "法穿": 2,
      "物穿": 2,
      "法抗": 3,
      "物抗": 3,
      "格挡": 2.5,
      "卸力": 5,
      "攻速": 5,
      "充能": 5,
      "移速": 5,
      "体力": 0.5,
      "耐力": 0.5,
      "嘲讽": 2
    };
    const mainAttrResult = mainAttributes[equipment].reduce((acc, mainAttr) => {
      let filteredAttributes = Array.from(attributes.entries());
      if (equipment === "头盔" && (mainAttr === "物抗" || mainAttr === "法抗")) {
        filteredAttributes = filteredAttributes.filter(
          ([name2]) => !["物抗", "法抗", "生命"].includes(name2)
        );
      } else {
        filteredAttributes = filteredAttributes.filter(
          ([name2]) => !mainAttributes[equipment].includes(name2)
        );
      }
      const correctionSum = filteredAttributes.reduce((sum, [name2, value]) => {
        return sum + value * (correctionFactors[name2] || 1);
      }, 0);
      const originalMain = Array.from(attributes.entries()).filter(([name2]) => name2 === mainAttr).reduce((sum, [, value]) => sum + value, 0);
      let finalValue = originalMain;
      if (mainAttr === "生命") {
        finalValue += correctionSum;
      } else {
        const factor = correctionFactors[mainAttr] || 1;
        finalValue += correctionSum / factor;
      }
      if (equipment === "头盔" && (mainAttr === "物抗" || mainAttr === "法抗")) {
        finalValue = finalValue / 2;
      }
      acc[mainAttr] = Number(finalValue.toFixed(1));
      return acc;
    }, {});
    const attributeTypes = /* @__PURE__ */ new Map();
    for (const [name2, value] of attributes.entries()) {
      attributeTypes.set(name2, (attributeTypes.get(name2) || 0) + value);
    }
    const allTypes = Array.from(attributeTypes.keys());
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allTypes.length);
    const selectedTypes = allTypes.sort(() => Math.random() - 0.5).slice(0, selectCount);
    const validTypes = selectedTypes.filter(
      (type) => !mainAttributes[equipment].includes(type)
    );
    const multiplier = validTypes.length === 3 ? 0.8 : validTypes.length === 2 ? 1 : validTypes.length === 1 ? 1.3 : 0;
    const finalAttributes = validTypes.map((type) => ({
      name: type,
      value: Math.ceil((attributeTypes.get(type) || 0) * multiplier)
    })).filter((attr) => attr.value > 0);
    const skills = [];
    const skilledMaterials = materialEntries.filter((e) => e.material.type === "材料").sort((a, b) => a.material.id - b.material.id);
    for (const entry of skilledMaterials) {
      if (skills.length >= 3) break;
      try {
        console.log(`检测到材料：${entry.material.name} (${entry.star}星)`);
        const materialSkills = await ctx.database.get("material_skill", {
          materialId: entry.material.id
        });
        if (!materialSkills || materialSkills.length === 0) {
          console.log("├─ 无技能");
          continue;
        }
        console.log(`├─ 包含技能：${materialSkills.map((s) => s.skillName).join(", ")}`);
        const maxLevel = Math.min(entry.star, 5);
        const probability = [0.3, 0.25, 0.2, 0.15, 0.1].slice(0, maxLevel);
        let acquiredLevel = 0;
        for (let level = probability.length; level >= 1; level--) {
          if (Math.random() < probability[level - 1]) {
            acquiredLevel = level;
            break;
          }
        }
        if (acquiredLevel > 0) {
          const randomIndex = Math.floor(Math.random() * materialSkills.length);
          const randomSkill = materialSkills[randomIndex];
          const finalLevel = Math.min(acquiredLevel, maxLevel);
          console.log(`└─ 获得技能：${randomSkill.skillName} Lv.${finalLevel} (概率:${probability[finalLevel - 1]})`);
          skills.push({
            name: randomSkill.skillName,
            level: finalLevel
          });
        } else {
          console.log("└─ 未触发技能");
        }
      } catch (error2) {
        console.error("技能处理出错：", error2);
      }
    }
    const output = [
      `🔨 成功锻造 ${equipment} 🔨`,
      "━━━━ 材料明细 ━━━━",
      ...materialEntries.map(
        (e) => `${e.material.name} ${e.star}星x${e.count} (${e.material.materialType})`
      ),
      "\n━━━━ 主属性 ━━━━",
      ...Object.entries(mainAttrResult).map(
        ([name2, value]) => `${name2}: ${value.toFixed(1)}`
      ),
      "\n━━━━ 附加属性 ━━━━",
      validTypes.length > 0 ? `随机选择 ${selectCount} 条属性，有效 ${validTypes.length} 条 x${multiplier}` : "无有效附加属性",
      ...finalAttributes.map(
        (attr) => `${attr.name}: ${attr.value.toFixed(1)}`
      ),
      "\n━━━━ 装备技能 ━━━━",
      skills.length > 0 ? skills.map((s) => `${s.name} Lv.${s.level}`).join("\n") : "未获得任何技能"
    ];
    return output.join("\n");
  });
  ctx.command("上传装备 <type> <materials:text>", "上传自定义装备").userFields(["authority"]).action(async ({ session }, type, materials) => {
    const materialEntries = await parseMaterials(materials);
    if (!materialEntries) return "材料参数格式错误";
    session.user.equipmentDraft = {
      type,
      materials: materialEntries
    };
    return [
      "📦 材料解析成功，请输入上传属性",
      "━━━━ 格式要求 ━━━━",
      "属性名称+主属性数值（用空格分隔多个属性）",
      "━━━━ 示例 ━━━━",
      "生命+1500 法强+200"
    ].join("\n");
  });
  ctx.command("上传属性 <...attrs:text>", "输入装备属性").userFields(["equipmentDraft"]).action(async ({ session }, ...attrs) => {
    const draft = session.user.equipmentDraft;
    if (!draft) return '请先使用"上传装备"指令开始创建';
    const mainAttributes = await parseAttributes(attrs.join(" "));
    if (typeof mainAttributes === "string") return mainAttributes;
    await ctx.database.create("equipment", {
      userId: session.userId,
      type: draft.type,
      materials: draft.materials.map((m) => ({
        name: m.name,
        type: m.type,
        star: m.star,
        count: m.count
      })),
      // 只存储必要字段
      mainAttributes,
      createdAt: /* @__PURE__ */ new Date()
    });
    delete session.user.equipmentDraft;
    return "装备上传成功！";
  });
  async function parseMaterials(input) {
    return Promise.all(input.split(/\s+/).map(async (entry) => {
      const match = entry.match(/^(.+?)(\d+)x(\d+)$/);
      if (!match) return null;
      const [_, name2, starStr, countStr] = match;
      const star = parseInt(starStr);
      const count = parseInt(countStr);
      const [material] = await findMaterialByNameOrAlias(name2);
      if (!material || material.type !== "材料") return null;
      return {
        name: material.name,
        // 只保存名称
        type: material.materialType,
        // 材料类型
        star,
        count
        // 移除 slots 字段
      };
    })).then((list) => list.filter(Boolean));
  }
  __name(parseMaterials, "parseMaterials");
  async function parseAttributes(input) {
    const attrs = input.split(/\s+/).map((entry) => {
      const match = entry.match(/^([^+＋]+)[+＋](\d+)$/);
      return match ? [match[1].trim(), match[2]] : null;
    }).filter(Boolean).flat();
    if (attrs.length === 0) return "属性参数格式错误，请使用 属性+数值 格式";
    const mainAttributes = {};
    for (let i = 0; i < attrs.length; i += 2) {
      const rawName = attrs[i];
      const rawValue = attrs[i + 1];
      const name2 = rawName.replace(/[^\u4e00-\u9fa5\s]/g, "").trim();
      const value = parseFloat(rawValue);
      if (!name2 || isNaN(value)) {
        return `无效属性格式：${rawName}+${rawValue}（示例：攻击+500）`;
      }
      mainAttributes[name2] = (mainAttributes[name2] || 0) + value;
    }
    return mainAttributes;
  }
  __name(parseAttributes, "parseAttributes");
  ctx.middleware(async (session, next) => {
    const user = session.user;
    if (user.equipmentDraft) {
      const attrs = session.content.split(/\s+/);
      if (attrs.length % 2 !== 0) return "属性输入格式不正确";
      const mainAttributes = {};
      for (let i = 0; i < attrs.length; i += 2) {
        const name2 = attrs[i];
        const value = parseFloat(attrs[i + 1]);
        if (isNaN(value)) return `无效数值：${attrs[i + 1]}`;
        mainAttributes[name2] = value;
      }
      const draft = session.user.equipmentDraft;
      await ctx.database.create("equipment", {
        userId: session.userId,
        type: draft.type,
        materials: draft.materials.map((m) => ({
          name: m.name,
          type: m.type,
          star: m.star,
          count: m.count
        })),
        // 只存储必要字段
        mainAttributes,
        createdAt: /* @__PURE__ */ new Date()
      });
      delete user.equipmentDraft;
      return "装备上传成功！";
    }
    return next();
  });
  ctx.command("查询装备 [type]", "查询装备").option("page", "-p <page:number>", { fallback: 1 }).option("attribute", "-a <属性名>").action(async ({ options }, type) => {
    if (type && !isNaN(Number(type))) {
      const id = Number(type);
      const [equipment] = await ctx.database.get("equipment", { id });
      if (!equipment) return "未找到该ID的装备";
      return [
        "🔍 装备详细信息",
        `ID: ${equipment.id}`,
        `类型: ${equipment.type}`,
        `主属性: ${Object.entries(equipment.mainAttributes).map(([k, v]) => `${k}+${v}`).join(" ")}`,
        `材料组成: ${equipment.materials.map((m) => `${m.name}${m.star}星x${m.count}`).join(" ")}`,
        `上传时间: ${equipment.createdAt.toLocaleDateString("zh-CN")}`,
        "━━━━━━━━━━━━━━━━━━",
        '输入"查询装备 <类型/ID>"查看其他装备'
      ].join("\n");
    }
    const filter = {};
    if (type) filter.type = type;
    if (options.attribute) {
      const attrName = convertAttrName(ctx, options.attribute);
      if (!attrName) return "无效属性名称";
      const equipments2 = await ctx.database.get("equipment", {
        ...filter,
        [`mainAttributes.${attrName}`]: { $exists: true }
      }, {
        sort: { [`mainAttributes.${attrName}`]: "desc" }
        // 新增排序
      });
      const pageSize2 = 5;
      const totalPages2 = Math.ceil(equipments2.length / pageSize2);
      const page2 = Math.min(options.page || 1, totalPages2);
      return [
        "🔍 装备查询结果",
        ...equipments2.slice((page2 - 1) * pageSize2, page2 * pageSize2).map((e) => [
          `ID:${e.id} [${e.type}]`,
          `属性：${attrName}+${e.mainAttributes[attrName]}`,
          `材料：${e.materials.map((m) => `${m.name}${m.star}星x${m.count}`).join(" ")}`,
          `上传时间：${e.createdAt.toLocaleDateString("zh-CN")}`
        ].join("\n")),
        `
第 ${page2}/${totalPages2} 页`
      ].join("\n\n");
    }
    const equipments = await ctx.database.get("equipment", filter, {
      sort: { createdAt: "desc" }
    });
    const pageSize = 5;
    const totalPages = Math.ceil(equipments.length / pageSize);
    const page = Math.min(options.page || 1, totalPages);
    return [
      "🔍 装备查询结果（按时间排序）",
      ...equipments.slice((page - 1) * pageSize, page * pageSize).map((e) => [
        `ID:${e.id} [${e.type}]`,
        `主属性：${Object.entries(e.mainAttributes).map(([k, v]) => `${k}+${v}`).join(" ")}`,
        `材料：${e.materials.map((m) => `${m.name}${m.star}星x${m.count}`).join(" ")}`,
        `上传时间：${e.createdAt.toLocaleDateString("zh-CN")}`
      ].join("\n")),
      `
第 ${page}/${totalPages} 页`
    ].join("\n\n");
  });
  ctx.command("注册 <nickname:string>", "注册用户昵称").action(async ({ session }, nickname) => {
    if (!nickname || nickname.length > 12 || !/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(nickname)) {
      return "昵称需为1-12位中英文/数字组合";
    }
    const existing = await ctx.database.get("user_profile", { userId: session.userId });
    if (existing.length) {
      return "您已注册过昵称";
    }
    const nameTaken = await ctx.database.get("user_profile", { nickname });
    if (nameTaken.length) {
      return "该昵称已被使用";
    }
    await ctx.database.create("user_profile", {
      userId: session.userId,
      nickname,
      createdAt: /* @__PURE__ */ new Date()
    });
    const [currency] = await ctx.database.get("user_currency", { userId: session.userId });
    if (!currency) {
      await ctx.database.create("user_currency", {
        userId: session.userId,
        love: 0,
        diamond: 0,
        gold: 0,
        crystal: 0,
        energy: 200
      });
    }
    return `注册成功！欢迎 ${nickname} 加入营火`;
  });
  ctx.command("背包 [page:number]", "查看背包物品").action(async ({ session }, page = 1) => {
    const userId = session.userId;
    const [profile] = await ctx.database.get("user_profile", { userId });
    if (!profile) return handleRecallableMessage(session, "请先使用「注册」注册账号", ctx);
    const [inventory] = await ctx.database.get("user_inventory", { userId });
    if (!inventory || !inventory.items.length) {
      return handleRecallableMessage(session, "背包是空的", ctx);
    }
    const materials = await ctx.database.get("material", {
      id: [...new Set(inventory.items.map((i) => i.materialId))]
    });
    const pageSize = 10;
    const totalPages = Math.ceil(inventory.items.length / pageSize);
    page = Math.min(Math.max(1, page), totalPages);
    const start = (page - 1) * pageSize;
    const groupedItems = inventory.items.reduce((acc, item) => {
      const material = materials.find((m) => m.id === item.materialId);
      if (!material) return acc;
      const type = material.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push({
        material,
        starLevel: item.starLevel,
        quantity: item.quantity
      });
      return acc;
    }, {});
    const output = [
      `🎒 ${profile.nickname} 的背包`,
      "━━━━━━━━━━━━━━"
    ];
    for (const [type, items] of Object.entries(groupedItems)) {
      output.push(`
【${type}】`);
      items.slice(start, start + pageSize).forEach((item) => {
        const starInfo = item.starLevel ? `⭐${item.starLevel} ` : "";
        output.push(`${item.material.name} ${starInfo}x${item.quantity}`);
      });
    }
    output.push(
      "\n━━━━━━━━━━━━━━",
      `第 ${page}/${totalPages} 页`
    );
    return handleRecallableMessage(session, output.join("\n"), ctx);
  });
  ctx.command("岛屿列表", "查看当前可登岛屿").action(async ({ session }) => {
    const islands = await ctx.database.get("island", {});
    if (!islands.length) return "当前没有可用的岛屿";
    const now = /* @__PURE__ */ new Date();
    const output = ["🏝️ 当前可用岛屿"];
    for (const island of islands) {
      const profiles = await ctx.database.get("user_profile", {
        userId: { $in: island.players }
      });
      const playerNames = profiles.map((p) => p.nickname).join("、");
      const remainingTime = Math.max(0, Math.floor((island.expiresAt.getTime() - now.getTime()) / 6e4));
      output.push(
        `
━━━━ ${island.id} ━━━━`,
        `剩余时间：${remainingTime}分钟`,
        `当前人数：${island.players.length}/${ctx.config.island.maxPlayers}人`,
        playerNames ? `在岛玩家：${playerNames}` : "暂无玩家"
      );
    }
    return handleRecallableMessage(session, output.join("\n"), ctx);
  });
  ctx.command("上岛 <islandId>", "登入指定岛屿").action(async ({ session }, islandId) => {
    const userId = session.userId;
    const [settlement] = await ctx.database.get("island_settlement", { userId });
    if (settlement) {
      const output = await formatSettlement(ctx, settlement);
      await ctx.database.remove("island_settlement", { userId });
      return handleRecallableMessage(session, output, ctx);
    }
    const [status] = await ctx.database.get("user_island_status", { userId });
    if (status) {
      const [action] = await ctx.database.get("action", { name: status.currentAction });
      return `您已在岛屿${status.islandId}上
当前：${status.currentAction}
输入"下岛"可以离开`;
    }
    const [island] = await ctx.database.get("island", { id: islandId });
    if (!island) return "指定岛屿不存在";
    if (island.players.length >= ctx.config.island.maxPlayers) {
      return "该岛屿人数已满";
    }
    const [currency] = await ctx.database.get("user_currency", { userId });
    if (!currency || currency.energy < ctx.config.island.entryCost) {
      return `精力不足，需要${ctx.config.island.entryCost}点（当前：${currency?.energy || 0}点）`;
    }
    try {
      await ctx.database.transact(async () => {
        await ctx.database.set("user_currency", { userId }, {
          energy: currency.energy - ctx.config.island.entryCost
        });
        await ctx.database.set("island", { id: islandId }, {
          players: [...island.players, userId]
        });
        await ctx.database.create("user_island_status", {
          userId,
          islandId,
          currentAction: "",
          lastActionTime: /* @__PURE__ */ new Date(),
          remainingActions: 0,
          actionHistory: []
        });
      });
      startAutoAction(ctx, userId);
      return "成功登岛！";
    } catch (err) {
      console.error("上岛失败:", err);
      return "上岛失败，请稍后重试";
    }
  });
  async function startAutoAction(ctx2, userId) {
    const interval = ctx2.config.island.actionInterval * 6e4;
    const timer = setInterval(async () => {
      try {
        const [status] = await ctx2.database.get("user_island_status", { userId });
        if (!status) {
          clearInterval(timer);
          return;
        }
        const actions = await ctx2.database.get("action", {});
        if (!actions.length) {
          clearInterval(timer);
          return;
        }
        const action = actions[Math.floor(Math.random() * actions.length)];
        const [currency] = await ctx2.database.get("user_currency", { userId });
        if (!currency) {
          clearInterval(timer);
          return;
        }
        if (currency.energy >= action.cost) {
          await ctx2.database.set("user_currency", { userId }, {
            energy: currency.energy - action.cost
          });
          const rewards = [];
          for (let i = 0; i < action.rewards.times; i++) {
            const reward = drawReward(action.rewards.pool);
            if (reward) {
              const [material] = await ctx2.database.get("material", { name: reward.item });
              if (material) {
                await updateInventory(ctx2, userId, material, reward.starLevel);
                rewards.push({
                  item: reward.item,
                  quantity: 1
                });
              }
            }
          }
          const mergedRewards = rewards.reduce((acc, curr) => {
            const existing = acc.find((r) => r.item === curr.item);
            if (existing) {
              existing.quantity += curr.quantity;
            } else {
              acc.push({ ...curr });
            }
            return acc;
          }, []);
          const actionHistory = Array.isArray(status.actionHistory) ? status.actionHistory : [];
          actionHistory.push({
            name: action.name,
            rewards: mergedRewards
          });
          await ctx2.database.set("user_island_status", { userId }, {
            currentAction: action.name,
            lastActionTime: /* @__PURE__ */ new Date(),
            actionHistory
          });
          if (rewards.length > 0) {
            const message = `执行动作"${action.name}"
获得:${rewards.map((r) => r.item).join("、")}`;
            await handleRecallableMessage(ctx2.bots[0].session(), message, ctx2);
          }
        }
      } catch (err) {
        console.error("自动执行动作失败:", err);
        clearInterval(timer);
      }
    }, interval);
  }
  __name(startAutoAction, "startAutoAction");
  ctx.command("下岛", "提前离开当前岛屿").action(async ({ session }) => {
    const userId = session.userId;
    const [status] = await ctx.database.get("user_island_status", { userId });
    if (!status) return "您不在任何岛屿上";
    const hasSettlement = await handlePlayerLeave(ctx, userId);
    if (hasSettlement) {
      const [settlement] = await ctx.database.get("island_settlement", { userId });
      if (settlement) {
        const output = await formatSettlement(ctx, settlement);
        await ctx.database.remove("island_settlement", { userId });
        return handleRecallableMessage(session, output, ctx);
      }
    }
    return "已离开岛屿";
  });
}
__name(apply, "apply");
var attrNameMap = {
  "法强": "faqiang",
  "攻击": "gongji",
  "治疗": "zhiliao",
  "生命": "shengming",
  "法暴": "fabao",
  "物暴": "wubao",
  "法暴伤": "fabao",
  "物暴伤": "wubaoshang",
  "法穿": "fachuan",
  "物穿": "wuchuan",
  "法抗": "fakang",
  "物抗": "wukang",
  "格挡": "gedang",
  "卸力": "xieli",
  "攻速": "gongsu",
  "充能": "chongneng",
  "移速": "yisu",
  "体力": "tili",
  "耐力": "naili",
  "嘲讽": "chaofeng"
  // 其他属性继续添加...
};
var using = ["puppeteer"];
var inject = ["puppeteer"];
async function performGacha(ctx, userId, isMiniPull = false, parentGachaType) {
  let [record] = await ctx.database.get("gacha_records", { userId });
  if (!record) {
    record = {
      userId,
      totalPulls: 0,
      pityCounter: {
        探险热潮: 0,
        动物派对: 0,
        沙滩派对: 0
      }
    };
    await ctx.database.create("gacha_records", record);
  }
  let gachaType;
  if (parentGachaType) {
    gachaType = parentGachaType;
  } else {
    const typeRand = Math.random();
    if (typeRand < 0.5) {
      gachaType = "探险热潮";
    } else if (typeRand < 0.85) {
      gachaType = "动物派对";
    } else {
      gachaType = "沙滩派对";
    }
  }
  if (!isMiniPull) {
    let newCounter2 = record.pityCounter[gachaType];
    newCounter2 = (record.pityCounter[gachaType] + 1) % 40;
    await ctx.database.set("gacha_records", { userId }, {
      totalPulls: record.totalPulls + 1,
      [`pityCounter.${gachaType}`]: newCounter2
    });
  }
  let newCounter = record.pityCounter[gachaType];
  if (!isMiniPull) {
    newCounter = (record.pityCounter[gachaType] + 1) % 40;
    await ctx.database.set("gacha_records", { userId }, {
      totalPulls: record.totalPulls + 1,
      [`pityCounter.${gachaType}`]: newCounter
    });
  }
  const isPity = !isMiniPull && newCounter === 0;
  let rankPool;
  if (isPity) {
    rankPool = Math.random() < 0.7 ? "A" : "S";
  } else {
    const rand = Math.random() * 100;
    if (isMiniPull) {
      if (rand < 0.5) {
        rankPool = "S";
      } else if (rand < 4.5) {
        rankPool = "A";
      } else if (rand < 14.5) {
        rankPool = "B";
      } else if (rand < 44.5) {
        rankPool = "C";
      } else {
        rankPool = "D";
      }
    } else {
      if (rand < 0.5) {
        rankPool = "S";
      } else if (rand < 5.5) {
        rankPool = "A";
      } else if (rand < 15.5) {
        rankPool = "B";
      } else if (rand < 45.5) {
        rankPool = "C";
      } else {
        if (rand < 95) {
          rankPool = "D";
        } else {
          const extra = await performGacha(
            ctx,
            userId,
            true,
            // isMiniPull
            gachaType
            // 传递当前扭蛋类型
          );
          return {
            item: null,
            rank: "彩蛋",
            gachaType,
            isPity: false,
            isMini: true,
            extra
          };
        }
      }
    }
  }
  const items = await ctx.database.get("material", {
    type: "时装",
    materialType: rankPool,
    grade: {
      "探险热潮": 1,
      "动物派对": 2,
      "沙滩派对": 3
    }[gachaType],
    slots: isMiniPull ? 1 : { $ne: 1 }
  });
  const randomItem = items[Math.floor(Math.random() * items.length)];
  return {
    item: randomItem,
    rank: rankPool,
    gachaType,
    isPity,
    isMini: isMiniPull
  };
}
__name(performGacha, "performGacha");
function convertAttrName(ctx, name2) {
  const normalize = /* @__PURE__ */ __name((str) => str.replace(
    /[\uff01-\uff5e]/g,
    (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248)
  ).replace(/\s+/g, ""), "normalize");
  const normalizedInput = normalize(name2);
  const exactMatch = Object.keys(ctx.config.attrNameMappings).find((k) => normalize(k) === normalizedInput);
  return exactMatch || null;
}
__name(convertAttrName, "convertAttrName");
async function formatTypeList(materials, type, page = 1) {
  const pageSize = 10;
  const totalPages = Math.ceil(materials.length / pageSize);
  page = Math.min(page, totalPages);
  const gachaPoolMap = {
    1: "探险热潮",
    2: "动物派对",
    3: "沙滩派对"
  };
  const sortedMaterials = materials.sort((a, b) => a.id - b.id);
  const pageData = sortedMaterials.slice((page - 1) * pageSize, page * pageSize);
  const output = [
    `📚 ${type}类物品列表`,
    ...pageData.map((m, index) => {
      const displayId = (page - 1) * pageSize + index + 1;
      let info = `${displayId}. ${m.name}`;
      switch (type) {
        case "食材":
          info += `｜饱食+${m.satiety || 0} ｜水分+${m.moisture || 0}`;
          break;
        case "时装":
          info += `｜扭蛋：${gachaPoolMap[m.grade] || "未知"}`;
          break;
        case "杂物":
          break;
        case "英灵":
          info += `｜${m.description?.slice(0, 20)}...`;
          break;
        default:
          info += `｜类型：${m.materialType}`;
          if (m.grade > 0) info += `｜阶级：${m.grade}阶`;
          info += `｜格子：${m.slots}格`;
      }
      return info;
    }),
    `
第 ${page}/${totalPages} 页，输入"图鉴 ${type} -p 页码"查看其他页`
  ];
  return output.join("\n");
}
__name(formatTypeList, "formatTypeList");
async function formatGradeList(materials, grade, page = 1) {
  const pageSize = 10;
  const totalPages = Math.ceil(materials.length / pageSize);
  page = Math.min(page, totalPages);
  const output = [
    `📚 ${grade}阶材料列表`,
    ...materials.sort((a, b) => a.id - b.id).slice((page - 1) * pageSize, page * pageSize).map((m) => `${m.name}｜${m.materialType}｜${m.slots}格`),
    `
第 ${page}/${totalPages} 页，输入"图鉴 ${grade}阶 -p 页码"查看其他页`
  ];
  return output.join("\n");
}
__name(formatGradeList, "formatGradeList");
async function formatMaterialTypeList(materials, type, page = 1) {
  const pageSize = 10;
  const totalPages = Math.ceil(materials.length / pageSize);
  page = Math.min(page, totalPages);
  const output = [
    `📚 ${type}类材料列表`,
    ...materials.sort((a, b) => a.id - b.id).slice((page - 1) * pageSize, page * pageSize).map((m) => `${m.name}｜${m.grade}阶｜${m.slots}格`),
    `
第 ${page}/${totalPages} 页，输入"图鉴 ${type} -p 页码"查看其他页`
  ];
  return output.join("\n");
}
__name(formatMaterialTypeList, "formatMaterialTypeList");
function formatDateCN(date) {
  const cnDate = new Date(date.getTime() + 8 * 60 * 60 * 1e3);
  return `${cnDate.getUTCFullYear()}年${(cnDate.getUTCMonth() + 1).toString().padStart(2, "0")}月${cnDate.getUTCDate().toString().padStart(2, "0")}日`;
}
__name(formatDateCN, "formatDateCN");
async function handleRecallableMessage(session, content, ctx) {
  const messages = await session.send(content);
  const message = Array.isArray(messages) ? messages[0] : messages;
  if (ctx.config.messageRecall?.enable && message) {
    setTimeout(async () => {
      try {
        await session.bot.deleteMessage(session.channelId, message);
        console.log(`[Recall] 消息已撤回 ID: ${message}`);
      } catch (err) {
        console.error("[Recall Error] 撤回失败:", err);
      }
    }, (ctx.config.messageRecall.recallTime || 30) * 1e3);
  }
  return;
}
__name(handleRecallableMessage, "handleRecallableMessage");
async function initializeActions(ctx) {
  const materials = await ctx.database.get("material", { type: "材料" });
  const foods = await ctx.database.get("material", { type: "食材" });
  const items = await ctx.database.get("material", { type: "杂物" });
  const allMaterials = [...materials, ...foods, ...items];
  const defaultActions = [
    {
      name: "采集椰果",
      cost: 5,
      rewards: {
        times: 3,
        pool: [
          { item: "椰子", weight: 40 },
          { item: "香蕉", weight: 30 },
          { item: "浆果", weight: 20 }
        ].filter(
          (reward) => allMaterials.some((m) => m.name === reward.item)
        )
      }
    },
    {
      name: "深海垂钓",
      cost: 8,
      rewards: {
        times: 3,
        pool: [
          { item: "风化手骨", starLevel: 1, weight: 45 },
          { item: "风化肋骨", starLevel: 1, weight: 15 }
        ].filter(
          (reward) => allMaterials.some((m) => m.name === reward.item)
        )
      }
    }
  ];
  const validActions = defaultActions.filter(
    (action) => action.rewards.pool.length > 0
  );
  for (const action of validActions) {
    await ctx.database.upsert("action", [action], ["name"]);
  }
}
__name(initializeActions, "initializeActions");
function startIslandSpawner(ctx) {
  const config = ctx.config.island;
  setInterval(async () => {
    try {
      const islands = await ctx.database.get("island", {});
      if (islands.length >= config.maxIslands) return;
      const now = /* @__PURE__ */ new Date();
      const island = {
        id: `IS-${Date.now()}`,
        createdAt: now,
        expiresAt: new Date(now.getTime() + config.islandLifespan * 6e4),
        players: []
      };
      await ctx.database.create("island", island);
      setTimeout(async () => {
        await handleIslandExpiry(ctx, island.id);
      }, config.islandLifespan * 6e4);
    } catch (err) {
      console.error("岛屿生成失败:", err);
    }
  }, config.spawnInterval * 6e4);
}
__name(startIslandSpawner, "startIslandSpawner");
async function handleIslandExpiry(ctx, islandId) {
  try {
    const [island] = await ctx.database.get("island", { id: islandId });
    if (!island) return;
    for (const userId of island.players) {
      await handlePlayerLeave(ctx, userId);
    }
    await ctx.database.remove("island", { id: islandId });
  } catch (err) {
    console.error("岛屿销毁失败:", err);
  }
}
__name(handleIslandExpiry, "handleIslandExpiry");
async function handlePlayerLeave(ctx, userId) {
  try {
    const [status] = await ctx.database.get("user_island_status", { userId });
    if (!status) return;
    const actionHistory = await getPlayerActions(ctx, userId, status.islandId);
    if (actionHistory.length > 0) {
      await ctx.database.create("island_settlement", {
        userId,
        islandId: status.islandId,
        actionHistory,
        settledAt: /* @__PURE__ */ new Date()
      });
      await ctx.database.remove("user_island_status", { userId });
      const [island] = await ctx.database.get("island", { id: status.islandId });
      if (island) {
        await ctx.database.set("island", { id: status.islandId }, {
          players: island.players.filter((id) => id !== userId)
        });
      }
      return true;
    }
    await ctx.database.remove("user_island_status", { userId });
    return false;
  } catch (err) {
    console.error("玩家离岛失败:", err);
    return false;
  }
}
__name(handlePlayerLeave, "handlePlayerLeave");
async function getPlayerActions(ctx, userId, islandId) {
  const [status] = await ctx.database.get("user_island_status", { userId });
  if (!status) return [];
  const actionHistory = Array.isArray(status.actionHistory) ? status.actionHistory : [];
  const actionStats = /* @__PURE__ */ new Map();
  for (const record of actionHistory) {
    if (!record || !record.name || !Array.isArray(record.rewards)) continue;
    const stats = actionStats.get(record.name) || {
      name: record.name,
      times: 0,
      rewards: []
    };
    stats.times++;
    for (const reward of record.rewards) {
      if (!reward || !reward.item) continue;
      const existing = stats.rewards.find((r) => r.item === reward.item);
      if (existing) {
        existing.quantity += reward.quantity || 1;
      } else {
        stats.rewards.push({
          item: reward.item,
          quantity: reward.quantity || 1
        });
      }
    }
    actionStats.set(record.name, stats);
  }
  return Array.from(actionStats.values());
}
__name(getPlayerActions, "getPlayerActions");
async function formatSettlement(ctx, settlement) {
  const output = [
    "🏝️ 岛屿探索结算",
    `岛屿ID：${settlement.islandId}`,
    "━━━━━━━━━━━━"
  ];
  let totalItems = 0;
  for (const action of settlement.actionHistory) {
    output.push(
      `
【${action.name}】`,
      "获得物品："
    );
    const itemsByType = /* @__PURE__ */ new Map();
    for (const reward of action.rewards) {
      const [material] = await ctx.database.get("material", { name: reward.item });
      if (!material) continue;
      if (!itemsByType.has(material.type)) {
        itemsByType.set(material.type, []);
      }
      itemsByType.get(material.type).push({
        name: reward.item,
        quantity: reward.quantity
      });
      totalItems += reward.quantity;
    }
    for (const [type, items] of itemsByType.entries()) {
      output.push(`${type}：${items.map((i) => `${i.name}x${i.quantity}`).join("、")}`);
    }
  }
  output.push(
    "\n━━━━━━━━━━━━",
    `共获得 ${totalItems} 个物品`,
    "物品已放入背包"
  );
  return output.join("\n");
}
__name(formatSettlement, "formatSettlement");
function drawReward(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  const roll = Math.random() * 100;
  let accumWeight = 0;
  for (const entry of pool) {
    accumWeight += entry.weight;
    if (roll < accumWeight) {
      return entry;
    }
  }
  return null;
}
__name(drawReward, "drawReward");
async function updateInventory(ctx, userId, material, starLevel) {
  const [profile] = await ctx.database.get("user_profile", { userId });
  if (!profile) return;
  let [inventory] = await ctx.database.get("user_inventory", { userId });
  if (!inventory) {
    inventory = {
      userId,
      nickname: profile.nickname,
      items: [],
      updatedAt: /* @__PURE__ */ new Date()
    };
  }
  const itemIndex = inventory.items.findIndex(
    (item) => item.materialId === material.id && (material.type === "材料" ? item.starLevel === starLevel : true)
  );
  if (itemIndex >= 0) {
    inventory.items[itemIndex].quantity++;
  } else {
    inventory.items.push({
      materialId: material.id,
      name: material.name,
      type: material.type,
      starLevel: material.type === "材料" ? starLevel : void 0,
      quantity: 1
    });
  }
  await ctx.database.upsert("user_inventory", [{
    ...inventory,
    updatedAt: /* @__PURE__ */ new Date()
  }], ["userId"]);
}
__name(updateInventory, "updateInventory");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name,
  using
});
