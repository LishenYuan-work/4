import type { Category, Product } from '../types'
import fruitImage from '../assets/category/fruit.svg'
import vegetablesImage from '../assets/category/vegetables.svg'
import meatDairyImage from '../assets/category/meat-dairy.svg'
import seafoodImage from '../assets/category/seafood.svg'
import groceryImage from '../assets/category/grocery.svg'
import preparedImage from '../assets/category/prepared.svg'

const image = (name: string) => `/static/products/${name}.jpg`

export const categories = ['水果', '蔬菜', '肉禽蛋奶', '水产', '粮油调味', '熟食及其他'] as const

const productRows: Array<[string, string, Category, number, string, number, number, string, string, string, string[], number]> = [
  ['p01','云南蓝莓鲜果','水果',29.9,'125g/盒',18,268,'云南蒙自','净重125g','冷藏0-4°C',['推荐','新鲜'],1],
  ['p02','丹东红颜草莓','水果',39.8,'500g/盒',8,421,'辽宁丹东','净重500g','当天采摘优先配送',['推荐','热销'],1],
  ['p03','海南贵妃芒','水果',19.8,'3斤装',36,182,'海南三亚','约6-8个','常温催熟后冷藏',['新鲜'],1],
  ['p04','新疆阿克苏苹果','水果',32.8,'5斤装',24,312,'新疆阿克苏','约10-12个','阴凉通风保存',['推荐'],1],
  ['p05','智利车厘子J级','水果',69.9,'500g/盒',6,509,'智利','J级果径','冷藏保存',['热销'],1],
  ['p06','泰国金枕榴莲肉','水果',56.8,'300g/盒',0,198,'泰国','冷冻果肉','冷冻保存',['缺货'],1],
  ['p07','有机上海青','蔬菜',6.9,'300g/份',32,210,'上海崇明','净重300g','冷藏保鲜',['推荐'],1],
  ['p08','山东番茄','蔬菜',9.9,'500g/份',47,286,'山东寿光','约4-6个','常温避光',['热销'],1],
  ['p09','本地娃娃菜','蔬菜',7.8,'2棵装',14,169,'本地农场','约500g','冷藏保存',['新鲜'],1],
  ['p10','云南甜玉米','蔬菜',12.8,'4根装',9,242,'云南昆明','约800g','冷藏保存',['推荐','热销'],1],
  ['p11','福建西兰花','蔬菜',11.8,'1颗',28,198,'福建漳州','约450g','冷藏保鲜',[],1],
  ['p12','紫皮洋葱','蔬菜',5.9,'500g/份',63,91,'甘肃酒泉','约3-4个','阴凉干燥保存',[],1],
  ['p13','谷饲牛腱块','肉禽蛋奶',42.8,'500g/份',12,314,'内蒙古','冷鲜切块','0-4°C冷藏',['推荐'],1],
  ['p14','散养土鸡蛋','肉禽蛋奶',22.8,'30枚',41,398,'安徽宣城','约1.5kg','冷藏保存',['热销'],1],
  ['p15','低温鲜牛奶','肉禽蛋奶',16.9,'950ml',16,275,'上海','巴氏杀菌','2-6°C冷藏',['新鲜','热销'],1],
  ['p16','黑猪五花肉','肉禽蛋奶',36.8,'400g/份',7,188,'浙江金华','冷鲜分割','0-4°C冷藏',['推荐'],1],
  ['p17','鸡胸肉轻食装','肉禽蛋奶',19.8,'500g/袋',35,155,'山东潍坊','去皮鸡胸','冷冻保存',[],1],
  ['p18','原味酸奶杯','肉禽蛋奶',15.9,'6杯装',22,224,'江苏苏州','100g×6','2-6°C冷藏',[],1],
  ['p19','东海带鱼段','水产',31.8,'500g/袋',13,271,'浙江舟山','冷冻切段','-18°C冷冻',['推荐'],1],
  ['p20','鲜活基围虾','水产',45.8,'500g/份',10,387,'广东湛江','约25-30只','冷链配送',['热销'],1],
  ['p21','挪威三文鱼块','水产',59.8,'250g/盒',5,299,'挪威','去皮鱼块','0-4°C冷藏',['新鲜'],1],
  ['p22','蒜蓉粉丝扇贝','水产',26.8,'6只装',26,177,'辽宁大连','半成品','冷冻保存',[],1],
  ['p23','鲜活鲫鱼','水产',39.8,'1条',0,113,'江苏太湖','约500g','现杀冷链',['缺货'],0],
  ['p24','五常大米','粮油调味',69.8,'5kg/袋',44,366,'黑龙江五常','长粒香','阴凉干燥保存',['推荐','热销'],1],
  ['p25','压榨菜籽油','粮油调味',79.8,'5L/桶',19,141,'四川成都','非转基因','避光保存',['调价'],1],
  ['p26','黄豆酱油','粮油调味',16.9,'500ml',38,205,'广东佛山','酿造酱油','常温保存',[],1],
  ['p27','有机小米','粮油调味',23.8,'1kg/袋',25,132,'山西沁州','精选小米','阴凉干燥',['新鲜'],1],
  ['p28','芝麻香油','粮油调味',25.8,'250ml',11,96,'河南驻马店','小磨香油','避光保存',[],1],
  ['p29','盐焗鸡半只','熟食及其他',32.8,'半只装',15,253,'广东梅州','熟食冷藏','0-4°C冷藏',['推荐'],1],
  ['p30','手工鲜肉馄饨','熟食及其他',24.9,'30只装',30,219,'上海','冷冻半成品','-18°C保存',['热销'],1],
  ['p31','桂花酒酿圆子','熟食及其他',19.9,'500g/盒',8,164,'苏州','甜品半成品','冷藏保存',['新鲜'],1],
  ['p32','即食藜麦沙拉','熟食及其他',22.9,'280g/盒',17,121,'上海','轻食即食','2-6°C冷藏',[],1],
]

