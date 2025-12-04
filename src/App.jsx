import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Utensils, Heart, ChefHat, ShoppingCart, 
  Clock, CheckCircle, XCircle, Bell, Settings, 
  ChevronLeft, Plus, Minus, ArrowRight, Home, List, LogOut, Edit, Upload, Loader, Eye, X, Trash2, Archive, FileUp 
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- 1. 辅助函数 (订单号新格式化) ---

// Helper function: Get YYYYMMDD format for date
const getDateKey = (isoDate) => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
};

// Helper function: Get HH:MM:SS format for time
const getTimeDisplay = (isoDate) => {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mi}:${ss}`;
};

// Key function: Pre-calculate daily sequence numbers for all orders
const calculateDailySequences = (orders) => {
    if (!orders || orders.length === 0) return new Map();

    // 1. Sort all orders ascending by time (for accurate sequencing)
    const sortedOrders = [...orders].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const sequenceMap = {}; // Tracks the counter for each dateKey
    const displayMap = new Map(); // Maps created_at to the sequence number

    for (const order of sortedOrders) {
        const dateKey = getDateKey(order.created_at);

        if (!sequenceMap[dateKey]) {
            sequenceMap[dateKey] = 1;
        } else {
            sequenceMap[dateKey]++;
        }
        
        // Use created_at as the key to guarantee uniqueness for the map lookup
        displayMap.set(order.created_at, sequenceMap[dateKey]);
    }
    return displayMap;
};

// Format the display ID and time (using pre-calculated sequence number)
const formatOrderDisplay = (created_at, dateSequenceMap) => {
    if (!created_at) return { displayId: 'N/A', displayTime: 'N/A' };
    
    const dateKey = getDateKey(created_at);
    const sequenceNumber = dateSequenceMap.get(created_at) || 0;
    const seq = String(sequenceNumber).padStart(3, '0');

    return {
        displayId: `${dateKey}-${seq}`, // e.g., 20251129-001
        displayTime: getTimeDisplay(created_at) // e.g., 10:18:30
    };
};


// --- 2. Supabase 配置和客户端 (真实云端数据库) ---

const SUPABASE_URL = 'https://tpenvfpvhvfyftcsmbxb.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_jMdHVHJNEuwDAKPjpeowkw__yWb7ZaP';

// 创建真实 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- PushPlus 微信推送配置 ---
// PushPlus 好友一对一推送函数
// token: 发送者的 token（需要实名认证）
// friendToken: 好友的 token（好友令牌/友链码，无需实名）
// 如果不指定 friendToken，则推送给自己
const sendPushPlusNotification = async (token, title, content, template = 'html', friendToken = null) => {
  if (!token) {
    console.log('PushPlus token 未配置，跳过微信推送');
    return false;
  }
  
  try {
    const payload = {
      token: token,
      title: title,
      content: content,
      template: template, // html, txt, json, markdown
      channel: 'wechat' // 微信公众号
    };
    
    // 如果有好友 token，添加到请求中（一对一好友推送）
    if (friendToken) {
      payload.to = friendToken; // 好友令牌
    }
    
    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    if (result.code === 200) {
      console.log('PushPlus 推送成功:', title, friendToken ? `(好友: ${friendToken.substring(0,8)}...)` : '(自己)');
      return true;
    } else {
      console.error('PushPlus 推送失败:', result.msg);
      return false;
    }
  } catch (error) {
    console.error('PushPlus 推送异常:', error);
    return false;
  }
};

// 菜品表情映射
const DISH_EMOJI_MAP = {
  // 主食
  '香炒劲道面': '🍜',
  '经典炒米粉': '🍝',
  '秘制炒饭': '🍚',
  '辣香肉末米粉': '🌶️',
  '白米饭': '🍚',
  '煮方便面': '🍜',
  '清汤挂面': '🥢',
  '香烤吐司': '🍞',
  // 主菜
  '可乐炖鸡翅': '🍗',
  '焦香排骨': '🍖',
  '麻辣猪耳': '🌶️',
  '老干妈炒火腿': '🥓',
  '红烧秘制肉': '🍖',
  '酸萝卜牛肚': '🥘',
  '青椒炒蛋': '🥚',
  '经典辣椒炒肉': '🌶️',
  '小炒黄牛肉': '🥩',
  '混合椒爆炒牛肉': '🫑',
  '酸菜鱼': '🐟',
  '红烧排骨': '🍖',
  '鲜椒小炒鸡': '🐔',
  '农家一碗香': '🥘',
  '麻婆豆腐': '🌶️',
  '肉末茄子': '🍆',
  // 素菜
  '清炒时蔬': '🥬',
  '酸辣土豆丝': '🥔',
  '酸辣藕丁': '🌱',
  '清炒儿菜': '🥬',
  '家常豆腐': '🧈',
  '时蔬混搭': '🥗',
  '炒三丝': '🥕',
  '香菇青菜': '🍄',
  '清炒丝瓜': '🥒',
  '干锅花菜': '🥦',
  '番茄炒蛋': '🍅',
  // 汤品
  '粉藕排骨汤': '🍲',
  '虫草花炖鸡汤': '🍲',
  '鲜香鱼汤': '🐠',
  '鲫鱼豆腐汤': '🥣',
  '炖雪梨': '🍐',
  '罗宋汤': '🥣',
  '菌菇汤': '🍄',
  '胡椒猪肚鸡汤': '🍲'
};

// Initial menu data
const INITIAL_MENU = [
  // 主食
  { id: 'm-1', name: '香炒劲道面', description: '香气浓郁，配料丰富', price: 19, stock: 99, sales: 0, category: '主食', method: '大火快炒，面条筋道', flavor: '香气浓郁，配料丰富', image: '🍜', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=香炒劲道面', tags: [] },
  { id: 'm-2', name: '经典炒米粉', description: '粒粒分明，口感爽滑', price: 19, stock: 99, sales: 0, category: '主食', method: '高温快炒，火候精准', flavor: '粒粒分明，口感爽滑', image: '🍝', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=经典炒米粉', tags: [] },
  { id: 'm-3', name: '秘制炒饭', description: '米香四溢，层次丰富', price: 19, stock: 99, sales: 0, category: '主食', method: '秘制配方，快速翻炒', flavor: '米香四溢，层次丰富', image: '🍚', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=秘制炒饭', tags: [] },
  { id: 'm-4', name: '辣香肉末米粉', description: '鲜香微辣，米粉柔滑', price: 19, stock: 99, sales: 0, category: '主食', method: '肉末炒香，辣椒提味', flavor: '鲜香微辣，米粉柔滑', image: '🌶️', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=辣香肉末米粉', tags: [] },
  { id: 'm-5', name: '白米饭', description: '清淡原香，百搭主食', price: 19, stock: 99, sales: 0, category: '主食', method: '蒸煮米粒，松软饱满', flavor: '清淡原香，百搭主食', image: '🍚', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=白米饭', tags: [] },
  { id: 'm-6', name: '煮方便面', description: '快捷鲜香，汤汁浓郁', price: 19, stock: 99, sales: 0, category: '主食', method: '热水煮制，调料入味', flavor: '快捷鲜香，汤汁浓郁', image: '🍜', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=煮方便面', tags: [] },
  { id: 'm-7', name: '清汤挂面', description: '清爽淡雅，面条柔滑', price: 19, stock: 99, sales: 0, category: '主食', method: '挂面煮熟，清汤调味', flavor: '清爽淡雅，面条柔滑', image: '🥢', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=清汤挂面', tags: [] },
  { id: 'm-8', name: '香烤吐司', description: '松软微甜，焦香可口', price: 19, stock: 99, sales: 0, category: '主食', method: '烤制金黄，外脆内软', flavor: '松软微甜，焦香可口', image: '🍞', imageUrl: 'https://placehold.co/320x180/facc15/374151?text=香烤吐司', tags: [] },
  
  // 主菜
  { id: 'm-9', name: '可乐炖鸡翅', description: '甜香浓郁，鸡翅嫩滑', price: 19, stock: 99, sales: 0, category: '主菜', method: '可乐慢炖，入味鲜美', flavor: '甜香浓郁，鸡翅嫩滑', image: '🍗', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=可乐炖鸡翅', tags: [] },
  { id: 'm-10', name: '焦香排骨', description: '外焦里嫩，香气扑鼻', price: 19, stock: 99, sales: 0, category: '主菜', method: '高温煎制，慢火收汁', flavor: '外焦里嫩，香气扑鼻', image: '🍖', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=焦香排骨', tags: [] },
  { id: 'm-11', name: '麻辣猪耳', description: '脆爽麻辣，开胃下酒', price: 19, stock: 99, sales: 0, category: '主菜', method: '卤制入味，辣椒爆炒', flavor: '脆爽麻辣，开胃下酒', image: '🌶️', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=麻辣猪耳', tags: [] },
  { id: 'm-12', name: '老干妈炒火腿', description: '辣香浓烈，火腿咸香', price: 19, stock: 99, sales: 0, category: '主菜', method: '老干妈酱爆炒', flavor: '辣香浓烈，火腿咸香', image: '🥓', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=老干妈炒火腿', tags: [] },
  { id: 'm-13', name: '红烧秘制肉', description: '肥而不腻，入口即化', price: 19, stock: 99, sales: 0, category: '主菜', method: '秘制酱料慢炖', flavor: '肥而不腻，入口即化', image: '🍖', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=红烧秘制肉', tags: ['招牌'] },
  { id: 'm-14', name: '酸萝卜牛肚', description: '酸爽开胃，牛肚脆嫩', price: 19, stock: 99, sales: 0, category: '主菜', method: '酸萝卜与牛肚快炒', flavor: '酸爽开胃，牛肚脆嫩', image: '🥘', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=酸萝卜牛肚', tags: [] },
  { id: 'm-15', name: '青椒炒蛋', description: '清香爽口，蛋嫩椒脆', price: 19, stock: 99, sales: 0, category: '主菜', method: '快火翻炒，保持鲜嫩', flavor: '清香爽口，蛋嫩椒脆', image: '🥚', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=青椒炒蛋', tags: [] },
  { id: 'm-16', name: '经典辣椒炒肉', description: '辣香扑鼻，肉片鲜嫩', price: 19, stock: 99, sales: 0, category: '主菜', method: '辣椒爆炒，肉香入味', flavor: '辣香扑鼻，肉片鲜嫩', image: '🌶️', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=经典辣椒炒肉', tags: [] },
  { id: 'm-17', name: '小炒黄牛肉', description: '鲜辣爽口，牛肉劲道', price: 19, stock: 99, sales: 0, category: '主菜', method: '快火翻炒，香辣提味', flavor: '鲜辣爽口，牛肉劲道', image: '🥩', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=小炒黄牛肉', tags: [] },
  { id: 'm-18', name: '混合椒爆炒牛肉', description: '多椒融合，牛肉鲜香', price: 19, stock: 99, sales: 0, category: '主菜', method: '彩椒快炒，肉质滑嫩', flavor: '多椒融合，牛肉鲜香', image: '🫑', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=混合椒爆炒牛肉', tags: [] },
  { id: 'm-19', name: '酸菜鱼', description: '酸辣鲜香，鱼片嫩滑', price: 19, stock: 99, sales: 0, category: '主菜', method: '酸菜熬汤，鱼片入味', flavor: '酸辣鲜香，鱼片嫩滑', image: '🐟', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=酸菜鱼', tags: ['招牌'] },
  { id: 'm-20', name: '红烧排骨', description: '浓香酱汁，排骨软烂', price: 19, stock: 99, sales: 0, category: '主菜', method: '慢火红烧，酱香浓郁', flavor: '浓香酱汁，排骨软烂', image: '🍖', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=红烧排骨', tags: [] },
  { id: 'm-21', name: '鲜椒小炒鸡', description: '鲜辣爽口，鸡肉嫩滑', price: 19, stock: 99, sales: 0, category: '主菜', method: '鲜椒爆炒，鸡肉入味', flavor: '鲜辣爽口，鸡肉嫩滑', image: '🐔', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=鲜椒小炒鸡', tags: [] },
  { id: 'm-22', name: '农家一碗香', description: '家常浓香，食材丰富', price: 19, stock: 99, sales: 0, category: '主菜', method: '多料合炒，层次分明', flavor: '家常浓香，食材丰富', image: '🥘', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=农家一碗香', tags: [] },
  { id: 'm-23', name: '麻婆豆腐', description: '麻辣鲜香，豆腐嫩滑', price: 19, stock: 99, sales: 0, category: '主菜', method: '豆腐入锅，麻辣调味', flavor: '麻辣鲜香，豆腐嫩滑', image: '🌶️', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=麻婆豆腐', tags: [] },
  { id: 'm-24', name: '肉末茄子', description: '咸香入味，茄子软糯', price: 19, stock: 99, sales: 0, category: '主菜', method: '肉末炒香，茄子炖煮', flavor: '咸香入味，茄子软糯', image: '🍆', imageUrl: 'https://placehold.co/320x180/ea580c/ffffff?text=肉末茄子', tags: [] },
  
  // 素菜
  { id: 'm-25', name: '清炒时蔬', description: '清甜爽口，健康美味', price: 19, stock: 99, sales: 0, category: '素菜', method: '轻油快炒，保留原味', flavor: '清甜爽口，健康美味', image: '🥬', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=清炒时蔬', tags: [] },
  { id: 'm-26', name: '酸辣土豆丝', description: '酸辣开胃，脆爽下饭', price: 19, stock: 99, sales: 0, category: '素菜', method: '快炒土豆丝，调酸辣汁', flavor: '酸辣开胃，脆爽下饭', image: '🥔', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=酸辣土豆丝', tags: [] },
  { id: 'm-27', name: '酸辣藕丁', description: '爽脆酸辣，清新解腻', price: 19, stock: 99, sales: 0, category: '素菜', method: '藕丁快炒，酸辣调味', flavor: '爽脆酸辣，清新解腻', image: '🌱', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=酸辣藕丁', tags: [] },
  { id: 'm-28', name: '清炒儿菜', description: '清香脆嫩，鲜甜爽口', price: 19, stock: 99, sales: 0, category: '素菜', method: '快火清炒，保持原味', flavor: '清香脆嫩，鲜甜爽口', image: '🥬', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=清炒儿菜', tags: [] },
  { id: 'm-29', name: '家常豆腐', description: '咸香入味，豆腐嫩滑', price: 19, stock: 99, sales: 0, category: '素菜', method: '煎制豆腐，酱汁收味', flavor: '咸香入味，豆腐嫩滑', image: '🧈', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=家常豆腐', tags: [] },
  { id: 'm-30', name: '时蔬混搭', description: '多彩清新，营养均衡', price: 19, stock: 99, sales: 0, category: '素菜', method: '多种蔬菜快炒', flavor: '多彩清新，营养均衡', image: '🥗', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=时蔬混搭', tags: [] },
  { id: 'm-31', name: '炒三丝', description: '清爽脆口，酸辣适中', price: 19, stock: 99, sales: 0, category: '素菜', method: '土豆、胡萝卜、青椒丝快炒', flavor: '清爽脆口，酸辣适中', image: '🥕', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=炒三丝', tags: [] },
  { id: 'm-32', name: '香菇青菜', description: '清香鲜美，爽口健康', price: 19, stock: 99, sales: 0, category: '素菜', method: '香菇与青菜清炒', flavor: '清香鲜美，爽口健康', image: '🍄', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=香菇青菜', tags: [] },
  { id: 'm-33', name: '清炒丝瓜', description: '清甜爽滑，汁水丰富', price: 19, stock: 99, sales: 0, category: '素菜', method: '丝瓜快炒，保持鲜嫩', flavor: '清甜爽滑，汁水丰富', image: '🥒', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=清炒丝瓜', tags: [] },
  { id: 'm-34', name: '干锅花菜', description: '香辣脆嫩，锅气十足', price: 19, stock: 99, sales: 0, category: '素菜', method: '干锅爆炒，花菜入味', flavor: '香辣脆嫩，锅气十足', image: '🥦', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=干锅花菜', tags: [] },
  { id: 'm-35', name: '番茄炒蛋', description: '酸甜可口，蛋嫩汁浓', price: 19, stock: 99, sales: 0, category: '素菜', method: '番茄与鸡蛋快炒', flavor: '酸甜可口，蛋嫩汁浓', image: '🍅', imageUrl: 'https://placehold.co/320x180/10b981/ffffff?text=番茄炒蛋', tags: [] },
  
  // 汤品
  { id: 'm-36', name: '粉藕排骨汤', description: '汤清味浓，藕粉排骨香', price: 19, stock: 99, sales: 0, category: '汤品', method: '慢火炖煮，清爽滋补', flavor: '汤清味浓，藕粉排骨香', image: '🍲', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=粉藕排骨汤', tags: [] },
  { id: 'm-37', name: '虫草花炖鸡汤', description: '滋补养生，鲜香浓郁', price: 19, stock: 99, sales: 0, category: '汤品', method: '虫草花与鸡肉慢炖', flavor: '滋补养生，鲜香浓郁', image: '🍲', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=虫草花炖鸡汤', tags: ['招牌'] },
  { id: 'm-38', name: '鲜香鱼汤', description: '鱼鲜汤浓，豆腐嫩滑', price: 19, stock: 99, sales: 0, category: '汤品', method: '鱼骨熬汤，豆腐入味', flavor: '鱼鲜汤浓，豆腐嫩滑', image: '🐠', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=鲜香鱼汤', tags: [] },
  { id: 'm-39', name: '鲫鱼豆腐汤', description: '鱼鲜豆香，汤汁清润', price: 19, stock: 99, sales: 0, category: '汤品', method: '鲫鱼熬汤，豆腐入味', flavor: '鱼鲜豆香，汤汁清润', image: '🥣', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=鲫鱼豆腐汤', tags: [] },
  { id: 'm-40', name: '炖雪梨', description: '清甜润喉，温润滋养', price: 19, stock: 99, sales: 0, category: '汤品', method: '雪梨慢炖，甜汤入味', flavor: '清甜润喉，温润滋养', image: '🍐', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=炖雪梨', tags: [] },
  { id: 'm-41', name: '罗宋汤', description: '酸甜浓郁，西式风味', price: 19, stock: 99, sales: 0, category: '汤品', method: '番茄牛肉慢炖', flavor: '酸甜浓郁，西式风味', image: '🥣', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=罗宋汤', tags: [] },
  { id: 'm-42', name: '菌菇汤', description: '清鲜爽口，菌香浓郁', price: 19, stock: 99, sales: 0, category: '汤品', method: '多种菌菇熬煮', flavor: '清鲜爽口，菌香浓郁', image: '🍄', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=菌菇汤', tags: [] },
  { id: 'm-43', name: '胡椒猪肚鸡汤', description: '胡椒辛香，滋补暖胃', price: 19, stock: 99, sales: 0, category: '汤品', method: '猪肚鸡肉慢炖，胡椒提味', flavor: '胡椒辛香，滋补暖胃', image: '🍲', imageUrl: 'https://placehold.co/320x180/3b82f6/ffffff?text=胡椒猪肚鸡汤', tags: [] },
  
  // 饮品
  { id: 'm-44', name: '小蒋特调美式', description: '苦中带甘，醇厚回味', price: 15, stock: 99, sales: 0, category: '饮品', method: '意式浓缩+热水', flavor: '苦中带甘，醇厚回味', image: '☕', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=小蒋特调美式', tags: ['招牌'] },
  { id: 'm-45', name: '丝滑拿铁', description: '奶香浓郁，柔滑细腻', price: 18, stock: 99, sales: 0, category: '饮品', method: '浓缩咖啡+蒸汽牛奶', flavor: '奶香浓郁，柔滑细腻', image: '🥛', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=丝滑拿铁', tags: [] },
  { id: 'm-46', name: '焦糖玛奇朵', description: '香甜浓郁，层次丰富', price: 20, stock: 99, sales: 0, category: '饮品', method: '浓缩+牛奶+焦糖', flavor: '香甜浓郁，层次丰富', image: '🍮', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=焦糖玛奇朵', tags: [] },
  { id: 'm-47', name: '摩卡奇遇', description: '咖啡巧克力双重奏', price: 20, stock: 99, sales: 0, category: '饮品', method: '浓缩+巧克力+牛奶', flavor: '咖啡巧克力双重奏', image: '🍫', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=摩卡奇遇', tags: [] },
  { id: 'm-48', name: '冰萃冷brew', description: '顺滑清甜，冰爽解渴', price: 16, stock: 99, sales: 0, category: '饮品', method: '冷水慢萃12小时', flavor: '顺滑清甜，冰爽解渴', image: '🧊', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=冰萃冷brew', tags: [] },
  { id: 'm-49', name: '手冲单品', description: '果酸明亮，香气馥郁', price: 22, stock: 99, sales: 0, category: '饮品', method: '手工冲泡精品豆', flavor: '果酸明亮，香气馥郁', image: '🫖', imageUrl: 'https://placehold.co/320x180/8b4513/ffffff?text=手冲单品', tags: [] }
];

// 用户ID管理
const getOrCreateUserId = () => {
    let id = localStorage.getItem('food_app_user_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('food_app_user_id', id);
    }
    return id;
};

const USER_ID = getOrCreateUserId(); 


// --- 3. 通用组件 ---

// 通用：加载动画
const Loading = () => (
  <div className="flex items-center justify-center h-screen bg-orange-50">
    <div className="animate-bounce text-4xl">🥘</div>
    <span className="ml-2 text-orange-600 font-bold">正在连接美味星球 (Supabase)...</span>
  </div>
);

// 通用：弹窗组件（支持滚动）
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        {children}
      </div>
    </div>
  );
};

// 通用：Toast 提示信息
const Toast = ({ message, onClose }) => {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => onClose(), 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-top-4 duration-300">
                {message}
            </div>
        </div>
    );
};

// 通用：订单详情Modal
const OrderDetailModal = ({ order, onClose, sequenceMap }) => {
    if (!order) return null;
    
    const { displayId, displayTime } = formatOrderDisplay(order.created_at, sequenceMap);
    
    const statusConfig = {
        pending: { bg: 'bg-orange-100', text: 'text-orange-600', label: '待接单', icon: '⏳' },
        cooking: { bg: 'bg-blue-100', text: 'text-blue-600', label: '烹饪中', icon: '👨‍🍳' },
        completed: { bg: 'bg-green-100', text: 'text-green-600', label: '已完成', icon: '✅' },
        rejected: { bg: 'bg-red-100', text: 'text-red-600', label: '已拒绝', icon: '❌' },
        cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: '已撤销', icon: '🚫' },
        deleted: { bg: 'bg-gray-200', text: 'text-gray-700', label: '已删除', icon: '🗑️' }
    };
    
    const config = statusConfig[order.status] || statusConfig.pending;
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">订单详情</h3>
                        <p className="text-sm text-gray-500 mt-1">订单号: {displayId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                {/* 订单状态 */}
                <div className={`${config.bg} ${config.text} rounded-xl p-4 mb-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{config.icon}</span>
                        <span className="font-bold text-lg">{config.label}</span>
                    </div>
                    {order.urgent && (
                        <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                            ⚡ 催单中
                        </span>
                    )}
                </div>
                
                {/* 时间线 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                    <h4 className="font-bold text-gray-700 text-sm mb-3">📅 时间线</h4>
                    
                    <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5"></div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">下单时间</p>
                            <p className="text-xs text-gray-500">{displayTime}</p>
                        </div>
                    </div>
                    
                    {order.cooking_started_at && (
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">开始制作</p>
                                <p className="text-xs text-gray-500">{getTimeDisplay(order.cooking_started_at)}</p>
                            </div>
                        </div>
                    )}
                    
                    {order.completed_at && (
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">完成时间</p>
                                <p className="text-xs text-gray-500">{getTimeDisplay(order.completed_at)}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* 菜品列表 */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-gray-700 text-sm mb-3">🍽️ 菜品明细</h4>
                    <div className="space-y-2">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-800">{item.name} x{item.quantity}</p>
                                    {item.special_request && item.special_request !== '无特殊备注' && (
                                        <p className="text-xs text-orange-600 mt-1">💬 {item.special_request}</p>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-gray-600">¥{item.price * item.quantity}</p>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 总价 */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 flex justify-between items-center">
                    <span className="font-bold text-gray-700">订单总价</span>
                    <span className="text-2xl font-bold text-orange-600">¥{order.total_price}</span>
                </div>
                
                <button onClick={onClose} className="w-full mt-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold active:scale-95 transition">
                    关闭
                </button>
            </div>
        </Modal>
    );
};

// 订单编辑Modal
const OrderEditModal = ({ order, onClose, onSave }) => {
    const [editedItems, setEditedItems] = useState(order.items);
    
    const updateQuantity = (index, delta) => {
        setEditedItems(prev => {
            const newItems = [...prev];
            const newQty = Math.max(0, newItems[index].quantity + delta);
            if (newQty === 0) {
                // 删除数量为0的菜品
                return newItems.filter((_, i) => i !== index);
            }
            newItems[index] = { ...newItems[index], quantity: newQty };
            return newItems;
        });
    };
    
    const totalPrice = editedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">编辑订单</h3>
                        <p className="text-sm text-gray-500 mt-1">调整菜品数量</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                {editedItems.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p>订单不能为空</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 mb-4">
                            {editedItems.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{item.name}</p>
                                            {item.special_request && item.special_request !== '无特殊备注' && (
                                                <p className="text-xs text-orange-600 mt-1">💬 {item.special_request}</p>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-gray-600">¥{item.price}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => updateQuantity(idx, -1)}
                                                className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gray-300 active:scale-95"
                                            >
                                                <Minus className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <span className="font-bold text-lg text-gray-800 w-8 text-center">{item.quantity}</span>
                                            <button 
                                                onClick={() => updateQuantity(idx, 1)}
                                                className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center active:scale-95"
                                            >
                                                <Plus className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-bold text-orange-600">小计: ¥{item.price * item.quantity}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-700">新总价</span>
                            <span className="text-2xl font-bold text-orange-600">¥{totalPrice}</span>
                        </div>
                        
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold active:scale-95 transition">
                                取消
                            </button>
                            <button 
                                onClick={() => onSave(order.id, editedItems)}
                                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold active:scale-95 transition"
                                disabled={editedItems.length === 0}
                            >
                                保存修改
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};


// --- 4. 顾客端组件 ---

// 顾客端：历史订单界面 (显示所有订单并支持撤销，支持日期筛选)
const OrderHistoryView = ({ userId, allOrders, showToast }) => {
    const sequenceMap = useMemo(() => calculateDailySequences(allOrders), [allOrders]);
    const [selectedDate, setSelectedDate] = useState('all'); // 'all' 或 'YYYYMMDD'
    const [selectedOrder, setSelectedOrder] = useState(null); // 选中查看详情的订单
    const [editingOrder, setEditingOrder] = useState(null); // 正在编辑的订单
    
    // 获取所有可用日期
    const availableDates = useMemo(() => {
        const dates = new Set();
        allOrders.forEach(order => {
            if (order.status !== 'cancelled') {
                const dateKey = getDateKey(order.created_at);
                dates.add(dateKey);
            }
        });
        return Array.from(dates).sort().reverse(); // 降序排列
    }, [allOrders]);
    
    // 显示所有设备的订单（移除user_id筛选），过滤已撤销，按日期筛选
    const displayOrders = useMemo(() => {
        return allOrders
            .filter(o => o.status !== 'cancelled' && o.status !== 'deleted') // 过滤已撤销和已删除
            .filter(o => {
                if (selectedDate === 'all') return true;
                return getDateKey(o.created_at) === selectedDate;
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [allOrders, selectedDate]);
    
    const cancelOrder = async (orderId) => {
        if (!window.confirm('确定要撤销这个订单吗？')) return;
        
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId)
                .select();

            if (error) throw new Error(error.message);
            showToast('订单已撤销');
        } catch (e) {
            console.error('撤销失败:', e);
            showToast('撤销失败，请重试');
        }
    };
    
    // 更新订单
    const updateOrder = async (orderId, updatedItems) => {
        try {
            const totalPrice = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const { error } = await supabase
                .from('orders')
                .update({ 
                    items: updatedItems,
                    total_price: totalPrice,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (error) throw new Error(error.message);
            showToast('订单已更新');
            setEditingOrder(null);
        } catch (e) {
            console.error('更新失败:', e);
            showToast('更新失败，请重试');
        }
    };

    return (
        <div className="p-4 pt-10 pb-24 space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">所有订单</h2>
            
            {/* 日期筛选 */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                <button
                    onClick={() => setSelectedDate('all')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                        selectedDate === 'all' 
                            ? 'bg-orange-500 text-white shadow-lg' 
                            : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                >
                    全部日期
                </button>
                {availableDates.map(date => {
                    const year = date.substring(0, 4);
                    const month = date.substring(4, 6);
                    const day = date.substring(6, 8);
                    return (
                        <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                                selectedDate === date 
                                    ? 'bg-orange-500 text-white shadow-lg' 
                                    : 'bg-white text-gray-600 border border-gray-200'
                            }`}
                        >
                            {month}/{day}
                        </button>
                    );
                })}
            </div>
            
            {displayOrders.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                    <div className="text-4xl mb-2">😭</div>
                    <p>{selectedDate === 'all' ? '还没有任何订单哦' : '该日期没有订单'}</p>
                </div>
            ) : (
                displayOrders.map(order => {
                    const { displayId, displayTime } = formatOrderDisplay(order.created_at, sequenceMap);
                    const isPending = order.status === 'pending';
                    const isCooking = order.status === 'cooking';
                    const isCompleted = order.status === 'completed';
                    const isRejected = order.status === 'rejected';
                    const isCancelled = order.status === 'cancelled';
                    
                    const statusConfig = {
                        pending: { bg: 'bg-orange-100', text: 'text-orange-600', label: '待接单' },
                        cooking: { bg: 'bg-blue-100', text: 'text-blue-600', label: '烹饪中' },
                        completed: { bg: 'bg-green-100', text: 'text-green-600', label: '已完成' },
                        rejected: { bg: 'bg-red-100', text: 'text-red-600', label: '已拒绝' },
                        cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: '已撤销' },
                        deleted: { bg: 'bg-gray-200', text: 'text-gray-700', label: '已删除' }
                    };
                    
                    const config = statusConfig[order.status] || statusConfig.pending;
                    
                    return (
                        <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-gray-700 text-lg">订单号: {displayId}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
                                    {config.label}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">时间: {displayTime}</p>
                            
                            <p className="text-sm text-gray-500 mb-2">总价: <span className="font-bold text-orange-600">¥{order.total_price}</span></p>
                            {order.items.map((item, idx) => (
                                <div key={idx} className="text-sm text-gray-600 flex justify-between mb-1">
                                    <span>{item.name} x{item.quantity}</span>
                                    {item.special_request && item.special_request !== '无特殊备注' && (
                                        <span className="text-xs text-gray-400 italic ml-2">{item.special_request}</span>
                                    )}
                                </div>
                            ))}
                            
                            {/* 操作按钮 */}
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1"
                                >
                                    <Eye className="w-4 h-4" /> 查看详情
                                </button>
                                {/* 编辑按钮：只有pending状态才能编辑 */}
                                {isPending && (
                                    <button
                                        onClick={() => setEditingOrder(order)}
                                        className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1"
                                    >
                                        <Edit className="w-4 h-4" /> 编辑
                                    </button>
                                )}
                                {/* 撤销按钮：只有pending和cooking状态才能撤销 */}
                                {(isPending || isCooking) && (
                                    <button
                                        onClick={() => cancelOrder(order.id)}
                                        className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-sm active:scale-95 transition-transform"
                                    >
                                        撤销订单
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            
            {/* 订单详情Modal */}
            {selectedOrder && (
                <OrderDetailModal 
                    order={selectedOrder} 
                    onClose={() => setSelectedOrder(null)}
                    sequenceMap={sequenceMap}
                />
            )}
            
            {/* 订单编辑Modal */}
            {editingOrder && (
                <OrderEditModal 
                    order={editingOrder} 
                    onClose={() => setEditingOrder(null)}
                    onSave={updateOrder}
                />
            )}
        </div>
    );
};

// 顾客端：购物车界面 (更新为菜品级备注)
const CartView = ({ cartItems, setCartItems, setView, userId, setActiveOrder }) => {
    const [loading, setLoading] = useState(false);

    const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);

    const updateQuantity = (cart_id, delta) => { 
        setCartItems(prev => {
            const index = prev.findIndex(item => item.cart_id === cart_id);
            if (index === -1) return prev;

            const newItems = [...prev];
            newItems[index].quantity += delta;

            if (newItems[index].quantity <= 0) {
                return newItems.filter(item => item.cart_id !== cart_id);
            }
            return newItems;
        });
    };

    const placeOrder = async () => {
        if (cartItems.length === 0) return;
        setLoading(true);

        const newOrder = {
            user_id: userId,
            items: cartItems.map(({ cart_id, ...item }) => item), 
            total_price: total,
            status: 'pending',
            customer_name: "吃货",
            urgent: false,
            urgent_count: 0
        };

        console.log('准备下单，订单数据:', newOrder);

        try {
            const { data, error } = await supabase
                .from('orders')
                .insert([newOrder])
                .select();

            if (error) {
                console.error('Supabase 插入错误:', error);
                alert('下单失败: ' + error.message);
                throw error;
            }

            console.log('下单成功，返回数据:', data);
            setCartItems([]);
            setView('history'); 
            alert('下单成功！');
        } catch (e) {
            console.error("下单失败 Error:", e);
            alert('下单失败，请检查控制台');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 pt-10 pb-28 flex flex-col min-h-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">爱心购物车</h2>
            
            <div className="flex-1 space-y-4 overflow-y-auto pb-4">
                {cartItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        <div className="text-4xl mb-2">🛒</div>
                        <p>购物车里还没有宝贝哦</p>
                    </div>
                ) : (
                    cartItems.map(item => (
                        <div key={item.cart_id} className="bg-white rounded-xl p-3 shadow-sm flex flex-col border border-orange-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{item.image}</span>
                                    <div>
                                        <p className="font-bold text-gray-800">{item.name}</p>
                                        <p className="text-sm text-orange-500">¥{item.price}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1 shrink-0">
                                    <button onClick={() => updateQuantity(item.cart_id, -1)} className="p-1 bg-white rounded-full text-gray-600 border border-gray-200">
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.cart_id, 1)} className="p-1 bg-orange-400 text-white rounded-full">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {/* Display item special request */}
                            <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 italic">
                                备注: {item.special_request}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {cartItems.length > 0 && (
                <div className="mt-4 p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-medium text-gray-700">总计:</span>
                        <span className="text-2xl font-bold text-orange-600">¥{total}</span>
                    </div>
                    <button 
                        onClick={placeOrder} 
                        disabled={loading} 
                        className="w-full py-3 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        {loading ? '下单中...' : <><Heart className="w-5 h-5 fill-current" /> 确认下单 ({cartItems.length} 项)</>}
                    </button>
                </div>
            )}
        </div>
    );
};


// 顾客端：主界面 (更新了 addToCart 逻辑和 Modal 内部)
const CustomerView = ({ userId, setRole, menuItems, allOrders, initialView = 'menu' }) => {
  const [view, setView] = useState(initialView); // menu, cart, status, history
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  
  // New: temporary state for detail page
  const [requestItemQuantity, setRequestItemQuantity] = useState(1);
  const [itemSpecialRequest, setItemSpecialRequest] = useState('无特殊备注'); 
  const [quickOptions, setQuickOptions] = useState({ spicy: false, cilantro: false, scallion: false });
  
  const [toastMessage, setToastMessage] = useState(''); 

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);
  
  // 催单功能
  const urgentOrder = useCallback(async (orderId) => {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ urgent: true, urgent_count: (activeOrder?.urgent_count || 0) + 1 })
            .eq('id', orderId)
            .select();

        if (error) throw new Error(error.message);
        showToast('已催单！大厨收到通知啦～');
    } catch (e) {
        console.error('催单失败:', e);
    }
  }, [activeOrder, showToast]);

  // Listen for the latest order of this user (for status page)
  useEffect(() => {
    if (!userId) return;

    const myOrder = allOrders
        .filter(o => o.user_id === userId && o.status !== 'completed' && o.status !== 'rejected' && o.status !== 'cancelled' && o.status !== 'deleted')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            
    if (myOrder) {
        setActiveOrder(myOrder);
    } else {
        setActiveOrder(null);
        if (view === 'status') {
             setView('menu');
        }
    }
  }, [userId, allOrders, view]);


  // Menu item click handler (reset request state)
  const handleSelectItem = (item) => {
      setSelectedItem(item);
      setRequestItemQuantity(1);
      setItemSpecialRequest('无特殊备注'); // Default value
      setQuickOptions({ spicy: false, cilantro: false, scallion: false }); // 重置快捷选项
  };

  // Add selected item to cart (Key update: include itemSpecialRequest and quick options)
  const addToCart = () => {
    if (!selectedItem || requestItemQuantity <= 0) return;
    
    // 构建快捷选项文本 - 根据菜品类别决定文本
    const quickOptionsText = [];
    const isBeverage = selectedItem.category === '饮品';
    
    if (isBeverage) {
        // 饮品：冰/热/常温
        if (quickOptions.spicy) quickOptionsText.push('冰');
        if (quickOptions.cilantro) quickOptionsText.push('热');
        if (quickOptions.scallion) quickOptionsText.push('常温');
    } else {
        // 其他菜品：加点辣/香菜/葱
        if (quickOptions.spicy) quickOptionsText.push('加点辣');
        if (quickOptions.cilantro) quickOptionsText.push('加香菜');
        if (quickOptions.scallion) quickOptionsText.push('加葱');
    }
    
    // 合并备注和快捷选项
    let finalRequest = itemSpecialRequest.trim() || '无特殊备注';
    if (quickOptionsText.length > 0) {
        const optionsStr = quickOptionsText.join('、');
        finalRequest = finalRequest === '无特殊备注' ? optionsStr : `${optionsStr}；${finalRequest}`;
    }

    setCartItems(prev => {
        // Items with request are always added as a new line item
        return [
            ...prev,
            { 
                ...selectedItem, 
                quantity: requestItemQuantity,
                special_request: finalRequest, // Bind request to item
                quick_options: quickOptions, // 保存快捷选项
                cart_id: crypto.randomUUID(), // Unique cart line ID
            }
        ];
    });

    // 1. Close modal
    setSelectedItem(null);
    // 2. Reset quantity and request
    setRequestItemQuantity(1);
    setItemSpecialRequest('无特殊备注');
    setQuickOptions({ spicy: false, cilantro: false, scallion: false });
    // 3. Show Toast, do not switch view
    showToast(`${selectedItem.name} x${requestItemQuantity} (${finalRequest}) 已加入购物车! 🎉`);
  };

  const currentMenu = menuItems; // Use editable menu passed from App

  // 分类状态
  const [selectedCategory, setSelectedCategory] = useState('主菜');
  const categories = ['主菜', '主食', '素菜', '汤品', '饮品'];
  
  // 根据分类筛选菜单，招牌菜品自动排序到最前面
  const filteredMenu = useMemo(() => {
    let filtered = currentMenu.filter(item => item.category === selectedCategory);
    
    // 排序: 招牌菜品在前，其他菜品在后
    return filtered.sort((a, b) => {
      const aIsSignature = a.tags?.includes('招牌') || false;
      const bIsSignature = b.tags?.includes('招牌') || false;
      
      if (aIsSignature && !bIsSignature) return -1;
      if (!aIsSignature && bIsSignature) return 1;
      return 0;
    });
  }, [currentMenu, selectedCategory]);

  // Render main content
  const renderContent = () => {
    const sequenceMap = calculateDailySequences(allOrders);
    
    if (view === 'menu') {
        return (
            <div className="px-4 pt-10 pb-28">
                <h2 className="font-bold text-2xl text-gray-800 mb-4">今日菜单</h2>
                
                {/* 分类筛选按钮 */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                                selectedCategory === cat 
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105' 
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                
                {/* 菜品列表 */}
                <div className="space-y-4">
                    {filteredMenu.map((item, index) => (
                        <div 
                            key={item.id} 
                            onClick={() => handleSelectItem(item)} 
                            className="bg-white rounded-2xl p-3 shadow-md border border-orange-50 flex gap-4 cursor-pointer transform transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards`
                            }}
                        >
                            {/* 带动画效果的菜品图标 */}
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center text-4xl shrink-0 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative transform group-hover:scale-110 transition-transform duration-300">
                                    {item.image}
                                </span>
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                                        {item.tags && item.tags.includes('招牌') && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">招牌</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-orange-500 font-bold text-lg flex items-center">
                                        <Heart className="w-4 h-4 mr-1 fill-current animate-pulse" /> ¥{item.price}
                                    </span>
                                    <span className="px-3 py-1 rounded-full text-sm font-bold shadow-md transition-all bg-orange-400 text-white shadow-orange-200 hover:bg-orange-500">
                                        来一份
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    if (view === 'cart') {
        return <CartView cartItems={cartItems} setCartItems={setCartItems} setView={setView} userId={userId} setActiveOrder={setActiveOrder} />;
    }

    if (view === 'history') {
        return <OrderHistoryView userId={userId} allOrders={allOrders} showToast={showToast} />;
    }

    // Order status (view === 'status') - Update order ID and details
    if (view === 'status' && activeOrder) {
        const isCooking = activeOrder.status === 'cooking';
        const isPending = activeOrder.status === 'pending';
        const { displayId, displayTime } = formatOrderDisplay(activeOrder.created_at, sequenceMap);
        
        return (
            <div className="min-h-full bg-[#FFFAF0] flex flex-col relative pb-10">
                <div className="absolute top-0 w-full h-64 bg-orange-400 rounded-b-[40px] z-0"></div>
                
                <div className="relative z-10 px-6 pt-12 pb-6 flex-1 flex flex-col overflow-y-auto">
                    <div className="flex justify-between items-center text-white mb-8">
                        <button onClick={() => setView('menu')} className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                            <ChevronLeft />
                        </button>
                        <div className="text-center">
                            <h1 className="font-bold text-lg">订单追踪 - #{displayId}</h1>
                            <p className="text-xs opacity-80">{displayTime}</p>
                        </div>
                        <div className="w-8"></div> 
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl p-6 flex-1 flex flex-col items-center text-center">
                        <div className="w-32 h-32 bg-orange-50 rounded-full flex items-center justify-center text-6xl mb-6 relative">
                            {isCooking ? '🍳' : '🛎️'}
                            {isCooking && <div className="absolute top-0 right-0 animate-ping w-4 h-4 bg-red-400 rounded-full"></div>}
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {isPending ? '等待大厨接单' : '大厨正在烹饪中!'}
                        </h2>
                        <p className="text-gray-500 text-sm mb-8">
                            {isPending ? '大厨可能正在打游戏，稍等一下...' : '预计送达：马上（厨房 -> 客厅）'}
                        </p>

                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-8 relative">
                            <div 
                                className={`h-full bg-orange-400 rounded-full transition-all duration-1000 ${isCooking ? 'w-2/3 animate-pulse' : 'w-1/6'}`}
                            ></div>
                        </div>

                        <div className="w-full bg-orange-50 h-px mb-6"></div>
                        
                        <div className="w-full bg-orange-50 rounded-xl p-4 text-left space-y-3 mb-auto">
                            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">订单详情</h3>
                            {activeOrder.items.map((item, idx) => {
                                // 根据备注判断是否为饮品
                                const isBeverage = item.special_request && (
                                    item.special_request.includes('冰') || 
                                    item.special_request.includes('热') || 
                                    item.special_request.includes('常温')
                                );
                                
                                return (
                                    <div key={idx} className="flex justify-between items-start border-b border-orange-100 last:border-b-0 last:pb-0 pb-2 mb-2">
                                        <div>
                                            <span className="font-medium text-gray-700">{item.name} x{item.quantity}</span>
                                            {item.special_request && item.special_request !== '无特殊备注' && (
                                                <p className="text-xs text-gray-500 italic mt-0.5">
                                                    {isBeverage ? '温度: ' : '备注: '}{item.special_request}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button 
                            onClick={() => urgentOrder(activeOrder.id)} 
                            className="w-full py-4 mt-6 mb-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform hover:bg-red-600"
                        >
                            {isPending ? '🔔 疯狂催单' : '🐶 乖乖等待'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
  };

  // Bottom Tab Navigation (unchanged)
  const NavItem = ({ targetView, icon: Icon, label }) => (
    <button 
        onClick={() => setView(targetView)} 
        className={`flex flex-col items-center p-2 rounded-lg transition ${view === targetView ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
    >
        <Icon className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FFFAF0] flex flex-col">
        {/* Top Navigation and Role Switch */}
        <div className="sticky top-0 z-10 bg-[#FFFAF0]/90 backdrop-blur-md px-4 py-3 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-500 fill-current" />
                <h1 className="text-xl font-bold text-gray-800">吃货的点单机</h1>
            </div>
            <button 
                onClick={() => setRole(null)} 
                className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-orange-100 transition shadow-md"
                title="返回首页"
            >
                <Home className="w-5 h-5 text-gray-600 hover:text-orange-500" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
            {renderContent()}
        </div>

        {/* Bottom Tab Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t py-2 flex justify-around shadow-lg z-20">
            <NavItem targetView="menu" icon={Home} label="菜单" />
            <NavItem targetView="cart" icon={ShoppingCart} label={`购物车 (${cartItems.length})`} />
            <NavItem targetView="status" icon={Bell} label={activeOrder ? '订单状态' : '无订单'} />
            <NavItem targetView="history" icon={List} label="我的订单" />
        </div>

        {/* Toast Notification */}
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />


        {/* Detail Modal */}
        <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)}>
          {selectedItem && (
            <div className="p-3 pb-4 max-h-[92vh] overflow-y-auto">
              {/* 实拍图片显示（自适应高度，最大20vh） */}
              <div className="w-full max-h-[18vh] bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center text-5xl mb-2 shadow-lg">
                  {selectedItem.imageUrl ? (
                      <img 
                          src={selectedItem.imageUrl} 
                          alt={selectedItem.name} 
                          className="w-full h-auto max-h-[18vh] object-contain"
                          onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/400x400/f3f4f6/6b7280?text=无实拍图/链接失效"; }} 
                      />
                  ) : (
                      selectedItem.image
                  )}
              </div>

              <h3 className="text-xl font-bold text-gray-800">{selectedItem.name}</h3>
              <p className="text-gray-500 text-xs mt-1">{selectedItem.description}</p>
              
              {/* Item details display */}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded-lg">
                  <p><span className="font-bold text-gray-600">类别:</span> {selectedItem.category}</p>
                  <p><span className="font-bold text-gray-600">做法:</span> {selectedItem.method}</p>
                  <p><span className="font-bold text-gray-600">口味:</span> {selectedItem.flavor}</p>
                  <p><span className="font-bold text-gray-600">销量:</span> <span className="font-bold text-orange-600">{selectedItem.sales || 0}</span> 份</p>
              </div>

              <div className="mt-2 space-y-2">
                {/* 快捷选项 - 根据菜品类别动态显示 */}
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                   <label className="text-xs font-bold text-blue-600 block mb-1">快捷选项</label>
                   <div className="flex gap-2 flex-wrap">
                     {selectedItem.category === '饮品' ? (
                       // 饮品选项：冰/热/常温
                       <>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, spicy: !prev.spicy }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.spicy 
                               ? 'bg-blue-500 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🧊 冰
                         </button>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, cilantro: !prev.cilantro }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.cilantro 
                               ? 'bg-red-500 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🔥 热
                         </button>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, scallion: !prev.scallion }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.scallion 
                               ? 'bg-green-500 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🌡️ 常温
                         </button>
                       </>
                     ) : (
                       // 其他菜品选项：加辣/香菜/葱
                       <>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, spicy: !prev.spicy }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.spicy 
                               ? 'bg-red-500 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🌶️ 加点辣
                         </button>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, cilantro: !prev.cilantro }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.cilantro 
                               ? 'bg-green-500 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🌿 加香菜
                         </button>
                         <button
                           onClick={() => setQuickOptions(prev => ({ ...prev, scallion: !prev.scallion }))}
                           className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                             quickOptions.scallion 
                               ? 'bg-green-600 text-white shadow-md' 
                               : 'bg-white text-gray-600 border border-gray-200'
                           }`}
                         >
                           🧅 加葱
                         </button>
                       </>
                     )}
                   </div>
                </div>
                
                <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                  <label className="text-xs font-bold text-red-400 block mb-1">数量选择</label>
                  <div className="flex items-center justify-center gap-3 py-1">
                    <button onClick={() => setRequestItemQuantity(q => Math.max(1, q - 1))} className="p-1.5 bg-white rounded-full text-gray-600 border shadow-sm active:scale-95">
                        <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-bold text-gray-800">{requestItemQuantity}</span>
                    <button onClick={() => setRequestItemQuantity(q => q + 1)} className="p-1.5 bg-orange-400 text-white rounded-full shadow-md active:scale-95">
                        <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Key: Item-level special request input */}
                <div className="bg-green-50 p-2 rounded-lg border border-green-100">
                   <label className="text-xs font-bold text-green-600 block mb-1">本菜品特殊备注</label>
                   <textarea 
                    value={itemSpecialRequest === '无特殊备注' ? '' : itemSpecialRequest}
                    onChange={(e) => setItemSpecialRequest(e.target.value)}
                    className="w-full bg-white rounded-lg p-2 text-xs border-none focus:ring-2 focus:ring-green-200 outline-none"
                    rows={2}
                    placeholder="例如：多放香菜，不要太甜"
                   />
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <button onClick={() => setSelectedItem(null)} className="flex-1 py-2 rounded-lg bg-gray-100 font-bold text-gray-600 active:scale-95 text-sm">取消</button>
                <button 
                    onClick={addToCart} 
                    className="flex-1 py-2 rounded-lg text-white font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 bg-orange-500 shadow-orange-200 text-sm"
                >
                    <ShoppingCart className="w-4 h-4 fill-current" /> 
                    加入购物车
                </button>
              </div>
            </div>
          )}
        </Modal>
    </div>
  );
};


// 菜单编辑子组件 (实现 Supabase Storage 模拟上传)
const MenuEditForm = ({ item, onSave, onCancel, showToast }) => {
    const [formData, setFormData] = useState({
        ...item,
        isSignature: item?.tags?.includes('招牌') || false
    });
    const [isUploading, setIsUploading] = useState(false); // New: Upload status

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: name === 'price' || name === 'stock' ? parseInt(value) || 0 : value
        }));
    };

    // 关键更新: 使用模拟的 Supabase Storage 上传文件
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsUploading(true);
            try {
                // Generate a unique file name
                const fileName = `${formData.id}-${Date.now()}-${file.name.replace(/\s/g, '_')}`;
                const bucketName = 'menu_images';
                
                // 1. Upload the file (Real Storage API call via fetch)
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(fileName, file);

                if (uploadError) throw new Error(uploadError.message);

                // 2. Get the public URL
                const { data: urlData, error: urlError } = supabase.storage
                    .from(bucketName)
                    .getPublicUrl(fileName);

                if (urlError) throw new Error(urlError.message);
                
                if (urlData.publicUrl) {
                    setFormData(prev => ({ 
                        ...prev, 
                        imageUrl: urlData.publicUrl 
                    }));
                    showToast("实拍图已成功上传至云端并获取链接！");
                } else {
                     throw new Error("未能获取到公共 URL。请检查 Storage 权限。");
                }
            } catch (error) {
                console.error("图片上传失败:", error);
                showToast(`上传失败: ${error.message}`);
            } finally {
                setIsUploading(false);
                e.target.value = ''; // Reset file input
            }
        }
    };

    return (
        <div className="p-4 space-y-3">
            <h4 className="text-lg font-bold text-gray-800">编辑 {item.name}</h4>
            
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-sm font-medium text-gray-700">菜名</span>
                    <input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg focus:ring-orange-500" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-gray-700">价格 (¥)</span>
                    <input type="number" name="price" value={formData.price} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg focus:ring-orange-500" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-gray-700">销量 (只读)</span>
                    <input type="number" value={formData.sales || 0} readOnly disabled className="mt-1 w-full p-2 border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-gray-700">类别</span>
                    <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg focus:ring-orange-500">
                        {['主菜', '主食', '素菜', '汤品', '饮品'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </label>
            </div>
            
            {/* 招牌菜品开关 */}
            <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100">
                <input 
                    type="checkbox" 
                    id="isSignature"
                    checked={formData.isSignature}
                    onChange={(e) => setFormData(prev => ({ ...prev, isSignature: e.target.checked }))}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <label htmlFor="isSignature" className="text-sm font-bold text-red-600 cursor-pointer flex items-center gap-1">
                    <span className="text-lg">⭐</span> 设为招牌菜品
                </label>
            </div>
            
            <label className="block">
                <span className="text-sm font-medium text-gray-700">描述</span>
                <textarea name="description" value={formData.description} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg focus:ring-orange-500" rows="2" />
            </label>
            
            {/* 关键：云端图片上传界面 */}
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-2">
                <span className="text-sm font-bold text-blue-700 flex items-center">
                    <Upload className="w-4 h-4 mr-1" /> 菜品实拍图管理 (Supabase Storage)
                </span>
                
                {/* 1. 文件上传 */}
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    disabled={isUploading}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer disabled:opacity-50"
                />
                
                {/* 上传状态显示 */}
                <div className='flex items-center text-xs text-gray-500 pt-2 border-t border-blue-100'>
                    {isUploading ? (
                        <span className='flex items-center text-blue-600 font-semibold'>
                            <Loader className='w-4 h-4 mr-2 animate-spin' /> 正在上传到 Supabase Storage...
                        </span>
                    ) : (
                        <span className='text-gray-700'>
                            当前 URL: 
                            <span className="font-mono text-xs block truncate text-gray-700 bg-white p-1 rounded mt-1">{formData.imageUrl}</span>
                        </span>
                    )}
                </div>

                {/* URL 手动输入（备用） */}
                <label className="block pt-2">
                    <span className="text-xs font-medium text-gray-700">或手动输入图片 URL (备用)</span>
                    <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg focus:ring-orange-500 text-sm" placeholder="粘贴图片链接" />
                </label>
            </div>


            <div className="flex gap-3 pt-4">
                <button onClick={onCancel} className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg font-bold active:scale-95">
                    取消
                </button>
                <button onClick={() => {
                    // 根据isSignature更新tags数组
                    const updatedTags = formData.isSignature 
                        ? (formData.tags?.includes('招牌') ? formData.tags : [...(formData.tags || []), '招牌'])
                        : (formData.tags?.filter(tag => tag !== '招牌') || []);
                    onSave({ ...formData, tags: updatedTags });
                }} disabled={isUploading} className={`flex-1 py-2 text-white rounded-lg font-bold shadow-md shadow-orange-200 active:scale-95 ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500'}`}>
                    {isUploading ? '请稍候...' : '保存修改'}
                </button>
            </div>
        </div>
    );
};

// 批量图片导入组件
const BatchImageUpload = ({ menuItems, updateMenu, showToast, onClose }) => {
    const [csvFile, setCsvFile] = useState(null);
    const [imageFiles, setImageFiles] = useState([]);
    const [csvData, setCsvData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const [previewMatches, setPreviewMatches] = useState([]);

    // 解析 CSV 文件
    const handleCsvUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            let text = event.target.result;
            
            // 移除 UTF-8 BOM
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }
            
            const lines = text.split('\n').filter(line => line.trim());
            const parsed = lines.map(line => {
                // 移除引号并分割
                const cleanLine = line.replace(/^["']|["']$/g, '').trim();
                const parts = cleanLine.split(',');
                const dishName = parts[0]?.replace(/^["']|["']$/g, '').trim();
                const fileName = parts[1]?.replace(/^["']|["']$/g, '').trim();
                return { dishName, fileName };
            });
            setCsvData(parsed);
            showToast(`已解析 ${parsed.length} 条数据`);
        };
        reader.readAsText(file, 'UTF-8'); // 指定 UTF-8 编码
    };

    // 选择图片文件
    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        setImageFiles(files);
        showToast(`已选择 ${files.length} 张图片`);
    };

    // 预览匹配结果
    useEffect(() => {
        if (csvData.length > 0 && imageFiles.length > 0) {
            const matches = csvData.map(({ dishName, fileName }) => {
                const imageFile = imageFiles.find(file => file.name === fileName);
                const menuItem = menuItems.find(item => item.name === dishName);
                
                // 调试信息
                console.log('匹配检查:', {
                    dishName,
                    fileName,
                    foundImage: !!imageFile,
                    foundDish: !!menuItem,
                    availableImages: imageFiles.map(f => f.name),
                    availableDishes: menuItems.map(m => m.name)
                });
                
                return {
                    dishName,
                    fileName,
                    imageFile,
                    menuItem,
                    status: imageFile && menuItem ? 'ready' : !imageFile ? 'no-image' : 'no-dish'
                };
            });
            setPreviewMatches(matches);
        }
    }, [csvData, imageFiles, menuItems]);

    // 批量上传
    const handleBatchUpload = async () => {
        const readyMatches = previewMatches.filter(m => m.status === 'ready');
        if (readyMatches.length === 0) {
            showToast('没有可上传的匹配项');
            return;
        }

        if (!window.confirm(`确定要上传 ${readyMatches.length} 张图片并更新菜品吗？`)) return;

        setIsProcessing(true);
        setUploadProgress({ current: 0, total: readyMatches.length });

        const bucketName = 'menu_images';
        let successCount = 0;

        for (let i = 0; i < readyMatches.length; i++) {
            const { menuItem, imageFile, fileName } = readyMatches[i];
            
            try {
                // 生成唯一文件名
                const uniqueFileName = `${menuItem.id}-${Date.now()}-${fileName.replace(/\s/g, '_')}`;
                
                // 上传到 Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(uniqueFileName, imageFile);

                if (uploadError) throw uploadError;

                // 获取公共 URL
                const { data: urlData } = supabase.storage
                    .from(bucketName)
                    .getPublicUrl(uniqueFileName);

                if (urlData?.publicUrl) {
                    // 更新菜品的 image_url
                    await updateMenu({ ...menuItem, imageUrl: urlData.publicUrl });
                    successCount++;
                }

                setUploadProgress({ current: i + 1, total: readyMatches.length });
            } catch (error) {
                console.error(`上传失败 ${fileName}:`, error);
            }
        }

        setIsProcessing(false);
        showToast(`批量上传完成！成功 ${successCount}/${readyMatches.length} 张`);
        
        if (successCount === readyMatches.length) {
            setTimeout(onClose, 1500);
        }
    };

    return (
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileUp className="w-5 h-5" />
                批量导入菜品图片
            </h4>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-blue-800">
                <p className="font-bold mb-1">📋 使用说明：</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>准备 CSV 文件，格式：<code className="bg-white px-1 rounded">菜品名,图片文件名</code></li>
                    <li>每行一条数据，例如：<code className="bg-white px-1 rounded">红烧肉,hongshaorou.jpg</code></li>
                    <li>选择对应的图片文件（支持多选）</li>
                    <li>预览匹配结果，确认后批量上传</li>
                </ol>
            </div>

            {/* CSV 文件上传 */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    1. 上传 CSV 文件
                </label>
                <input 
                    type="file" 
                    accept=".csv,.txt" 
                    onChange={handleCsvUpload}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                />
                {csvData.length > 0 && (
                    <p className="text-xs text-green-600">✓ 已解析 {csvData.length} 条数据</p>
                )}
            </div>

            {/* 图片文件选择 */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    2. 选择图片文件（可多选）
                </label>
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleImageSelect}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-500 file:text-white hover:file:bg-green-600"
                />
                {imageFiles.length > 0 && (
                    <p className="text-xs text-green-600">✓ 已选择 {imageFiles.length} 张图片</p>
                )}
            </div>

            {/* 预览匹配结果 */}
            {previewMatches.length > 0 && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        3. 预览匹配结果
                    </label>
                    <div className="max-h-60 overflow-y-auto space-y-1 bg-gray-50 p-2 rounded border">
                        {previewMatches.map((match, idx) => (
                            <div key={idx} className={`text-xs p-2 rounded flex items-center justify-between ${
                                match.status === 'ready' ? 'bg-green-50 text-green-700' : 
                                match.status === 'no-image' ? 'bg-yellow-50 text-yellow-700' : 
                                'bg-red-50 text-red-700'
                            }`}>
                                <span className="font-mono truncate flex-1">
                                    {match.dishName} → {match.fileName}
                                </span>
                                <span className="ml-2 font-bold">
                                    {match.status === 'ready' ? '✓ 就绪' : 
                                     match.status === 'no-image' ? '⚠ 缺图片' : 
                                     '✗ 无此菜品'}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="text-green-600">
                            ✓ 就绪: {previewMatches.filter(m => m.status === 'ready').length}
                        </span>
                        <span className="text-yellow-600">
                            ⚠ 缺图片: {previewMatches.filter(m => m.status === 'no-image').length}
                        </span>
                        <span className="text-red-600">
                            ✗ 无菜品: {previewMatches.filter(m => m.status === 'no-dish').length}
                        </span>
                    </div>
                </div>
            )}

            {/* 上传进度 */}
            {isProcessing && (
                <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-sm font-bold text-blue-600">
                            正在上传 {uploadProgress.current}/{uploadProgress.total}
                        </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4">
                <button 
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg font-bold active:scale-95 disabled:opacity-50"
                >
                    取消
                </button>
                <button 
                    onClick={handleBatchUpload}
                    disabled={isProcessing || previewMatches.filter(m => m.status === 'ready').length === 0}
                    className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-bold active:scale-95 disabled:opacity-50 disabled:bg-gray-400"
                >
                    {isProcessing ? '上传中...' : `开始上传 (${previewMatches.filter(m => m.status === 'ready').length})`}
                </button>
            </div>
        </div>
    );
};

// --- 5. 大厨端组件 ---

// 大厨端：菜单管理界面 
const MenuManagementView = ({ menuItems, updateMenu, deleteMenu, addMenu, showToast }) => {
    const [editingItem, setEditingItem] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isBatchUploading, setIsBatchUploading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('主菜');
    const categories = ['主菜', '主食', '素菜', '汤品', '饮品'];

    const handleSave = (updatedItem) => {
        updateMenu(updatedItem);
        setEditingItem(null);
        showToast('菜品更新成功！');
    };
    
    const handleAdd = (newItem) => {
        addMenu(newItem);
        setIsAdding(false);
        showToast('新菜品添加成功！');
    };
    
    const handleDelete = (itemId, itemName) => {
        if (window.confirm(`确定要删除【${itemName}】吗？`)) {
            deleteMenu(itemId);
            showToast('菜品已删除');
        }
    };

    // 同步默认菜单
    const handleSyncDefaultMenu = async () => {
        if (!window.confirm('确定要同步默认菜单吗？\n这将添加代码中新增的菜品（如饮品），不会删除现有菜品。')) return;
        
        setIsSyncing(true);
        try {
            // 找出数据库中缺失的菜品
            const existingIds = new Set(menuItems.map(item => item.id));
            const missingItems = INITIAL_MENU.filter(item => !existingIds.has(item.id));
            
            if (missingItems.length === 0) {
                showToast('所有默认菜品已存在，无需同步');
                setIsSyncing(false);
                return;
            }
            
            // 转换字段名并插入
            const itemsToInsert = missingItems.map(({ imageUrl, ...item }) => ({
                ...item,
                image_url: imageUrl
            }));
            
            const { data: inserted, error } = await supabase
                .from('menu')
                .insert(itemsToInsert)
                .select();
            
            if (error) throw error;
            
            showToast(`成功同步 ${missingItems.length} 个新菜品！`);
            
            // 刷新页面以重新加载菜单
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('同步失败:', error);
            showToast('同步失败，请重试');
        } finally {
            setIsSyncing(false);
        }
    };
    
    const filteredItems = menuItems.filter(item => item.category === categoryFilter);

    return (
        <div className="p-4 pt-8 pb-20 space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Settings className="w-6 h-6 mr-2 text-gray-500" />
                    菜单及库存管理
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleSyncDefaultMenu}
                        disabled={isSyncing}
                        className="px-3 py-2 bg-purple-500 text-white rounded-full font-bold shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 text-sm"
                    >
                        {isSyncing ? <Loader className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                        {isSyncing ? '同步中...' : '同步菜单'}
                    </button>
                    <button
                        onClick={() => setIsBatchUploading(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-full font-bold shadow-lg active:scale-95 flex items-center gap-2"
                    >
                        <FileUp className="w-5 h-5" /> 批量导入
                    </button>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="px-4 py-2 bg-green-500 text-white rounded-full font-bold shadow-lg active:scale-95 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> 新增菜品
                    </button>
                </div>
            </div>
            
            {/* 分类筛选 */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                            categoryFilter === cat 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                    >
                        {cat} ({menuItems.filter(i => i.category === cat).length})
                    </button>
                ))}
            </div>
            
            {/* Menu List */}
            {filteredItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4 flex-1">
                            <span className="text-4xl">{item.image}</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-800">{item.name}</p>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">{item.category}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                                <div className="flex gap-4 mt-2">
                                    <p className="text-sm text-gray-500">销量: <span className="font-bold text-orange-600">{item.sales || 0}</span> 份</p>
                                    <p className="text-sm text-orange-500 font-bold">¥{item.price}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setEditingItem(item)}
                                className="p-2 bg-orange-500 text-white rounded-full shadow-md active:scale-95 transition-transform"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleDelete(item.id, item.name)}
                                className="p-2 bg-red-500 text-white rounded-full shadow-md active:scale-95 transition-transform"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            
            {filteredItems.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                    <div className="text-4xl mb-2">🍽️</div>
                    <p>该分类暂无菜品</p>
                </div>
            )}
            
            {/* Edit Modal */}
            <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)}>
                {editingItem && (
                    <MenuEditForm 
                        item={editingItem} 
                        onSave={handleSave} 
                        onCancel={() => setEditingItem(null)} 
                        showToast={showToast}
                    />
                )}
            </Modal>
            
            {/* Add Modal */}
            <Modal isOpen={isAdding} onClose={() => setIsAdding(false)}>
                <MenuEditForm 
                    item={{
                        id: 'm-' + Date.now(),
                        name: '',
                        description: '',
                        price: 19,
                        stock: 99,
                        category: '主食',
                        method: '',
                        flavor: '',
                        image: '🍽️',
                        imageUrl: 'https://placehold.co/320x180/facc15/374151?text=新菜品',
                        tags: []
                    }} 
                    onSave={handleAdd} 
                    onCancel={() => setIsAdding(false)} 
                    showToast={showToast}
                />
            </Modal>
            
            {/* Batch Upload Modal */}
            <Modal isOpen={isBatchUploading} onClose={() => setIsBatchUploading(false)}>
                <BatchImageUpload 
                    menuItems={menuItems}
                    updateMenu={updateMenu}
                    showToast={showToast}
                    onClose={() => setIsBatchUploading(false)}
                />
            </Modal>
        </div>
    );
};


// 厨房端：主界面 (更新订单ID显示和详情页逻辑，支持日期筛选)
const KitchenView = ({ setRole, menuItems, updateMenu, deleteMenu, addMenu, allOrders, showToast }) => {
  const [kitchenTab, setKitchenTab] = useState('orders'); // orders, menu
  const [filterStatus, setFilterStatus] = useState('pending'); // Order filter status
  const [selectedDate, setSelectedDate] = useState('all'); // 'all' 或 'YYYYMMDD'
  const [selectedOrder, setSelectedOrder] = useState(null); // 选中查看详情的订单
  
  // Pre-calculate sequence numbers
  const sequenceMap = useMemo(() => calculateDailySequences(allOrders), [allOrders]);

  // 获取所有可用日期
  const availableDates = useMemo(() => {
      const dates = new Set();
      allOrders.forEach(order => {
          if (order.status !== 'cancelled' && order.status !== 'rejected') {
              const dateKey = getDateKey(order.created_at);
              dates.add(dateKey);
          }
      });
      return Array.from(dates).sort().reverse(); // 降序排列
  }, [allOrders]);


  const updateOrderStatus = async (orderId, newStatus) => {
    try {
        const updateData = { status: newStatus };
        
        // 记录时间戳
        if (newStatus === 'cooking') {
            updateData.cooking_started_at = new Date().toISOString();
        } else if (newStatus === 'completed') {
            updateData.completed_at = new Date().toISOString();
        }
        
        const { data: orderData, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select();

        if (error) throw new Error(error.message);
        
        // 如果订单完成，更新菜品销量
        if (newStatus === 'completed' && orderData && orderData.length > 0) {
            const order = orderData[0];
            console.log('开始更新销量，订单商品:', order.items);
            for (const item of order.items) {
                console.log(`正在更新菜品: ${item.name} (ID: ${item.id}), 数量: ${item.quantity}`);
                // 先查询当前销量，再更新
                const { data: menuItem, error: fetchError } = await supabase
                    .from('menu')
                    .select('sales')
                    .eq('id', item.id)
                    .single();
                
                console.log(`查询到当前销量:`, menuItem);
                
                if (!fetchError && menuItem) {
                    const currentSales = menuItem.sales || 0;
                    const newSales = currentSales + item.quantity;
                    console.log(`更新销量: ${currentSales} + ${item.quantity} = ${newSales}`);
                    
                    const { error: salesError } = await supabase
                        .from('menu')
                        .update({ sales: newSales })
                        .eq('id', item.id);
                    
                    if (salesError) {
                        console.error(`更新菜品 ${item.name} 销量失败:`, salesError);
                    } else {
                        console.log(`✓ 菜品 ${item.name} 销量更新成功: ${newSales}`);
                    }
                } else {
                    console.error(`查询菜品 ${item.name} 失败:`, fetchError);
                }
            }
        }
        
    } catch (e) {
      console.error("更新状态失败 Error:", e);
    }
  };

  const statusOptions = [
      { key: 'all', label: '所有订单', Icon: List, activeBg: 'bg-gray-100', activeText: 'text-gray-700' },
      { key: 'pending', label: '待处理', Icon: Bell, activeBg: 'bg-orange-100', activeText: 'text-orange-600' },
      { key: 'cooking', label: '烹饪中', Icon: Utensils, activeBg: 'bg-blue-100', activeText: 'text-blue-600' },
      { key: 'completed', label: '已完成', Icon: CheckCircle, activeBg: 'bg-green-100', activeText: 'text-green-600' },
      { key: 'rejected', label: '已拒绝', Icon: XCircle, activeBg: 'bg-red-100', activeText: 'text-red-600' },
  ];

  // Filter orders based on status and date
  const filteredOrders = useMemo(() => {
    // Sort: unprocessed first (pending -> cooking -> completed), then by time descending
    const sortedOrders = [...allOrders]
        .filter(o => o.status !== 'cancelled' && o.status !== 'deleted') // 只过滤已撤销和已删除
        .filter(o => {
            if (selectedDate === 'all') return true;
            return getDateKey(o.created_at) === selectedDate;
        })
        .sort((a, b) => {
            const statusOrder = { 'pending': 0, 'cooking': 1, 'completed': 2, 'rejected': 3 };
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;
            // Same status, sort by time descending (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return sortedOrders.filter(o => 
        filterStatus === 'all' ? true : o.status === filterStatus
    );
  }, [allOrders, filterStatus, selectedDate]);

  // 回收站订单
  const deletedOrders = useMemo(() => {
    return [...allOrders]
        .filter(o => o.status === 'deleted')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allOrders]);

  // 永久删除订单（从数据库中删除）
  const permanentlyDeleteOrder = async (orderId) => {
    if (!window.confirm('确定要永久删除此订单吗？此操作无法撤销！')) return;
    
    try {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) throw new Error(error.message);
        showToast('订单已永久删除');
    } catch (e) {
        console.error('永久删除失败:', e);
        showToast('删除失败，请重试');
    }
  };

  // 恢复订单
  const restoreOrder = async (orderId) => {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'pending' })
            .eq('id', orderId);

        if (error) throw new Error(error.message);
        showToast('订单已恢复到待处理');
    } catch (e) {
        console.error('恢复失败:', e);
        showToast('恢复失败，请重试');
    }
  };

  // 清空回收站
  const emptyTrash = async () => {
    if (!window.confirm(`确定要清空回收站吗？这将永久删除 ${deletedOrders.length} 个订单，此操作无法撤销！`)) return;
    
    try {
        const deleteIds = deletedOrders.map(o => o.id);
        const { error } = await supabase
            .from('orders')
            .delete()
            .in('id', deleteIds);

        if (error) throw new Error(error.message);
        showToast(`已清空回收站，删除了 ${deleteIds.length} 个订单`);
    } catch (e) {
        console.error('清空回收站失败:', e);
        showToast('清空失败，请重试');
    }
  };

  // 回收站视图
  const renderTrashView = () => (
    <div className="px-4 space-y-4 pt-8 pb-24">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-700">🗑️ 回收站 ({deletedOrders.length})</h2>
            {deletedOrders.length > 0 && (
                <button 
                    onClick={emptyTrash}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 transition active:scale-95"
                >
                    清空回收站
                </button>
            )}
        </div>

        {deletedOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-20">
                <div className="text-6xl mb-4">🗑️</div>
                <p className="text-lg">回收站是空的</p>
                <p className="text-sm mt-2">已删除的订单会显示在这里</p>
            </div>
        ) : (
            deletedOrders.map(order => {
                const { displayId, displayTime } = formatOrderDisplay(order.created_at, sequenceMap);

                return (
                    <div key={order.id} className="bg-white rounded-xl overflow-hidden shadow-md border-l-4 border-gray-400 opacity-75">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">订单号: {displayId}</h3>
                                <p className="text-xs text-gray-500">时间: {displayTime}</p>
                                <p className="text-xs text-gray-500 mt-1">{order.customer_name}</p>
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-600">
                                已删除
                            </span>
                        </div>

                        <div className="p-4">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center mb-2 pb-2 border-b border-gray-50 last:border-b-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">{item.name}</span>
                                        {item.special_request && item.special_request !== '无特殊备注' && (
                                            <span className="text-xs text-red-500 italic">⚠️ 备注: {item.special_request}</span>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-900">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-gray-50 flex gap-3">
                            <button 
                                onClick={() => restoreOrder(order.id)}
                                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold text-sm hover:bg-green-600 transition active:scale-95"
                            >
                                恢复订单
                            </button>
                            <button 
                                onClick={() => permanentlyDeleteOrder(order.id)}
                                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 transition active:scale-95"
                            >
                                永久删除
                            </button>
                        </div>
                    </div>
                );
            })
        )}
    </div>
  );


    const renderOrderView = () => (
        <div className="px-4 space-y-4 pt-8 pb-24">
        
        {/* 日期筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
            <button
                onClick={() => setSelectedDate('all')}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                    selectedDate === 'all' 
                        ? 'bg-orange-500 text-white shadow-lg' 
                        : 'bg-white text-gray-600 border border-gray-200'
                }`}
            >
                全部日期
            </button>
            {availableDates.map(date => {
                const year = date.substring(0, 4);
                const month = date.substring(4, 6);
                const day = date.substring(6, 8);
                return (
                    <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                            selectedDate === date 
                                ? 'bg-orange-500 text-white shadow-lg' 
                                : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                    >
                        {month}/{day}
                    </button>
                );
            })}
        </div>
        
        {/* Status filter buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
            {statusOptions.map(({ key, label, Icon, activeBg, activeText }) => {
                const count = key === 'all' 
                    ? allOrders.filter(o => o.status !== 'rejected' && o.status !== 'cancelled').length 
                    : allOrders.filter(o => o.status === key).length;
                const isActive = filterStatus === key;
                
                return (
                    <button 
                        key={key}
                        onClick={() => setFilterStatus(key)}
                        className={`rounded-xl p-2 text-center transition-all shadow-sm active:scale-95 ${isActive ? activeBg : 'bg-white text-gray-50 hover:bg-gray-50'} border ${isActive ? 'border-transparent' : 'border-gray-100'}`}
                    >
                        <div className={`text-xl font-bold flex items-center justify-center ${isActive ? activeText : 'text-gray-700'}`}>
                            <Icon className="w-5 h-5 mr-1" />{count}
                        </div>
                        <div className={`text-xs ${isActive ? activeText : 'text-gray-500'}`}>{label}</div>
                    </button>
                )
            })}
        </div>
        
        {filteredOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
                <div className="text-4xl mb-2">😴</div>
                <p>{filterStatus === 'all' ? '当前没有订单' : `没有处于【${statusOptions.find(o => o.key === filterStatus)?.label}】状态的订单`}</p>
            </div>
        ) : (
            filteredOrders.map(order => {
                const { displayId, displayTime } = formatOrderDisplay(order.created_at, sequenceMap);

                return (
                    <div key={order.id} className={`bg-white rounded-xl overflow-hidden shadow-md border-l-4 ${
                        order.status === 'pending' ? 'border-orange-500' : 
                        order.status === 'cooking' ? 'border-blue-500' : 
                        order.status === 'rejected' ? 'border-red-500' : 'border-green-500'
                    }`}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                        <div>
                            {/* Update: display formatted order ID */}
                            <h3 className="font-bold text-gray-800 text-lg">订单号: {displayId}</h3>
                            <p className="text-xs text-gray-500">时间: {displayTime}</p>
                            <p className="text-xs text-gray-500 mt-1">{order.customer_name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                            order.status === 'pending' ? 'bg-orange-100 text-orange-600' : 
                            order.status === 'cooking' ? 'bg-blue-100 text-blue-600' : 
                            order.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                        }`}>
                            {order.status === 'pending' ? '待接单' : 
                             order.status === 'cooking' ? '烹饪中' : 
                             order.status === 'rejected' ? '已拒绝' : '已完成'}
                        </span>
                        </div>

                        <div className="p-4">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center mb-2 pb-2 border-b border-gray-50 last:border-b-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">{item.name}</span>
                                        {/* Key: Display item special request */}
                                        {item.special_request && item.special_request !== '无特殊备注' && (
                                            <span className="text-xs text-red-500 italic">⚠️ 备注: {item.special_request}</span>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-900">x{item.quantity}</span>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        {order.status !== 'completed' && order.status !== 'rejected' && (
                            <div className="p-3 bg-gray-50 space-y-2">
                                <button 
                                    onClick={() => setSelectedOrder(order)}
                                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1"
                                >
                                    <Eye className="w-4 h-4" /> 查看详情
                                </button>
                                <div className="flex gap-3">
                                    {order.status === 'pending' && (
                                        <>
                                        <button 
                                            onClick={() => updateOrderStatus(order.id, 'rejected')}
                                            className="flex-1 py-2 bg-white border border-gray-200 text-gray-500 rounded-lg font-bold text-sm hover:bg-red-50 transition active:scale-95"
                                        >
                                            残忍拒绝
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus(order.id, 'cooking')}
                                            className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm shadow-md shadow-orange-200 hover:bg-orange-600 transition active:scale-95"
                                        >
                                            开始烹饪
                                        </button>
                                        </>
                                    )}
                                    {order.status === 'cooking' && (
                                         <button 
                                            onClick={() => updateOrderStatus(order.id, 'completed')}
                                            className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold text-sm shadow-md shadow-green-200 hover:bg-green-600 transition active:scale-95"
                                         >
                                            完成出餐
                                         </button>
                                    )}
                                </div>
                                {/* 删除按钮 - 所有状态都可删除 */}
                                <button 
                                    onClick={() => updateOrderStatus(order.id, 'deleted')}
                                    className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm hover:bg-red-100 transition active:scale-95 flex items-center justify-center gap-1"
                                >
                                    <Trash2 className="w-4 h-4" /> 删除订单
                                </button>
                            </div>
                        )}
                        {(order.status === 'completed' || order.status === 'rejected') && (
                            <div className="p-3 bg-gray-50 space-y-2">
                                <button 
                                    onClick={() => setSelectedOrder(order)}
                                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-1"
                                >
                                    <Eye className="w-4 h-4" /> 查看详情
                                </button>
                                {/* 已完成和已拒绝订单也可删除 */}
                                <button 
                                    onClick={() => updateOrderStatus(order.id, 'deleted')}
                                    className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm hover:bg-red-100 transition active:scale-95 flex items-center justify-center gap-1"
                                >
                                    <Trash2 className="w-4 h-4" /> 删除订单
                                </button>
                            </div>
                        )}
                    </div>
                );
            })
        )}
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Kitchen Header */}
      <div className="bg-white px-4 py-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-gray-800" />
          <h1 className="text-xl font-bold text-gray-800">大厨控制台</h1>
        </div>
        <button 
            onClick={() => setRole(null)} 
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-orange-100 transition shadow-md"
            title="返回首页"
        >
            <Home className="w-5 h-5 text-gray-600 hover:text-orange-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {kitchenTab === 'orders' ? renderOrderView() : 
         kitchenTab === 'trash' ? renderTrashView() : (
          <MenuManagementView 
            menuItems={menuItems} 
            updateMenu={updateMenu} 
            deleteMenu={deleteMenu}
            addMenu={addMenu}
            showToast={showToast} 
          />
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t py-2 flex justify-around shadow-lg z-20">
          <button 
              onClick={() => setKitchenTab('orders')} 
              className={`flex flex-col items-center p-2 rounded-lg transition ${kitchenTab === 'orders' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
             <Utensils className="w-6 h-6 mb-1" />
             <span className="text-xs font-medium">订单管理</span>
          </button>
          <button 
              onClick={() => setKitchenTab('trash')} 
              className={`flex flex-col items-center p-2 rounded-lg transition ${kitchenTab === 'trash' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
             <Archive className="w-6 h-6 mb-1" />
             <span className="text-xs font-medium">回收站</span>
          </button>
          <button 
              onClick={() => setKitchenTab('menu')} 
              className={`flex flex-col items-center p-2 rounded-lg transition ${kitchenTab === 'menu' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
          >
             <List className="w-6 h-6 mb-1" />
             <span className="text-xs font-medium">菜单管理</span>
          </button>
      </div>
      
      {/* 订单详情Modal */}
      {selectedOrder && (
          <OrderDetailModal 
              order={selectedOrder} 
              onClose={() => setSelectedOrder(null)}
              sequenceMap={sequenceMap}
          />
      )}
    </div>
  );
};

// --- 6. 主入口 ---
export default function App() {
  // 从localStorage读取保存的身份信息
  const [savedRole, setSavedRole] = useState(() => {
    return localStorage.getItem('userRole') || null;
  });
  const [showRoleModal, setShowRoleModal] = useState(() => {
    // 如果没有保存的身份，显示选择弹窗
    return !localStorage.getItem('userRole');
  });
  
  // PushPlus 好友推送配置
  // senderToken: 发送者 token（已实名认证的大厨 token，用于调用 API）
  // friendToken_kitchen: 大厨的好友令牌（顾客下单时推送给大厨）
  // friendToken_customer: 顾客的好友令牌（大厨出餐时推送给顾客）
  const [senderToken, setSenderToken] = useState(() => {
    return localStorage.getItem('pushPlus_senderToken') || '';
  });
  const [friendTokenKitchen, setFriendTokenKitchen] = useState(() => {
    return localStorage.getItem('pushPlus_friendToken_kitchen') || '';
  });
  const [friendTokenCustomer, setFriendTokenCustomer] = useState(() => {
    return localStorage.getItem('pushPlus_friendToken_customer') || '';
  });
  const [showTokenConfig, setShowTokenConfig] = useState(false);
  const [tempSenderToken, setTempSenderToken] = useState('');
  const [tempFriendKitchen, setTempFriendKitchen] = useState('');
  const [tempFriendCustomer, setTempFriendCustomer] = useState('');
  
  const [role, setRole] = useState(null); // null表示在home page
  const [menuItems, setMenuItems] = useState([]); // 从云端加载菜单
  const [allOrders, setAllOrders] = useState([]); // Order data lifted
  const [toastMessage, setToastMessage] = useState(''); // Global toast state
  const [menuLoading, setMenuLoading] = useState(true); // 菜单加载状态
  const [initialView, setInitialView] = useState('menu'); // 初始视图状态
  const user = { uid: USER_ID };
    const prevOrdersRef = useRef([]);
    const ordersInitializedRef = useRef(false);
    const lastRoleRef = useRef(null);
  
  // 处理手机返回键
  useEffect(() => {
    const handleBackButton = (e) => {
      // 如果当前在顾客端或大厨端,返回到home page
      if (role) {
        e.preventDefault();
        setRole(null);
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    // 添加一个历史记录条目,使返回键可以被拦截
    if (role) {
      window.history.pushState(null, '', window.location.pathname);
    }

    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [role]);
  
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);
 
  // 系统通知函数 - 使用 PushPlus 好友一对一推送
  // senderToken: 已实名的发送者 token
  // friendToken: 目标好友的令牌
  const showNotification = useCallback(async (title, body, icon = '🔔', targetRole = null) => {
    // 1. PushPlus 好友推送 - 使用发送者 token 推送到目标好友
    const sender = localStorage.getItem('pushPlus_senderToken');
    const friendToken = targetRole === 'kitchen' 
      ? localStorage.getItem('pushPlus_friendToken_kitchen')
      : targetRole === 'customer'
        ? localStorage.getItem('pushPlus_friendToken_customer')
        : null;
    
    if (sender && friendToken) {
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 15px; background: linear-gradient(135deg, #fff5f5 0%, #fff8e1 100%); border-radius: 12px;">
          <div style="font-size: 24px; margin-bottom: 10px;">${icon}</div>
          <h2 style="color: #e65100; margin: 0 0 10px 0; font-size: 18px;">${title}</h2>
          <p style="color: #333; margin: 0; font-size: 14px; line-height: 1.6;">${body}</p>
          <p style="color: #999; font-size: 12px; margin-top: 15px;">来自：小蒋炒菜馆</p>
        </div>
      `;
      // 使用发送者 token 调用 API，推送到好友
      sendPushPlusNotification(sender, `🍳 ${title}`, htmlContent, 'html', friendToken);
      console.log(`PushPlus 好友推送: ${targetRole}`);
    } else if (!sender) {
      console.log('PushPlus: 发送者 token 未配置');
    } else {
      console.log(`PushPlus: ${targetRole} 的好友令牌未配置`);
    }

    // 2. 本地浏览器通知 - 受身份过滤（只有当前设备身份匹配才显示）
    if (targetRole && savedRole !== targetRole) {
      console.log(`本地通知被过滤: 目标身份=${targetRole}, 当前身份=${savedRole}`);
      return; // 只跳过本地通知，PushPlus 已经发送了
    }

    // 浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: icon,
        badge: icon,
        tag: 'order-notification',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
      
      // 播放提示音
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDGH0fPTgjMGHm7A7+OZRQ0PVajn77FZGAg+ltv0xXEoCi6Czv');
      audio.play().catch(e => console.log('无法播放提示音:', e));
    }
  }, [showToast, savedRole]);

  // 初始化时请求通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 从云端加载菜单数据
  useEffect(() => {
    const fetchMenu = async () => {
      const { data: menuData, error } = await supabase
        .from('menu')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('加载菜单失败:', error);
        // 如果数据库为空，插入初始菜单
        if (menuData === null || menuData.length === 0) {
          console.log('数据库菜单为空，插入初始数据...');
          const { error: insertError } = await supabase
            .from('menu')
            .insert(INITIAL_MENU);
          if (!insertError) {
            setMenuItems(INITIAL_MENU);
          }
        }
        setMenuLoading(false);
        return;
      }
      
      // 如果数据库为空，插入初始菜单
      if (!menuData || menuData.length === 0) {
        console.log('数据库菜单为空，插入初始数据...');
        // 转换字段名：imageUrl -> image_url，删除imageUrl字段
        const menuToInsert = INITIAL_MENU.map(({ imageUrl, ...item }) => ({
          ...item,
          image_url: imageUrl
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('menu')
          .insert(menuToInsert)
          .select();
        if (!insertError && inserted) {
          // 转换回来：image_url -> imageUrl
          const convertedMenu = inserted.map(item => ({
            ...item,
            imageUrl: item.image_url
          }));
          setMenuItems(convertedMenu);
        } else {
          console.error('插入初始菜单失败:', insertError);
        }
      } else {
        // 转换字段名：image_url -> imageUrl
        const convertedMenu = menuData.map(item => ({
          ...item,
          imageUrl: item.image_url
        }));
        setMenuItems(convertedMenu);
      }
      setMenuLoading(false);
    };

    fetchMenu();

    // 订阅菜单实时更新
    const menuChannel = supabase
      .channel('menu-realtime-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'menu' },
        (payload) => {
          console.log('新菜品:', payload.new);
          const converted = { ...payload.new, imageUrl: payload.new.image_url };
          setMenuItems(prev => [...prev, converted]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu' },
        (payload) => {
          console.log('菜品更新:', payload.new);
          const converted = { ...payload.new, imageUrl: payload.new.image_url };
          setMenuItems(prev => prev.map(item => 
            item.id === converted.id ? converted : item
          ));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'menu' },
        (payload) => {
          console.log('菜品删除:', payload.old);
          setMenuItems(prev => prev.filter(item => item.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(menuChannel);
    };
  }, []);

  // Listen for all orders (lifted to App level) - 真实 Supabase Realtime
  useEffect(() => {
    const fetchAllOrders = async () => {
        // Always fetch all orders by creation time descending
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false }); 

        if (error) {
            console.error("Supabase query failed:", error);
            return;
        }
        setAllOrders(orders || []);
    };

    // 初始加载数据
    fetchAllOrders();

    // 订阅实时更新 - 使用 Supabase Realtime Channels API
    const channel = supabase
        .channel('orders-realtime-channel')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders' },
            (payload) => {
                console.log('新订单:', payload.new);
                // 插入新订单到列表顶部
                setAllOrders(prev => [payload.new, ...prev]);
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                console.log('订单更新:', payload.new);
                // 更新现有订单
                setAllOrders(prev => prev.map(order => 
                    order.id === payload.new.id ? payload.new : order
                ));
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'orders' },
            (payload) => {
                console.log('订单删除:', payload.old);
                // 删除订单
                setAllOrders(prev => prev.filter(order => order.id !== payload.old.id));
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, []);

  // Realtime notifications for order updates
  useEffect(() => {
    if (!role) {
        prevOrdersRef.current = allOrders;
        lastRoleRef.current = role;
        return;
    }

    if (!ordersInitializedRef.current) {
        ordersInitializedRef.current = true;
        prevOrdersRef.current = allOrders;
        lastRoleRef.current = role;
        return;
    }

    if (lastRoleRef.current !== role) {
        lastRoleRef.current = role;
        prevOrdersRef.current = allOrders;
        return;
    }

    const previousOrders = prevOrdersRef.current || [];

    if (previousOrders.length === 0 && allOrders.length === 0) return;

    // Detect brand new orders
    const newlyCreatedOrders = allOrders.filter(order =>
        !previousOrders.some(prev => prev.id === order.id)
    );

    if (newlyCreatedOrders.length > 0) {
        const latestOrder = newlyCreatedOrders[0];
        const dishName = latestOrder.items?.[0]?.name || '爱心料理';
        const customerName = latestOrder.customer_name || '客人';
        // 只通知大厨身份的用户
        showNotification('🍴 新订单', `${customerName} 刚下单了 ${dishName}`, '🍴', 'kitchen');
    }

    // Detect status changes
    const statusChanges = allOrders.reduce((changes, order) => {
        const previous = previousOrders.find(prev => prev.id === order.id);
        if (previous && previous.status !== order.status) {
            changes.push(order);
        }
        return changes;
    }, []);

    statusChanges.forEach(order => {
        // 顾客订单状态变化通知
        if (order.user_id === user.uid) {
            const statusConfig = {
                cooking: { title: '👨‍🍳 大厨已接单', msg: '正在烹饪中～' },
                completed: { title: '✅ 出餐完成', msg: '快来领取美味～' },
                rejected: { title: '❌ 订单被拒绝', msg: '大厨暂时忙不过来，稍后再试哦～' },
                cancelled: { title: '🚫 订单已取消', msg: '您的订单已取消' }
            };
            const config = statusConfig[order.status];
            if (config) {
                const dishName = order.items?.[0]?.name || '菜品';
                // 只通知顾客身份的用户
                showNotification(config.title, `${dishName} - ${config.msg}`, '🔔', 'customer');
            }
        }

        // 大厨端订单状态通知
        if (order.status === 'pending') {
            const dishName = order.items?.[0]?.name || '菜品';
            showNotification('🔔 订单状态变化', `有订单回到了待处理状态: ${dishName}`, '🔔', 'kitchen');
        }
        if (order.status === 'cancelled') {
            const dishName = order.items?.[0]?.name || '菜品';
            showNotification('❌ 订单取消', `客人取消了订单: ${dishName}`, '❌', 'kitchen');
        }
    });
    
    // 检测催单
    const urgentChanges = allOrders.reduce((changes, order) => {
        const previous = previousOrders.find(prev => prev.id === order.id);
        if (previous && order.urgent && (!previous.urgent || order.urgent_count > (previous.urgent_count || 0))) {
            changes.push(order);
        }
        return changes;
    }, []);
    
    urgentChanges.forEach(order => {
        const dishName = order.items?.[0]?.name || '菜品';
        // 只通知大厨身份的用户
        showNotification('🔔 催单通知', `客人在催单啦！订单: ${dishName}`, '🔔', 'kitchen');
    });

    prevOrdersRef.current = allOrders;
  }, [allOrders, role, showNotification, user.uid]);

  // Function to update menu, used by kitchen
  const updateMenu = useCallback(async (updatedItem) => {
      // 先更新本地状态（乐观更新）
      setMenuItems(prev => prev.map(item => 
          item.id === updatedItem.id ? updatedItem : item
      ));
      
      // 同步到云端数据库
      const { error } = await supabase
        .from('menu')
        .update({
          name: updatedItem.name,
          description: updatedItem.description,
          price: updatedItem.price,
          stock: updatedItem.stock,
          category: updatedItem.category,
          method: updatedItem.method,
          flavor: updatedItem.flavor,
          image: updatedItem.image,
          image_url: updatedItem.imageUrl || updatedItem.image_url,
          tags: updatedItem.tags || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedItem.id);
      
      if (error) {
        console.error('更新菜单到云端失败:', error);
      }
  }, []);
  
  // Function to delete menu item
  const deleteMenu = useCallback(async (itemId) => {
      // 先更新本地状态
      setMenuItems(prev => prev.filter(item => item.id !== itemId));
      
      // 从云端删除
      const { error } = await supabase
        .from('menu')
        .delete()
        .eq('id', itemId);
      
      if (error) {
        console.error('从云端删除菜单失败:', error);
      }
  }, []);
  
  // Function to add menu item
  const addMenu = useCallback(async (newItem) => {
      // 先更新本地状态
      setMenuItems(prev => [...prev, newItem]);
      
      // 插入到云端数据库
      const { error } = await supabase
        .from('menu')
        .insert([{
          id: newItem.id,
          name: newItem.name,
          description: newItem.description,
          price: newItem.price,
          stock: newItem.stock,
          category: newItem.category,
          method: newItem.method,
          flavor: newItem.flavor,
          image: newItem.image,
          image_url: newItem.imageUrl || newItem.image_url,
          tags: newItem.tags || []
        }]);
      
      if (error) {
        console.error('添加菜单到云端失败:', error);
      }
  }, []);

  if (!user || menuLoading) return <Loading />;

  // PushPlus 好友令牌配置界面
  if (showTokenConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-yellow-50 to-orange-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-6 left-6 text-4xl opacity-20 animate-bounce">🍳</div>
        <div className="absolute top-20 right-10 text-3xl opacity-20 animate-pulse">🥘</div>
        
        <div className="bg-white rounded-3xl shadow-2xl p-5 max-w-sm w-full z-10 animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">📱</div>
            <h2 className="text-lg font-black text-gray-800 mb-1">配置微信推送</h2>
            <p className="text-xs text-gray-500">PushPlus 好友一对一推送</p>
          </div>

          <div className="bg-blue-50 p-3 rounded-xl mb-4 text-xs text-blue-800">
            <p className="font-bold mb-1">📋 配置说明：</p>
            <ul className="space-y-1">
              <li>• <strong>发送者 Token</strong>：您已实名认证的 token（用于调用 API）</li>
              <li>• <strong>好友令牌</strong>：在 PushPlus「好友消息」中添加好友后获取</li>
              <li>• 好友只需关注公众号，<strong>无需实名认证</strong>即可接收</li>
            </ul>
          </div>

          <div className="space-y-3">
            {/* 发送者 Token */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                🔑 发送者 Token（已实名）
              </label>
              <input
                type="text"
                value={tempSenderToken}
                onChange={(e) => setTempSenderToken(e.target.value)}
                placeholder="您的 PushPlus Token"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
              />
            </div>

            {/* 大厨好友令牌 */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                👨‍🍳 大厨好友令牌
              </label>
              <input
                type="text"
                value={tempFriendKitchen}
                onChange={(e) => setTempFriendKitchen(e.target.value)}
                placeholder="推送新订单通知给大厨"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">顾客下单时推送给大厨</p>
            </div>

            {/* 顾客好友令牌 */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                🍽️ 顾客好友令牌
              </label>
              <input
                type="text"
                value={tempFriendCustomer}
                onChange={(e) => setTempFriendCustomer(e.target.value)}
                placeholder="推送订单状态给顾客"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">大厨出餐时推送给顾客</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setShowTokenConfig(false);
                setTempSenderToken(senderToken);
                setTempFriendKitchen(friendTokenKitchen);
                setTempFriendCustomer(friendTokenCustomer);
              }}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm active:scale-95"
            >
              取消
            </button>
            <button
              onClick={async () => {
                // 保存配置
                if (tempSenderToken.trim()) {
                  localStorage.setItem('pushPlus_senderToken', tempSenderToken.trim());
                  setSenderToken(tempSenderToken.trim());
                }
                if (tempFriendKitchen.trim()) {
                  localStorage.setItem('pushPlus_friendToken_kitchen', tempFriendKitchen.trim());
                  setFriendTokenKitchen(tempFriendKitchen.trim());
                }
                if (tempFriendCustomer.trim()) {
                  localStorage.setItem('pushPlus_friendToken_customer', tempFriendCustomer.trim());
                  setFriendTokenCustomer(tempFriendCustomer.trim());
                }
                
                // 发送测试通知
                if (tempSenderToken.trim()) {
                  showToast('正在发送测试通知...');
                  const success = await sendPushPlusNotification(
                    tempSenderToken.trim(),
                    '🎉 配置成功',
                    '<div style="text-align:center;padding:20px;"><h2 style="color:#e65100;">小蒋炒菜馆</h2><p>✅ 推送配置已保存！</p></div>',
                    'html'
                  );
                  if (success) {
                    showToast('✅ 配置已保存，测试通知已发送！');
                  } else {
                    showToast('⚠️ 配置已保存，但测试通知发送失败');
                  }
                } else {
                  showToast('✅ 配置已保存');
                }
                
                setShowTokenConfig(false);
              }}
              className="flex-1 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl font-bold text-sm active:scale-95"
            >
              保存配置
            </button>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-xs text-yellow-800">
            <p className="font-bold mb-1">💡 如何获取好友令牌？</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>登录 pushplus.plus 网站</li>
              <li>点击「好友消息」→「我的好友」</li>
              <li>添加好友（好友需先关注公众号）</li>
              <li>复制好友的「好友令牌」</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // 身份选择弹窗（首次打开或清除身份后显示）
  if (showRoleModal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-yellow-50 to-orange-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* 装饰性背景元素 */}
        <div className="absolute top-6 left-6 text-4xl opacity-20 animate-bounce">🍳</div>
        <div className="absolute top-20 right-10 text-3xl opacity-20 animate-pulse">🥘</div>
        <div className="absolute bottom-24 left-12 text-3xl opacity-20 animate-bounce delay-100">🍜</div>
        <div className="absolute bottom-16 right-8 text-4xl opacity-20 animate-pulse delay-200">🍲</div>
        
        {/* 弹窗内容 */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full z-10 animate-in zoom-in duration-500">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">👋</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">欢迎来到</h2>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-500">
              小蒋炒菜馆
            </h1>
            <p className="text-sm text-gray-500 mt-3">请选择您的身份</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                localStorage.setItem('userRole', 'customer');
                setSavedRole('customer');
                setShowRoleModal(false);
                showToast('已选择顾客身份');
              }}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 p-4 rounded-2xl shadow-lg flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-3xl shadow-md">
                🍽️
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-black text-white">我是顾客</h3>
                <p className="text-orange-100 text-xs">点菜、查看订单状态</p>
              </div>
              <div className="text-xl text-white">→</div>
            </button>

            <button
              onClick={() => {
                localStorage.setItem('userRole', 'kitchen');
                setSavedRole('kitchen');
                setShowRoleModal(false);
                showToast('已选择大厨身份');
              }}
              className="w-full bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 p-4 rounded-2xl shadow-lg flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-3xl shadow-md">
                👨‍🍳
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-black text-white">我是大厨</h3>
                <p className="text-purple-100 text-xs">接单、管理菜单</p>
              </div>
              <div className="text-xl text-white">→</div>
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            💡 身份选择后可在首页配置微信推送
          </p>
        </div>
      </div>
    );
  }

  // Home Page: Select Role (原来的首页，不影响savedRole)
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-yellow-50 to-orange-100 flex flex-col items-center justify-between p-4 relative overflow-hidden">
        {/* 装饰性背景元素 */}
        <div className="absolute top-6 left-6 text-4xl opacity-20 animate-bounce">🍳</div>
        <div className="absolute top-20 right-10 text-3xl opacity-20 animate-pulse">🥘</div>
        <div className="absolute bottom-24 left-12 text-3xl opacity-20 animate-bounce delay-100">🍜</div>
        <div className="absolute bottom-16 right-8 text-4xl opacity-20 animate-pulse delay-200">🍲</div>
        
        {/* 左上角身份标识 */}
        {savedRole && (
          <div className="absolute top-4 left-4 flex items-center gap-2 animate-in slide-in-from-left z-20">
            <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-xs font-medium border border-gray-200">
              {savedRole === 'customer' ? '🍽️ 顾客' : '👨‍🍳 大厨'}
            </div>
            <button
              onClick={() => {
                if (window.confirm('确定要清除身份信息吗？下次打开将重新选择。')) {
                  localStorage.removeItem('userRole');
                  setSavedRole(null);
                  setShowRoleModal(true);
                  showToast('已清除身份，请重新选择');
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full shadow-lg text-xs font-bold active:scale-95 transition flex items-center justify-center"
              title="清除身份"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* 右上角通知配置按钮 */}
        <button
          onClick={() => {
            setTempSenderToken(senderToken);
            setTempFriendKitchen(friendTokenKitchen);
            setTempFriendCustomer(friendTokenCustomer);
            setShowTokenConfig(true);
          }}
          className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-xs font-medium border border-gray-200 flex items-center gap-1 z-20 active:scale-95 transition"
          title="配置微信推送"
        >
          <Bell className="w-4 h-4" />
          {senderToken ? '✅' : '⚠️'}
        </button>
        
        {/* 顶部标题区域 */}
        <div className="text-center mt-6 z-10">
          <div className="inline-block mb-2 animate-in zoom-in duration-500">
            <div className="text-5xl mb-1">❤️</div>
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-500 mb-2 animate-in slide-in-from-top duration-700">
            小蒋炒菜馆
          </h1>
          <div className="flex items-center justify-center gap-2 text-gray-600 animate-in fade-in duration-1000">
            <span className="text-xl">👨‍🍳</span>
            <p className="text-sm font-medium">爱心厨房 · 温暖料理</p>
            <span className="text-xl">🍽️</span>
          </div>
        </div>

        {/* 中间厨师插图 */}
        <div className="z-10 animate-in zoom-in duration-700 delay-200">
          <div className="relative">
            {/* 厨师主体 */}
            <div className="text-7xl filter drop-shadow-2xl">
              👨‍🍳
            </div>
            {/* 装饰爱心 */}
            <div className="absolute -top-1 -right-1 text-3xl animate-bounce">
              ❤️
            </div>
            <div className="absolute -bottom-1 -left-1 text-2xl animate-pulse">
              ✨
            </div>
          </div>
        </div>

        {/* 底部按钮区域 - 只用于进入页面，不影响savedRole */}
        <div className="w-full max-w-sm space-y-3 mb-4 z-10">
          <button 
            onClick={() => {
              setRole('customer');
              setInitialView('menu');
            }}
            className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 p-4 rounded-2xl shadow-xl shadow-orange-200 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white animate-in slide-in-from-bottom duration-500"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-lg transform -rotate-6 hover:rotate-0 transition-transform">
              🍽️
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-black text-white mb-0.5">我要点菜</h3>
              <p className="text-orange-100 text-xs font-medium">肚子饿了，想吃好吃的～</p>
            </div>
            <div className="text-2xl text-white">→</div>
          </button>

          <button 
            onClick={() => {
              setRole('customer');
              setInitialView('history');
            }}
            className="w-full bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 p-4 rounded-2xl shadow-xl shadow-pink-200 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white animate-in slide-in-from-bottom duration-500 delay-100"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-lg transform rotate-6 hover:rotate-0 transition-transform">
              📝
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-black text-white mb-0.5">我的订单</h3>
              <p className="text-pink-100 text-xs font-medium">查看订单状态和历史～</p>
            </div>
            <div className="text-2xl text-white">→</div>
          </button>

          <button 
            onClick={() => {
              setRole('kitchen');
            }}
            className="w-full bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 p-4 rounded-2xl shadow-xl shadow-purple-200 flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white animate-in slide-in-from-bottom duration-500 delay-200"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-lg transform -rotate-6 hover:rotate-0 transition-transform">
              🎁
            </div>
            <div className="text-left flex-1">
              <h3 className="text-xl font-black text-white mb-0.5">大厨特供</h3>
              <p className="text-purple-100 text-xs font-medium">管理菜单，精心烹饪～</p>
            </div>
            <div className="text-2xl text-white">→</div>
          </button>
        </div>

        {/* 底部装饰文字 */}
        <div className="absolute bottom-2 text-center text-xs text-gray-400 animate-in fade-in duration-1000 delay-500">
          <p>💝 用爱烹饪每一餐 💝</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        
        {/* 左上角身份标识（在顾客/大厨页面内显示） */}
        {savedRole && role && (
          <div className="fixed top-4 left-4 z-50 flex items-center gap-2 animate-in slide-in-from-left">
            <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-xs font-medium border border-gray-200">
              {savedRole === 'customer' ? '🍽️ 顾客' : '👨‍🍳 大厨'}
            </div>
            <button
              onClick={() => {
                if (window.confirm('确定要清除身份信息吗？下次打开将重新选择。')) {
                  localStorage.removeItem('userRole');
                  setSavedRole(null);
                  setRole(null);
                  setShowRoleModal(true);
                  showToast('已清除身份，请重新选择');
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full shadow-lg text-xs font-bold active:scale-95 transition flex items-center justify-center"
              title="清除身份"
            >
              ✕
            </button>
          </div>
        )}

      {role === 'customer' ? (
        <CustomerView userId={user.uid} setRole={setRole} menuItems={menuItems} allOrders={allOrders} initialView={initialView} />
      ) : (
        <KitchenView 
          setRole={setRole} 
          menuItems={menuItems} 
          updateMenu={updateMenu} 
          deleteMenu={deleteMenu}
          addMenu={addMenu}
          allOrders={allOrders} 
          showToast={showToast} 
        />
      )}
    </div>
  );
}