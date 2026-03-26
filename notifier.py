"""
Notification service: Telegram and Email
"""
import smtplib
import logging
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config

logger = logging.getLogger(__name__)


class Notifier:
    def send_pipeline_complete(self, stats: dict) -> dict:
        """
        Send notification after pipeline completes.
        Returns dict with results from each channel.
        """
        message = self._build_message(stats)
        results = {}

        if config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID:
            results["telegram"] = self._send_telegram(message)
        else:
            results["telegram"] = {"sent": False, "reason": "No Telegram config"}

        if config.EMAIL_USER and config.EMAIL_PASSWORD and config.EMAIL_TO:
            results["email"] = self._send_email(
                subject=f"📊 Reddit Ops 每日报告 - {stats.get('date', 'Today')}",
                html_body=self._build_html_message(stats)
            )
        else:
            results["email"] = {"sent": False, "reason": "No email config"}

        logger.info(f"Notification results: {results}")
        return results

    def _build_message(self, stats: dict) -> str:
        date = stats.get("date", "Today")
        total_posts = stats.get("total_posts", 0)
        total_candidates = stats.get("total_candidates", 0)
        total_content = stats.get("total_content", 0)
        review_url = f"{config.APP_URL}/editor"

        cat_counts = stats.get("category_counts", {})
        cat_lines = []
        cat_names = {
            "A": "结构型测评", "B": "场景痛点",
            "C": "观点争议", "D": "竞品KOL", "E": "平台趋势"
        }
        for k, v in cat_counts.items():
            if v > 0:
                cat_lines.append(f"  {k}({cat_names.get(k, k)}): {v}条")

        return f"""📊 Reddit Ops 每日报告 {date}

✅ 任务完成！

📥 抓取帖子: {total_posts} 篇
🎯 候选帖子: {total_candidates} 篇
✍️ 生成内容: {total_content} 条

📂 热点分布:
{chr(10).join(cat_lines) if cat_lines else '  暂无数据'}

🔗 审核地址: {review_url}

请前往审核并标记内容状态。"""

    def _build_html_message(self, stats: dict) -> str:
        date = stats.get("date", "Today")
        review_url = f"{config.APP_URL}/editor"
        cat_counts = stats.get("category_counts", {})

        cat_rows = ""
        cat_names = {
            "A": "结构型测评", "B": "场景痛点",
            "C": "观点争议", "D": "竞品KOL", "E": "平台趋势"
        }
        for k, v in cat_counts.items():
            cat_rows += f"<tr><td style='padding:4px 12px'>{k} - {cat_names.get(k, k)}</td><td style='padding:4px 12px'><b>{v}</b></td></tr>"

        return f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#4f46e5">📊 Reddit Ops 每日报告</h2>
  <p style="color:#6b7280">{date}</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
    <p>📥 <b>抓取帖子:</b> {stats.get('total_posts', 0)} 篇</p>
    <p>🎯 <b>候选帖子:</b> {stats.get('total_candidates', 0)} 篇</p>
    <p>✍️ <b>生成内容:</b> {stats.get('total_content', 0)} 条</p>
  </div>
  <h3>热点分布</h3>
  <table style="width:100%;border-collapse:collapse">
    {cat_rows}
  </table>
  <div style="margin:24px 0">
    <a href="{review_url}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">
      前往审核 →
    </a>
  </div>
</body>
</html>"""

    def _send_telegram(self, text: str) -> dict:
        try:
            url = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}/sendMessage"
            resp = requests.post(url, json={
                "chat_id": config.TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML"
            }, timeout=10)
            resp.raise_for_status()
            return {"sent": True, "channel": "telegram"}
        except Exception as e:
            logger.error(f"Telegram notification failed: {e}")
            return {"sent": False, "error": str(e)}

    def _send_email(self, subject: str, html_body: str) -> dict:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = config.EMAIL_USER
            msg["To"] = config.EMAIL_TO
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            with smtplib.SMTP(config.EMAIL_SMTP_HOST, config.EMAIL_SMTP_PORT) as server:
                server.starttls()
                server.login(config.EMAIL_USER, config.EMAIL_PASSWORD)
                server.sendmail(config.EMAIL_USER, config.EMAIL_TO, msg.as_string())

            return {"sent": True, "channel": "email"}
        except Exception as e:
            logger.error(f"Email notification failed: {e}")
            return {"sent": False, "error": str(e)}
