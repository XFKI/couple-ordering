# 🍽️ 情侣点餐系统

> 一个温馨的双角色点餐应用 - 顾客端(宝宝)点菜，厨房端(大厨)做菜

## ✨ 核心功能

### 👤 顾客端
- 🍜 **43道菜品** - 主食/主菜/素菜/汤品完整分类
- 🏷️ **快捷选项** - 加点辣/加香菜/加葱一键选择
- 📝 **自定义备注** - 每道菜支持特殊要求
- 🛒 **购物车管理** - 数量调整、备注显示
- 📱 **实时订单追踪** - 下单→烹饪→完成全流程
- 📋 **订单详情** - 查看制作时间线和完整信息
- 🔔 **系统通知** - 订单状态变化实时提醒

### 👨‍🍳 厨房端
- 📊 **订单管理** - 待处理/烹饪中/已完成分类
- ⏱️ **时间记录** - 自动记录制作开始和完成时间
- 🍱 **菜单管理** - 增删改菜品、设置招牌菜
- 🖼️ **图片上传** - Supabase Storage云端存储
- 🔔 **催单提醒** - 接收顾客催单通知
- 📅 **日期筛选** - 按日期查看历史订单

---

## 🚀 快速开始

### 启动项目
```bash
# 双击运行
启动.bat

# 或命令行运行
npm run dev
```

访问地址：http://localhost:5173

### 角色选择
- 🍽️ **我要点菜** - 进入顾客端
- 👨‍🍳 **大厨特供** - 进入厨房端

---

## 📖 使用指南

### 顾客端操作流程

**1. 浏览菜单**
- 点击分类标签筛选菜品（全部/主食/主菜/素菜/汤品）
- ⭐ 招牌菜自动排在最前面
- 点击菜品卡片查看详情

**2. 下单**
```
选择菜品 → 快捷选项(加辣/香菜/葱) → 填写备注 → 加入购物车 → 确认下单
```

**3. 查看订单**
- **我的订单** - 查看所有订单状态
- **查看详情** - 点击订单查看时间线和菜品明细
- **撤销订单** - 待接单/烹饪中可撤销

### 厨房端操作流程

**1. 订单管理**
```
新订单 → 开始烹饪(记录时间) → 完成出餐(记录时间)
```

**2. 菜单管理**
- **新增菜品** - 右上角绿色按钮
- **设为招牌** - 勾选招牌复选框，自动排序优先
- **编辑菜品** - 修改信息、上传图片
- **删除菜品** - 二次确认后删除

**3. 日期筛选**
- 点击日期按钮查看特定日期订单
- 全部日期显示所有订单

---

## 💾 数据库设置

