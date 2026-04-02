"""
Product Card Manager
管理产品卡的 CRUD 和流程控制
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

import models
import config


class ProductCardManager:
    """产品卡管理器"""

    # 支持的阶段
    PHASES = ["P1", "P2", "P3", "P4-1", "P4-2", "P5"]

    # 阶段名称映射
    PHASE_NAMES = {
        "P1": "项目配置",
        "P2": "内容抓取",
        "P3": "热帖识别",
        "P4-1": "人设设计",
        "P4-2": "内容创作",
        "P5": "发布追踪",
    }

    def __init__(self):
        self.export_dir = os.path.join(config.DATA_DIR, "product_cards")
        os.makedirs(self.export_dir, exist_ok=True)

    def create_card(
        self,
        project_id: str,
        phase: str,
        card_name: str,
        card_data: Dict,
        parent_card_id: Optional[str] = None,
    ) -> str:
        """
        创建新产品卡

        Args:
            project_id: 项目 ID
            phase: 阶段 (P1/P2/P3/P4-1/P4-2/P5)
            card_name: 产品卡名称
            card_data: Data Card JSON 数据
            parent_card_id: 上游产品卡 ID

        Returns:
            card_id: 新产品卡 ID
        """
        # 验证阶段
        if phase not in self.PHASES:
            raise ValueError(f"Invalid phase: {phase}. Must be one of {self.PHASES}")

        # 创建产品卡
        card_id = models.create_product_card(
            project_id=project_id,
            phase=phase,
            card_name=card_name,
            card_data=card_data,
            parent_card_id=parent_card_id,
        )

        # 更新项目当前产品卡
        models.set_project_current_card(project_id, card_id)

        return card_id

    def get_card(self, card_id: str) -> Optional[Dict]:
        """获取产品卡详情"""
        return models.get_product_card(card_id)

    def get_project_cards(
        self, project_id: str, phase: Optional[str] = None
    ) -> List[Dict]:
        """获取项目的所有产品卡"""
        return models.get_project_product_cards(project_id, phase)

    def get_card_chain(self, card_id: str) -> List[Dict]:
        """获取产品卡链路（从 P1 到当前）"""
        return models.get_product_card_chain(card_id)

    def update_card(
        self,
        card_id: str,
        card_name: Optional[str] = None,
        card_data: Optional[Dict] = None,
        status: Optional[str] = None,
    ) -> bool:
        """更新产品卡"""
        return models.update_product_card(card_id, card_name, card_data, status)

    def confirm_card(self, card_id: str, confirmed_by: str = "user") -> bool:
        """
        确认产品卡，进入下一阶段

        Args:
            card_id: 产品卡 ID
            confirmed_by: 确认人（默认 user）

        Returns:
            bool: 是否成功
        """
        return models.confirm_product_card(card_id, confirmed_by)

    def delete_card(self, card_id: str) -> bool:
        """删除产品卡（仅 draft 状态可删除）"""
        return models.delete_product_card(card_id)

    def export_card(self, card_id: str) -> str:
        """
        导出产品卡为 JSON 文件

        Returns:
            export_path: 导出文件路径
        """
        card = self.get_card(card_id)
        if not card:
            raise ValueError(f"Card not found: {card_id}")

        # 构建文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{card['id']}_{timestamp}.json"
        export_path = os.path.join(self.export_dir, filename)

        # 写入文件
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(card, f, ensure_ascii=False, indent=2)

        # 更新数据库中的导出路径
        models.update_product_card(card_id, export_path=export_path)

        return export_path

    def get_workflow_status(self, project_id: str) -> Dict:
        """
        获取项目流程状态

        Returns:
            {
                'current_phase': 'P1',  # 当前阶段
                'current_card_id': 'card_xxx',  # 当前产品卡
                'completed_phases': ['P1'],  # 已完成阶段
                'pending_phases': ['P2', 'P3', 'P4-1', 'P4-2', 'P5'],  # 待完成阶段
                'phase_cards': {  # 每个阶段的产品卡列表
                    'P1': [...],
                    'P2': [...],
                    ...
                }
            }
        """
        # 获取项目信息
        project = models.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        current_card_id = project.get("current_card_id")

        # 获取所有产品卡
        all_cards = self.get_project_cards(project_id)

        # 按阶段分组
        phase_cards = {phase: [] for phase in self.PHASES}
        completed_phases = set()

        for card in all_cards:
            phase = card["phase"]
            if phase in phase_cards:
                phase_cards[phase].append(card)
                if card["status"] == "active":
                    completed_phases.add(phase)

        # 确定当前阶段
        current_phase = None
        if current_card_id:
            current_card = self.get_card(current_card_id)
            if current_card:
                current_phase = current_card["phase"]

        # 如果没有当前阶段，找第一个未完成的
        if not current_phase:
            for phase in self.PHASES:
                if phase not in completed_phases:
                    current_phase = phase
                    break

        # 待完成阶段
        pending_phases = [
            p for p in self.PHASES if p not in completed_phases and p != current_phase
        ]

        return {
            "current_phase": current_phase,
            "current_card_id": current_card_id,
            "completed_phases": list(completed_phases),
            "pending_phases": pending_phases,
            "phase_cards": phase_cards,
            "project_id": project_id,
            "project_name": project.get("name", "Unknown"),
        }

    def jump_to_phase(self, project_id: str, target_phase: str) -> Optional[str]:
        """
        跳转到指定阶段

        Args:
            project_id: 项目 ID
            target_phase: 目标阶段

        Returns:
            card_id: 该阶段最新的产品卡 ID，如果没有则返回 None
        """
        if target_phase not in self.PHASES:
            raise ValueError(f"Invalid phase: {target_phase}")

        # 获取该阶段的所有产品卡
        cards = self.get_project_cards(project_id, target_phase)

        if cards:
            # 返回最新的产品卡
            latest_card = cards[0]  # 已按时间倒序
            models.set_project_current_card(project_id, latest_card["id"])
            return latest_card["id"]

        return None

    def get_next_phase(self, current_phase: str) -> Optional[str]:
        """获取下一阶段"""
        try:
            current_idx = self.PHASES.index(current_phase)
            if current_idx < len(self.PHASES) - 1:
                return self.PHASES[current_idx + 1]
        except ValueError:
            pass
        return None

    def get_prev_phase(self, current_phase: str) -> Optional[str]:
        """获取上一阶段"""
        try:
            current_idx = self.PHASES.index(current_phase)
            if current_idx > 0:
                return self.PHASES[current_idx - 1]
        except ValueError:
            pass
        return None

    def create_p1_card(self, project_id: str, input_data: Dict) -> str:
        """
        创建 P1 项目配置卡

        Args:
            project_id: 项目 ID
            input_data: {
                'project_background': '...',
                'target_audience': '...',
                'unique_selling_points': ['...'],
                'seed_keywords': ['...']
            }

        Returns:
            card_id: 产品卡 ID
        """
        from p1_config_generator import P1ConfigGenerator

        generator = P1ConfigGenerator()
        card_data = generator.generate(input_data)

        card_name = f"项目配置 - {input_data.get('project_background', '未命名')[:20]}"

        return self.create_card(
            project_id=project_id, phase="P1", card_name=card_name, card_data=card_data
        )

    def create_p2_card(
        self,
        project_id: str,
        parent_card_id: str,
        scraping_data: Dict,
        use_mock: bool = False,
    ) -> str:
        """
        创建 P2 内容抓取卡

        Args:
            project_id: 项目 ID
            parent_card_id: P1 产品卡 ID
            scraping_data: 抓取数据
            use_mock: 是否使用 Mock 数据

        Returns:
            card_id: 产品卡 ID
        """
        from p2_scraping_manager import P2ScrapingManager

        manager = P2ScrapingManager()

        if use_mock:
            card_data = manager.generate_mock_card_data(parent_card_id)
        else:
            card_data = manager.generate_card_data(parent_card_id, scraping_data)

        # 从 scraping_data 中获取搜索词作为卡片名称
        search_queries = (
            card_data.get("scraping_data", {})
            .get("search_strategy_applied", {})
            .get("search_queries", [])
        )
        query_name = search_queries[0] if search_queries else "未命名"
        card_name = f"内容抓取 - {query_name}"

        return self.create_card(
            project_id=project_id,
            phase="P2",
            card_name=card_name,
            card_data=card_data,
            parent_card_id=parent_card_id,
        )

    def create_p3_card(self, project_id: str, parent_card_id: str) -> str:
        """
        创建 P3 热帖识别卡

        Args:
            project_id: 项目 ID
            parent_card_id: P2 产品卡 ID

        Returns:
            card_id: 产品卡 ID
        """
        from p3_analyzer import P3Analyzer

        analyzer = P3Analyzer()
        card_data = analyzer.analyze(parent_card_id)

        candidates_count = len(card_data.get("outputs", [{}])[0].get("fields", []))
        card_name = f"热帖识别 - {candidates_count}个候选"

        return self.create_card(
            project_id=project_id,
            phase="P3",
            card_name=card_name,
            card_data=card_data,
            parent_card_id=parent_card_id,
        )

    def validate_card_data(self, card_data: Dict, phase: str) -> List[str]:
        """
        验证产品卡数据格式

        Args:
            card_data: Data Card JSON
            phase: 阶段

        Returns:
            errors: 错误列表，空列表表示验证通过
        """
        errors = []

        # 检查必需字段
        required_fields = [
            "card_id",
            "card_name",
            "level",
            "input_parameters",
            "upstream_data",
            "outputs",
        ]

        for field in required_fields:
            if field not in card_data:
                errors.append(f"缺少必需字段: {field}")

        # 检查 outputs
        if "outputs" in card_data:
            if not isinstance(card_data["outputs"], list):
                errors.append("outputs 必须是数组")
            elif len(card_data["outputs"]) == 0:
                errors.append("outputs 不能为空")

        # 阶段特定验证
        if phase == "P1":
            if "input_parameters" in card_data:
                params = card_data["input_parameters"]
                seed_keywords = [
                    p for p in params if p.get("param_name") == "seed_keywords"
                ]
                if not seed_keywords:
                    errors.append("P1 必须有 seed_keywords 参数")

        elif phase == "P2":
            if "outputs" in card_data:
                raw_posts = [
                    o for o in card_data["outputs"] if "raw" in o.get("output_id", "")
                ]
                if not raw_posts:
                    errors.append("P2 必须有原始数据输出")

        elif phase == "P3":
            if "outputs" in card_data:
                candidates = [
                    o
                    for o in card_data["outputs"]
                    if "candidate" in o.get("output_id", "")
                ]
                if not candidates:
                    errors.append("P3 必须有候选热帖输出")

        return errors


# 全局实例
_card_manager = None


def get_card_manager() -> ProductCardManager:
    """获取产品卡管理器实例（单例）"""
    global _card_manager
    if _card_manager is None:
        _card_manager = ProductCardManager()
    return _card_manager
