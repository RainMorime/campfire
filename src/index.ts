import { Context, h, Schema, Session, Bot, Dict, remove, sleep, Time} from 'koishi'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import {  } from 'koishi-plugin-puppeteer'


export const name = 'campfire'

// 定义黑名单数据结构
interface BlacklistEntry {
  userId: string;
  qqNumbers: number[];
  behavior: string;
}

// 初始化黑名单数据
const blacklist: BlacklistEntry[] = [];
// ================== 数据库类型 ==================
declare module 'koishi' {
  interface Tables {
    material: MaterialEntry
    material_attribute: MaterialAttribute
    material_alias: MaterialAlias
    food: FoodEffect
    material_skill: MaterialSkill
    fortune: FortuneEntry
    user_cooldown: UserCooldown
    user_currency: UserCurrency
    gacha_records: GachaRecord
    greedy_chest: GreedyChestEntry
    equipment: EquipmentEntry
    user_profile: UserProfile
    user_inventory: UserInventory
    island: Island
    action: Action 
    user_island_status: UserIslandStatus
    island_settlement: IslandSettlement
  }

  interface User {
    equipmentDraft?: {
      type: string
      materials: any[]
    }
  }
}

interface MaterialEntry {
  id: number
  name: string
  type: '材料' | '食材' | '杂物' | '时装' | '英灵'
  materialType: string
  grade: number
  slots: number
  description: string
  image: string
  merit?: number
  price?: number
  satiety?: number  // 仅食材类型有效
  moisture?: number // 仅食材类型有效
}
// 在MaterialEntry类型定义后添加扩展类型
interface MaterialWithAttributes extends MaterialEntry {
  attributes?: MaterialAttribute[]
  skills?: MaterialSkill[] // 添加技能字段
}

interface MaterialAttribute {
  id: number
  materialId: number
  starLevel: number
  attrName: string
  attrValue: number
}

interface MaterialAlias {
  id: number
  materialId: number
  alias: string
}

interface FoodEffect {
  id: number
  materialId: number
  dishType: '便当' | '罐头' | '药剂' | '全部'
  effectType: '基础加成' | '特殊加成'
  effectSubType: string
  value: number
  stackValue: number
}

interface MaterialSkill {
  id: number
  materialId: number
  skillName: string
  description: string
  effect: string
  image: string
}

interface FortuneEntry {
  id: number
  level: number      // 档位（1-20）
  description: string
  isSpecial: boolean // 是否为彩蛋描述
}

interface UserCooldown {
  id: number
  userId: string
  lastUsed: Date
}

interface UserCurrency {
  userId: string
  love: number     // 爱心
  diamond: number  // 钻石
  gold: number     // 金币
  crystal: number  // 幻晶
  energy: number   // 精力
}

interface GachaRecord {
  userId: string
  totalPulls: number
  pityCounter: {
    探险热潮: number
    动物派对: number
    沙滩派对: number
  }
}

interface GreedyChestEntry {
  userId: string;
  slots: string[];
  finished: boolean;
  createdAt: Date;
}

interface UserProfile {
  userId: string
  nickname: string
  createdAt: Date
}

interface UserInventory {
  userId: string
  nickname: string
  items: Array<{
    materialId: number
    name: string
    type: string
    starLevel?: number
    quantity: number
  }>
  updatedAt: Date
}

interface Island {
  id: string
  createdAt: Date
  expiresAt: Date
  players: string[]
}

interface Action {
  name: string
  cost: number
  rewards: {
    times: number
    pool: Array<{
      item: string
      weight: number
      starLevel?: number
    }>
  }
}

interface UserIslandStatus {
  userId: string
  islandId: string
  currentAction: string
  lastActionTime: Date
  remainingActions: number
  actionHistory: Array<{
    name: string
    rewards: Array<{
      item: string
      quantity: number
    }>
  }>
}
interface IslandSettlement {
  userId: string
  islandId: string
  actionHistory: Array<{
    name: string
    times: number
    rewards: Array<{
      item: string
      quantity: number
    }>
  }>
  settledAt: Date
}
// ================== 插件配置 ==================
export interface Config {
  greedyChestRates?: {
    gold: number
    greed: number
    diamond: number
    lucky: number
  }
  attrNameMappings?: Record<string, string>
  messageRecall?: {
    enable: boolean
    recallTime: number
  }
  island?: {
    spawnInterval: number
    maxIslands: number
    islandLifespan: number 
    maxPlayers: number
    actionInterval: number
    entryCost: number
  }
}

// 修复配置Schema的默认值
export const Config: Schema<Config> = Schema.object({
  messageRecall: Schema.object({
    enable: Schema.boolean()
      .default(true)
      .description('是否启用消息自动撤回'),
    recallTime: Schema.number()
      .min(5).max(300).step(1)
      .default(30)
      .description('消息自动撤回时间(秒)')
  }).description('消息撤回设置'),
  
  greedyChestRates: Schema.object({
    gold: Schema.number()
      .min(0).max(100)
      .step(1)
      .default(40)
      .description('金币面出现概率 (%)'),
    greed: Schema.number()
      .min(0).max(100)
      .step(1)
      .default(30)
      .description('贪婪面出现概率 (%)'),
    diamond: Schema.number()
      .min(0).max(100)
      .step(1)
      .default(20)
      .description('钻石面出现概率 (%)'),
    lucky: Schema.number()
      .min(0).max(100)
      .step(1)
      .default(10)
      .description('幸运面出现概率 (%)')
  }).description('贪婪宝箱概率配置'),
  attrNameMappings: Schema.dict(String)
    
    .description('属性名称映射表（中文 → 英文标识）')
    .role('table', {
      display: 'key-value',
      headers: {
        key: { label: '中文属性名' },
        value: { label: '英文标识' }
      }
    }),
  island: Schema.object({
    spawnInterval: Schema.number()
      .default(10)
      .description('岛屿生成间隔(分钟)'),
    maxIslands: Schema.number()
      .default(2)
      .description('最大同时存在岛屿数'),
    islandLifespan: Schema.number()
      .default(30)
      .description('岛屿存在时间(分钟)'),
    maxPlayers: Schema.number()
      .default(6)
      .description('单岛最大人数'),
    actionInterval: Schema.number()
      .default(4)
      .description('动作执行间隔(分钟)'),
    entryCost: Schema.number()
      .default(20)
      .description('上岛消耗精力')
  }).description('岛屿系统配置')
})

