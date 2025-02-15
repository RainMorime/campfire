import { Context, h, Schema } from 'koishi'
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
  ctx.command('图鉴 <name>', '查询物品图鉴')
    .action(async (_, name) => {
      if (!name) return '请输入要查询的物品名称'
      
      const [item] = await findMaterialByNameOrAlias(name) 

      if (!item) return '未找到该物品'

      const output = []
      const imagePath = resolve(__dirname, item.image)
      output.push(h.image(pathToFileURL(imagePath).href))

      // 基本信息
      let info = `【${item.name}】`
      info += `｜类型：${item.type}·${item.materialType}`
      if (item.grade > 0) info += `｜阶级：${item.grade}阶`
      if (item.slots > 0) info += `｜占用：${item.slots}格`
      if (item.type === '食材') {
        info += `｜饱食+${item.satiety||0} 水分+${item.moisture||0}`
      }
      info += `\n📝 ${item.description}`

      // 材料属性
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

    // 构建资源路径
    const resources = {
        background: loadDataURL(resolve(assetPath, 'baojukuang1_1.png')),
        gradeIcon: loadDataURL(resolve(assetPath, `rare/grade${grade}.png`)),
        starIcon: loadDataURL(resolve(assetPath, `rare/star${grade}.png`)),
        attrIcons: Object.fromEntries(
            Object.entries(attrNameMap).map(([name, file]) => [
                name, 
                loadDataURL(resolve(assetPath, `attr/${file}.png`))
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
  async function processMaterialInput(ctx: Context, stars: number, materials: string, needImage: boolean) {
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
    .action(async (_, inputParams) => {
      const params = inputParams.split(/\s+/)
      
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
      switch(mode) {
        case 'attribute':
          if (params.length < 2) return '属性模式需要参数格式：星级 属性1x数值...'
          const stars = parseInt(params[0])
          const materials = params.slice(1).join(' ')
          if (isNaN(stars) || stars < 1 || stars > 5) return '星级必须为1-5的整数'
          const result = await processAttributeInput(stars, materials, false)
          return 'error' in result ? result.error : result.textOutput.join('\n')
          
        case 'mixed':
          if (params.length < 2) return '混合模式需要参数格式：星级 材料/属性组合...'
          const mixedStars = parseInt(params[0])
          if (isNaN(mixedStars) || mixedStars < 1 || mixedStars > 5) return '星级必须为1-5的整数'
          const mixedResult = await processMixedInput(ctx, mixedStars, params.slice(1), false)
          return 'error' in mixedResult ? mixedResult.error : mixedResult.textOutput.join('\n')
          
        default:
          if (params.length < 2) return '材料模式需要参数格式：星级 材料1x数量...'
          const materialStars = parseInt(params[0])
          if (isNaN(materialStars) || materialStars < 1 || materialStars > 5) return '星级必须为1-5的整数'
          const materialResult = await processMaterialInput(ctx, materialStars, params.slice(1).join(' '), false)
          return 'error' in materialResult ? materialResult.error : materialResult.textOutput.join('\n')
      }
    })

  ctx.command('精工 <inputParams:text>', '正式合成精工锭')
    .action(async (_, inputParams) => {
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
  
  ctx.command('营火运势', '每日运势占卜（每日限一次）')
    .userFields(['authority'])
    .action(async ({ session }) => {
      const userId = session.userId
      const isAdmin = session.user.authority >= 4

      // 检查冷却时间（非管理员）
      if (!isAdmin) {
        const lastUsed = await ctx.database.get('user_cooldown', { userId })
        if (lastUsed.length > 0) {
          const lastDate = new Date(lastUsed[0].lastUsed)
          const today = new Date()
          if (lastDate.toDateString() === today.toDateString()) {
            return '今天已经占卜过了，明天再来吧~'
          }
        }
      }

      // 生成随机数值（所有人1%彩蛋）
      let luckValue = Math.floor(Math.random() * 100) + 1
      let isSpecial = Math.random() < 0.01  // 所有人都有1%概率

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

      // 随机元素祝福（仅文字）
      const element = elements[Math.floor(Math.random() * elements.length)]

      // 更新冷却时间
      if (!isAdmin) {
        await ctx.database.upsert('user_cooldown', [{
          userId,
          lastUsed: new Date()
        }], ['userId'])
      }

      // 构建纯文字结果
      let result = `✨ 营火运势 ✨\n`
      result += `今日元素祝福：${element}\n`
      result += `幸运数值：${luckValue}${isSpecial ? '✨' : ''}\n`
      result += `运势解读：${fortune?.description || '未知运势'}`

      return result
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