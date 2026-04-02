#!/usr/bin/env python3
"""
Test Script for Product Cards Backend
测试产品卡后端功能
"""

import json
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 初始化数据库
import models

models.init_db()

from product_card_manager import get_card_manager


def test_p1_generation():
    """测试 P1 生成"""
    print("\n" + "=" * 50)
    print("测试 P1 项目配置卡生成")
    print("=" * 50)

    # 获取或创建测试项目
    projects = models.get_projects()
    if projects:
        project_id = projects[0]["id"]
        print(f"使用现有项目: {project_id}")
    else:
        project_id = models.create_project(
            name="测试项目 - Open Ear Earbuds",
            background="测试开放式耳机",
            query="open ear earbuds",
            subreddits=["headphones", "earbuds"],
        )
        print(f"创建新项目: {project_id}")

    # P1 输入数据
    input_data = {
        "project_background": "运动耳机品牌推广 - 开放式聆听体验",
        "target_audience": "跑步爱好者、健身人群",
        "unique_selling_points": ["开放聆听", "舒适佩戴", "运动安全"],
        "seed_keywords": ["open ear earbuds", "bone conduction"],
        "brand_names": ["OpenBeats"],
        "competitor_brands": ["Shokz", "Bose", "Sony"],
    }

    try:
        card_id = get_card_manager().create_p1_card(project_id, input_data)
        print(f"✅ P1 卡片创建成功: {card_id}")

        # 获取卡片详情
        card = get_card_manager().get_card(card_id)
        if card:
            card_data = card.get("card_data", {})
            generated = card_data.get("generated_data", {})

            print(f"\n📋 卡片信息:")
            print(f"  - 名称: {card_data.get('card_name', 'N/A')}")
            print(f"  - 阶段: {card['phase']}")
            print(f"  - 状态: {card['status']}")

            print(f"\n🔑 生成的关键词 ({len(generated.get('all_keywords', []))} 个):")
            core_keywords = generated.get("core_keywords", [])[:5]
            print(f"  核心: {', '.join(core_keywords)}")

            print(f"\n📍 推荐的 Subreddits:")
            subs = generated.get("subreddit_suggestions", {}).get("high_relevance", [])
            for s in subs[:3]:
                print(f"  - r/{s.get('name', 'N/A')}: {s.get('reason', '')}")

            return card_id
        else:
            print("❌ 无法获取卡片详情")
            return None
    except Exception as e:
        print(f"❌ P1 生成失败: {e}")
        import traceback

        traceback.print_exc()
        return None


def test_p2_generation(p1_card_id):
    """测试 P2 生成"""
    print("\n" + "=" * 50)
    print("测试 P2 内容抓取卡生成 (Mock 模式)")
    print("=" * 50)

    try:
        # 获取 P1 卡片的项目 ID
        p1_card = get_card_manager().get_card(p1_card_id)
        project_id = p1_card["project_id"]

        # 创建 P2 卡片
        card_id = get_card_manager().create_p2_card(
            project_id=project_id,
            parent_card_id=p1_card_id,
            scraping_data={},
            use_mock=True,
        )
        print(f"✅ P2 卡片创建成功: {card_id}")

        # 获取卡片详情
        card = get_card_manager().get_card(card_id)
        if card:
            card_data = card.get("card_data", {})
            scraping_data = card_data.get("scraping_data", {})

            print(f"\n📋 卡片信息:")
            print(f"  - 名称: {card_data.get('card_name', 'N/A')}")
            print(f"  - 阶段: {card['phase']}")
            print(f"  - 父卡片: {card.get('parent_card_id', 'N/A')}")

            print(f"\n📊 抓取统计:")
            print(f"  - 帖子总数: {scraping_data.get('total_posts', 0)}")
            print(f"  - 板块分布: {scraping_data.get('subreddit_breakdown', {})}")

            # 显示预览
            posts_preview = scraping_data.get("posts_preview", [])
            if posts_preview:
                print(f"\n📝 帖子预览 (前 3 条):")
                for i, post in enumerate(posts_preview[:3], 1):
                    print(
                        f"  {i}. [{post.get('subreddit', 'N/A')}] {post.get('title', 'N/A')[:50]}..."
                    )
                    print(
                        f"     👍 {post.get('upvotes', 0)}  💬 {post.get('comments', 0)}"
                    )

            return card_id
        else:
            print("❌ 无法获取卡片详情")
            return None
    except Exception as e:
        print(f"❌ P2 生成失败: {e}")
        import traceback

        traceback.print_exc()
        return None


