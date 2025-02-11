import { Context, h, Schema } from 'koishi'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { createCanvas, loadImage, registerFont } from 'canvas'
import { writeFileSync } from 'fs'

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

  // ========== 查询价格指令 ==========
  async function findMaterialByNameOrAlias(name: string) {
    // 先查别名表
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
  // ========== 修改后的图鉴查询 ==========
  ctx.command('图鉴 <name>', '查询物品图鉴')
    .action(async (_, name) => {
      if (!name) return '请输入要查询的物品名称'
      
      const [item] = await findMaterialByNameOrAlias(name) 

      if (!item) return '未找到该物品'

      const output = []
      const imagePath = resolve(__dirname, item.image)
      output.push(h.image(pathToFileURL(imagePath).href))

      // 紧凑型基本信息
      let info = `【${item.name}】`
      info += `｜类型：${item.type}·${item.materialType}`
      if (item.grade > 0) info += `｜阶级：${item.grade}阶`
      if (item.slots > 0) info += `｜占用：${item.slots}格`
      if (item.type === '食材') {
        info += `｜饱食+${item.satiety||0} 水分+${item.moisture||0}`
      }
      info += `\n📝 ${item.description}`

      // 材料属性紧凑显示
      if (item.type === '材料') {
        const attributes = await ctx.database.get('material_attribute', { 
          materialId: item.id,
          starLevel: { $gte: 1, $lte: 5 }
        })

        const starOutput = []
        for (let star = 1; star <= 5; star++) {
          const starAttrs = attributes.filter(a => a.starLevel === star)
          if (starAttrs.length === 0) continue
          
          const attrText = starAttrs
            .map(a => `${a.attrName} ${a.attrValue}`)
            .join('｜')
          starOutput.push(`⭐${star} → ${attrText}`)
        }
        
        if (starOutput.length > 0) {
          info += `\n🔧 属性成长：\n${starOutput.join('\n')}`
        }
      }

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
  async function generateResultImage(results: string[], grade: number, stars: number) {
    // 注册字体（在创建画布之前）
    const fontPath = resolve(__dirname, '../assets/fusion_pixel.ttf')
    registerFont(fontPath, { family: 'Fusion Pixel' })

    // 加载本地模板图片
    const templatePath = resolve(__dirname, '../assets/baojukuang1_1.png')
    const template = await loadImage(templatePath)
    
    
    const canvas = createCanvas(160, 160)
    const ctx2 = canvas.getContext('2d') 

    // 绘制背景模板（自动缩放）
    ctx2.drawImage(template, 0, 0, 160, 160)

    // ==== 绘制阶级图标 ====
    try {
      const gradeImagePath = resolve(__dirname, `../assets/rare/grade${grade}.png`)
      const gradeImage = await loadImage(gradeImagePath)
      ctx2.drawImage(gradeImage, 102, 72, 48, 8) // 阶级位置
    } catch (err) {
      console.error('阶级图标加载失败:', err)
    }

    // ==== 绘制星级图标 ====
    try {
      const starImagePath = resolve(__dirname, `../assets/rare/star${grade}.png`)
      const starImage = await loadImage(starImagePath)
      const starWidth = 48 // 修改为16像素宽度
      const starHeight = 8 // 新增高度参数
      const startX = 102  // 阶级图标右侧5像素开始
      const startY = 72  // 垂直

      for (let i = 0; i < Math.min(stars, 5); i++) {
        ctx2.drawImage(
          starImage,
          startX + i * 7, // 每颗间隔像素
          startY,
          starWidth,
          starHeight // 设置固定尺寸16x16
        )
      }
    } catch (err) {
      console.error('星级图标加载失败:', err)
    }

    // ==== 属性图标绘制 ====
    const iconPositions = [
      { x: 13, y: 99 },  // 第1行图标位置
      { x: 13, y: 111 },  // 第2行图标位置
      { x: 13, y: 123 }   // 第3行图标位置
    ]

    // 只处理前3个属性
    for (const [index, text] of results.slice(0, 3).entries()) {
      const attrName = text.split('+')[0]
      try {
        // 转换属性名称到文件名
        const fileName = {
          '法强': 'faqiang',
          '攻击': 'gongji',
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
          // 其他属性继续添加...
        }[attrName] || 'default'

        const iconPath = resolve(__dirname, `../assets/attr/${fileName}.png`)
        const icon = await loadImage(iconPath)
        ctx2.drawImage(
          icon,
          iconPositions[index].x,
          iconPositions[index].y,
          16,
          16
        )
      } catch (err) {
        console.error(`属性图标加载失败: ${attrName}`, err)
      }
    }

    // 设置字体样式
    ctx2.fillStyle = '#ffffff'
    ctx2.font = '10px "Fusion Pixel"' // 调小字号适应像素字体
    ctx2.textAlign = 'left'

    // 定义新的位置坐标（三行左对齐）
    const positions = [
      { x: 29, y: 110 },  // 第1行
      { x: 29, y: 122 },  // 第2行
      { x: 29, y: 134 }   // 第3行
    ]

    // 只显示前3个结果
    results.slice(0, 3).forEach((text, index) => {
      ctx2.fillText(text, positions[index].x, positions[index].y)
    })

    // 转换为Base64
    return canvas.toDataURL('image/png')
  }

  // ========== 模拟精工锭指令 ==========
  ctx.command('模拟精工锭 <stars:number> <materials:text>', '模拟精工锭合成')
    .usage('格式：模拟精工锭 星级 材料1x数量 材料2x数量 ...')
    .example('模拟精工锭 5 兽核x1 精铁矿x3 星尘x2')
    .action(async (_, stars, materials) => {
      const result = await simulateRefinement(ctx, stars, materials)
      if ('error' in result) return result.error
      return [h.image(result.imageData), result.textOutput.join('\n')]
    })

  // 将模拟精工锭逻辑提取为独立函数
  async function simulateRefinement(ctx: Context, stars: number, materials: string) {
    // ==== 材料参数解析 ====
    const materialEntries = await Promise.all(materials.split(/\s+/).map(async entry => {
      const match = entry.match(/^(.+?)x(\d+)$/)
      if (!match) return null
      
      // 解析材料名称（支持包含空格的名称）
      const materialName = match[1].trim()
      const count = parseInt(match[2])
      
      // 查询材料数据（支持别名）
      const [material] = await findMaterialByNameOrAlias(materialName)
      
      return material ? {
        original: entry,
        name: material.name, // 使用正式名称
        count,
        materialData: material
      } : null
    })).then(list => list.filter(Boolean))

    // ==== 基础参数校验 ====
    if (materialEntries.length < 2) {
      return { error: '至少需要两个材料进行合成，格式：材料名x数量' }
    }

    // ==== 材料存在性检查 ====
    const missingList = materialEntries
      .filter(entry => !entry.materialData)
      .map(entry => entry.original)

    if (missingList.length > 0) {
      return { error: `以下材料不存在：${missingList.join(', ')}` }
    }

    // ==== 材料数据获取方式 ====
    const materialsData = materialEntries.map(entry => entry.materialData)
    
    // ==== 检查材料是否有所需星级的属性 ====
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
      return { error: `以下材料缺少 ${stars} 星级属性：${
        missingStarMaterials.map(m => m.name).join(', ')
      }` }
    }
  
    // ==== 阶级一致性检查 ====
    const firstGrade = materialsData[0].grade
    const invalidTier = materialsData.some(data => data.grade !== firstGrade)
    if (invalidTier) {
      const tierList = [...new Set(materialsData.map(m => m.grade))]
      return { error: `材料阶级不一致，存在以下阶级：${tierList.join(', ')}` }
    }
  
    // ==== 兽核存在检查 ====
    const hasCore = materialsData.some(data => data.materialType === '兽核')
    if (!hasCore) {
      return { error: '合成必须包含兽核材料' }
    }
  
    // ==== 格子总数计算 ====
    let totalSlots = 0
    for (const entry of materialEntries) {
      const material = materialsData.find(m => m.name === entry.name)
      totalSlots += material.slots * entry.count
    }
    
    if (totalSlots !== 15) {
      return { error: `材料总格子数应为15，当前为${totalSlots}` }
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
      const finalValue = Math.ceil(totalValue * multiplier)
      return { name, totalValue, finalValue }
    })
  
    // ==== 结果输出 ====
    const textOutput = [
      '🔥 精工锭合成模拟结果 🔥',
      `目标星级：${stars}⭐`,
      `材料阶级：${firstGrade}阶`,
      `使用材料：${materialEntries.map(m => `${m.name}x${m.count}`).join(' + ')}`,
      `总格子数：${totalSlots}/15`,
      '',
      '【属性计算过程】',
      ...Array.from(attributeMap.entries()).map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      '',
      `随机选择 ${selected.length} 条属性进行强化：`,
      ...finalAttributes.map(attr => 
        `${attr.name}: ${attr.totalValue.toFixed(2)} × ${multiplier.toFixed(2)} ≈ ${attr.finalValue}`
      ),
      '',
      '【最终加成效果】',
      ...finalAttributes.map(attr => `+ ${attr.finalValue}${attr.name}`)
    ]

    // ==== 生成结果 ====
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

  // 技能管理指令
  ctx.command('材料技能')
    .subcommand('.add <materialName:string> <skillName:string> <description:text> <effect:text> <image:string>', '添加材料技能', {
      authority: 2
    })
    .action(async (_, materialName, skillName, description, effect, image) => {
      const [material] = await findMaterialByNameOrAlias(materialName)
      if (!material) return '材料不存在'

      await ctx.database.create('material_skill', {
        materialId: material.id,
        skillName,
        description,
        effect,
        image
      })
      return `已为 ${materialName} 添加技能：${skillName}`
    })

  ctx.command('材料技能')
    .subcommand('.remove <materialName:string> <skillName:string>', '删除材料技能', {
      authority: 2
    })
    .action(async (_, materialName, skillName) => {
      const [material] = await findMaterialByNameOrAlias(materialName)
      if (!material) return '材料不存在'

      const result = await ctx.database.remove('material_skill', { 
        materialId: material.id,
        skillName 
      })
      return result ? `已删除技能：${skillName}` : '技能不存在'
    })

  // 数据库管理指令
  ctx.command('数据库管理')
    .subcommand('.删除 <table:string>', '删除数据库表', {
      authority: 5
    })
    .action(async (_, table) => {
      const validTables = [
        'material', 'material_attribute', 'material_alias',
        'food', 'material_skill'
      ]
      
      if (!validTables.includes(table)) {
        return `无效数据库表名，可用选项：${validTables.join(', ')}`
      }
      try {
        await ctx.database.drop(table as any)
        return `已成功删除 ${table} 数据库表`
      } catch (err) {
        console.error('数据库删除失败:', err)
        return `删除 ${table} 表失败，请检查控制台日志`
      }      
    })

  // 新增精工指令
  ctx.command('精工 <stars:number> <materials:text>', '正式合成精工锭')
    .usage('格式：精工 星级 材料1x数量 材料2x数量 ...')
    .example('精工 5 兽核x1 精铁x3')
    .action(async (_, stars, materials) => {
      const result = await simulateRefinement(ctx, stars, materials)
      if ('error' in result) return result.error
      return h.image(result.imageData)
    })
}

// 新增属性名称转换映射
const attrNameMap: Record<string, string> = {
  '法强': 'faqiang',
  '攻击': 'gongji',
  '防御': 'fangyu',
  '生命': 'shengming',
  '暴击': 'baoji',
  '爆伤': 'baoshang',
  '精通': 'jingtong',
  '充能': 'chongneng',
  // 其他属性继续添加...
}