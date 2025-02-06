import { Context, h, Schema } from 'koishi'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

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
  }
}

interface MaterialEntry {
  id: number
  name: string
  type: '材料' | '食材' | '杂物'
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

interface MaterialAttribute {
  id: number
  materialId: number
  starLevel: number
  attrName: string
  attrValue: number
}

// ================== 插件配置 ==================
export interface Config {}

export const Config: Schema<Config> = Schema.object({})

// ================== 插件主体 ==================
export function apply(ctx: Context) {
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
    // ========== 查询价格指令 ==========
  ctx.command('查询价格 <name:string>', '查询物品价格信息')
    .action(async (_, name) => {
      if (!name) return '请输入物品名称'

      // 查询物品时只获取需要的字段
      const [item] = await ctx.database.get('material', { name: [name] }, [
        'name', 'image', 'merit', 'price'
      ] as const)
      if (!item) return '未找到该物品'

      const output = []
      // 生成图片输出：将物品图片文件路径转换为 URL 后通过 h.image 显示
      const imagePath = resolve(__dirname, item.image)
      output.push(h.image(pathToFileURL(imagePath).href))

      // 拼接文字信息：物品名称、所需功勋（如果有）、参考价格
      let info = `物品名称：${item.name}`
      if (item.merit !== undefined && item.merit !== null) {
        info += `\n所需功勋：${item.merit}`
      }
      info += `\n参考价格：${item.price || '暂无'}`
      output.push(info)

      return output.join('\n')
    })
  // ========== 修改后的图鉴查询 ==========
  ctx.command('图鉴 <name>', '查询物品图鉴')
    .action(async (_, name) => {
      if (!name) return '请输入要查询的物品名称'
      
      const [item] = await ctx.database.get('material', { name: [name] }, [
        'id', 'name', 'type', 'materialType','grade', 'slots', 'description', 'image',
        'merit', 'price', 'satiety', 'moisture'
      ] as const) 

      if (!item) return '未找到该物品'

      const output = []
      const imagePath = resolve(__dirname, item.image)
      output.push(h.image(pathToFileURL(imagePath).href))

      let info = `【物品信息】\n名称：${item.name}`
      if (item.grade && item.grade > 0) {
        info += `\n材料阶级：${item.grade}阶`
      }

      if (item.slots && item.slots > 0) {
        info += `\n占用格子：${item.slots}格`
      }
      
      // 只有材料类型显示全星级属性
    if (item.type === '材料') {
    // 查询所有星级的属性（1-5星）
    const attributes = await ctx.database.get('material_attribute', { 
      materialId: item.id,
      starLevel: { $gte: 1, $lte: 5 } // 查询1-5星数据
    })

    // 按星级分组
    const starMap = attributes.reduce((map, attr) => {
      const star = attr.starLevel
      if (!map.has(star)) map.set(star, [])
      map.get(star).push(attr)
      return map
    }, new Map<number, MaterialAttribute[]>())

    // 生成星级属性显示
    const starOutput = []
    for (let star = 1; star <= 5; star++) {
      starOutput.push(`\n⭐ ${star}星属性：`)
      const attrs = starMap.get(star)
      if (attrs?.length) {
        attrs.forEach(attr => {
          starOutput.push(`▸ ${attr.attrName}: ${attr.attrValue}`)
        })
      } else {
        starOutput.push('（暂无属性数据）')
      }
    }
    
    output.push('\n【全星级属性】' + starOutput.join('\n'))
    }
      // 食材特殊字段
      if (item.type === '食材') {
        info += `\n饱食度：${item.satiety || 0}\n水分：${item.moisture || 0}`
      }

      info += `\n描述：${item.description}`
      output.push(info)

      

      return output.join('\n')
    })

  // ========== 材料创建指令 ==========
  ctx.command('材料图鉴')
    .subcommand('.create <name:string> <type:string> <materialType:string> <grade:number> <slots:number> <description:text> <image:string>', '创建新材料', {
      authority: 2,
    })
    .action(async (_, name, type, materialType, grade, slots, description, image) => {
      // 强制类型校验
      const validTypes = ['材料', '食材', '杂物'] as const
      if (!validTypes.includes(type as typeof validTypes[number])) {
        return `类型必须为：${validTypes.join('/')}`
      }

      // 转换为正确类型
      const MType = type as '材料' | '食材' | '杂物'

      
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
  .subcommand('.materialExtend <name:string> <...attrs:string>',  {
    authority: 5
  })
  .usage('参数：材料名称 属性1 属性2 ...')
  .example('材料图鉴.materialExtend 菌丝 法强 体力 耐力')
  .action(async (_, name, ...attrs) => {
    // ==== 参数验证 ====
    // 获取材料信息
    const [material] = await ctx.database.get('material', { name: [name] })
    if (!material) return `材料 ${name} 不存在`
    if (material.type !== '材料') return `该物品类型为 ${material.type}，仅支持材料类型`

    // 检查参数
    if (attrs.length === 0) return '至少需要一个属性'
    if (new Set(attrs).size !== attrs.length) return '存在重复的属性'

    // ==== 生成属性 ====
    const entries = []
    for (let starLevel = 1; starLevel <= 5; starLevel+=1) {
      attrs.forEach(attrName => {
        entries.push({
          materialId: material.id,
          starLevel,
          attrName,
          attrValue: 0 
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

    // ==== 输出信息 ====
    const output = [
      `成功为 ${name}(${material.id}) 创建属性模板：`,
      `共生成 ${entries.length} 条属性模板`
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

  // ========== 模拟精工锭指令 ==========
  ctx.command('模拟精工锭 <stars:number> <materials:text>', '模拟精工锭合成')
  .usage('格式：模拟精工锭 星级 材料1x数量 材料2x数量 ...')
  .example('模拟精工锭 5 兽核x1 精铁矿x3 星尘x2')
  .action(async (_, stars, materials) => {
    // ==== 材料参数解析 ====
    const materialEntries = materials.split(/\s+/)
      .map(entry => {
        const match = entry.match(/^(.+?)x(\d+)$/)
        if (!match) return null
        return {
          name: match[1].trim(),
          count: parseInt(match[2]),
          original: match[0]
        }
      })
      .filter(Boolean)
  
    // ==== 基础参数校验 ====
    if (materialEntries.length < 2) {
      return '至少需要两个材料进行合成，格式：材料名x数量'
    }
  
    // ==== 材料数据查询 ====
    const materialsData = await ctx.database.get('material', { 
      name: materialEntries.map(m => m.name) 
    })
  
    // ==== 材料存在性检查 ====
    const missingList = materialEntries
      .filter(entry => !materialsData.some(data => data.name === entry.name))
      .map(entry => entry.original)
  
    if (missingList.length > 0) {
      return `以下材料不存在：${missingList.join(', ')}`
    }
  
    // ==== 新增：检查材料是否有所需星级的属性 ====
    const attributes = await ctx.database
      .select('material_attribute')
      .where({
        materialId: materialsData.map(m => m.id),
        starLevel: stars // 直接使用传入的 stars 参数
      })
      .execute()
  
    // 检查是否有材料缺少该星级属性
    const missingStarMaterials = materialsData.filter(material => 
      !attributes.some(attr => attr.materialId === material.id)
    )
    
    if (missingStarMaterials.length > 0) {
      return `以下材料缺少 ${stars} 星级属性：${
        missingStarMaterials.map(m => m.name).join(', ')
      }`
    }
  
    // ==== 阶级一致性检查 ====
    const firstGrade = materialsData[0].grade
    const invalidTier = materialsData.some(data => data.grade !== firstGrade)
    if (invalidTier) {
      const tierList = [...new Set(materialsData.map(m => m.grade))]
      return `材料阶级不一致，存在以下阶级：${tierList.join(', ')}`
    }
  
    // ==== 兽核存在检查 ====
    const hasCore = materialsData.some(data => data.materialType === '兽核')
    if (!hasCore) {
      return '合成必须包含兽核材料'
    }
  
    // ==== 格子总数计算 ====
    let totalSlots = 0
    for (const entry of materialEntries) {
      const material = materialsData.find(m => m.name === entry.name)
      totalSlots += material.slots * entry.count
    }
    
    if (totalSlots !== 15) {
      return `材料总格子数应为15，当前为${totalSlots}`
    }
  
    // ==== 属性计算（根据材料数量加权）====
    const attributeMap = new Map<string, number>()
    for (const attr of attributes) {
      const materialEntry = materialEntries.find(
        entry => entry.name === materialsData.find(m => m.id === attr.materialId)?.name
      )
      const contribution = attr.attrValue * (materialEntry?.count || 1)
      const current = attributeMap.get(attr.attrName) || 0
      attributeMap.set(attr.attrName, current + contribution)
    }
  
    // ==== 随机选择属性 ====
    const allAttributes = Array.from(attributeMap.entries())
    const selectCount = Math.min(
      Math.floor(Math.random() * 3) + 1,
      allAttributes.length
    )
    
    const selected = allAttributes
      .sort(() => Math.random() - 0.5)
      .slice(0, selectCount)
  
    // ==== 最终加成计算 ====
    let multiplier = 1
    switch(selected.length) {
      case 1: multiplier = 0.3; break
      case 2: multiplier = 0.8 * 0.3; break
      case 3: multiplier = 0.6 * 0.3; break
    }
  
    const finalAttributes = selected.map(([name, totalValue]) => {
      const finalValue = Math.round(totalValue * multiplier)
      return { name, totalValue, finalValue }
    })
  
    // ==== 结果输出 ====
    const output = [
      '',
      '🔥 精工锭合成模拟结果 🔥',
      `目标星级：${stars}⭐`,
      `材料阶级：${firstGrade}阶`,
      `使用材料：${materialEntries.map(m => `${m.name}x${m.count}`).join(' + ')}`,
      `总格子数：${totalSlots}/15`,
      '',
      '【属性计算过程】',
      `原始属性总和（已考虑材料数量）：`,
      ...Array.from(attributeMap.entries()).map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      '',
      `随机选择 ${selected.length} 条属性进行强化：`,
      ...finalAttributes.map(attr => 
        `${attr.name}: ${attr.totalValue.toFixed(2)} × ${multiplier.toFixed(2)} ≈ ${attr.finalValue}`
      ),
      '',
      '【最终加成效果】',
      ...finalAttributes.map(attr => `+ ${attr.finalValue} ${attr.name}`)
    ]
  
    return output.join('\n')
  })

  // ========== 黑名单系统（原功能保留）==========
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
}