// ================== 插件主体 ==================
export function apply(ctx: Context, config: Config) {
  // 确保配置正确合并
  ctx.config = {
    attrNameMappings: {
      
      ...config.attrNameMappings // 保留用户自定义配置
    },
    // 合并其他配置项
    ...config
  }

  // 在convertAttrName开头添加调试日志
  console.log('[INIT] 最终配置:', ctx.config.attrNameMappings)
  
  // 初始化数据库表
  ctx.model.extend('material', {
    id: 'unsigned',
    name: 'string',
    type: 'string',
    materialType: 'string',
    grade: 'unsigned',
    slots: 'unsigned',
    description: 'text',
    image: 'string',
    merit: 'unsigned',
    price: 'unsigned',
    satiety: 'integer',
    moisture: 'integer',
  }, {
    autoInc: true,
    primary: 'id',
  })

  ctx.model.extend('material_attribute', {
    id: 'unsigned',
    materialId: 'unsigned',
    starLevel: 'unsigned',
    attrName: 'string',
    attrValue: 'float',
  }, {
    autoInc: true,
    foreign: {
      materialId: ['material','id']
    }
  })

  ctx.model.extend('material_alias', {
    id: 'unsigned',
    materialId: 'unsigned',
    alias: 'string',
  }, {
    autoInc: true,
    foreign: {
      materialId: ['material', 'id']
    }
  })

  ctx.model.extend('food', {
    id: 'unsigned',
    materialId: 'unsigned',
    dishType: 'string',
    effectType: 'string',
    effectSubType: 'string',
    value: 'float',
    stackValue: 'float'
  }, {
    autoInc: true,
    foreign: {
      materialId: ['material', 'id']
    }
  })

  ctx.model.extend('material_skill', {
    id: 'unsigned',
    materialId: 'unsigned',
    skillName: 'string',
    description: 'text',
    effect: 'text',
    image: 'string'
  }, {
    autoInc: true,
    foreign: {
      materialId: ['material', 'id']
    }
  })

  // 新增运势表
  ctx.model.extend('fortune', {
    id: 'unsigned',
    level: 'unsigned',
    description: 'text',
    isSpecial: 'boolean'
  }, {
    autoInc: true,
    primary: 'id'
  })

  // 用户冷却时间表
  ctx.model.extend('user_cooldown', {
    id: 'unsigned',
    userId: 'string',
    lastUsed: 'timestamp'
  }, {
    autoInc: true,
    primary: 'id'
  })

  // 新增用户货币表
  ctx.model.extend('user_currency', {
    userId: 'string',
    love: { type: 'unsigned', initial: 0 },
    diamond: { type: 'unsigned', initial: 0 },
    gold: { type: 'unsigned', initial: 0 },
    crystal: { type: 'unsigned', initial: 0 },
    energy: { type: 'unsigned', initial: 200 }  // 新增精力字段
  }, {
    primary: 'userId'
  })

  // 添加用户昵称表
  ctx.model.extend('user_profile', {
    userId: 'string',
    nickname: 'string',
    createdAt: 'timestamp'
  }, {
    primary: 'userId'
  })

  ctx.model.extend('gacha_records', {
    userId: 'string',
    totalPulls: 'unsigned',
    pityCounter: 'json'
  }, {
    primary: 'userId'
  })

  // 新增贪婪宝箱状态表
  ctx.model.extend('greedy_chest', {
    userId: 'string',
    slots: 'list',
    finished: 'boolean',
    createdAt: 'timestamp'
  }, {
    primary: 'userId'
  })

  // 初始化装备表
  ctx.model.extend('equipment', {
    id: 'unsigned',
    userId: 'string',
    type: 'string',
    materials: 'json',
    mainAttributes: 'json',
    createdAt: 'timestamp'
  }, {
    autoInc: true,
    primary: 'id'
  })

  // 修改用户字段扩展方式
  ctx.model.extend('user', {
    equipmentDraft: 'json'
  }, {
    primary: 'id',
    autoInc: true
  })

  // 修改背包表定义
  ctx.model.extend('user_inventory', {
    userId: 'string',
    nickname: 'string',
    items: 'json',
    updatedAt: 'timestamp'
  }, {
    primary: 'userId'
  })

  // 初始化岛屿相关表
  ctx.model.extend('island', {
    id: 'string',
    createdAt: 'timestamp',
    expiresAt: 'timestamp',
    players: 'list'
  }, {
    primary: 'id'
  })

  ctx.model.extend('action', {
    name: 'string',
    cost: 'unsigned',
    rewards: 'json'
  }, {
    primary: 'name'
  })

  ctx.model.extend('user_island_status', {
    userId: 'string',
    islandId: 'string',
    currentAction: 'string',
    lastActionTime: 'timestamp',
    remainingActions: 'unsigned',
    actionHistory: 'json'
  }, {
    primary: ['userId']
  })

  ctx.model.extend('island_settlement', {
    userId: 'string',
    islandId: 'string',
    actionHistory: 'json',
    settledAt: 'timestamp'
  }, {
    primary: ['userId', 'islandId']  // 使用复合主键
  })

  // 初始化岛屿生成器
  initializeActions(ctx)
  startIslandSpawner(ctx)

  // ========== 查询价格指令 ==========
  async function findMaterialByNameOrAlias(name: string) {// 先查别名表
    
    const aliasEntry = await ctx.database.get('material_alias', { alias: name })
    if (aliasEntry.length > 0) {
      return ctx.database.get('material', { id: aliasEntry[0].materialId })
    }
    // 没找到别名再查原名
    return ctx.database.get('material', { name: [name] })
  }
  
  ctx.command('查询价格 <name:string>', '查询物品价格信息')
    .action(async (_, name) => {
      if (!name) return '请输入物品名称'

      const [item] = await findMaterialByNameOrAlias(name)
      if (!item) return '未找到该物品'

      const output = []
      const imagePath = resolve(__dirname, item.image)
      output.push(h.image(pathToFileURL(imagePath).href))

      let info = `物品名称：${item.name}`
      if (item.merit !== undefined && item.merit !== null && item.merit > 0) {
        info += `\n所需功勋：${item.merit}`
      }
      info += `\n参考价格：${item.price || '暂无'}`
      output.push(info)

      return output.join('\n')
    })
  // ========== 图鉴查询 ==========
  // 在文件顶部添加类型定义
  type MaterialWithAttributes = MaterialEntry & {
    attributes?: MaterialAttribute[]
    skills?: MaterialSkill[]
  }
  

  // 图鉴指令
  ctx.command('图鉴 [name]', '查询物品图鉴')
    .option('page', '-p <page:number>') 
    .option('star', '-s <星级:number>')
    .option('attr', '-a <属性名>')
    .action(async ({ session, options }, name) => {

      // 查询材料基本信息
      if (name && !options.star && !options.attr) {
        const materials = await findMaterialByNameOrAlias(name);
        if (materials.length) {
          const material = materials[0]; // 取第一个匹配的材料
          const output = [];

          // 根据材料类型展示不同信息
          switch (material.type) {
            case '材料':
              output.push(`【${material.name}】`);
              output.push(`类型：${material.materialType}`);
              output.push(`阶级：${material.grade}阶`);
              output.push(`占用：${material.slots}格`);
              if (material.description) output.push(`描述：${material.description}`);
              break;
            case '食材':
              output.push(`🍴【${material.name}】食材`);
              output.push(`饱食度：${material.satiety}`);
              output.push(`水分：${material.moisture}`);
              if (material.description) output.push(`描述：${material.description}`);
              break;
            case '杂物':
              output.push(`📦【${material.name}】杂物`);
              if (material.description) output.push(`描述：${material.description}`);
              break;
            case '时装':
              output.push(`👔【${material.name}】时装`);
              output.push(`扭蛋池：${['探险热潮', '动物派对', '沙滩派对'][material.grade - 1] || '未知'}`);
              if (material.description) output.push(`描述：${material.description}`);
              break;
            case '英灵':
              output.push(`⚔【${material.name}】英灵`);
              if (material.description) output.push(`描述：${material.description}`);
              break;
          }

          // 查询并展示属性成长信息
          if (material.type === '材料') {
            const attributes = await ctx.database.get('material_attribute', {
              materialId: material.id
            });

            if (attributes.length) {
              output.push('\n🔧 属性成长：');
              // 按星级分组
              const starMap = new Map<number, string[]>();
              attributes.forEach(attr => {
                const entry = starMap.get(attr.starLevel) || [];
                entry.push(`${attr.attrName} +${attr.attrValue}`);
                starMap.set(attr.starLevel, entry);
              });
              
              // 按星级顺序输出
              [1,2,3,4,5].forEach(star => {
                if (starMap.has(star)) {
                  output.push(`⭐${star} → ${starMap.get(star).join('｜')}`);
                }
              });
            }

            // 查询技能信息
            const skills = await ctx.database.get('material_skill', {
              materialId: material.id
            });

            if (skills.length) {
              output.push('\n⚔ 技能列表：');
              skills.forEach(skill => {
                output.push(`${skill.skillName}`);
              });
            }
          }

          // 显示图片（如果有）
          if (material.image) {
            const imagePath = resolve(__dirname, material.image);
            if (existsSync(imagePath)) {
              output.unshift(h.image(pathToFileURL(imagePath).href));
            }
          }

          // 使用handleRecallableMessage发送消息
          return handleRecallableMessage(session, output.join('\n'), ctx)
        }
      }

      // 优先级1：属性+星级查询
      if (options.attr && options.star) {
        const attrName = convertAttrName(ctx, options.attr)
        if (!attrName) return '无效属性名称'
        
        const attributes = await ctx.database.get('material_attribute', {
          attrName,
          starLevel: options.star
        })
        
        const materials = await ctx.database.get('material', {
          id: attributes.map(a => a.materialId),
          type: '材料',
          materialType: { $ne: '兽核' }
        }) as MaterialWithAttributes[]

        const results = materials
          .map(m => ({
            ...m,
            attributes: attributes.filter(a => a.materialId === m.id)
          }))
          .filter(m => m.attributes.length > 0)
          .sort((a, b) => 
            (b.attributes[0].attrValue / b.slots) - 
            (a.attributes[0].attrValue / a.slots)
          )

        return formatAttributeList(results, attrName, options.star, options.page)
      }

      // 优先级2：纯属性查询
      if (options.attr) {
        const attrName = convertAttrName(ctx, options.attr)
        if (!attrName) return '无效属性名称'

        // 获取所有星级的属性数据
        const attributes = await ctx.database.get('material_attribute', { 
          attrName
        })
        
        // 获取材料基础信息
        const materials = await ctx.database.get('material', {
          id: [...new Set(attributes.map(a => a.materialId))], // 去重
          type: '材料',
          materialType: { $ne: '兽核' } // 排除兽核材料
        }) as MaterialWithAttributes[]

        // 关联属性到材料
        const results = materials.map(m => ({
          ...m,
          attributes: attributes.filter(a => a.materialId === m.id)
        }))

        return formatAttributeList(results, attrName, undefined, options.page)
      }

      // 优先级3：类型查询
      const validTypes: MaterialEntry['type'][] = ['材料', '食材', '杂物', '时装', '英灵']
      if (validTypes.includes(name as MaterialEntry['type'])) {
        const materials = await ctx.database.get('material', { 
          type: name as MaterialEntry['type'] // 添加类型断言
        })
        return formatTypeList(materials, name, options.page)
      }

      // 优先级4：子类型查询
      const materialSubTypes = ['碎块', '兽核', '布匹', '丝绳', '残骸']
      if (materialSubTypes.includes(name)) {
        const materials = await ctx.database.get('material', { 
          materialType: name,
          type: '材料' as const // 明确为字面量类型
        })
        return formatMaterialTypeList(materials, name, options.page)
      }

      // 优先级5：阶级查询
      const gradeMatch = name?.match(/([一二三四五六七八九十])阶/)
      if (gradeMatch) {
        const grade = ['一','二','三','四','五','六','七','八','九','十']
          .indexOf(gradeMatch[1]) + 1
        const materials = await ctx.database.get('material', { 
          grade,
          type: '材料'
        })
        return formatGradeList(materials, grade, options.page)
      }

      // 默认提示
      return `请选择查询类型：
1. 材料名称：直接输入材料名称
2. 材料类型：材料/食材/杂物/时装/英灵
3. 材料子类：碎块/兽核/布匹/丝绳/残骸
4. 阶级查询：三阶/四阶
5. 属性查询：攻击/法强 + -s 星级`
    })

  // 格式化函数保持不变
  async function formatAttributeList(
    materials: MaterialWithAttributes[],
    attrName: string,
    star?: number,
    page = 1
  ) {
    // 展开所有星级属性
    const allEntries = materials.flatMap(m => 
      m.attributes?.map(attr => ({
        name: m.name,
        grade: m.grade,
        star: attr.starLevel,
        value: attr.attrValue,
        slots: m.slots
      })) || []
    )
  
    // 按单格值降序 > 星级降序排序
    const sorted = allEntries.sort((a, b) => {
      const perSlotDiff = (b.value / b.slots) - (a.value / a.slots)
      if (perSlotDiff !== 0) return perSlotDiff
      return b.star - a.star
    })
  
    const pageSize = 10
    const totalPages = Math.ceil(sorted.length / pageSize)
    page = Math.min(page, totalPages)
  
    const output = [
      `📚 【${attrName}】全星级属性排行`,
      ...sorted
        .slice((page - 1) * pageSize, page * pageSize)
        .map(entry => {
          const perSlot = (entry.value / entry.slots).toFixed(1)
          return `${entry.name}｜${entry.grade}阶｜${entry.star}星｜单格:${perSlot}｜总值:${entry.value}`
        })
    ]

    if (totalPages > 1) {
      output.push(`\n第 ${page}/${totalPages} 页，输入"图鉴 -a ${attrName} -p 页码"查看其他页`)
    }
    return output.join('\n')
  }

  

  // ========== 材料创建指令 ==========
  ctx.command('材料图鉴')
    .subcommand('.create <name:string> <type:string> <materialType:string> <grade:number> <slots:number> <description:text> <image:string>', '创建新材料', {
      authority: 2,
    })
    .action(async (_, name, type, materialType, grade, slots, description, image) => {
      // 更新有效类型列表
      const validTypes = ['材料', '食材', '杂物', '时装', '英灵'] as const
      if (!validTypes.includes(type as typeof validTypes[number])) {
        return `类型必须为：${validTypes.join('/')}`
      }

      // 转换为正确类型
      const MType = type as '材料' | '食材' | '杂物' | '时装' | '英灵'

      
      if (slots < 1) {
        return '格子数必须大于 0'
      }

      const existing = await ctx.database.get('material', { name: [name] })
      if (existing.length) {
        return '该名称的材料已存在'
      }

      const material = await ctx.database.create('material', {
        name,
        type:MType,
        materialType,  // 使用转换后的类型
        grade,
        slots,
        description,
        image
      })

      return `材料 ${name} (ID:${material.id}) 创建成功！`

      
    })
  
 ctx.command('材料图鉴')
  .subcommand('.materialExtend <name:string> <...args:string>', '扩展材料属性数值', {
    authority: 5
  })
  .usage('参数：材料名称 属性1 数值1 属性2 数值2 ...')
  .example('材料图鉴.materialExtend 菌丝 法强 3 体力 4 耐力 3 3 6 4 3 7 4 4 9 5 5 10 6')
  .action(async (_, name, ...args) => {
    // ==== 参数解析 ====
    // 分离属性名和数值
    const attrMap = new Map<string, number[]>()
    let currentAttr = ''
    
    args.forEach(arg => {
      if (isNaN(Number(arg))) {
        // 属性名称
        currentAttr = arg
        attrMap.set(currentAttr, [])
      } else {
        // 数值
        if (!currentAttr) return
        attrMap.get(currentAttr).push(Number(arg))
      }
    })

    // ==== 参数验证 ====
    const [material] = await ctx.database.get('material', { name: [name] })
    if (!material) return `材料 ${name} 不存在`
    if (material.type !== '材料') return `该物品类型为 ${material.type}，仅支持材料类型`

    // 检查数值完整性
    const attrs = Array.from(attrMap.keys())
    if (attrs.length === 0) return '至少需要指定一个属性'
    
    const totalValues = attrs.reduce((sum, attr) => sum + attrMap.get(attr).length, 0)
    if (totalValues !== attrs.length * 5) {
      return `需要每个属性提供5个数值（对应1-5星），当前总数：${totalValues}，应有：${attrs.length * 5}`
    }

    // ==== 生成属性条目 ====
    const entries = []
    for (let starLevel = 1; starLevel <= 5; starLevel++) {
      attrs.forEach(attr => {
        const values = attrMap.get(attr)
        const value = values[starLevel - 1] // 数组从0开始
        entries.push({
          materialId: material.id,
          starLevel,
          attrName: attr,
          attrValue: value
        })
      })
    }

    // ==== 数据库操作 ====
    try {
      await Promise.all(
        entries.map(entry => ctx.database.create('material_attribute', entry))
      )
    } catch (err) {
      console.error('属性扩展失败:', err)
      return '创建失败，请检查控制台日志'
    }

    // ==== 格式化输出 ====
    const output = [
      `成功为 ${name}(${material.id}) 设置属性数值：`,
      ...entries.map(e => 
        `${material.id} ${e.starLevel}星 ${e.attrName} ${e.attrValue}`
      ),
      `共配置 ${entries.length} 条属性数值`
    ]

    return output.join('\n')
  })
  // ========== 属性管理指令 ==========
  ctx.command('材料属性')
    .subcommand('.add <materialId:number> <starLevel:number> <attrName:string> <attrValue:number>', '添加属性', {
      authority: 2
    })
    .example('材料属性.add 1 5 攻击力 120')
    .action(async (_, materialId, starLevel, attrName, attrValue) => {
      // 检查材料是否存在
      const material = await ctx.database.get('material', { id: materialId })
      if (!material.length) {
        return '指定的材料不存在'
      }

      await ctx.database.create('material_attribute', {
        materialId,
        starLevel,
        attrName,
        attrValue
      })

      return `已为材料 ${material[0].name} 添加 ${starLevel} 星属性：${attrName}=${attrValue}`
    })

  // ========== 图片生成函数 ==========
  const assetPath = resolve(__dirname, 'assets')

  // 在生成HTML前添加路径验证
  console.log('资源目录路径:', assetPath)
  console.log('字体文件存在:', existsSync(resolve(assetPath, 'fusion_pixel.ttf')))
  console.log('背景图存在:', existsSync(resolve(assetPath, 'baojukuang1_1.png')))

  async function generateResultImage(results: string[], grade: number, stars: number) {
    // 读取本地文件并转换为Data URL
    const loadDataURL = (path: string) => {
        const data = require('fs').readFileSync(path)
        return `data:image/png;base64,${data.toString('base64')}`
    }

    // 替换原有硬编码的attrNameMap为配置映射
    const attrMappings = ctx.config.attrNameMappings

    const resources = {
      background: loadDataURL(resolve(assetPath, 'baojukuang1_1.png')),
      gradeIcon: loadDataURL(resolve(assetPath, `rare/grade${grade}.png`)),
      starIcon: loadDataURL(resolve(assetPath, `rare/star${grade}.png`)),
      attrIcons: Object.fromEntries(
        // 使用配置中的映射关系
        Object.entries(attrMappings).map(([chinese, english]) => [
          chinese, 
          loadDataURL(resolve(assetPath, `attr/${english}.png`))
        ])
      ),
      font: loadDataURL(resolve(assetPath, 'fusion_pixel.ttf'))
    }

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
            ${Array.from({length: stars}, (_, i) => `
                <img class="star-icon" 
                     src="${resources.starIcon}"
                     style="left: ${99 + i * 7}px"> <!-- 每颗星间隔7px -->
            `).join('')}

            <!-- 属性区域 垂直排列 -->
            ${results.slice(0, 3).map((text, index) => {
                const [name, value] = text.split('+')
                const yPos = 91 + index * 12  /* 每行间隔12px */
                return `
                <img class="attr-icon" 
                     src="${resources.attrIcons[name] || resources.attrIcons.default}"
                     style="top: ${yPos}px;
                            width: 32px;      /* 实际渲染尺寸放大2倍 */
                            height: 32px;
                            transform: scale(0.5); /* 缩小回原始显示尺寸 */
                            transform-origin: top left;">
                <div class="attr-text" style="top: ${yPos + 2}px">${name}+${value}</div>
                `
            }).join('')}
        </div>
    </body>
    </html>
    `

    // 添加字体加载验证
    console.log('字体数据长度:', resources.font.length)  // 验证字体是否正常加载
    console.log('背景图数据:', resources.background.slice(0, 50))  // 查看部分base64数据

    // 恢复完整的Puppeteer操作流程
    const browser = ctx.puppeteer.browser
    const page = await browser.newPage()
    
    try {
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
        await page.setViewport({
            width: 160, 
            height: 160,
            deviceScaleFactor: 2 // 关键参数：将分辨率提升2倍
        })
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const screenshot = await page.screenshot({
            type: 'png',
            omitBackground: true,
            clip: {
                x: 0,
                y: 0,
                width: 160,
                height: 160
            }
        })
        
        return `data:image/png;base64,${screenshot.toString('base64')}`
    } finally {
        await page.close()
    }
  }

  // ========== 属性处理核心函数 ==========
  async function processAttributeInput(stars: number, materials: string, needImage: boolean, grade: number = 3) {
    // 解析属性参数
    const attributes = new Map<string, number>()
    for (const entry of materials.split(/\s+/)) {
      const match = entry.match(/^(.+?)x(\d+)$/)
      if (!match) return { error: `无效属性格式：${entry}` }
      
      const [_, attrName, valueStr] = match
      const value = parseInt(valueStr)
      
      if (!attrNameMap[attrName]) {
        return { error: `请让可约添加新属性：${attrName}，目前可用属性：${Object.keys(attrNameMap).join(' ')}` }
      }
      
      attributes.set(attrName, value)
    }

    // 随机选择逻辑
    const allAttributes = Array.from(attributes.entries())
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length)
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount)

    // 应用乘数
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1] // [1条, 2条, 3条]
    const finalAttributes = selected.map(([name, value]) => ({
      name,
      finalValue: Math.ceil(value * multiplier)
    }))

    // ==== 生成文本输出 ====
    const textOutput = [
      '🔥 精工结果 🔥',
      `目标星级：${stars}⭐`,
      '输入属性：' + Array.from(attributes.entries()).map(([k, v]) => `${k}x${v}`).join(' '),
      '',
      '【属性总和】',
      ...Array.from(attributes.entries()).map(([name, value]) => `${name}: ${value}`),
      '',
      '【计算过程】',
      `随机选择 ${selectCount} 条属性 x${multiplier}`,
      ...selected.map(([name, value], index) => 
        `${name}: ${value} × ${multiplier} ≈ ${finalAttributes[index].finalValue}`
      )
    ]

    // 图片生成逻辑
    if (needImage) {
      try {
        const imageData = await generateResultImage(
          finalAttributes.map(attr => `${attr.name}+${attr.finalValue}`),
          grade, // 使用传入的阶级参数
          stars
        )
        return { imageData, textOutput }
      } catch (err) {
        console.error('图片生成失败:', err)
        return { error: textOutput.join('\n') }
      }
    }

    return { textOutput }
  }

  // ========== 材料处理核心函数 ==========
  async function processMaterialInput(ctx: Context, stars: number | 'all', materials: string, needImage: boolean) {
    // ==== all 模式处理 ====
    if (stars === 'all') {
      // 存储各星级属性总和
      const starAttributes = new Map<number, Map<string, number>>()
      
      // 获取1-5星属性数据
      for (let star = 1; star <= 5; star++) {
        const result = await processMaterialInput(ctx, star, materials, false)
        if ('error' in result) return result
        
        const attrMap = new Map<string, number>()
        result.textOutput.join('\n').match(/(\S+): (\d+)/g)?.forEach(match => {
          const [name, value] = match.split(': ')
          attrMap.set(name, parseInt(value))
        })
        starAttributes.set(star, attrMap)
      }

      // 基于1星数据选择词条
      const baseAttributes = Array.from(starAttributes.get(1).entries())
      const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, baseAttributes.length)
      const multiplier = [0.3, 0.24, 0.18][selectCount - 1]
      
      // 随机选择词条（仅基于1星数据）
      const selectedAttrs = baseAttributes
        .sort(() => Math.random() - 0.5)
        .slice(0, selectCount)
        .map(([name]) => name)

      // 生成各星级结果
      const results = []
      for (let star = 1; star <= 5; star++) {
        const currentAttributes = starAttributes.get(star)
        // 使用选定的词条计算当前星级的值
        const starResult = {
          star,
          attributes: selectedAttrs.map(name => ({
            name,
            value: Math.ceil((currentAttributes.get(name) || 0) * multiplier)
          }))
        }
        results.push(starResult)
      }

      // 计算属性总和
      const totalResult = selectedAttrs.reduce((acc, name) => {
        acc[name] = results.reduce((sum, r) => {
          const attr = r.attributes.find(a => a.name === name)
          return sum + (attr ? attr.value : 0)
        }, 0)
        return acc
      }, {})

      // 构建输出
      const output = [
        '🔥 全星级精工模拟（真实星级数据） 🔥',
        `使用材料：${materials}`,
        `随机选择 ${selectCount} 条词条 x${multiplier}`,
        `选中词条：${selectedAttrs.join('、')}`,
        '━━━━━━━━━━━━━━━━━━',
        ...results.map(r => 
          `${r.star}⭐：${r.attributes.map(a => `${a.name}+${a.value}`).join(' ')}`
        ),
        '━━━━━━━━━━━━━━━━━━',
        '属性总和：',
        ...Object.entries(totalResult).map(([name, total]) => 
          `${name}: ${total}`
        )
      ]

      return { textOutput: output }
    }

    // ==== 材料参数解析 ====
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async entry => {
      const match = entry.match(/^(.+?)x(\d+)$/)
      if (!match) return null
      
      const materialName = match[1].trim()
      // 新增属性材料检测
      if (attrNameMap[materialName]) {
        return null // 属性材料不参与材料模式计算
      }
      
      const [material] = await findMaterialByNameOrAlias(materialName)
      return material ? { material, count: parseInt(match[2]) } : null
    })).then(list => list.filter(Boolean))

    // ==== 基础校验 ====
    if (materialEntries.length < 2) {
      return { error: '材料模式需要至少两个有效材料，格式：材料名x数量（字母x）' }
    }

    // ==== 兽核严格校验 ====
    const coreEntries = materialEntries.filter(entry => 
      entry.material.materialType === '兽核'
    )
    // 检查兽核总数和单个数量
    const totalCores = coreEntries.reduce((sum, entry) => sum + entry.count, 0)
    if (totalCores !== 1 || coreEntries.some(entry => entry.count !== 1)) {
      return { 
        error: `必须使用且只能使用1个兽核材料，当前使用：${
          coreEntries.map(e => `${e.material.name}x${e.count}`).join(' ')
        } 总数量：${totalCores}个` 
      }
    }

    // ==== 材料数据获取 ====
    const materialsData = materialEntries.map(entry => entry.material)
    const firstGrade = materialsData[0].grade

    // ==== 属性校验 ====
    const attributes = await ctx.database.get('material_attribute', {
        materialId: materialsData.map(m => m.id),
      starLevel: stars
    })

    // ==== 格子计算 ====
    const totalSlots = materialEntries.reduce((sum, entry) => 
      sum + (entry.material.slots * entry.count), 0)
    if (totalSlots !== 15) {
      return { error: `材料总格子数应为15，当前为${totalSlots}` }
    }

    // ==== 属性计算 ====
    const attributeMap = new Map<string, number>()
    materialEntries.forEach(entry => {
      const attrs = attributes.filter(a => a.materialId === entry.material.id)
      attrs.forEach(attr => {
        const value = (attributeMap.get(attr.attrName) || 0) + (attr.attrValue * entry.count)
        attributeMap.set(attr.attrName, value)
      })
    })

    // ==== 随机选择属性 ====
    const allAttributes = Array.from(attributeMap.entries())
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length)
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount)

    // ==== 应用乘数 ====
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1]
    const finalAttributes = selected.map(([name, value]) => ({
      name,
      finalValue: Math.ceil(value * multiplier)
    }))

    // ==== 生成文本输出 ====
    const textOutput = [
      '🔥 精工结果 🔥',
      `目标星级：${stars}⭐`,
      `材料阶级：${firstGrade}阶`,
      `使用材料：${materialEntries.map(m => `${m.material.name}x${m.count}`).join(' ')}`,
      '',
      '【属性总和】',
      ...Array.from(attributeMap.entries()).map(([name, value]) => `${name}: ${value}`),
      '',
      '【计算过程】',
      `随机选择 ${selectCount} 条属性 x${multiplier}`,
      ...selected.map(([name, value], index) => 
        `${name}: ${value} × ${multiplier} ≈ ${finalAttributes[index].finalValue}`
      )
    ]

    // ==== 图片生成 ====
    if (needImage) {
      try {
        const imageData = await generateResultImage(
          finalAttributes.map(attr => `${attr.name}+${attr.finalValue}`),
          firstGrade,
          stars
        )
        return { imageData, textOutput }
      } catch (err) {
        console.error('图片生成失败:', err)
        return { error: textOutput.join('\n') }
      }
    }

    return { textOutput }
  }

  // ========== 混合模式属性处理逻辑 ==========
  async function processMixedInput(ctx: Context, stars: number, inputs: string[], needImage: boolean) {
    // ==== 分离材料和属性参数 ====
    const materialParts: string[] = []
    const attributeParts: string[] = []
    
    inputs.forEach(input => {
      const [name] = input.split('x')
      if (Object.keys(attrNameMap).includes(name)) {
        attributeParts.push(input)
      } else {
        materialParts.push(input)
      }
    })

    // ==== 处理材料部分 ====
    const materialResult = await processMaterialInput(ctx, stars, materialParts.join(' '), false)
    if ('error' in materialResult) return materialResult
    
    // ==== 处理属性部分 ====
    const attributeResult = await processAttributeInput(stars, attributeParts.join(' '), false)
    if ('error' in attributeResult) return attributeResult

    // ==== 合并属性数值 ====
    const mergedAttributes = new Map<string, number>()
    
    // 解析材料转换属性
    const materialAttrRegex = /(\S+): (\d+)/g
    const materialAttrs = new Map<string, number>()
    let match
    while ((match = materialAttrRegex.exec(materialResult.textOutput.join('\n'))) !== null) {
      const name = match[1]
      const value = parseInt(match[2])
      materialAttrs.set(name, (materialAttrs.get(name) || 0) + value)
      mergedAttributes.set(name, ((mergedAttributes.get(name) || 0) + value))
    }

    // 解析直接输入属性
    const directAttrRegex = /(\S+): (\d+)/g
    const directAttrs = new Map<string, number>()
    while ((match = directAttrRegex.exec(attributeResult.textOutput.join('\n'))) !== null) {
      const name = match[1]
      const value = parseInt(match[2])
      directAttrs.set(name, (directAttrs.get(name) || 0) + value)
      mergedAttributes.set(name, (mergedAttributes.get(name) || 0) + value)
    }
    
    // ==== 获取最高阶级 ====
    let maxGrade = 0
    if (materialParts.length > 0) {
      const materials = await Promise.all(materialParts.map(async part => {
        const [name] = part.split('x')
        return (await findMaterialByNameOrAlias(name))[0]
      }))
      maxGrade = Math.max(...materials.map(m => m.grade))
    }
    // ==== 随机选择属性 ====
    const allAttributes = Array.from(mergedAttributes.entries())
    const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allAttributes.length)
    const selected = allAttributes.sort(() => Math.random() - 0.5).slice(0, selectCount)

    // ==== 应用乘数 ====
    const multiplier = [0.3, 0.24, 0.18][selectCount - 1] || 0
    const finalAttributes = selected.map(([name, value]) => ({
      name,
      finalValue: Math.ceil(value/2 * multiplier)
    }))


    // ==== 生成结果 ====
    const textOutput = [
      '🔥 混合模式精工结果 🔥',
      `目标星级：${stars}⭐`,
      `最高阶级：${maxGrade || '无材料输入'}`,
      `使用材料：${materialParts.join(' ')}`,
      `输入属性：${attributeParts.join(' ')}`,
      '',
      '【材料转换属性】',
      ...Array.from(materialAttrs.entries()).map(([k, v]) => `${k}: ${v/2}`),
      '【直接输入属性】',
      ...Array.from(directAttrs.entries()).map(([k, v]) => `${k}: ${v/2}`),
      '【合并总属性】',
      ...Array.from(mergedAttributes.entries()).map(([k, v]) => `${k}: ${v/2}`),
      '',
      '【计算过程】',
      `随机选择 ${selectCount} 条属性 x${multiplier.toFixed(2)}`,
      ...selected.map(([name, value], index) => 
        `${name}: ${value/2} x ${multiplier.toFixed(2)} ≈ ${finalAttributes[index].finalValue}`
      )
    ]

    // ==== 图片生成 ====
    if (needImage) {
    try {
      const imageData = await generateResultImage(
        finalAttributes.map(attr => `${attr.name}+${attr.finalValue}`),
          maxGrade || 3, // 默认3阶
        stars
      )
      return { imageData, textOutput }
    } catch (err) {
      console.error('图片生成失败:', err)
      return { error: textOutput.join('\n') }
    }
  }

    return { textOutput }
  }

  // ========== 指令处理 ==========
  ctx.command('模拟精工锭 <inputParams:text>', '模拟合成精工锭')
    .action(async ({ session }, inputParams) => {
      const params = inputParams.split(/\s+/)
      
      // ==== 新增 all 模式判断 ====
      if (params[0] === 'all') {
        const materialResult = await processMaterialInput(ctx, 'all', params.slice(1).join(' '), false)
        return 'error' in materialResult ? materialResult.error : materialResult.textOutput.join('\n')
      }
      
      // ==== 增强模式判断 ====
      let mode: 'material' | 'attribute' | 'mixed' = 'material'
      const hasAttributes = await Promise.all(params.slice(1).map(async p => {
        const [name] = p.split('x')
        return Object.keys(attrNameMap).includes(name) || !(await findMaterialByNameOrAlias(name))[0]
      })).then(results => results.some(Boolean))
      
      const hasMaterials = await Promise.all(params.slice(1).map(async p => {
        const [name] = p.split('x')
        return (await findMaterialByNameOrAlias(name))[0]?.type === '材料'
      })).then(results => results.some(Boolean))

      if (hasAttributes && hasMaterials) {
        mode = 'mixed'
      } else if (hasAttributes) {
        mode = 'attribute'
      }

      // ==== 统一处理逻辑 ====
      let result
      switch(mode) {
        case 'attribute':
          if (params.length < 2) return '属性模式需要参数格式：星级 属性1x数值...'
          const stars = parseInt(params[0])
          const materials = params.slice(1).join(' ')
          if (isNaN(stars) || stars < 1 || stars > 5) return '星级必须为1-5的整数'
          result = await processAttributeInput(stars, materials, false)
          break
          
        case 'mixed':
          if (params.length < 2) return '混合模式需要参数格式：星级 材料/属性组合...'
          const mixedStars = parseInt(params[0])
          if (isNaN(mixedStars) || mixedStars < 1 || mixedStars > 5) return '星级必须为1-5的整数'
          result = await processMixedInput(ctx, mixedStars, params.slice(1), false)
          break
          
        default:
          if (params.length < 2) return '材料模式需要参数格式：星级 材料1x数量...'
          const materialStars = parseInt(params[0])
          if (isNaN(materialStars) || materialStars < 1 || materialStars > 5) return '星级必须为1-5的整数'
          result = await processMaterialInput(ctx, materialStars, params.slice(1).join(' '), false)
          break
      }
      
      // 使用handleRecallableMessage发送消息
      const content = 'error' in result ? result.error : result.textOutput.join('\n')
      return handleRecallableMessage(session, content, ctx)
    })

  ctx.command('精工 <inputParams:text>', '正式合成精工锭')
    .action(async ({ session }, inputParams) => {
      const params = inputParams.split(/\s+/)
      
      // ==== 参数模式判断 ====
      let mode: 'material' | 'attribute' | 'mixed' = 'material'
      const hasAttributes = await Promise.all(params.slice(1).map(async p => {
        const [name] = p.split('x')
        return Object.keys(attrNameMap).includes(name) || !(await findMaterialByNameOrAlias(name))[0]
      })).then(results => results.some(Boolean))
      
      const hasMaterials = await Promise.all(params.slice(1).map(async p => {
        const [name] = p.split('x')
        return (await findMaterialByNameOrAlias(name))[0]?.type === '材料'
      })).then(results => results.some(Boolean))

      if (hasAttributes && hasMaterials) {
        mode = 'mixed'
      } else if (hasAttributes) {
        mode = 'attribute'
      }

      // ==== 属性模式处理 ====
      if (mode === 'attribute') {
        if (params.length < 3) return '属性模式需要参数格式：阶级 星级 属性1x数值...'
        
        const grade = parseInt(params[0])
        const stars = parseInt(params[1])
        const materials = params.slice(2).join(' ')

        if (isNaN(grade) || grade < 1 || grade > 10) return '阶级必须为1-10的整数'
        if (isNaN(stars) || stars < 1 || stars > 5) return '星级必须为1-5的整数'

        const result = await processAttributeInput(stars, materials, true, grade)
        if ('error' in result) return result.error
        return h.image(result.imageData)
      }

      // ==== 混合模式处理 ====
      if (mode === 'mixed') {
        if (params.length < 2) return '混合模式需要参数格式：星级 材料/属性组合...'
        
        const stars = parseInt(params[0])
        if (isNaN(stars) || stars < 1 || stars > 5) return '星级必须为1-5的整数'
        
        const result = await processMixedInput(ctx, stars, params.slice(1), true)
        if ('error' in result) return result.error
        return h.image(result.imageData)
      }

      // ==== 材料模式处理 ====
      if (params.length < 2) return '材料模式需要参数格式：星级 材料1x数量...'
      
      const stars = parseInt(params[0])
      if (isNaN(stars) || stars < 1 || stars > 5) return '星级必须为1-5的整数'
      
      const result = await processMaterialInput(ctx, stars, params.slice(1).join(' '), true)
      if ('error' in result) return result.error
      return h.image((result as any).imageData)
    })

  // ========== 黑名单系统==========
  // 定义挂榜命令
  ctx.command('挂榜 <userId> <qqNumber> <behavior>', '将用户列入黑名单')
    .action((_, userId, qqNumber, behavior) => {
       // 将 qqNumber 转换为 number 类型
       const qqNumberAsNumber = Number(qqNumber);
      // 查找是否已存在该用户的记录
      const existingEntry = blacklist.find(entry => entry.userId === userId);

      if (existingEntry) {
        // 如果用户ID已存在，检查QQ号是否已存在
        if (!existingEntry.qqNumbers.includes(qqNumberAsNumber)) {
          existingEntry.qqNumbers.push(qqNumberAsNumber);
        
        }
      } else {
        // 如果用户ID不存在，创建新的记录
        blacklist.push({
          userId,
          qqNumbers: [qqNumberAsNumber],
          behavior,
        });
      }

      return `已成功挂榜 ${userId} QQ号${qqNumber}`;
    });

  // 定义查询命令
  ctx.command('查询 <query>', '查询用户是否在黑名单中')
    .action((_, query) => {
      // 查找是否存在匹配的记录
      const matchingEntries = blacklist.filter(entry =>
        entry.userId === query || entry.qqNumbers.includes(Number(query))
      );

      if (matchingEntries.length > 0) {
        // 如果存在匹配的记录，构建输出字符串
        const output = matchingEntries.map(entry => {
          return `该用户为黑名单用户！用户ID：${entry.userId} QQ号：${entry.qqNumbers.join(' ')} 行为：${entry.behavior}`;
        }).join('\n');

        return output;
      } else {
        // 如果不存在匹配的记录，返回提示信息
        return `该用户未被记载！交易前请核实对方身份。`;
      }
    });

  // 定义删除黑名单命令
  ctx.command('删除黑名单 <query>', '从黑名单中删除用户')
  .action((_, query) => {
    // 查找是否存在匹配的记录
    const index = blacklist.findIndex(entry =>
      entry.userId === query || entry.qqNumbers.includes(Number(query))
    );

    if (index !== -1) {
      // 如果存在匹配的记录，删除该记录
      blacklist.splice(index, 1);
      return `已成功删除黑名单中的 ${query}`;
    } else {
      // 如果不存在匹配的记录，返回提示信息
      return `未找到匹配的黑名单记录，无法删除。`;
    }
  });

  // 添加别名管理指令
  ctx.command('材料别名')
    .subcommand('.add <materialName:string> <alias:string>', '添加材料别名', {
      authority: 2
    })
    .action(async (_, materialName, alias) => {
      const [material] = await ctx.database.get('material', { name: [materialName] })
      if (!material) return `材料 ${materialName} 不存在`
      
      const existing = await ctx.database.get('material_alias', { alias })
      if (existing.length) return '该别名已被使用'

      await ctx.database.create('material_alias', {
        materialId: material.id,
        alias
      })
      return `已为 ${materialName} 添加别名：${alias}`
    })

  ctx.command('材料别名')
    .subcommand('.remove <alias:string>', '删除材料别名', {
      authority: 2
    })
    .action(async (_, alias) => {
      const result = await ctx.database.remove('material_alias', { alias })
      return result ? `已删除别名：${alias}` : '别名不存在'
    })

  // 新增烹饪指令
  ctx.command('烹饪 <dishType:string> <materials:text>', '制作料理')
  .usage('格式：烹饪 料理类型 食材1x数量 食材2x数量 ... (共6个食材)')
  .example('烹饪 便当 胡萝卜x2 牛肉x3 大米x1')
  .action(async (_, dishType, materials) => {
    // ==== 材料解析 ====
    let totalCount = 0
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async entry => {
      const match = entry.match(/^(.+?)x(\d+)$/)
      if (!match) return null
      
      const materialName = match[1].trim()
      const count = parseInt(match[2])
      totalCount += count
      
      const [material] = await findMaterialByNameOrAlias(materialName)
      if (!material || material.type !== '食材') return null
      
      return { material, count }
    })).then(list => list.filter(Boolean))

    // ==== 材料检查 ====
    if (totalCount !== 6) {
      return '需要精确使用6个食材进行烹饪（总数量为6）'
    }

    // ==== 基础属性计算 ====
    let totalSatiety = 0, totalMoisture = 0
    materialEntries.forEach(entry => {
      totalSatiety += (entry.material.satiety || 0) * entry.count
      totalMoisture += (entry.material.moisture || 0) * entry.count
    })

    // ==== 修改后的加成计算 ====
    let healthMultiplier = 1, staminaMultiplier = 1, timeMultiplier = 1
    const specialEffects = new Map<string, number>()

    const foodEffects = await ctx.database.get('food', { 
      materialId: materialEntries.map(e => e.material.id) 
    })

    foodEffects.forEach(effect => {
      const entries = materialEntries.filter(e => e.material.id === effect.materialId)
      const totalCount = entries.reduce((sum, e) => sum + e.count, 0)

      if (effect.effectType === '基础加成') {
        switch(effect.effectSubType) {
          case '生命':
            healthMultiplier += effect.value * totalCount / 100
            break
          case '体力':
            staminaMultiplier += effect.value * totalCount / 100
            break
          case '秒数':
            timeMultiplier += effect.value * totalCount / 100
            break
        }
      } else {
        const key = effect.effectSubType
        const current = specialEffects.get(key) || 0
        specialEffects.set(key, current + (effect.stackValue * totalCount))
      }
    })

    // ==== 应用基础加成乘数 ====
    let totalSeconds = 60 + Math.floor(totalMoisture / 30)
    let instantHealth = 0, instantStamina = 0
    let baseHealth = 0, baseStamina = 0

    switch(dishType) {
      case '便当':
        instantHealth = Math.floor((40 + totalSatiety * 13) * healthMultiplier)
        instantStamina = Math.floor((20 + totalMoisture * 6) * staminaMultiplier)
        totalSeconds = Math.floor(totalSeconds * timeMultiplier)
        break
      case '罐头':
        baseHealth = Math.floor((6 + totalSatiety * 1.1) * healthMultiplier)
        baseStamina = Math.floor((2 + totalMoisture * 0.75) * staminaMultiplier)
        totalSeconds = Math.floor(totalSeconds * timeMultiplier)
        break
    }

    // ==== 修改后的结果输出 ====
    const output = [
      '🍳 烹饪结果 🍳',
      `料理类型：${dishType}`,
      `总饱食度：${totalSatiety}`,
      `总水分：${totalMoisture}`,
      '',
      '【基础加成】',
      `生命效果倍率：${(healthMultiplier * 100).toFixed(0)}%`,
      `体力效果倍率：${(staminaMultiplier * 100).toFixed(0)}%`,
      `持续时间倍率：${(timeMultiplier * 100).toFixed(0)}%`,
      ''
    ]

    // 根据料理类型添加不同输出
    if (dishType === '便当') {
      output.push(
        `瞬间回复生命：${Math.floor(instantHealth)}`,
        `瞬间回复体力：${Math.floor(instantStamina)}`
      )
    } else if (dishType === '罐头') {
      output.push(
        `持续时长：${totalSeconds}秒`,
        `每5秒回复生命：${Math.floor(baseHealth)}`,
        `每5秒回复体力：${Math.floor(baseStamina)}`,
        `总计回复：${Math.floor(baseHealth * totalSeconds / 5)}生命 / ${Math.floor(baseStamina * totalSeconds / 5)}体力`
      )
    }

    output.push(
      '',
      '【特殊加成】',
      ...Array.from(specialEffects.entries()).map(([type, value]) => {
        if (type === '烹饪时长') return `☆ 持续时间 +${value}秒`
        return `☆ ${type}：${value}`
      })
    )

    return output.join('\n')
  })

  
  // 新增技能查询指令
  ctx.command('材料技能 <name:string>', '查询材料技能')
    .action(async (_, name) => {
      const [material] = await findMaterialByNameOrAlias(name)
      if (!material) return '材料不存在'

      const skills = await ctx.database.get('material_skill', { materialId: material.id })
      if (skills.length === 0) return '该材料没有关联技能'

      const output = [
        `材料：${material.name} 技能列表`,
        ...skills.map(skill => {
          const image = h.image(pathToFileURL(resolve(__dirname, skill.image)).href)
          return [
            image,
            `技能名称：${skill.skillName}`,
            `描述：${skill.description}`,
            `效果：${skill.effect}`
          ].join('\n')
        })
      ]

      return output.join('\n\n')
    })

  // ========== 新增营火运势指令 ==========
  // 元素祝福列表
  const elements = ['草', '冰', '火', '岩']
  
  ctx.command('营火签到', '每日签到')
    .userFields(['authority'])
    .action(async ({ session }) => {
      const userId = session.userId
      const isAdmin = session.user?.authority >= 4

      // 检查是否已注册
      const [profile] = await ctx.database.get('user_profile', { userId })
      if (!profile) {
        return '您还未注册账号哦~\n请使用「注册 昵称」完成注册\n(昵称需为1-12位中英文/数字组合)'
      }

      // 检查冷却时间(非管理员)
      if (!isAdmin) {
        const lastUsed = await ctx.database.get('user_cooldown', { userId })
        if (lastUsed.length > 0) {
          const lastDate = new Date(lastUsed[0].lastUsed)
          
          // 转换为北京时间的日期部分（年-月-日）
          const lastDateCN = new Date(lastDate.getTime() + 8 * 60 * 60 * 1000)
          const lastDateStr = `${lastDateCN.getUTCFullYear()}-${(lastDateCN.getUTCMonth() + 1).toString().padStart(2, '0')}-${lastDateCN.getUTCDate().toString().padStart(2, '0')}`
          
          // 获取当前北京时间的日期部分
          const nowCN = new Date(Date.now() + 8 * 60 * 60 * 1000)
          const todayStr = `${nowCN.getUTCFullYear()}-${(nowCN.getUTCMonth() + 1).toString().padStart(2, '0')}-${nowCN.getUTCDate().toString().padStart(2, '0')}`
          
          if (lastDateStr === todayStr) {
            return `今天已经占卜过了（上次签到时间：${formatDateCN(lastDate)}），明天再来吧~`
          }
        }
      }

      // 初始化用户货币（如果不存在）
      const [currency] = await ctx.database.get('user_currency', { userId })
      if (!currency) {
        await ctx.database.create('user_currency', {
          userId,
          love: 0,
          diamond: 0,
          gold: 0,
          crystal: 0,
          energy: 200
        })
      }

      // 生成随机数值（所有人1%彩蛋）
      let luckValue = Math.floor(Math.random() * 100) + 1
      let isSpecial = Math.random() < 0.01

      // 触发彩蛋时强制设为999
      if (isSpecial) {
        luckValue = 999
      }

      // 获取运势档位（彩蛋固定20档）
      const level = isSpecial ? 20 : Math.min(20, Math.ceil(luckValue / 5))

      // 查询运势描述
      const [fortune] = await ctx.database.get('fortune', { 
        level,
        isSpecial: isSpecial  
      }, { limit: 1 })

      // 随机元素祝福
      const element = elements[Math.floor(Math.random() * elements.length)]

      // 更新冷却时间(非管理员)
      if (!isAdmin) {
        const nowUTC = new Date()
        await ctx.database.upsert('user_cooldown', [{
          userId,
          lastUsed: nowUTC
        }], ['userId'])
      }

      // 奖励发放
      await ctx.database.upsert('user_currency', [{
        userId,
        diamond: (currency?.diamond || 0) + 2400,
        energy: 200
      }], ['userId'])

      // 获取最新货币数据
      const [newCurrency] = await ctx.database.get('user_currency', { userId })

      // 构建输出结果
      return [
        `✨ 营火签到 ✨`,
        `昵称：${profile.nickname}`,
        `今日元素祝福：${element}`,
        `幸运数值：${luckValue}${isSpecial ? '✨' : ''}`,
        `运势解读：${fortune?.description || '未知运势'}`,
        `\n🎁 签到奖励：钻石+2400`,
        `当前余额：💎${newCurrency.diamond}  💰${newCurrency.gold}  💖${newCurrency.love}  ✨${newCurrency.crystal}`,
        `精力值：⚡${newCurrency.energy}/200`
      ].filter(Boolean).join('\n')
    })

  ctx.command('我的余额', '查看账户余额')
    .action(async ({ session }) => {
      const [currency] = await ctx.database.get('user_currency', { 
        userId: session.userId 
      })
      if (!currency) return '尚未创建账户，请先使用营火签到'
      
      const [profile] = await ctx.database.get('user_profile', {
        userId: session.userId
      })
      
      return `💰 账户余额：${profile ? `\n昵称：${profile.nickname}` : ''}
💎 钻石：${currency.diamond}
💰 金币：${currency.gold}
💖 爱心：${currency.love}
✨ 幻晶：${currency.crystal}
⚡ 精力：${currency.energy}/200`
    })

  // ========== 扭蛋指令 ==========
  ctx.command('扭蛋 <type:string>', '进行扭蛋抽卡')
    .option('count', '-c <count:number>', { fallback: 1 })
    .action(async ({ session, options }, type) => {
      const userId = session.userId
      const pullCount = type === '十连' ? 10 : 1
      const cost = 240 * pullCount

      // 获取当前钻石并校验
      const [currency] = await ctx.database.get('user_currency', { userId })
      if (!currency || currency.diamond < cost) {
        return `钻石不足，需要${cost}💎（当前余额：${currency?.diamond || 0}💎）`
      }

      // 直接扣除钻石
      await ctx.database.upsert('user_currency', [{
        userId,
        diamond: currency.diamond - cost
      }], ['userId'])

      // 获取或初始化抽卡记录
      let [record] = await ctx.database.get('gacha_records', { userId })
      if (!record) {
        record = {
          userId,
          totalPulls: 0,
          pityCounter: {
            探险热潮: 0,
            动物派对: 0,
            沙滩派对: 0
          }
        }
        await ctx.database.create('gacha_records', record)
      }

      // 抽卡逻辑
      const results = []
      for (let i = 0; i < pullCount; i++) {
        results.push(await performGacha(ctx, userId))
      }

      // 扣除钻石后添加最新余额查询
      const [newCurrency] = await ctx.database.get('user_currency', { userId })
      
      // 修改结果输出部分
      const output = [
        '🎉━━━━ 扭蛋结果 ━━━━🎉',
        `消耗钻石：${cost}💎  `,
        
      ]

      results.forEach((r, index) => {
        output.push(`\n🔮 第 ${index + 1} 抽 ━━━━━━`)
        if (r.rank === '彩蛋') {
          output.push(
            '✨✨ 袖珍彩蛋触发！✨✨',
            `├─ 主池类型：${r.gachaType}`,
            `└─ 额外奖励：${r.extra.rank}级 ${r.extra.item?.name || '神秘物品'}`
          )
        } else {
          const rankIcon = {
            S: '🌟S级',
            A: '✨A级', 
            B: '🔶B级',
            C: '🔷C级',
            D: '⚪D级'
          }[r.rank]
          
          output.push(
            `${rankIcon} ${r.item?.name || '未知物品'}`,
            `├─ 扭蛋类型：${r.isMini ? '袖珍' : '常规'} ${r.gachaType}`,
            `└─ ${r.isPity ? '✨保底奖励' : '常规掉落'}`
          )
        }
      })

      // 添加底部信息
      output.push(
        '\n  ━━━━ 余额信息 ━━━━  ',
        `剩余钻石：💎${newCurrency.diamond}`,
        `累计抽卡：${record.totalPulls + pullCount}次`
      )

      // 使用handleRecallableMessage发送消息
      return handleRecallableMessage(session, output.join('\n'), ctx)
    })

  // ========== 新增贪婪宝箱指令 ==========
  ctx.command('贪婪宝箱 [action]', '贪婪宝箱抽奖')
    .usage('输入"贪婪宝箱"开始/继续抽奖，"贪婪宝箱 结算"提前领取奖励\n测试指令：贪婪宝箱 <面类型> (-t)')
    .option('test', '-t 测试模式（不消耗钻石）')
    .action(async ({ session, options }, action) => {
      const userId = session.userId
      const costPerPull = options.test ? 0 : 30 // 测试模式不消耗钻石

      // 获取用户状态
      const [chest] = await ctx.database.get('greedy_chest', { userId })
      const [currency] = await ctx.database.get('user_currency', { userId })

      // 测试模式直接生成指定面
      if (action && ['金币','贪婪','钻石','幸运'].includes(action)) {
        if (!options.test) return '测试模式需要添加 -t 参数'

        // 生成测试槽位
        const testSlot = action
        const newSlots = chest?.slots?.length < 3 
          ? [...(chest?.slots || []), testSlot] 
          : [testSlot]

        // 更新测试状态
        await ctx.database.upsert('greedy_chest', [{
          userId,
          slots: newSlots,
          finished: newSlots.length >= 3
        }], ['userId'])

        // 自动结算
        if (newSlots.length >= 3) {
          const result = await calculateRewards(newSlots, currency)
          await clearUserState(userId)
          return buildOutput(result, newSlots)
        }

        return [
          '🧪━━ 测试模式 ━━🧪',
          `当前槽位：[${newSlots.join('][')}]${'⬜'.repeat(3 - newSlots.length)}`,
          '输入指令继续添加测试面，例如：贪婪宝箱 钻石 -t'
        ].join('\n')
      }

      // 结算处理
      if (action === '结算') {
        if (!chest || chest.finished) return '没有可结算的宝箱'
        if (chest.slots.length === 0) return '尚未开始抽奖'

        // 强制结算逻辑
        const result = await calculateRewards(chest.slots, currency)
        await clearUserState(userId)
        return buildOutput(result, chest.slots, true)
      }

      // 开始/继续抽奖
      if (chest && !chest.finished) {
        // 检查是否已满
        if (chest.slots.length >= 3) {
          const result = await calculateRewards(chest.slots, currency)
          await clearUserState(userId)
          return buildOutput(result, chest.slots)
        }

        // 继续抽奖
        return processNextPull(ctx, userId, chest, currency, costPerPull, action)
      }

      // 新开宝箱
      if (!currency || currency.diamond < costPerPull) {
        return `需要${costPerPull}💎（当前余额：${currency?.diamond || 0}💎）`
      }

      // 初始化状态
      await ctx.database.upsert('greedy_chest', [{
        userId,
        slots: [],
        finished: false,
        createdAt: new Date()
      }], ['userId'])

      return processNextPull(ctx, userId, { slots: [] }, currency, costPerPull, action)
    })

  // 处理单次抽奖
  async function processNextPull(
    ctx: Context,
    userId: string,
    chest: any,
    currency: any,
    cost: number,
    testFace?: string // 仅允许字符串类型
  ) {
    // 扣除钻石
    await ctx.database.upsert('user_currency', [{
      userId,
      diamond: currency.diamond - cost
    }], ['userId'])

    // 生成新槽位
    const newSlot = generateSlot(ctx, testFace)
    const newSlots = [...chest.slots, newSlot]

    // 更新状态
    await ctx.database.upsert('greedy_chest', [{
      userId,
      slots: newSlots,
      finished: newSlots.length >= 3
    }], ['userId'])

    // 自动结算条件
    if (newSlots.length >= 3) {
      const result = await calculateRewards(newSlots, currency)
      await clearUserState(userId)
      return buildOutput(result, newSlots)
    }

    // 构建中间结果
    const [newCurrency] = await ctx.database.get('user_currency', { userId })
    return [
      '🎰━━ 贪婪宝箱 ━━🎰',
      `当前槽位：[${newSlots.join('][')}]${'⬜'.repeat(3 - newSlots.length)}`,
      `消耗钻石：${cost}💎 剩余次数：${3 - newSlots.length}`,
      '━━━━━━━━━━━━',
      `输入"贪婪宝箱"继续抽奖 (${3 - newSlots.length}次剩余)`,
      `或输入"贪婪宝箱 结算"提前领取奖励`,
      '━━━━━━━━━━━━',
      `当前余额：💎${newCurrency.diamond}`
    ].join('\n')
  }

  // 生成单个槽位结果
  function generateSlot(ctx: Context, testFace?: string): string {
    const rates = ctx.config.greedyChestRates
    const total = rates.gold + rates.greed + rates.diamond + rates.lucky
    
    // 自动调整概率
    const scale = total > 100 ? 100 / total : 1
    const thresholds = {
      gold: (rates.gold * scale) / 100,
      greed: (rates.gold + rates.greed) * scale / 100,
      diamond: (rates.gold + rates.greed + rates.diamond) * scale / 100,
      lucky: 1
    }

    if (typeof testFace === 'string' && ['金币','贪婪','钻石','幸运'].includes(testFace)) {
      return testFace
    }
    
    const rand = Math.random()
    return rand < thresholds.gold ? '金币' 
      : rand < thresholds.greed ? '贪婪' 
      : rand < thresholds.diamond ? '钻石' 
      : '幸运'
  }

  // 奖励计算核心逻辑
  async function calculateRewards(slots: string[], currency: any) {
    const counts = {
      金币: slots.filter(x => x === '金币').length,
      贪婪: slots.filter(x => x === '贪婪').length,
      钻石: slots.filter(x => x === '钻石').length,
      幸运: slots.filter(x => x === '幸运').length
    }

    // 修复点：当有两个贪婪面时，仅当第三面不是贪婪时才触发三连
    if (counts.贪婪 >= 2 && counts.贪婪 < 3) {
      const thirdSlot = slots[2]
      const validTypes = ['金币', '钻石', '幸运'] as const // 排除贪婪类型
      const slotType = validTypes.find(t => t === thirdSlot)
      
      if (slotType) {
        // 仅当第三面是非贪婪类型时重置计数
        Object.keys(counts).forEach(key => counts[key] = 0)
        counts[slotType] = 3
      }
    }

    let goldGained = 0
    let diamondGained = 0
    let extraItems = []
    let reward = ''
    const rand = Math.random()

    // 判断奖励类型优先级
    const rewardPriority = ['幸运', '钻石', '金币', '贪婪']
    let finalType = rewardPriority.find(type => counts[type] >= 1)

    // 金币奖励
    if (finalType === '金币') {
      switch(counts.金币) {
        case 1:
          if (rand < 0.45) { reward = '获得金币666'; goldGained = 666 }
          else if (rand < 0.75) { reward = '获得金币888'; goldGained = 888 }
          else { reward = '获得金币1111'; goldGained = 1111 }
          break
        case 2:
          if (rand < 0.45) { reward = '获得金币1666'; goldGained = 1666 }
          else if (rand < 0.75) { reward = '获得金币1888'; goldGained = 1888 }
          else { reward = '获得金币2333'; goldGained = 2333 }
          break
        case 3:
          if (rand < 0.45) { reward = '获得金币3333'; goldGained = 3333 }
          else if (rand < 0.75) { reward = '获得金币6666'; goldGained = 6666 }
          else { reward = '获得金币9999'; goldGained = 9999 }
      }
    }
    
    // 钻石奖励
    else if (finalType === '钻石') {
      switch(counts.钻石) {
        case 1:
          if (rand < 0.45) { reward = '获得钻石33'; diamondGained = 33 }
          else if (rand < 0.75) { reward = '获得钻石66'; diamondGained = 66 }
          else { reward = '获得钻石99'; diamondGained = 99 }
          break
        case 2:
          if (rand < 0.35) { reward = '获得钻石99'; diamondGained = 99 }
          else if (rand < 0.65) { reward = '获得钻石145'; diamondGained = 145 }
          else if (rand < 0.9) { reward = '获得钻石233'; diamondGained = 233 }
          else { reward = '获得钻石350'; diamondGained = 350 }
          break
        case 3:
          if (rand < 0.45) { reward = '获得钻石270'; diamondGained = 270 }
          else if (rand < 0.75) { reward = '获得钻石499'; diamondGained = 499 }
          else { reward = '获得钻石888'; diamondGained = 888 }
      }
    }

    // 贪婪处理
    else if (finalType === '贪婪') {
      switch(counts.贪婪) {
        case 1: reward = '再抽一次'; break
        case 2: reward = '再抽一次'; break
        case 3: reward = '什么都没有'
      }
    }

    // 幸运奖励
    else if (finalType === '幸运') {
      switch(counts.幸运) {
        case 1:
          if (rand < 0.45) { reward = '获得自救卡'; extraItems.push('自救卡') }
          else if (rand < 0.75) { reward = '获得死亡免掉落卡'; extraItems.push('死亡免掉落卡') }
          else { reward = '获得二锅头'; extraItems.push('二锅头') }
          break
        case 2:
          if (rand < 0.45) { reward = '获得袖珍扭蛋：没偷吃'; extraItems.push('袖珍扭蛋') }
          else if (rand < 0.75) { reward = '获得魔法丝线x1'; extraItems.push('魔法丝线x1') }
          else { reward = '获得常驻武器抽奖券x3'; extraItems.push('常驻武器抽奖券x3') }
          break
        case 3:
          if (rand < 0.45) { reward = '获得魔法丝线x5'; extraItems.push('魔法丝线x5') }
          else if (rand < 0.75) {
            const items = ['电玩金章','电玩高手','电玩猫猫']
            reward = `获得${items[Math.floor(Math.random()*3)]}`
            extraItems.push(reward)
          }
          else { reward = '获得可约的香吻'; extraItems.push('可约的香吻') }
      }
    }

    // 更新最终货币
    await ctx.database.upsert('user_currency', [{
      userId: currency.userId,
      gold: currency.gold + goldGained,
      diamond: currency.diamond + diamondGained
    }], ['userId'])

    return { goldGained, diamondGained, extraItems, reward }
  }

  // 构建结果输出
  function buildOutput(result: any, slots: string[], isEarly = false) {
    return [
      '🎰━━ 贪婪宝箱 ━━🎰',
      `最终槽位：[${slots.join('][')}]`,
      isEarly ? '⚠ 提前结算 ⚠' : '✅ 抽奖完成 ✅',
      '━━━━━━━━━━━━',
      `🎁 获得奖励：${result.reward}`,
      ...(result.extraItems.length > 0 ? ['获得道具：' + result.extraItems.join(' ')] : []),
      '━━━━━━━━━━━━',
      `金币收入：💰${result.goldGained}`,
      `钻石变化：💎${result.diamondGained} (净收益: ${result.diamondGained - 30 * slots.length})`
    ].filter(Boolean).join('\n')
  }

  // 清除用户状态
  async function clearUserState(userId: string) {
    await ctx.database.remove('greedy_chest', { userId })
  }

  ctx.command('材料属性 <name>', '查询材料属性')
    .action(async ({ session }, name) => {
      const attrName = convertAttrName(ctx, name)
      // 使用转换后的属性名进行查询...
      const attributes = await ctx.database.get('material_attribute', { 
        attrName: attrName 
      })
      // ...返回查询结果
    })

  // 在MaterialEntry类型后添加装备类型定义
  type EquipmentType = '头盔' | '内甲' | '斗篷' | '腿甲' | '靴子' | '戒指' | '项链' | '手镯' | '手套'

  // 在apply函数中添加锻造指令
  ctx.command('锻造 <equipment> <materials:text>', '制作装备')
    .usage(`可用装备类型：
- 头盔：7碎块 5丝绳 6残骸 8布匹
- 内甲：8碎块 6丝绳 10残骸 9布匹
- 斗篷：7碎块 6丝绳 6残骸 10布匹
- 腿甲：8碎块 6丝绳 6残骸 6布匹
- 靴子：6碎块 6丝绳 6残骸 6布匹
- 戒指：1兽核 10碎块/残骸 8丝绳/布匹
- 项链：1兽核 7碎块/残骸 12丝绳/布匹
- 手镯：1兽核 10碎块/残骸 11丝绳/布匹
- 手套：1兽核 17碎块/残骸 9丝绳/布匹`)
    .example('锻造 头盔 菌丝3x2 丝绳4x1 ...')
    .action(async (_, equipment, materials) => {
      // 验证装备类型
      const validEquipments: EquipmentType[] = ['头盔','内甲','斗篷','腿甲','靴子','戒指','项链','手镯','手套']
      if (!validEquipments.includes(equipment as EquipmentType)) {
        return `无效装备类型，可用类型：${validEquipments.join(' ')}`
      }

      // 解析材料参数
      const materialEntries = await Promise.all(materials.split(/\s+/).map(async entry => {
        const match = entry.match(/^(.+?)(\d+)x(\d+)$/)
        if (!match) return null
        
        const [_, name, starStr, countStr] = match
        const star = parseInt(starStr)
        const count = parseInt(countStr)
        
        const [material] = await findMaterialByNameOrAlias(name)
        if (!material || material.type !== '材料') return null
        
        return { 
          material,
          star,
          count,
          slots: material.slots * count
        }
      })).then(list => list.filter(Boolean))

      // 材料分类统计
      let coreCount = 0
      const materialStats = {
        碎块: 0,
        兽核: 0,
        丝绳: 0,
        残骸: 0,
        布匹: 0
      }

      materialEntries.forEach(entry => {
        const type = entry.material.materialType
        if (type === '兽核') coreCount += entry.count
        if (materialStats.hasOwnProperty(type)) {
          materialStats[type] += entry.slots
        }
      })

      // 装备需求配置
      const requirements: Record<EquipmentType, { core: number, 碎块残骸: number, 丝绳布匹: number } | {
        碎块: number,
        丝绳: number,
        残骸: number,
        布匹: number
      }> = {
        '头盔': { 碎块:7, 丝绳:5, 残骸:6, 布匹:8 },
        '内甲': { 碎块:8, 丝绳:6, 残骸:10, 布匹:9 },
        '斗篷': { 碎块:7, 丝绳:6, 残骸:6, 布匹:10 },
        '腿甲': { 碎块:8, 丝绳:6, 残骸:6, 布匹:6 },
        '靴子': { 碎块:6, 丝绳:6, 残骸:6, 布匹:6 },
        '戒指': { core:1, 碎块残骸:10, 丝绳布匹:8 },
        '项链': { core:1, 碎块残骸:7, 丝绳布匹:12 },
        '手镯': { core:1, 碎块残骸:10, 丝绳布匹:11 },
        '手套': { core:1, 碎块残骸:17, 丝绳布匹:9 }
      }

      // 验证材料数量
      const req = requirements[equipment]
      let error = ''
      
      if ('core' in req) {
        // 处理通用格装备
        if (coreCount !== req.core) error += `需要${req.core}个兽核 `
        const 碎块残骸 = materialStats.碎块 + materialStats.残骸
        if (碎块残骸 !== req.碎块残骸) error += `碎块/残骸总格数需要${req.碎块残骸} `
        const 丝绳布匹 = materialStats.丝绳 + materialStats.布匹
        if (丝绳布匹 !== req.丝绳布匹) error += `丝绳/布匹总格数需要${req.丝绳布匹}`
      } else {
        // 处理固定类型装备
        if (materialStats.碎块 !== req.碎块) error += `碎块需要${req.碎块}格 `
        if (materialStats.丝绳 !== req.丝绳) error += `丝绳需要${req.丝绳}格 `
        if (materialStats.残骸 !== req.残骸) error += `残骸需要${req.残骸}格 `
        if (materialStats.布匹 !== req.布匹) error += `布匹需要${req.布匹}格`
      }

      if (error) return `材料不符合要求：${error.trim()}`

      // 计算属性总和
      const attributes = new Map<string, number>()
      for (const entry of materialEntries) {
        const attrs = await ctx.database.get('material_attribute', {
          materialId: entry.material.id,
          starLevel: entry.star
        })
        
        attrs.forEach(attr => {
          const total = (attr.attrValue * entry.count) || 0
          attributes.set(attr.attrName, (attributes.get(attr.attrName) || 0) + total)
        })
      }

      // 定义装备主属性映射
      const mainAttributes: Record<EquipmentType, string[]> = {
          '头盔': ['生命', '物抗', '法抗'],
          '内甲': ['生命', '物抗'],
          '斗篷': ['生命', '法抗'],
          '腿甲': ['生命', '体力'],
          '靴子': ['生命', '耐力'],
          '戒指': ['生命', '攻击'],
          '项链': ['生命', '法强'],
          '手镯': ['生命', '治疗'],
          '手套': ['生命', '攻击']
      }

      // 属性修正系数映射
      const correctionFactors: Record<string, number> = {
          '法强': 4,
          '攻击': 4,
          '治疗': 3,
          '生命': 0.1,
          '法暴': 5,
          '物暴': 5,
          '法暴伤': 2.5,
          '物暴伤': 2.5,
          '法穿': 2,
          '物穿': 2,
          '法抗': 3,
          '物抗': 3,
          '格挡': 2.5,
          '卸力': 5,
          '攻速': 5,
          '充能': 5,
          '移速': 5,
          '体力': 0.5,
          '耐力': 0.5,
          '嘲讽': 2
      }

      // 修改主属性计算逻辑
      const mainAttrResult = mainAttributes[equipment].reduce((acc, mainAttr) => {
          // 处理头盔特殊过滤规则
          let filteredAttributes = Array.from(attributes.entries());
          if (equipment === '头盔' && (mainAttr === '物抗' || mainAttr === '法抗')) {
              // 计算抗性时排除所有抗性属性
              filteredAttributes = filteredAttributes.filter(
                  ([name]) => !['物抗', '法抗', '生命'].includes(name)
              );
          } else {
              // 常规情况仅排除当前主属性
              filteredAttributes = filteredAttributes.filter(
                  ([name]) => !mainAttributes[equipment].includes(name)
              );
          }

          // 计算修正总和（使用实际材料属性值）
          const correctionSum = filteredAttributes.reduce((sum, [name, value]) => {
              return sum + (value * (correctionFactors[name] || 1));
          }, 0);

          // 获取原始主属性总和（当前主属性的实际材料值）
          const originalMain = Array.from(attributes.entries())
              .filter(([name]) => name === mainAttr)
              .reduce((sum, [, value]) => sum + value, 0);

          let finalValue = originalMain;

          if (mainAttr === '生命') {
              // 生命值 = 原始生命 + ∑(其他属性值×对应系数)
              finalValue += correctionSum;
          } else {
              // 其他属性 = 原始属性 + ∑(其他属性值×对应系数)/自身系数
              const factor = correctionFactors[mainAttr] || 1;
              finalValue += correctionSum / factor;
          }

          // 头盔抗性特殊处理：总值平分
          if (equipment === '头盔' && (mainAttr === '物抗' || mainAttr === '法抗')) {
              finalValue = finalValue / 2;
          }

          acc[mainAttr] = Number(finalValue.toFixed(1));
          return acc;
      }, {} as Record<string, number>);

      // 修改附加属性处理部分
      // 将属性按类型合并总值
      const attributeTypes = new Map<string, number>()
      for (const [name, value] of attributes.entries()) {
          attributeTypes.set(name, (attributeTypes.get(name) || 0) + value)
      }

      // 获取所有属性类型并随机选择
      const allTypes = Array.from(attributeTypes.keys())
      const selectCount = Math.min(Math.floor(Math.random() * 3) + 1, allTypes.length)
      const selectedTypes = allTypes.sort(() => Math.random() - 0.5).slice(0, selectCount)

      // 过滤与主属性重复的类型
      const validTypes = selectedTypes.filter(type => 
          !mainAttributes[equipment].includes(type)
      )

      // 根据有效类型数量应用乘数
      const multiplier = validTypes.length === 3 ? 0.8 : 
                        validTypes.length === 2 ? 1 : 
                        validTypes.length === 1 ? 1.3 : 0

      const finalAttributes = validTypes.map(type => ({
          name: type,
          value: Math.ceil((attributeTypes.get(type) || 0) * multiplier)
      })).filter(attr => attr.value > 0) // 过滤掉0值属性



      
      // 在finalAttributes定义后添加技能判定逻辑
      const skills: { name: string; level: number }[] = []

      // 获取所有带技能的材料（按ID升序）
      const skilledMaterials = materialEntries
        .filter(e => e.material.type === '材料')
        .sort((a, b) => a.material.id - b.material.id)

      // 新技能判定逻辑
      for (const entry of skilledMaterials) {
        if (skills.length >= 3) break
        
        try {
          console.log(`检测到材料：${entry.material.name} (${entry.star}星)`)
          const materialSkills = await ctx.database.get('material_skill', {
            materialId: entry.material.id
          })
          
          // 添加空值检查
          if (!materialSkills || materialSkills.length === 0) {
            console.log('├─ 无技能')
            continue
          }

          console.log(`├─ 包含技能：${materialSkills.map(s => s.skillName).join(', ')}`)

          // 修复概率数组越界问题
          const maxLevel = Math.min(entry.star, 5)
          const probability = [0.3, 0.25, 0.2, 0.15, 0.1].slice(0, maxLevel)
          let acquiredLevel = 0

          for (let level = probability.length; level >= 1; level--) {
            if (Math.random() < probability[level - 1]) {
              acquiredLevel = level
              break
            }
          }

          if (acquiredLevel > 0) {
            const randomIndex = Math.floor(Math.random() * materialSkills.length)
            const randomSkill = materialSkills[randomIndex]
            // 添加技能等级上限检查
            const finalLevel = Math.min(acquiredLevel, maxLevel)
            
            console.log(`└─ 获得技能：${randomSkill.skillName} Lv.${finalLevel} (概率:${probability[finalLevel-1]})`)
            skills.push({
              name: randomSkill.skillName,
              level: finalLevel
            })
          } else {
            console.log('└─ 未触发技能')
          }
        } catch (error) {
          console.error('技能处理出错：', error)
          // 跳过错误继续执行
        }
      }

      // 更新结果显示逻辑（将原来的output构建代码移动到这里）
      const output = [
        `🔨 成功锻造 ${equipment} 🔨`,
        '━━━━ 材料明细 ━━━━',
        ...materialEntries.map(e => 
            `${e.material.name} ${e.star}星x${e.count} (${e.material.materialType})`
        ),
        '\n━━━━ 主属性 ━━━━',
        ...Object.entries(mainAttrResult).map(([name, value]) => 
            `${name}: ${(value as number).toFixed(1)}`
        ),
        '\n━━━━ 附加属性 ━━━━',
        validTypes.length > 0 
            ? `随机选择 ${selectCount} 条属性，有效 ${validTypes.length} 条 x${multiplier}`
            : '无有效附加属性',
        ...finalAttributes.map(attr => 
            `${attr.name}: ${attr.value.toFixed(1)}`
        ),
        '\n━━━━ 装备技能 ━━━━',
        skills.length > 0 
            ? skills.map(s => `${s.name} Lv.${s.level}`).join('\n')
            : '未获得任何技能'
      ]

      return output.join('\n')
    })

  // 修改上传装备指令
  ctx.command('上传装备 <type> <materials:text>', '上传自定义装备')
    .userFields(['authority'])
    .action(async ({ session }, type: string, materials: string) => {
      // ==== 第一步：处理材料参数 ====
      const materialEntries = await parseMaterials(materials)
      if (!materialEntries) return '材料参数格式错误';

      // 保存材料到用户草稿
      (session.user as any).equipmentDraft = {
        type,
        materials: materialEntries
      }

      return [
        '📦 材料解析成功，请输入上传属性',
        '━━━━ 格式要求 ━━━━',
        '属性名称+主属性数值（用空格分隔多个属性）',
        '━━━━ 示例 ━━━━',
        '生命+1500 法强+200',
      ].join('\n')
    })

  // 新增属性输入指令
  ctx.command('上传属性 <...attrs:text>', '输入装备属性')
    .userFields(['equipmentDraft']) // 确保这里正确声明
    .action(async ({ session }, ...attrs: string[]) => {
      // ==== 第二步：处理属性参数 ====
      const draft = session.user.equipmentDraft
      if (!draft) return '请先使用"上传装备"指令开始创建'

      const mainAttributes = await parseAttributes(attrs.join(' '))
      if (typeof mainAttributes === 'string') return mainAttributes // 错误信息

      // 创建装备记录
      await ctx.database.create('equipment', {
        userId: session.userId,
        type: draft.type,
        materials: draft.materials.map(m => ({
          name: m.name,
          type: m.type,
          star: m.star,
          count: m.count
        })), // 只存储必要字段
        mainAttributes,
        createdAt: new Date()
      })

      // 清除草稿
      delete session.user.equipmentDraft
      return '装备上传成功！'
    })

  // 新增材料解析函数
  async function parseMaterials(input: string) {
    return Promise.all(input.split(/\s+/).map(async entry => {
      const match = entry.match(/^(.+?)(\d+)x(\d+)$/)
      if (!match) return null
      const [_, name, starStr, countStr] = match
      const star = parseInt(starStr)
      const count = parseInt(countStr)
      
      const [material] = await findMaterialByNameOrAlias(name)
      if (!material || material.type !== '材料') return null
      
      return { 
        name: material.name,          // 只保存名称
        type: material.materialType,  // 材料类型
        star,
        count
        // 移除 slots 字段
      }
    })).then(list => list.filter(Boolean))
  }

  // 新增属性解析函数
  async function parseAttributes(input: string) {
    const attrs = input.split(/\s+/)
      .map(entry => {
        const match = entry.match(/^([^+＋]+)[+＋](\d+)$/)
        return match ? [match[1].trim(), match[2]] : null
      })
      .filter(Boolean)
      .flat()

    if (attrs.length === 0) return '属性参数格式错误，请使用 属性+数值 格式'

    const mainAttributes: Record<string, number> = {}
    for (let i = 0; i < attrs.length; i += 2) {
      const rawName = attrs[i]
      const rawValue = attrs[i+1]
      
      const name = rawName.replace(/[^\u4e00-\u9fa5\s]/g, '').trim()
      const value = parseFloat(rawValue)
      
      if (!name || isNaN(value)) {
        return `无效属性格式：${rawName}+${rawValue}（示例：攻击+500）`
      }
      
      mainAttributes[name] = (mainAttributes[name] || 0) + value
    }

    return mainAttributes
  }

  // 处理属性输入
  ctx.middleware(async (session, next) => {
    const user = session.user as typeof session.user & { equipmentDraft?: any }
    if (user.equipmentDraft) {
      const attrs = session.content.split(/\s+/)
      if (attrs.length % 2 !== 0) return '属性输入格式不正确'

      const mainAttributes: Record<string, number> = {}
      for (let i = 0; i < attrs.length; i += 2) {
        const name = attrs[i]
        const value = parseFloat(attrs[i+1])
        if (isNaN(value)) return `无效数值：${attrs[i+1]}`
        mainAttributes[name] = value
      }

      // 使用类型断言访问equipmentDraft
      const draft = (session.user as any).equipmentDraft
      await ctx.database.create('equipment', {
        userId: session.userId,
        type: draft.type,
        materials: draft.materials.map(m => ({
          name: m.name,
          type: m.type,
          star: m.star,
          count: m.count
        })), // 只存储必要字段
        mainAttributes,
        createdAt: new Date()
      })

      delete user.equipmentDraft
      return '装备上传成功！'
    }
    return next()
  })

  // 新增查询装备指令
  ctx.command('查询装备 [type]', '查询装备')
    .option('page', '-p <page:number>', { fallback: 1 })
    .option('attribute', '-a <属性名>')
    .action(async ({ options }, type) => {
      // ==== 新增ID查询逻辑 ====
      if (type && !isNaN(Number(type))) {
        const id = Number(type)
        const [equipment] = await ctx.database.get('equipment', { id })
        if (!equipment) return '未找到该ID的装备'

        return [
          '🔍 装备详细信息',
          `ID: ${equipment.id}`,
          `类型: ${equipment.type}`,
          `主属性: ${Object.entries(equipment.mainAttributes).map(([k, v]) => `${k}+${v}`).join(' ')}`,
          `材料组成: ${equipment.materials.map(m => `${m.name}${m.star}星x${m.count}`).join(' ')}`,
          `上传时间: ${equipment.createdAt.toLocaleDateString('zh-CN')}`,
          '━━━━━━━━━━━━━━━━━━',
          '输入"查询装备 <类型/ID>"查看其他装备'
        ].join('\n')
      }

      // 原有查询逻辑保持不变...
      const filter: any = {}
      if (type) filter.type = type
      if (options.attribute) {
        // 使用配置映射转换属性名
        const attrName = convertAttrName(ctx, options.attribute)
        if (!attrName) return '无效属性名称'
        
        // 按数值降序排列
        const equipments = await ctx.database.get('equipment', {
          ...filter,
          [`mainAttributes.${attrName}`]: { $exists: true }
        }, {
          sort: { [`mainAttributes.${attrName}`]: 'desc' } // 新增排序
        })

        const pageSize = 5
        const totalPages = Math.ceil(equipments.length / pageSize)
        const page = Math.min(options.page || 1, totalPages)

        return [
          '🔍 装备查询结果',
          ...equipments
            .slice((page - 1) * pageSize, page * pageSize)
            .map(e => [
              `ID:${e.id} [${e.type}]`,
              `属性：${attrName}+${e.mainAttributes[attrName]}`,
              `材料：${e.materials.map(m => `${m.name}${m.star}星x${m.count}`).join(' ')}`,
              `上传时间：${e.createdAt.toLocaleDateString('zh-CN')}`
            ].join('\n')),
          `\n第 ${page}/${totalPages} 页`
        ].join('\n\n')
      }

      // 默认按上传时间降序
      const equipments = await ctx.database.get('equipment', filter, {
        sort: { createdAt: 'desc' }
      })
      const pageSize = 5
      const totalPages = Math.ceil(equipments.length / pageSize)
      const page = Math.min(options.page || 1, totalPages)

      return [
        '🔍 装备查询结果（按时间排序）',
        ...equipments
          .slice((page - 1) * pageSize, page * pageSize)
          .map(e => [
            `ID:${e.id} [${e.type}]`,
            `主属性：${Object.entries(e.mainAttributes).map(([k,v])=>`${k}+${v}`).join(' ')}`,
            `材料：${e.materials.map(m => `${m.name}${m.star}星x${m.count}`).join(' ')}`,
            `上传时间：${e.createdAt.toLocaleDateString('zh-CN')}`
          ].join('\n')),
        `\n第 ${page}/${totalPages} 页`
      ].join('\n\n')
    })

  // 新增注册命令
  ctx.command('注册 <nickname:string>', '注册用户昵称')
    .action(async ({ session }, nickname) => {
      // 检查昵称合法性
      if (!nickname || nickname.length > 12 || !/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(nickname)) {
        return '昵称需为1-12位中英文/数字组合'
      }

      // 检查是否已注册
      const existing = await ctx.database.get('user_profile', { userId: session.userId })
      if (existing.length) {
        return '您已注册过昵称'
      }

      // 检查昵称唯一性
      const nameTaken = await ctx.database.get('user_profile', { nickname })
      if (nameTaken.length) {
        return '该昵称已被使用'
      }

      // 创建记录
      await ctx.database.create('user_profile', {
        userId: session.userId,
        nickname,
        createdAt: new Date()
      })

      // 初始化用户货币（如果不存在）
      const [currency] = await ctx.database.get('user_currency', { userId: session.userId })
      if (!currency) {
        await ctx.database.create('user_currency', {
          userId: session.userId,
          love: 0,
          diamond: 0,
          gold: 0,
          crystal: 0,
          energy: 200
        })
      }

      return `注册成功！欢迎 ${nickname} 加入营火`
    })

  // 在 apply 函数中添加背包指令
  // 查看背包
  ctx.command('背包 [page:number]', '查看背包物品')
    .action(async ({ session }, page = 1) => {
      const userId = session.userId
      const [profile] = await ctx.database.get('user_profile', { userId })
      if (!profile) return handleRecallableMessage(session, '请先使用「注册」注册账号', ctx)

      // 获取背包物品
      const [inventory] = await ctx.database.get('user_inventory', { userId })
      if (!inventory || !inventory.items.length) {
        return handleRecallableMessage(session, '背包是空的', ctx)
      }

      // 获取物品详情
      const materials = await ctx.database.get('material', {
        id: [...new Set(inventory.items.map(i => i.materialId))]
      })

      // 分页处理
      const pageSize = 10
      const totalPages = Math.ceil(inventory.items.length / pageSize)
      page = Math.min(Math.max(1, page), totalPages)
      const start = (page - 1) * pageSize

      // 按类型分组显示
      const groupedItems = inventory.items.reduce((acc, item) => {
        const material = materials.find(m => m.id === item.materialId)
        if (!material) return acc
        
        const type = material.type
        if (!acc[type]) acc[type] = []
        
        acc[type].push({
          material,
          starLevel: item.starLevel,
          quantity: item.quantity
        })
        return acc
      }, {} as Record<string, any[]>)

      const output = [
        `🎒 ${profile.nickname} 的背包`,
        '━━━━━━━━━━━━━━'
      ]

      // 按类型显示物品
      for (const [type, items] of Object.entries(groupedItems)) {
        output.push(`\n【${type}】`)
        items.slice(start, start + pageSize).forEach(item => {
          const starInfo = item.starLevel ? `⭐${item.starLevel} ` : ''
          output.push(`${item.material.name} ${starInfo}x${item.quantity}`)
        })
      }

      output.push(
        '\n━━━━━━━━━━━━━━',
        `第 ${page}/${totalPages} 页`
      )

      return handleRecallableMessage(session, output.join('\n'), ctx)
    })

  // 在 apply 函数中添加岛屿指令
  ctx.command('岛屿列表', '查看当前可登岛屿')
    .action(async ({ session }) => {
      const islands = await ctx.database.get('island', {})
      if (!islands.length) return '当前没有可用的岛屿'

      const now = new Date()
      const output = ['🏝️ 当前可用岛屿']

      for (const island of islands) {
        // 获取岛上玩家昵称
        const profiles = await ctx.database.get('user_profile', {
          userId: { $in: island.players }
        })
        const playerNames = profiles.map(p => p.nickname).join('、')

        const remainingTime = Math.max(0, Math.floor((island.expiresAt.getTime() - now.getTime()) / 60000))
        output.push(
          `\n━━━━ ${island.id} ━━━━`,
          `剩余时间：${remainingTime}分钟`,
          `当前人数：${island.players.length}/${ctx.config.island.maxPlayers}人`,
          playerNames ? `在岛玩家：${playerNames}` : '暂无玩家'
        )
      }

      return handleRecallableMessage(session, output.join('\n'), ctx)
    })

  ctx.command('上岛 <islandId>', '登入指定岛屿')
    .action(async ({ session }, islandId) => {
        const userId = session.userId

        // 检查是否有未查看的结算
        const [settlement] = await ctx.database.get('island_settlement', { userId })
        if (settlement) {
            const output = await formatSettlement(ctx, settlement)
            await ctx.database.remove('island_settlement', { userId })
            return handleRecallableMessage(session, output, ctx)
        }

        // 检查是否已在岛上
        const [status] = await ctx.database.get('user_island_status', { userId })
        if (status) {
            const [action] = await ctx.database.get('action', { name: status.currentAction })
            return `您已在岛屿${status.islandId}上\n当前：${status.currentAction}\n输入"下岛"可以离开`
        }

        // 检查岛屿是否存在
        const [island] = await ctx.database.get('island', { id: islandId })
        if (!island) return '指定岛屿不存在'

        // 检查岛屿是否已满
        if (island.players.length >= ctx.config.island.maxPlayers) {
            return '该岛屿人数已满'
        }

        // 检查精力是否足够
        const [currency] = await ctx.database.get('user_currency', { userId })
        if (!currency || currency.energy < ctx.config.island.entryCost) {
            return `精力不足，需要${ctx.config.island.entryCost}点（当前：${currency?.energy || 0}点）`
        }

        try {
            // 开启事务
            await ctx.database.transact(async () => {
                // 扣除精力
                await ctx.database.set('user_currency', { userId }, {
                    energy: currency.energy - ctx.config.island.entryCost
                })

                // 更新岛屿玩家列表
                await ctx.database.set('island', { id: islandId }, {
                    players: [...island.players, userId]
                })

                // 初始化玩家状态
                await ctx.database.create('user_island_status', {
                    userId,
                    islandId,
                    currentAction: '',
                    lastActionTime: new Date(),
                    remainingActions: 0,
                    actionHistory: []
                })
            })

            // 启动自动执行
            startAutoAction(ctx, userId)

            return '成功登岛！'
        } catch (err) {
            console.error('上岛失败:', err)
            return '上岛失败，请稍后重试'
        }
    })

  // 添加自动执行函数
  async function startAutoAction(ctx: Context, userId: string) {
    const interval = ctx.config.island.actionInterval * 60000

    const timer = setInterval(async () => {
        try {
            // 检查玩家是否还在岛上
            const [status] = await ctx.database.get('user_island_status', { userId })
            if (!status) {
                clearInterval(timer)
                return
            }

            // 获取所有可用动作
            const actions = await ctx.database.get('action', {})
            if (!actions.length) {
                clearInterval(timer)
                return
            }

            // 随机选择一个动作
            const action = actions[Math.floor(Math.random() * actions.length)]

            // 获取用户精力
            const [currency] = await ctx.database.get('user_currency', { userId })
            if (!currency) {
                clearInterval(timer)
                return
            }

            // 判断精力是否足够
            if (currency.energy >= action.cost) {
                // 扣除精力
                await ctx.database.set('user_currency', { userId }, {
                    energy: currency.energy - action.cost
                })

                // 执行动作并获得奖励
                const rewards = []
                for (let i = 0; i < action.rewards.times; i++) {
                    const reward = drawReward(action.rewards.pool)
                    if (reward) {
                        const [material] = await ctx.database.get('material', { name: reward.item })
                        if (material) {
                            await updateInventory(ctx, userId, material, reward.starLevel)
                            rewards.push({
                                item: reward.item,
                                quantity: 1
                            })
                        }
                    }
                }

                // 合并相同物品的数量
                const mergedRewards = rewards.reduce((acc, curr) => {
                    const existing = acc.find(r => r.item === curr.item)
                    if (existing) {
                        existing.quantity += curr.quantity
                    } else {
                        acc.push({ ...curr })
                    }
                    return acc
                }, [] as { item: string, quantity: number }[])

                // 更新玩家状态和动作历史
                const actionHistory = Array.isArray(status.actionHistory) ? status.actionHistory : []
                actionHistory.push({
                    name: action.name,
                    rewards: mergedRewards
                })

                await ctx.database.set('user_island_status', { userId }, {
                    currentAction: action.name,
                    lastActionTime: new Date(),
                    actionHistory
                })

                // 发送动作执行通知
                if (rewards.length > 0) {
                    const message = `执行动作"${action.name}"\n获得:${rewards.map(r => r.item).join('、')}`
                    await handleRecallableMessage(ctx.bots[0].session(), message, ctx)
                }
            }

        } catch (err) {
            console.error('自动执行动作失败:', err)
            clearInterval(timer)
        }
    }, interval)
  }

  

  ctx.command('下岛', '提前离开当前岛屿')
    .action(async ({ session }) => {
        const userId = session.userId

        const [status] = await ctx.database.get('user_island_status', { userId })
        if (!status) return '您不在任何岛屿上'

        // 处理离岛并等待结果
        const hasSettlement = await handlePlayerLeave(ctx, userId)

        if (hasSettlement) {
            // 获取并显示结算记录
            const [settlement] = await ctx.database.get('island_settlement', { userId })
            if (settlement) {
                const output = await formatSettlement(ctx, settlement)
                await ctx.database.remove('island_settlement', { userId })
                return handleRecallableMessage(session, output, ctx)
            }
        }

        return '已离开岛屿'
    })

  
}
                                                                                                                                                                                                                                                                                                                                                                                                              
// 新增属性名称转换映射
const attrNameMap: Record<string, string> = {
  '法强': 'faqiang',
  '攻击': 'gongji',
  '治疗': 'zhiliao',
  '生命': 'shengming',
  '法暴': 'fabao',
  '物暴': 'wubao',
  '法暴伤': 'fabao',
  '物暴伤': 'wubaoshang',
  '法穿': 'fachuan',
  '物穿': 'wuchuan',
  '法抗': 'fakang',
  '物抗': 'wukang',
  '格挡': 'gedang',
  '卸力': 'xieli',
  '攻速': 'gongsu',
  '充能': 'chongneng',
  '移速': 'yisu',
  '体力': 'tili',
  '耐力': 'naili',
  '嘲讽': 'chaofeng'
  // 其他属性继续添加...
}

  // 在插件apply函数中声明依赖
  export const using = ['puppeteer'] as const

  // 在插件声明部分修改服务依赖
  export const inject = ['puppeteer']

  // ========== 抽卡核心逻辑 ==========
  async function performGacha(
    ctx: Context, 
    userId: string, 
    isMiniPull = false,
    parentGachaType?: '探险热潮' | '动物派对' | '沙滩派对'
  ) {
    // 获取或初始化抽卡记录
    let [record] = await ctx.database.get('gacha_records', { userId })
    if (!record) {
      record = {
        userId,
        totalPulls: 0,
        pityCounter: {
          探险热潮: 0,
          动物派对: 0,
          沙滩派对: 0
        }
      }
      await ctx.database.create('gacha_records', record)
    }

    // 调整gachaType生成逻辑
    let gachaType: '探险热潮' | '动物派对' | '沙滩派对'
    if (parentGachaType) {
      gachaType = parentGachaType // 继承父级类型
        } else {
      const typeRand = Math.random()
      if (typeRand < 0.5) {
        gachaType = '探险热潮'
      } else if (typeRand < 0.85) {
        gachaType = '动物派对'
      } else {
        gachaType = '沙滩派对'
      }
    }

    // 袖珍池子不更新保底计数器
    if (!isMiniPull) {
      // 更新对应类型的保底计数器
      let newCounter = record.pityCounter[gachaType]
      newCounter = (record.pityCounter[gachaType] + 1) % 40
      await ctx.database.set('gacha_records', { userId }, {
        totalPulls: record.totalPulls + 1,
        [`pityCounter.${gachaType}`]: newCounter
      })
    }

    // 保底判断（仅在普通池子生效）
    let newCounter = record.pityCounter[gachaType]
    if (!isMiniPull) {
      newCounter = (record.pityCounter[gachaType] + 1) % 40
      await ctx.database.set('gacha_records', { userId }, {
        totalPulls: record.totalPulls + 1,
        [`pityCounter.${gachaType}`]: newCounter
      })
    }
    const isPity = !isMiniPull && newCounter === 0

    // 概率计算
    let rankPool: string
    if (isPity) {
      rankPool = Math.random() < 0.7 ? 'A' : 'S'
    } else {
      // 通用概率（普通池和袖珍池共用）
      const rand = Math.random() * 100
      if (isMiniPull) {
        // 袖珍彩蛋池概率
        if (rand < 0.5) {
          rankPool = 'S'
        } else if (rand < 4.5) {
          rankPool = 'A'
        } else if (rand < 14.5) {
          rankPool = 'B'
        } else if (rand < 44.5) {
          rankPool = 'C'
        } else {
          rankPool = 'D'
        }
      } else {
        // 普通池概率
        if (rand < 0.5) { // S 0.5%
          rankPool = 'S'
        } else if (rand < 5.5) { // A 5%
          rankPool = 'A'
        } else if (rand < 15.5) { // B 10%
          rankPool = 'B'
        } else if (rand < 45.5) { // C 30%
          rankPool = 'C'
        } else {
          // 普通池49.5% D + 5%袖珍彩蛋
          if (rand < 95) { // D 49.5%
            rankPool = 'D'
          } else { // 袖珍彩蛋 5%
            const extra = await performGacha(
              ctx, 
      userId,
              true,  // isMiniPull
              gachaType  // 传递当前扭蛋类型
            )
            return { 
              item: null, 
              rank: '彩蛋',
              gachaType,
              isPity: false,
              isMini: true,
              extra 
            }
          }
        }
      }
    }

    // 查询对应物品
    const items = await ctx.database.get('material', {
      type: '时装',
      materialType: rankPool,
      grade: { 
        '探险热潮': 1,
        '动物派对': 2,
        '沙滩派对': 3 
      }[gachaType],
      slots: isMiniPull ? 1 : { $ne: 1 }
    })

    // 随机选择一件
    const randomItem = items[Math.floor(Math.random() * items.length)]

    // 添加返回结构
    return {
      item: randomItem,
      rank: rankPool,
      gachaType,
      isPity,
      isMini: isMiniPull
    }
  }



  // 在formatAttributeList函数后添加正确的属性转换函数
  function convertAttrName(ctx: Context, name: string): string | null {
    // 统一全角字符处理
    const normalize = (str: string) => 
      str.replace(/[\uff01-\uff5e]/g, ch => 
        String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
      ).replace(/\s+/g, '')

    const normalizedInput = normalize(name)
    
    // 优先精确匹配
    const exactMatch = Object.keys(ctx.config.attrNameMappings)
      .find(k => normalize(k) === normalizedInput)
    
    return exactMatch || null
  }

  // formatTypeList函数
  async function formatTypeList(materials: MaterialEntry[], type: string, page = 1) {
    const pageSize = 10
    const totalPages = Math.ceil(materials.length / pageSize)
    page = Math.min(page, totalPages)

    // 扭蛋池映射
    const gachaPoolMap = {
      1: '探险热潮',
      2: '动物派对', 
      3: '沙滩派对'
    }
      // 按ID排序后分页
      const sortedMaterials = materials.sort((a, b) => a.id - b.id)
      const pageData = sortedMaterials.slice((page - 1) * pageSize, page * pageSize)

    const output = [
      `📚 ${type}类物品列表`,
      ...pageData.map((m, index) => {
        // 计算当前页的序号（从1开始）
        const displayId = (page - 1) * pageSize + index + 1
        let info = `${displayId}. ${m.name}`
        
        switch(type) {
          case '食材':
            info += `｜饱食+${m.satiety||0} ｜水分+${m.moisture||0}`
            break
          case '时装':
            info += `｜扭蛋：${gachaPoolMap[m.grade] || '未知'}`
            break
          case '杂物':
            // 仅保留名称
            break
          case '英灵':
            info += `｜${m.description?.slice(0, 20)}...` 
            break
          default: // 材料保持原有
            info += `｜类型：${m.materialType}`
            if (m.grade > 0) info += `｜阶级：${m.grade}阶`
            info += `｜格子：${m.slots}格`
        }
        
        return info
      }),
      `\n第 ${page}/${totalPages} 页，输入"图鉴 ${type} -p 页码"查看其他页`
    ]

    return output.join('\n')
  }

  // 阶数格式化函数
  async function formatGradeList(materials: MaterialEntry[], grade: number, page = 1) {
    
    const pageSize = 10
    const totalPages = Math.ceil(materials.length / pageSize)
    page = Math.min(page, totalPages)

    const output = [
      `📚 ${grade}阶材料列表`,
      ...materials
        .sort((a, b) => a.id - b.id)
        .slice((page - 1) * pageSize, page * pageSize)
        .map(m => `${m.name}｜${m.materialType}｜${m.slots}格`),
      `\n第 ${page}/${totalPages} 页，输入"图鉴 ${grade}阶 -p 页码"查看其他页`
    ]

    return output.join('\n')
  }

  // 新增星级属性格式化函数
  async function formatStarAttributeList(
    
    materials: MaterialWithAttributes[], 
    attrName: string,
    star: number,
    page = 1
  ) {
    const pageSize = 10
    const totalPages = Math.ceil(materials.length / pageSize)
    page = Math.min(page, totalPages)

    const output = [
      `⭐${star}星【${attrName}】属性排行`,
      ...materials
        .slice((page - 1) * pageSize, page * pageSize)
        .map(m => {
          const attrValue = m.attributes[0]?.attrValue || 0
          const perSlot = (attrValue / m.slots).toFixed(1)
          return `${m.name}｜${m.materialType}｜单格值:${perSlot}｜总值:${attrValue}`
        }),
      `\n第 ${page}/${totalPages} 页，输入"图鉴 ${attrName} ${star}星 -p 页码"查看其他页`
    ]

    return output.join('\n')
  }

  // 补充格式化函数
  async function formatMaterialTypeList(materials: MaterialEntry[], type: string, page = 1) {
    const pageSize = 10
    const totalPages = Math.ceil(materials.length / pageSize)
    page = Math.min(page, totalPages)

    const output = [
      `📚 ${type}类材料列表`,
      ...materials
        .sort((a, b) => a.id - b.id)
        .slice((page - 1) * pageSize, page * pageSize)
        .map(m => `${m.name}｜${m.grade}阶｜${m.slots}格`),
      `\n第 ${page}/${totalPages} 页，输入"图鉴 ${type} -p 页码"查看其他页`
    ]

    return output.join('\n')
  }

  // 新增日期格式化函数（在文件底部添加）
  function formatDateCN(date: Date): string {
    const cnDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    return `${cnDate.getUTCFullYear()}年${
      (cnDate.getUTCMonth() + 1).toString().padStart(2, '0')}月${
      cnDate.getUTCDate().toString().padStart(2, '0')}日`
  }

  // 在FortuneEntry接口后添加EquipmentEntry接口定义
  interface EquipmentEntry {
    id: number
    userId: string
    type: string
    materials: any[]
    mainAttributes: Record<string, number>
    createdAt: Date
  }

  // 修改消息撤回处理函数
  async function handleRecallableMessage(session: Session, content: any, ctx: Context) {
    const messages = await session.send(content)
    const message = Array.isArray(messages) ? messages[0] : messages
    
    // 检查配置并添加撤回
    if (ctx.config.messageRecall?.enable && message) {
      setTimeout(async () => {
        try {
          await session.bot.deleteMessage(session.channelId, message)
          console.log(`[Recall] 消息已撤回 ID: ${message}`)
        } catch (err) {
          console.error('[Recall Error] 撤回失败:', err)
        }
      }, (ctx.config.messageRecall.recallTime || 30) * 1000)
    }

    return
  }
  // 在文件末尾添加岛屿相关函数
  async function initializeActions(ctx: Context) {
    // 分别查询材料和食材
    const materials = await ctx.database.get('material', { type: '材料' })
    const foods = await ctx.database.get('material', { type: '食材' })
    const items = await ctx.database.get('material', { type: '杂物' })

    const allMaterials = [...materials, ...foods, ...items]

    const defaultActions = [
      {
        name: '采集椰果',
        cost: 5,
        rewards: {
          times: 3,
          pool: [
            { item: '椰子', weight: 40 },
            { item: '香蕉', weight: 30 },
            { item: '浆果', weight: 20 }
          ].filter(reward => 
            allMaterials.some(m => m.name === reward.item)
          )
        }
      },
      {
        name: '深海垂钓',
        cost: 8,
        rewards: {
          times: 3,
          pool: [
            { item: '风化手骨', starLevel: 1, weight: 45 },
            { item: '风化肋骨', starLevel: 1, weight: 15 }
          ].filter(reward => 
            allMaterials.some(m => m.name === reward.item)
          )
        }
      }
    ]

    // 过滤掉奖励池为空的动作
    const validActions = defaultActions.filter(
      action => action.rewards.pool.length > 0
    )

    // 写入数据库
    for (const action of validActions) {
      await ctx.database.upsert('action', [action], ['name'])
    }
  }

  function startIslandSpawner(ctx: Context) {
    const config = ctx.config.island

    // 定时生成岛屿
    setInterval(async () => {
      try {
        // 获取当前岛屿数量
        const islands = await ctx.database.get('island', {})
        if (islands.length >= config.maxIslands) return

        // 生成新岛屿
        const now = new Date()
        const island = {
          id: `IS-${Date.now()}`,
          createdAt: now,
          expiresAt: new Date(now.getTime() + config.islandLifespan * 60000),
          players: []
        }

        await ctx.database.create('island', island)

        // 设置销毁定时器
        setTimeout(async () => {
          await handleIslandExpiry(ctx, island.id)
        }, config.islandLifespan * 60000)

      } catch (err) {
        console.error('岛屿生成失败:', err)
      }
    }, config.spawnInterval * 60000)
  }

  // 处理岛屿到期
  async function handleIslandExpiry(ctx: Context, islandId: string) {
    try {
      // 获取岛上所有玩家
      const [island] = await ctx.database.get('island', { id: islandId })
      if (!island) return

      // 处理每个玩家的离岛
      for (const userId of island.players) {
        await handlePlayerLeave(ctx, userId)
      }

      // 删除岛屿
      await ctx.database.remove('island', { id: islandId })

    } catch (err) {
      console.error('岛屿销毁失败:', err)
    }
  }

  // 处理玩家离岛
  async function handlePlayerLeave(ctx: Context, userId: string) {
    try {
        const [status] = await ctx.database.get('user_island_status', { userId })
        if (!status) return

        const actionHistory = await getPlayerActions(ctx, userId, status.islandId)
        
        if (actionHistory.length > 0) {
            // 创建结算记录
            await ctx.database.create('island_settlement', {
                userId,
                islandId: status.islandId,
                actionHistory,
                settledAt: new Date()
            })

            // 清除状态
            await ctx.database.remove('user_island_status', { userId })

            // 从岛屿移除玩家
            const [island] = await ctx.database.get('island', { id: status.islandId })
            if (island) {
                await ctx.database.set('island', { id: status.islandId }, {
                    players: island.players.filter(id => id !== userId)
                })
            }

            // 返回 true 表示有结算记录
            return true
        }

        // 没有动作记录，直接清理状态
        await ctx.database.remove('user_island_status', { userId })
        return false

    } catch (err) {
        console.error('玩家离岛失败:', err)
        return false
    }
  }

  // 添加获取玩家动作记录函数
  async function getPlayerActions(ctx: Context, userId: string, islandId: string) {
    const [status] = await ctx.database.get('user_island_status', { userId })
    if (!status) return []

    const actionHistory = Array.isArray(status.actionHistory) ? status.actionHistory : []
    
    // 按动作名称分组统计
    const actionStats = new Map<string, {
        name: string,
        times: number,
        rewards: { item: string, quantity: number }[]
    }>()

    // 处理动作历史
    for (const record of actionHistory) {
        if (!record || !record.name || !Array.isArray(record.rewards)) continue

        const stats = actionStats.get(record.name) || {
            name: record.name,
            times: 0,
            rewards: []
        }
        
        stats.times++
        
        // 合并奖励
        for (const reward of record.rewards) {
            if (!reward || !reward.item) continue
            const existing = stats.rewards.find(r => r.item === reward.item)
            if (existing) {
                existing.quantity += (reward.quantity || 1)
            } else {
                stats.rewards.push({ 
                    item: reward.item, 
                    quantity: reward.quantity || 1 
                })
            }
        }
        
        actionStats.set(record.name, stats)
    }

    // 返回正确的结构
    return Array.from(actionStats.values())
  }

  // 修改结算格式化函数
  async function formatSettlement(ctx: Context, settlement: IslandSettlement) {
    const output = [
        '🏝️ 岛屿探索结算',
        `岛屿ID：${settlement.islandId}`,
        '━━━━━━━━━━━━'
    ]

    let totalItems = 0
    for (const action of settlement.actionHistory) {  // 改用 actionHistory
        output.push(
            `\n【${action.name}】`,
            '获得物品：'
        )
        
        // 按物品类型分类显示
        const itemsByType = new Map<string, { name: string, quantity: number }[]>()
        
        for (const reward of action.rewards) {
            // 查询物品类型
            const [material] = await ctx.database.get('material', { name: reward.item })
            if (!material) continue
            
            if (!itemsByType.has(material.type)) {
                itemsByType.set(material.type, [])
            }
            itemsByType.get(material.type).push({
                name: reward.item,
                quantity: reward.quantity
            })
            totalItems += reward.quantity
        }

        // 按类型输出
        for (const [type, items] of itemsByType.entries()) {
            output.push(`${type}：${items.map(i => `${i.name}x${i.quantity}`).join('、')}`)
        }
    }

    output.push(
        '\n━━━━━━━━━━━━',
        `共获得 ${totalItems} 个物品`,
        '物品已放入背包'
    )

    return output.join('\n')
  }

  // 添加奖励抽取函数
  function drawReward(pool: Action['rewards']['pool']) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0)
    const roll = Math.random() * 100
    
    let accumWeight = 0
    for (const entry of pool) {
      accumWeight += entry.weight
      if (roll < accumWeight) {
        return entry  // 返回完整的奖励对象，包含 item 和 starLevel
      }
    }
    
    return null
  }

  // 修改背包更新函数
  async function updateInventory(ctx: Context, userId: string, material: MaterialEntry, starLevel?: number) {
    // 获取用户昵称
    const [profile] = await ctx.database.get('user_profile', { userId })
    if (!profile) return

    // 获取或创建背包
    let [inventory] = await ctx.database.get('user_inventory', { userId })
    if (!inventory) {
      inventory = {
        userId,
        nickname: profile.nickname,
        items: [],
        updatedAt: new Date()
      }
    }

    // 查找物品
    const itemIndex = inventory.items.findIndex(item => 
      item.materialId === material.id && 
      (material.type === '材料' ? item.starLevel === starLevel : true)
    )

    if (itemIndex >= 0) {
      // 更新数量
      inventory.items[itemIndex].quantity++
    } else {
      // 添加新物品
      inventory.items.push({
        materialId: material.id,
        name: material.name,
        type: material.type,
        starLevel: material.type === '材料' ? starLevel : undefined,
        quantity: 1
      })
    }

    // 更新背包
    await ctx.database.upsert('user_inventory', [{
      ...inventory,
      updatedAt: new Date()
    }], ['userId'])
  }