export const products: Product[] = productRows.map(([id,name,category,price,unit,stock,sales,origin,spec,freshness,tags,onSale]) => ({
  id, name, category, price, unit, stock, sales, origin, spec, freshness, image: image(id === 'p01' ? 'blueberry' : id === 'p02' ? 'strawberry' : id === 'p03' ? 'mango' : id === 'p04' ? 'apple' : id === 'p05' ? 'cherry' : id === 'p06' ? 'durian' : id === 'p07' || id === 'p08' || id === 'p09' || id === 'p10' || id === 'p11' || id === 'p12' ? 'vegetables' : id === 'p13' || id === 'p14' || id === 'p15' || id === 'p16' || id === 'p17' || id === 'p18' ? 'meat-dairy' : id === 'p19' || id === 'p20' || id === 'p21' || id === 'p22' || id === 'p23' ? 'seafood' : id === 'p24' || id === 'p25' || id === 'p26' || id === 'p27' || id === 'p28' ? 'rice-oil' : 'prepared'), tags, onSale: Boolean(onSale)
}))

// One representative image per category keeps the demo catalogue visually
// consistent and avoids presenting a generic photo as a specific product.
const categoryRepresentativeImages: Record<string, string> = {
  fruit: fruitImage,
  vegetables: vegetablesImage,
  meatDairy: meatDairyImage,
  seafood: seafoodImage,
  grocery: groceryImage,
  prepared: preparedImage,
}

const categoryProductIds: Record<string, string[]> = {
  fruit: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'],
  vegetables: ['p07', 'p08', 'p09', 'p10', 'p11', 'p12'],
  meatDairy: ['p13', 'p14', 'p15', 'p16', 'p17', 'p18'],
  seafood: ['p19', 'p20', 'p21', 'p22', 'p23'],
  grocery: ['p24', 'p25', 'p26', 'p27', 'p28'],
  prepared: ['p29', 'p30', 'p31', 'p32'],
}

export function applyCategoryRepresentativeImages(items: Product[]) {
  Object.entries(categoryProductIds).forEach(([category, productIds]) => {
    const asset = categoryRepresentativeImages[category]
    productIds.forEach(productId => {
      const product = items.find(item => item.id === productId)
      // Cloud-hosted or remote images are uploaded by the merchant and must
      // take precedence over the default category illustration.
      if (product && !/^(cloud:\/\/|https?:\/\/|data:)/i.test(product.image || '')) product.image = asset
    })
  })
}

applyCategoryRepresentativeImages(products)