### Supabase配置
在 `src/App.jsx` 中配置你的Supabase凭证：
```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 数据表结构

**orders 表**
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  items JSONB NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  customer_name TEXT DEFAULT '吃货',
  urgent BOOLEAN DEFAULT FALSE,
  urgent_count INTEGER DEFAULT 0,
  cooking_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**menu 表**
```sql
CREATE TABLE menu (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 99,
  category TEXT,
  method TEXT,
  flavor TEXT,
  image TEXT,
  image_url TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 启用实时订阅
1. 在Supabase后台进入 **Database** → **Replication**
2. 将 `orders` 和 `menu` 表添加到 `supabase_realtime` 发布
3. 设置RLS策略为公共访问（开发环境）

### 添加时间戳字段
运行项目根目录的 `add_timestamp_fields.sql`:
```sql
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cooking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

---

## 🎨 特色功能

### 1️⃣ 招牌菜品自动排序
- 大厨端设置招牌菜品
- 顾客端菜单中招牌菜自动排在最前面
- 带⭐标识，醒目易识别

### 2️⃣ 快捷选项 + 自定义备注
- 🌶️ 加点辣 / 🌿 加香菜 / 🧅 加葱
- 点击按钮快速添加，自动合并到备注
- 格式：`加点辣、加香菜;不要太甜`

### 3️⃣ 订单详情时间线
- 📅 下单时间
- 🔵 开始制作时间（点击"开始烹饪"自动记录）
- 🟢 完成时间（点击"完成出餐"自动记录）

### 4️⃣ 实时同步优化
- 使用增量更新替代全量查询
- `INSERT` → 添加到列表
- `UPDATE` → 更新对应项
- `DELETE` → 从列表移除
- 避免重复查询，提升性能

---

## 📂 项目结构

```
点菜系统/
├── src/
│   └── App.jsx           # 主应用文件(2100+行)
├── public/               # 静态资源
├── add_timestamp_fields.sql  # 数据库字段添加脚本
├── 启动.bat             # 一键启动脚本
├── package.json         # 项目依赖
└── README.md           # 项目文档
```

### 核心代码组织

**App.jsx 文件结构**
```javascript
1. 辅助函数 (订单号格式化)
2. Supabase配置 + 初始菜单数据
3. 通用组件 (Modal/Toast/OrderDetailModal)
4. 顾客端组件 (OrderHistoryView/CartView/CustomerView)
5. 大厨端组件 (MenuEditForm/MenuManagementView/KitchenView)
6. 主应用 (角色选择 + 全局状态)
```

---

## 🔧 技术栈

- **前端框架**: React 18
- **构建工具**: Vite 5
- **样式方案**: Tailwind CSS 3
- **图标库**: Lucide React
- **后端服务**: Supabase (PostgreSQL + Storage + Realtime)
- **数据库**: PostgreSQL with JSONB
- **实时通信**: Supabase Realtime Channels
- **文件存储**: Supabase Storage

---

## 📝 订单号格式

**格式**: `YYYYMMDD-XXX`

**示例**: 
- `20251129-001` - 2025年11月29日第1单
- `20251129-002` - 2025年11月29日第2单

**特点**:
- 每日自动重置序列号
- 按创建时间升序编号
- 跨日期唯一标识

---

## 🎯 数据流

### 下单流程
```
选菜 → 快捷选项 → 备注 → 加购物车 → 下单
  ↓
orders表插入新记录 (status: pending)
  ↓
实时订阅触发 → 大厨端收到通知
```

### 制作流程
```
大厨点击"开始烹饪"
  ↓
UPDATE orders SET 
  status = 'cooking',
  cooking_started_at = NOW()
  ↓
实时同步 → 顾客端显示"烹饪中"
  ↓
大厨点击"完成出餐"
  ↓
UPDATE orders SET 
  status = 'completed',
  completed_at = NOW()
  ↓
实时同步 → 顾客端显示"已完成"
```

---

## ⚠️ 注意事项

1. **Supabase配置**: 确保在 `App.jsx` 中填写正确的URL和Key
2. **数据表创建**: 按照上述SQL创建 `orders` 和 `menu` 表
3. **实时订阅**: 在Supabase后台启用表的实时复制
4. **Storage桶**: 创建 `menu_images` 桶，设置为公共访问
5. **RLS策略**: 开发环境可设置为公共访问，生产环境需配置安全策略

---

## 🐛 故障排除

### 订单实时更新重复
✅ 已修复 - 使用增量更新替代全量查询

### 时间戳字段不存在
运行 `add_timestamp_fields.sql` 添加字段

### 图片上传失败
检查Supabase Storage桶权限设置

### 实时订阅不生效
确认表已添加到 `supabase_realtime` 发布

---

## 📱 浏览器兼容性

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ 需支持ES6+和LocalStorage

---

## 💡 后续优化建议

1. **用户认证** - Supabase Auth登录系统
2. **支付集成** - 在线支付功能
3. **订单评价** - 完成后评分评论
4. **数据统计** - 销量报表和热门菜品分析
5. **多语言** - i18n国际化支持
6. **移动端优化** - PWA渐进式Web应用

---

**Enjoy Coding! ❤️**
"# couple-ordering" 
