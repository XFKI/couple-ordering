-- 为orders表添加制作开始时间和完成时间字段
-- 在Supabase SQL Editor中运行此脚本

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cooking_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 验证字段是否添加成功
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('cooking_started_at', 'completed_at');
