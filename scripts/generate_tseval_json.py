#!/usr/bin/env python3
"""
生成 tseval.json 文件，包含 Stock Quant 数据

使用方法:
  python3 generate_tseval_json.py

输入: results_full.json (在 Quant/backtest_final_package 目录)
输出: tseval.json (可复制到前端 public/ 目录)
"""

import json
import sys
from pathlib import Path

def main():
    # 查找 results_full.json
    results_file = Path(__file__).parent.parent / 'Quant' / 'backtest_final_package' / 'results_full.json'
    
    if not results_file.exists():
        print(f"❌ 找不到文件: {results_file}")
        sys.exit(1)
    
    print(f"📖 读取: {results_file}")
    with open(results_file, 'r') as f:
        results = json.load(f)
    
    print(f"✓ 加载了 {len(results)} 条回测结果")
    
    # 按配置分组
    quant_data = {
        'backtest_91d_conservative': [],
        'backtest_91d_balanced': [],
        'backtest_91d_aggressive': []
    }
    
    for item in results:
        config = item['config']
        key = f'backtest_91d_{config}'
        
        # 去掉模型名称的 st_ 或 ts_ 前缀
        model_name = item['model']
        if model_name.startswith('st_') or model_name.startswith('ts_'):
            model_name = model_name[3:]  # 去掉前3个字符
        
        # 特殊处理 Baseline
        if 'Baseline' in model_name or 'BuyHold' in model_name:
            model_name = 'baseline'
        
        # 跳过 HL 模型（我们只要 Buy and Hold）
        if model_name == 'HL':
            continue
        
        entry = {
            'model': model_name,
            'total_return': item['total_return'],
            'annualized_return': item['annualized_return'],
            'sharpe': item['sharpe'],
            'max_drawdown': item['max_drawdown'],
            'win_rate': item['win_rate'],
            'avg_turnover': item['avg_turnover'],
            'n_runs': 1
        }
        
        quant_data[key].append(entry)
    
    # 创建 tseval.json 结构
    tseval_data = {
        'tracks': {
            'stock': {
                'datasets': {
                    'Stock-HS300': {
                        'horizons': {
                            '1': [],
                            '5': []
                        },
                        'quant': quant_data
                    }
                }
            }
        }
    }
    
    # 保存
    output_file = Path('tseval.json')
    with open(output_file, 'w') as f:
        json.dump(tseval_data, f, indent=2)
    
    print(f"\n✅ 生成: {output_file.absolute()}")
    print(f"文件大小: {output_file.stat().st_size / 1024:.1f} KB")
    print(f"\n包含数据:")
    for key, items in quant_data.items():
        print(f"  {key}: {len(items)} 个模型")
    
    # 显示示例
    print(f"\n示例数据 (conservative 前5个):")
    for item in quant_data['backtest_91d_conservative'][:5]:
        print(f"  {item['model']:15s} total_return={item['total_return']:7.4f}")
    
    print(f"\n📋 使用方法:")
    print(f"  1. 生成完整数据: python3 generate_tseval_json.py")
    print(f"  2. 合并到 leaderboard.json: python3 merge_quant_data.py")
    print(f"  3. 复制到项目: cp leaderboard.json /path/to/project/content/tseval/")

if __name__ == '__main__':
    main()
