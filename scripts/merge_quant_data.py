#!/usr/bin/env python3
"""
将 tseval.json 的 quant 数据合并到 leaderboard.json

使用方法:
  python3 merge_quant_data.py
"""

import json
from pathlib import Path

def main():
    leaderboard_file = Path('leaderboard.json')
    tseval_file = Path('tseval.json')
    
    if not leaderboard_file.exists():
        print(f"❌ 找不到 {leaderboard_file}")
        return
    
    if not tseval_file.exists():
        print(f"❌ 找不到 {tseval_file}")
        print(f"请先运行: python3 generate_tseval_json.py")
        return
    
    # 读取现有的 leaderboard.json
    print(f"📖 读取: {leaderboard_file}")
    with open(leaderboard_file, 'r') as f:
        leaderboard = json.load(f)
    
    # 读取生成的 tseval.json
    print(f"📖 读取: {tseval_file}")
    with open(tseval_file, 'r') as f:
        tseval = json.load(f)
    
    # 提取 quant 数据
    quant_data = tseval['tracks']['stock']['datasets']['Stock-HS300']['quant']
    
    # 合并到 leaderboard.json
    leaderboard['tracks']['stock']['datasets']['Stock-HS300']['quant'] = quant_data
    
    # 保存
    print(f"💾 保存: {leaderboard_file}")
    with open(leaderboard_file, 'w') as f:
        json.dump(leaderboard, f, indent=2)
    
    print(f"\n✅ 合并完成")
    print(f"\n包含数据:")
    for key, items in quant_data.items():
        # 统计 baseline
        baselines = [m for m in items if m['model'] in ['baseline', 'HL']]
        print(f"  {key}: {len(items)} 个模型 (baseline: {len(baselines)})")
    
    print(f"\n📋 下一步:")
    print(f"  cp {leaderboard_file} /path/to/project/content/tseval/")

if __name__ == '__main__':
    main()
