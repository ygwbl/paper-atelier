#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sxltx Atelier · Twitter (X) 自动化发布与宣发推客引擎
功能：
1. 若已配置 Twitter API v2 OAuth 1.0a 密钥，直接通过纯原生库（零外部依赖）自动发推；
2. 若未配置 API 密钥，智能生成在 280 字符权重安全阈值内的 Web Intent 一键直达发布链接；
3. 支持与 curator_daemon.py 联动，文章落盘即刻自动同步至多平台。
"""

import os
import sys
import json
import time
import hmac
import hashlib
import base64
import secrets
import urllib.parse
import urllib.request
import webbrowser

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
ARTICLES_FILE = os.path.join(DATA_DIR, "articles.json")
SYND_DIR = os.path.join(DATA_DIR, "syndications")

def calculate_twitter_weight(text):
    """计算 Twitter 字符权重（非 ASCII 字符计 2，ASCII 计 1，URL 计 23 字符/46 权重）"""
    import re
    text_clean = re.sub(r'https?://\S+', 'X'*23, text)
    weight = 0
    for ch in text_clean:
        weight += 2 if ord(ch) > 127 else 1
    return weight

def get_twitter_credentials():
    """获取 Twitter API 凭据（优先环境变量，其次 config.json）"""
    creds = {
        "api_key": os.getenv("TWITTER_API_KEY", ""),
        "api_secret": os.getenv("TWITTER_API_SECRET", ""),
        "access_token": os.getenv("TWITTER_ACCESS_TOKEN", ""),
        "access_token_secret": os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "")
    }
    if not all(creds.values()) and os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            tw = cfg.get("twitter", {})
            for k in creds:
                if not creds[k] and tw.get(k):
                    creds[k] = tw[k]
        except Exception:
            pass
    return creds

def create_oauth1_header(method, url, params, creds):
    """纯原生标准 RFC 5849 OAuth 1.0a 签名头生成"""
    oauth_params = {
        "oauth_consumer_key": creds["api_key"],
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": creds["access_token"],
        "oauth_version": "1.0"
    }
    all_params = {}
    all_params.update(params)
    all_params.update(oauth_params)
    
    encoded_params = sorted([
        (urllib.parse.quote(str(k), safe=""), urllib.parse.quote(str(v), safe=""))
        for k, v in all_params.items()
    ])
    param_str = "&".join(f"{k}={v}" for k, v in encoded_params)
    
    base_string = f"{method.upper()}&{urllib.parse.quote(url, safe='')}&{urllib.parse.quote(param_str, safe='')}"
    signing_key = f"{urllib.parse.quote(creds['api_secret'], safe='')}&{urllib.parse.quote(creds['access_token_secret'], safe='')}"
    
    sig = base64.b64encode(
        hmac.new(signing_key.encode("utf-8"), base_string.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")
    oauth_params["oauth_signature"] = sig
    
    header_parts = [
        f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(v, safe="")}"'
        for k, v in sorted(oauth_params.items())
    ]
    return "OAuth " + ", ".join(header_parts)

def build_tweet_content(article):
    """根据文章构建适配布道于 X 的高质感精炼推文（严控在 270 字符权重内）"""
    title = article.get("title", "").strip()
    slug = article.get("slug") or article.get("id")
    art_url = f"https://blog.hlat.xyz/article/{slug}"
    
    summary = article.get("summary", "").strip().lstrip("“\" \t")
    # 提取第一句精华
    sentences = [s.strip() for s in summary.replace("。", "。\n").splitlines() if s.strip()]
    lead = sentences[0] if sentences else summary
    if len(lead) > 75:
        lead = lead[:72] + "..."
        
    candidate = f"【{title}】\n\n{lead}\n\n手记直达：{art_url}\n#Web开发 #架构设计 #独立博客"
    
    # 动态安全权重检测与微调
    while calculate_twitter_weight(candidate) > 275 and len(lead) > 20:
        lead = lead[:-5] + "..."
        candidate = f"【{title}】\n\n{lead}\n\n手记直达：{art_url}\n#Web开发 #架构设计 #独立博客"
        
    return candidate, art_url

def post_tweet_api(text, creds):
    """通过 Twitter API v2 发送推文"""
    url = "https://api.twitter.com/2/tweets"
    payload = json.dumps({"text": text}).encode("utf-8")
    auth_header = create_oauth1_header("POST", url, {}, creds)
    
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result

def generate_tweet_intent_url(text):
    """生成预填充全套文案、链接与标签的直达 Intent URL"""
    return "https://twitter.com/intent/tweet?text=" + urllib.parse.quote(text)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sxltx Atelier Twitter (X) 宣发引擎")
    parser.add_argument("--slug", help="指定文章 slug，默认最新一篇")
    parser.add_argument("--open", action="store_true", help="在默认浏览器中一键打开推文预填发布页")
    parser.add_argument("--dry-run", action="store_true", help="仅预览推文文案与字符权重")
    args = parser.parse_args()

    # 1. 加载文章
    if not os.path.exists(ARTICLES_FILE):
        print(f"[错误] 文章数据不存在: {ARTICLES_FILE}")
        sys.exit(1)
        
    with open(ARTICLES_FILE, "r", encoding="utf-8") as f:
        articles = json.load(f)
    if not articles:
        print("[提示] 暂无可宣发的文章")
        sys.exit(0)
        
    target_art = articles[0]
    if args.slug:
        matched = [a for a in articles if a.get("slug") == args.slug or a.get("id") == args.slug]
        if matched:
            target_art = matched[0]
            
    slug = target_art.get("slug") or target_art.get("id")
    tweet_text, art_url = build_tweet_content(target_art)
    weight = calculate_twitter_weight(tweet_text)
    intent_url = generate_tweet_intent_url(tweet_text)
    
    # 落盘宣发资源包
    art_synd_dir = os.path.join(SYND_DIR, slug)
    os.makedirs(art_synd_dir, exist_ok=True)
    with open(os.path.join(art_synd_dir, "social.txt"), "w", encoding="utf-8") as f:
        f.write(tweet_text)
    with open(os.path.join(art_synd_dir, "twitter_intent.txt"), "w", encoding="utf-8") as f:
        f.write(intent_url)
        
    print(f"=== Sxltx Atelier · X (Twitter) 宣发文案包 ===")
    print(f"文章: {target_art.get('title')}")
    print(f"推文字符权重: {weight} / 280 安全阈值 (余量: {280 - weight})")
    print("-" * 50)
    print(tweet_text)
    print("-" * 50)
    print(f"预填直发 Intent 链接:\n{intent_url}\n")
    
    if args.dry_run:
        return

    # 2. 检查 API 凭据
    creds = get_twitter_credentials()
    if all(creds.values()):
        print("[API 模式] 检测到完整 Twitter API 凭据，正在直推至 X (Twitter)...")
        try:
            res = post_tweet_api(tweet_text, creds)
            tweet_id = res.get("data", {}).get("id")
            print(f"[成功] 推文已全自动发布至 X！")
            print(f"推文 ID: {tweet_id}")
            print(f"推文直达链接: https://x.com/Sxltx_/status/{tweet_id}")
        except Exception as e:
            print(f"[API 失败] 直推发生异常: {e}")
            print("[降级] 建议使用上述 Intent 链接在浏览器中一键直发。")
    else:
        print("[提示] 当前尚未配置 Twitter API 密钥（无需惊慌）。")
        print("  - 若需全天候【零人工介入全自动发推】，只需在 config.json 的 'twitter' 节点填入 4 个 API 凭据；")
        print("  - 若当前想立即发推，点击上述生成的 Intent 直达链接，浏览器将直接唤起预填好所有文案与标签的发布卡片。")
        if args.open:
            print("[操作] 正在默认浏览器中唤起 Twitter 预填发帖窗口...")
            webbrowser.open(intent_url)

if __name__ == "__main__":
    main()
