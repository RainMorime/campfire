import { Context, Fragment, Schema,h } from 'koishi'
import fs from 'fs';
import { pathToFileURL } from 'url';
import path, { resolve } from 'path';

export const name = 'campfire'

// 定义黑名单数据结构
interface BlacklistEntry {
  userId: string;
  qqNumbers: number[];
  behavior: string;
}

// 初始化黑名单数据
const blacklist: BlacklistEntry[] = [];

// 定义图鉴数据结构
interface ItemEntry {
  id: number; // 添加一个唯一的ID
  name: string;
  imagePath: string; // 修改为本地路径
  merit: number;
  price: number;
}

// 初始化图鉴数据
let itemCatalog: ItemEntry[] = [];

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

// 应用插件
export function apply(ctx: Context) {
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

  // 定义上传图鉴命令
  ctx.command('上传图鉴 <name> <imagePath> <merit> <price>', '上传物品图鉴')
    .action((_, name, imagePath, merit, price) => {
      // 将 merit 和 price 转换为 number 类型
      const meritAsNumber = Number(merit);
      const priceAsNumber = Number(price);

      // 生成一个唯一的ID
      const id = itemCatalog.length + 1;

      // 检查物品名称是否已存在
      const existingEntry = itemCatalog.find(entry => entry.name === name);

      if (existingEntry) {
        return `物品图鉴已存在，无法上传。`;
      } else {
        // 如果物品名称不存在，创建新的记录
        const newEntry: ItemEntry = {
          id,
          name,
          imagePath, // 修改为本地路径
          merit: meritAsNumber,
          price: priceAsNumber,
        };

        itemCatalog.push(newEntry);

        // 将图鉴数据保存到本地文件
        saveCatalogToFile(itemCatalog);

        return `已成功上传物品图鉴：${name}`;
      }
    });



// 定义查询图鉴命令
ctx.command('图鉴 <name>', '查询物品图鉴')
.action((_, name) => {
  // 查找是否存在匹配的记录
  const matchingEntry = itemCatalog.find(entry => entry.name === name);

  if (matchingEntry) {
    // 如果存在匹配的记录，返回物品图鉴信息
    
    return h.image(pathToFileURL(resolve(__dirname,matchingEntry.imagePath)).href) + `物品名称：${matchingEntry.name}\n所需功勋：${matchingEntry.merit}\n参考价格：${matchingEntry.price}`;


  } else {
    // 如果不存在匹配的记录，返回提示信息
    return Promise.resolve(`未找到匹配的物品图鉴。`);
  }
});






  // 定义删除图鉴命令
  ctx.command('删除图鉴 <query>', '从图鉴中删除物品')
    .action((_, query) => {
      // 查找是否存在匹配的记录
      const index = itemCatalog.findIndex(entry => entry.id === Number(query) || entry.name === query);

      if (index !== -1) {
        // 如果存在匹配的记录，删除该记录
        itemCatalog.splice(index, 1);

        // 将更新后的图鉴数据保存到本地文件
        saveCatalogToFile(itemCatalog);

        return `已成功删除图鉴中的 ${query}`;
      } else {
        // 如果不存在匹配的记录，返回提示信息
        return `未找到匹配的图鉴记录，无法删除。`;
      }
    });
    // 定义更改价格命令
  ctx.command('更改价格 <item> <price>', '更改物品的参考价格')
  .action((_, item, price) => {
    // 将 price 转换为 number 类型
    const newPrice = Number(price);

    // 查找是否存在匹配的物品记录
    const matchingEntry = itemCatalog.find(entry => entry.name === item);

    if (matchingEntry) {
      // 如果存在匹配的物品记录，更新价格
      matchingEntry.price = newPrice;
      return `已成功将物品 ${item} 的价格更改为 ${newPrice}`;
    } else {
      // 如果不存在匹配的物品记录，返回提示信息
      return `未找到物品 ${item}，无法更改价格。`;
    }
  });
}

// 将图鉴数据保存到本地文件
function saveCatalogToFile(catalog: ItemEntry[]) {
  const filePath = path.join(__dirname, 'itemCatalog.json');
  const data = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(filePath, data);
}

// 从本地文件加载图鉴数据
function loadCatalogFromFile() {
  const filePath = path.join(__dirname, 'itemCatalog.json');

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    itemCatalog = JSON.parse(data).map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      imagePath: entry.imagePath, // 修改为本地路径
      merit: entry.merit,
      price: entry.price,
    }));
  }
}

// 在应用启动时加载图鉴数据
loadCatalogFromFile();
