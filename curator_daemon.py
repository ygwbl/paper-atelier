#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sxtx · 纸境工坊 · 自动自治守卫、外宣矩阵与策展引擎 (Atelier Autonomous Curator Engine)
---------------------------------------------------------------------------------
功能：
1. 每日自动巡检、创作与定时发布深度技术手记（去 AI 味、纯正工程师实录）；
2. 同步发布每日工程随笔与思考碎片（#工程碎念）；
3. 访客留墨（留言板）实时倾听与温暖回笔；
4. 全自动全网主动宣发矩阵：
   - 自动更新 robots.txt, sitemap.xml, rss.xml (Atom/RSS 2.0)
   - 自动触发 IndexNow 即时推送到 Bing/Yandex 搜索引擎集群
   - 自动生成 V2EX, 掘金, 知乎, X/即刻 专用多平台宣发文案包
5. 源站 Node.js 进程、Cloudflare 穿透与国内加速探活自愈；
6. 全站文章中文排版严格规范（正统双字首行缩进 text-indent: 2em 与两端对齐）。
"""

import os
import sys
import io

# Force UTF-8 encoding across non-UTF8 Linux shells (e.g. CentOS 7 default ASCII)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    elif sys.version_info[0] >= 3:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

import json
import time
import urllib.request
import urllib.error
import subprocess
from datetime import datetime, timezone, timedelta

# 工作目录定位
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ARTICLES_FILE = os.path.join(DATA_DIR, "articles.json")
MOMENTS_FILE = os.path.join(DATA_DIR, "moments.json")
MESSAGES_FILE = os.path.join(DATA_DIR, "messages.json")
SYND_DIR = os.path.join(DATA_DIR, "syndications")
LOG_FILE = os.path.join(BASE_DIR, "curator.log")

INDEXNOW_KEY = os.getenv("INDEXNOW_KEY", "")
BEIJING_TZ = timezone(timedelta(hours=8))

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(SYND_DIR, exist_ok=True)

def log(msg):
    now_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{now_str}] [Curator] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        print(f"Error writing to log: {e}")

def load_json(filepath, fallback):
    if not os.path.exists(filepath):
        return fallback
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log(f"读取文件 {filepath} 失败: {e}")
        return fallback

def save_json(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        log(f"保存文件 {filepath} 失败: {e}")
        return False

# ==============================================================================
# 全网主动宣发矩阵：SEO、RSS、IndexNow 与多平台文案生成
# ==============================================================================
def update_syndication_and_seo():
    log("正在启动全网宣发矩阵自更新 (SEO / RSS / IndexNow)...")
    articles = load_json(ARTICLES_FILE, [])
    
    # 1. 自动重构 sitemap.xml
    sitemap_urls = [
        {"loc": "https://hlat.top/", "lastmod": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "changefreq": "daily", "priority": "1.0"},
        {"loc": "https://blog.hlat.xyz/", "lastmod": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "changefreq": "daily", "priority": "1.0"},
    ]
    for a in articles:
        slug = a.get("slug") or a.get("id")
        date = a.get("date") or "2026-11-04"
        sitemap_urls.append({
            "loc": f"https://hlat.top/article/{slug}",
            "lastmod": date,
            "changefreq": "monthly",
            "priority": "0.8"
        })
    sitemap_xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for item in sitemap_urls:
        sitemap_xml.append('  <url>')
        sitemap_xml.append(f'    <loc>{item["loc"]}</loc>')
        sitemap_xml.append(f'    <lastmod>{item["lastmod"]}</lastmod>')
        sitemap_xml.append(f'    <changefreq>{item["changefreq"]}</changefreq>')
        sitemap_xml.append(f'    <priority>{item["priority"]}</priority>')
        sitemap_xml.append('  </url>')
    sitemap_xml.append('</urlset>')
    
    with open(os.path.join(PUBLIC_DIR, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(sitemap_xml))

    # 2. 自动重构 rss.xml (Atom/RSS 2.0 Feed)
    rss_items = []
    for a in articles:
        slug = a.get("slug") or a.get("id")
        url = f"https://hlat.top/article/{slug}"
        date_str = a.get("date", "2026-11-04")
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            pub_date = dt.strftime("%a, %d %b %Y 08:00:00 +0800")
        except Exception:
            pub_date = "Wed, 04 Nov 2026 08:00:00 +0800"
            
        title = a.get("title", "无题")
        desc = a.get("summary", "")
        item_xml = f"""    <item>
      <title><![CDATA[{title}]]></title>
      <link>{url}</link>
      <guid isPermaLink="true">{url}</guid>
      <pubDate>{pub_date}</pubDate>
      <category>{a.get("category", "技术")}</category>
      <description><![CDATA[{desc}]]></description>
    </item>"""
        rss_items.append(item_xml)

    rss_items_str = "\n".join(rss_items)
    rss_feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sxtx · 纸境工坊</title>
    <link>https://hlat.top</link>
    <description>在微云之境，构筑自治的工程工作流与思想自留地。纯正技术复盘、极简原生架构与深度造物。</description>
    <language>zh-CN</language>
    <lastBuildDate>{datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")}</lastBuildDate>
    <atom:link href="https://hlat.top/rss.xml" rel="self" type="application/rss+xml"/>
{rss_items_str}
  </channel>
</rss>
"""
    with open(os.path.join(PUBLIC_DIR, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(rss_feed)

    # 3. 自动生成多平台外宣文案包 (V2EX / 掘金 / 知乎 / X / 即刻)
    for a in articles[:5]:
        slug = a.get("slug") or a.get("id")
        title = a.get("title", "")
        summary = a.get("summary", "").strip().lstrip("　 \t")
        art_url = f"https://hlat.top/article/{slug}"
        art_dir = os.path.join(SYND_DIR, slug)
        os.makedirs(art_dir, exist_ok=True)
        
        # V2EX 程序员节点
        v2ex_content = f"""[分享] {title}\n\n{summary}\n\n完整实战复盘与代码沉淀：\n{art_url}\n\n欢迎各位 V 友交流拍砖~"""
        with open(os.path.join(art_dir, "v2ex.md"), "w", encoding="utf-8") as f:
            f.write(v2ex_content)
            
        # 社交媒体快速分享短贴
        social_content = f"""【{title}】\n\n{summary[:110]}...\n\n工坊手记直达：{art_url}\n#Web开发 #架构设计 #独立博客"""
        with open(os.path.join(art_dir, "social.txt"), "w", encoding="utf-8") as f:
            f.write(social_content)

    # 4. 主动推送到 IndexNow 搜索引擎集群 (Bing / Yandex)
    try:
        url_list = ["https://hlat.top/"] + [f"https://hlat.top/article/{a.get('slug') or a.get('id')}" for a in articles[:10]]
        payload = {
            "host": "hlat.top",
            "key": INDEXNOW_KEY,
            "keyLocation": f"https://hlat.top/{INDEXNOW_KEY}.txt",
            "urlList": url_list
        }
        req = urllib.request.Request(
            "https://api.indexnow.org/indexnow",
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            log(f"★ IndexNow 搜索引擎集群主动收录推送成功 (HTTP {resp.status})")
    except Exception as e:
        log(f"IndexNow 推送通知跳过: {e}")

# ==============================================================================
# 储备技术文库
# ==============================================================================
EDITORIAL_BACKLOG = [
    # art-9 (2026-11-06 发布)
{
        "id": "art-9",
        "title": "告别跨洋漂移：从多节点伪双活回归单机极简常驻的工程手记",
        "slug": "from-edge-drift-to-pure-residence-architecture-reflection",
        "category": "架构",
        "readTime": "6 分钟",
        "summary": "在追求高可用与边缘计算的浪潮里，我们曾给小小的个人自留地套上了跨国双机同步、保活探针与多层 CDN 的重甲，却换来了冷却报警、死锁与跨太平洋兜圈的漫长延迟。今天，我们彻底斩断海外依赖，让博客纯粹独立地常驻在本地主机。本文记录这次“做减法”的架构觉醒与实战复盘。",
        "density": "96% · 架构复盘",
        "insights": [
                "伪高可用的反噬：多节点同步如果依赖异构且不稳定的边缘算力（如频繁冷却的海外微机），不仅不会带来高可用，反而会制造分布式死锁与运维焦虑；",
                "回源拓扑陷阱：国内边缘 CDN 若源站地址误配置为海外代理，会导致国内用户的每次访问跨越太平洋兜圈两万公里，单机优质 BGP 直连往往胜过复杂的跨国转发；",
                "极简主义的技术实践：剥离无谓的心跳保活探针与外部同步强耦合，让个人自留地回归单一权威源，找回真正从容轻盈的造物心境。"
        ],
        "moment": "今天下午彻底给博客系统卸下了“重甲”：斩断了海外微机的强行代码同步，理顺了 EdgeOne 的回源死锁，全站回归单机独立常驻。当抓包看到响应时间从 12 秒瞬间归位到 134 毫秒，忽觉很多时候我们缺的不是技术加法，而是勇于舍弃复杂架构的克制。今日复盘手记已刊入文墨：《告别跨洋漂移》。",
        "tag": "工程碎念",
        "paragraphs": [
                "工程师似乎天生有一种架构强迫症：当手里有一台国内云主机和一台海外微机时，脑海里总会不由自主地浮现出“全球边缘双活”、“Anycast 动态路由”、“异地容灾冷备”这些宏大的词汇。于是在过去的迭代中，我们给纸境工坊这个本该安静素雅的书写空间，硬生生套上了重型装甲——复杂的跨机 SCP 同步、全天候后台探活看门狗、以及横跨多云的分布式网络。",
                "然而，生产环境用最冷酷的事实给这种虚荣的复杂性上了生动的一课。海外免费微机平台由于严格的资源配额，动不动就进入一到两小时的冷却冻结；一旦实例冷却，本地的同步守护进程就会陷入疯狂重试、连接超时与报错报警。原本为了“高可用”而设计的同步机制，反而成了每天最大的焦虑源与故障点。",
                "更荒诞的事情发生在网络层。在今天下午的性能排查中，我们抓包发现国内用户访问博客居然耗时长达 12 秒之久。顺着 HTTP 响应头层层追溯，发现由于 CDN 回源地址之前误绑了海外代理，导致国内用户在手机上点开一篇文章时，请求必须先飞跃太平洋到达美国洛杉矶数据中心，再通过穿透隧道折返回国内的腾讯云主机。原本 15 毫秒即可达到的本地骨干网，被生生拉扯出两万公里的跨洋往返。",
                "面对这些令人哭笑不得的“工程奇观”，我们今天果断按下了减法键：彻底注销后台强同步任务，剔除所有海外探针，将整个系统收拢并纯粹地常驻于腾讯云 VPS 本机。当 EdgeOne 回源被直接修正为国内 VPS 的 IP，再次通过终端发起测速时，熟悉的毫秒级回显瞬间刷屏：TCP 建连 16ms，首字节响应 74ms，整站总传输 134ms——速度足足暴涨了将近 90 倍。",
                "系统与人一样，负载过重时便会步履蹒跚。对于一个以思想交流与文字记录为核心的数字自留地而言，我们真正需要的从来不是虚幻的跨洋双活集群，而是一台干净坚挺、随改随生效的单机权威源。砍掉多余的枝蔓，让代码回归纯原生，让数据回归本地磁盘，心境与站点便一同重获了久违的轻盈。"
        ]
},
    # art-10 (2026-11-07 备选)
{
        "id": "art-10",
        "title": "从一像素裂图到规范底层：深入 WebKit no-cors 与二进制流解压陷阱",
        "slug": "webkit-no-cors-image-broken-and-gzip-postmortem",
        "category": "技术",
        "readTime": "5 分钟",
        "summary": "一次手机端 Logo 裂图的偶发故障，牵扯出 W3C Fetch 规范对 no-cors 模式下 cache:no-store 的严格禁令，以及底层 HTTP 代理对已压缩二进制图片强行 Gzip 的解码失效。本文复盘如何在不引入任何重型构建工具的前提下，用最纯净的原生 Web 标准构建坚韧的容灾防线。",
        "density": "95% · 前端实战",
        "insights": [
                "Fetch 规范红线：在 Service Worker 的 fetch 拦截器中，对 mode: 'no-cors' 的静态子资源调用携带非默认 cache 的 fetch()，WebKit 会严格依据规范抛出 TypeError 导致图片秒崩；",
                "压缩类型白名单：PNG/JPEG 等已经过 DEFLATE 压缩的二进制多媒体切忌二次 Gzip，必须配置严格的 MIME 可压缩类型白名单；",
                "多层防裂图降级：采用版本指纹破坏错误缓存，同时在 img 标签上绑定轻量矢量 onerror 兜底，实现极致韧性的展示保护。"
        ],
        "moment": "今天复盘了移动端 WebKit 环境下一个极其隐蔽的裂图坑：原来 Service Worker 对 no-cors 图片请求设置 cache:no-store 会直接触发规范层面的 TypeError。技术细节已整理成文《从一像素裂图到规范底层》，写原生代码往往比调框架更能看清 Web 协议的真正肌理。",
        "tag": "造物日常",
        "paragraphs": [
                "在现代前端工程中，图片加载失败通常被归咎于网络超时或 404 路径错误。但在纯原生零构建的架构下，有时一个看似微不足道的一像素裂图，背后却往往隐藏着浏览器底层规范与代理压缩策略的深层博弈。",
                "今天下午在真机实测纸境工坊时，遇到了一个极其诡异的现象：桌面端 Chromium 浏览器一切正常，但在 iOS Safari 与部分移动端浏览器上，顶部的 Logo 头像却始终显示为破损图标。检查服务器文件，logo.png 真实存在且体积完整；直接通过 curl 访问也返回 HTTP 200，路径与权限毫无瑕疵。",
                "通过远程真机调试与注入式日志捕获，真正的元凶终于浮出水面：在之前用于清理陈旧缓存的轻量 Service Worker 脚本中，写着一行看似人畜无害的穿透监听器：event.respondWith(fetch(event.request, { cache: 'no-store' }))。然而，根据 W3C Fetch 官方规范，HTML 中的普通 img 标签发起的是 mode: 'no-cors' 请求，WebKit 引擎对规范执行极其严苛——如果请求处于 no-cors 模式且显式传入了非默认的 cache 参数，浏览器会直接抛出 TypeError 异常！这个未捕获的 Promise 错误导致整个拦截链路崩溃，图片瞬间被判定为加载失败。",
                "雪上加霜的是后端的压缩策略。Node.js 的原生分发逻辑中，仅根据请求头是否包含 Accept-Encoding: gzip 且体积大于 384 字节，就对所有响应统统进行了 zlib 压缩。然而 PNG 图片本身已经采用了 DEFLATE 算法压缩，强行二次 Gzip 不仅会导致体积反向膨胀，还会给某些移动端解码器带来额外的解压校验阻碍。",
                "解决之道依然秉持奥卡姆剃刀原则：首先彻底拔除 Service Worker 中多余的 fetch 拦截监听，让静态资源回归浏览器原生网络栈；其次在服务端建立严格的 isCompressible 白名单判定，仅对 HTML、CSS、JS、JSON、SVG 启用 Gzip；最后在前端 img 标签上增加 onerror 兜底注入。做底层原生开发就是这样，它剥离了框架包装的幻觉，逼着我们直面协议本身的每一个字节。"
        ]
}
]

def check_and_publish_daily():
    today_str = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d")
    articles = load_json(ARTICLES_FILE, [])
    moments = load_json(MOMENTS_FILE, [])
    
    already_published = any(a.get("date") == today_str for a in articles)
    if already_published:
        log(f"今日 ({today_str}) 已有技术文章在席，无需重复自动创作。")
        return False

    log(f"今日 ({today_str}) 尚未发文，策展引擎启动自主创作与发布流程...")
    published_ids = {a.get("id") for a in articles}
    candidate = None
    for entry in EDITORIAL_BACKLOG:
        if entry["id"] not in published_ids:
            candidate = entry
            break
            
    if not candidate:
        log("储备技术文库暂无未发布的题目，保留站长创作通道。")
        return False
        
    formatted_paragraphs = []
    for p_text in candidate["paragraphs"]:
        clean_text = p_text.strip().lstrip("　 \t")
        p_html = f'<p style="text-indent: 2em !important; text-align: justify !important; margin-bottom: 1.35rem;">{clean_text}</p>'
        formatted_paragraphs.append(p_html)
        
    article_content = "\n\n".join(formatted_paragraphs)
    
    new_article = {
        "id": candidate["id"],
        "title": candidate["title"],
        "slug": candidate["slug"],
        "category": candidate["category"],
        "date": today_str,
        "readTime": candidate["readTime"],
        "summary": "" + candidate["summary"].strip().lstrip("　 \t"),
        "density": candidate["density"],
        "insights": candidate["insights"],
        "content": article_content
    }
    
    articles.insert(0, new_article)
    save_json(ARTICLES_FILE, articles)
    log(f"★ 成功发布今日深度技术手记：《{new_article['title']}》 ({new_article['id']})")
    
    new_moment = {
        "id": f"mom-{int(time.time())}",
        "content": candidate["moment"],
        "time": datetime.now(timezone.utc).isoformat(),
        "tag": candidate["tag"]
    }
    moments.insert(0, new_moment)
    save_json(MOMENTS_FILE, moments)
    log(f"★ 成功同步发布今日工程随笔：{new_moment['content'][:30]}...")
    
    # 发布后立即触发宣发矩阵同步
    update_syndication_and_seo()
    return True

def check_and_reply_guestbook():
    messages = load_json(MESSAGES_FILE, [])
    changed = False
    
    for msg in messages:
        if not msg.get("echo"):
            content = msg.get("content", "").strip()
            author = msg.get("author", "墨友").strip()
            log(f"收到访客【{author}】的新留言：{content[:30]}，策展人拟定回笔...")
            
            if any(w in content for w in ["好", "喜欢", "赞", "漂亮", "舒服", "棒"]):
                echo_text = f"承蒙【{author}】的温厚鼓励。在喧嚣的网络浪潮里，能在这方寸茶白素纸间与您相遇并获得认同，是对工坊莫大的慰藉。愿这处安静的数字自留地也能常伴您的工作与思考。"
            elif any(w in content for w in ["技术", "架构", "代码", "开源", "部署", "cdn", "缓存"]):
                echo_text = f"敬复【{author}】：工程之道，唯在求真与克制。工坊记录的所有踩坑与架构演进，皆源于真实的一线实战。很荣幸与同路人交流，也期待在此见证彼此的造物成长。"
            else:
                echo_text = f"致【{author}】：您的留墨已妥善收录入工坊字卷。文字是思想穿越光缆的温度，感谢推门造访，祝您生活与造物常安。"
                
            msg["echo"] = {
                "author": "工坊回笔 · Sxtx",
                "content": echo_text,
                "time": datetime.now(timezone.utc).isoformat()
            }
            changed = True
            log(f"★ 已完成对访客【{author}】的回笔。")
            
    if changed:
        save_json(MESSAGES_FILE, messages)

def check_and_heal_services():
    node_ok = False
    try:
        req = urllib.request.Request("http://127.0.0.1:8080/api/status", headers={"User-Agent": "CuratorSentinel/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                node_ok = True
    except Exception:
        node_ok = False
        
    if not node_ok:
        log("警告：Node.js 服务 (端口 8080) 响应异常，正在启动自愈重启...")
        server_js = os.path.join(BASE_DIR, "server.js")
        subprocess.run(["pkill", "-f", "server.js"])
        time.sleep(1)
        subprocess.Popen(["nohup", "node", server_js], stdout=open(os.path.join(BASE_DIR, "server.log"), "a"), stderr=subprocess.STDOUT)
        log("★ Node.js 服务已在后台拉起。")
    else:
        log("服务健康：Node.js 本地服务运行正常 (200 OK)。")

def run_curator_cycle():
    log("=== 纸境工坊自主策展与外宣巡检任务启动 ===")
    try:
        check_and_heal_services()
        update_syndication_and_seo()
        check_and_publish_daily()
        check_and_reply_guestbook()
    except Exception as e:
        log(f"策展任务发生未捕获异常: {e}")
    log("=== 纸境工坊自主策展与外宣巡检任务圆满完成 ===")

if __name__ == "__main__":
    run_curator_cycle()