def test_p3_analysis(p2_card_id):
    """测试 P3 分析"""
    print("\n" + "=" * 50)
    print("测试 P3 热帖识别卡生成")
    print("=" * 50)

    try:
        # 获取 P2 卡片的项目 ID
        p2_card = get_card_manager().get_card(p2_card_id)
        project_id = p2_card["project_id"]

        # 创建 P3 卡片
        card_id = get_card_manager().create_p3_card(project_id, p2_card_id)
        print(f"✅ P3 卡片创建成功: {card_id}")

        # 获取卡片详情
        card = get_card_manager().get_card(card_id)
        if card:
            card_data = card.get("card_data", {})
            analysis_data = card_data.get("analysis_data", {})

            print(f"\n📋 卡片信息:")
            print(f"  - 名称: {card_data.get('card_name', 'N/A')}")
            print(f"  - 阶段: {card['phase']}")

            print(f"\n📊 分析统计:")
            print(f"  - 分析帖子数: {analysis_data.get('total_posts', 0)}")
            print(f"  - 候选热帖: {analysis_data.get('candidates_count', 0)}")

            # 分类统计
            cat_stats = analysis_data.get("category_stats", {})
            print(f"\n🏷️ 分类分布:")
            for cat, info in cat_stats.get("category_distribution", {}).items():
                if info.get("count", 0) > 0:
                    print(f"  - {info.get('name', cat)}: {info['count']} 条")

            # 评分分布
            score_dist = cat_stats.get("score_distribution", {})
            print(f"\n⭐ 评分分布:")
            for level, count in score_dist.items():
                print(f"  - {level} 级: {count} 条")

            # 候选预览
            candidates = analysis_data.get("candidates_preview", [])
            if candidates:
                print(f"\n🔥 候选热帖预览 (前 3 条):")
                for i, c in enumerate(candidates[:3], 1):
                    print(
                        f"  {i}. [{c.get('score_level', 'N/A')}] {c.get('title', 'N/A')[:40]}..."
                    )
                    print(
                        f"     评分: {c.get('composite_score', 0):.2f}  分类: {c.get('category_name', 'N/A')}"
                    )

            return card_id
        else:
            print("❌ 无法获取卡片详情")
            return None
    except Exception as e:
        print(f"❌ P3 分析失败: {e}")
        import traceback

        traceback.print_exc()
        return None


def test_workflow_status(project_id):
    """测试流程状态查询"""
    print("\n" + "=" * 50)
    print("测试流程状态查询")
    print("=" * 50)

    try:
        status = get_card_manager().get_workflow_status(project_id)

        print(f"\n📊 项目流程状态:")
        print(f"  - 项目名称: {status.get('project_name', 'N/A')}")
        print(f"  - 当前阶段: {status.get('current_phase', 'N/A')}")
        print(f"  - 当前卡片: {status.get('current_card_id', 'N/A')}")
        print(f"  - 已完成: {', '.join(status.get('completed_phases', []))}")
        print(f"  - 待完成: {', '.join(status.get('pending_phases', []))}")

        # 各阶段卡片数
        print(f"\n📁 各阶段卡片数:")
        for phase, cards in status.get("phase_cards", {}).items():
            print(f"  - {phase}: {len(cards)} 张卡片")

        return True
    except Exception as e:
        print(f"❌ 流程状态查询失败: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_export(card_id):
    """测试导出功能"""
    print("\n" + "=" * 50)
    print("测试产品卡导出")
    print("=" * 50)

    try:
        export_path = get_card_manager().export_card(card_id)
        print(f"✅ 导出成功: {export_path}")

        # 验证文件存在
        if os.path.exists(export_path):
            file_size = os.path.getsize(export_path)
            print(f"  - 文件大小: {file_size} 字节")

            # 读取并验证 JSON
            with open(export_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                print(f"  - 验证 JSON: 有效")
                print(f"  - 卡片 ID: {data.get('id', 'N/A')}")
                print(f"  - 阶段: {data.get('phase', 'N/A')}")

        return True
    except Exception as e:
        print(f"❌ 导出失败: {e}")
        import traceback

        traceback.print_exc()
        return False


def run_full_test():
    """运行完整测试"""
    print("\n" + "=" * 60)
    print("🚀 产品卡后端功能完整测试")
    print("=" * 60)

    results = {}

    # Test P1
    p1_card_id = test_p1_generation()
    results["P1"] = p1_card_id is not None

    if p1_card_id:
        # Test P2
        p2_card_id = test_p2_generation(p1_card_id)
        results["P2"] = p2_card_id is not None

        if p2_card_id:
            # Test P3
            p3_card_id = test_p3_analysis(p2_card_id)
            results["P3"] = p3_card_id is not None

            # Get project ID
            p1_card = get_card_manager().get_card(p1_card_id)
            project_id = p1_card["project_id"]

            # Test workflow status
            results["workflow_status"] = test_workflow_status(project_id)

            # Test export
            if p3_card_id:
                results["export"] = test_export(p3_card_id)

    # Summary
    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)

    all_passed = True
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {test_name:20s} {status}")
        if not passed:
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 所有测试通过！Phase 1 后端功能正常工作。")
    else:
        print("⚠️ 部分测试失败，请检查错误信息。")
    print("=" * 60)

    return all_passed


if __name__ == "__main__":
    success = run_full_test()
    sys.exit(0 if success else 1)
