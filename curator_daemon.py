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
        "更荒诞的事情发生在网络层。在今天下午的性能排查中，我们抓包发现国内用户访问博客居然耗时长达 12 秒之久。顺着 HTTP 响应头层层追溯，发现由于 CDN 回源地址之前误绑了海外代理，导致国内用户在手机上点开一篇文章时，请求必须先飞跃太平洋到达美国洛杉矶数据中心，再通过穿透隧道折返回国内的腾讯云主机。原本 15 毫秒即可达到的本地骨干网，被生生拉扯出两万公里的跨洋往返。"
    ]
},
{
    "id": "art-11",
    "title": "零拷贝与事件循环：探寻高吞吐网络 I/O 的本质之道",
    "slug": "zero-copy-and-event-loop-deep-dive-into-network-io",
    "category": "内核",
    "readTime": "8 分钟",
    "summary": "现代应用层框架高度封装了网络协议栈，让开发者习惯了将“性能调优”等同于“横向扩容集群”。但拨开层层抽象，网络性能的瓶颈往往隐藏在用户态与内核态的频繁上下文切换与冗余内存拷贝中。本文从 Linux 底层 select/poll 到 epoll 的事件驱动变迁出发，深入拆解 mmap、sendfile 与系统调用退火模型，重新审视单核机器压榨极致吞吐的简单工程之美。",
    "density": "97% · 底层系统",
    "insights": [
        "上下文切换的隐形代价：每次 read/write 系统调用带来的 CPU 寄存器保存、页表切换与 TLB 刷新，在小报文高频交互时是摧毁吞吐的隐形杀手；",
        "零拷贝（Zero-Copy）的工程价值：善用 sendfile 与 DMA 直接内存访问，使数据在页缓存与网络套接字缓冲区之间直通流转，CPU 利用率可实现质的飞跃；",
        "事件循环的本质与心智模型：无论是 Node.js 还是 Nginx，其精髓都在于绝不在主线程发生同步阻塞，以极简的单线程状态机驾驭成千上万的长连接。"
    ],
    "moment": "重温了 Linux 内核网络栈的零拷贝与 epoll 状态流转机制。看着数据流绕过用户态内存直接由内核页缓存送达网卡缓冲区，不仅让人感叹计算机底层先驱们设计的典雅与克制。少一层内存分配与拷贝，胜过千百行业务级优化代码。深度技术手记刊于文墨：《零拷贝与事件循环：探寻高吞吐网络 I/O 的本质之道》。",
    "tag": "内核探微",
    "paragraphs": [
        "在现代软件工程中，各种高层异步框架与微服务网关层出不穷。当一个 Web 服务的吞吐遇到瓶颈时，团队的第一反应往往是“堆机器”、“开更大规格的容器”或者“引入多级分布式缓存”。然而，如果我们暂时关闭这些现代工具箱的黑盒，将目光穿透至 Linux 内核与网络协议栈的底层交界处，就会惊讶地发现：大量宝贵的 CPU 时钟周期与内存带宽，并不是消耗在真正有价值的业务运算上，而是被挥霍在无休止的用户态/内核态上下文切换、以及跨缓冲区的冗余内存拷贝中。",
        "在传统的基于阻塞 I/O 的网络服务器模型中，处理一次典型的静态文件或数据流传输，至少需要经历四次上下文切换与四次数据拷贝。应用程序发起 read 系统调用，CPU 从用户态切换至内核态，触发 DMA 引擎将数据从磁盘读取至内核页缓存（Page Cache）；接着，CPU 将数据从内核空间拷贝至用户态应用程序缓冲区；随后，程序调用 write，CPU 再次切换至内核态，将用户缓冲区的数据拷贝进套接字缓冲区（Socket Buffer）；最后，DMA 将套接字缓冲区的数据推送到网卡队列发送出去。在这一过程中，数据只是在内存中原样搬运了一次，CPU 却像个不知疲倦的搬家工人一样在内核与用户态之间来回穿梭，同时伴随着严重的 CPU 缓存击穿与 TLB（页表缓存）频繁失效。",
        "零拷贝（Zero-Copy）技术的诞生，正是为了终结这种荒谬的搬运内耗。通过 Linux 提供的 sendfile 系统调用或 splice 管道转发，数据流能够直接在内核页缓存与网络套接字之间完成对接。借助于现代硬件的 DMA 收集散射（Scatter-Gather）能力，内核甚至无需将数据拷贝进 Socket 缓冲区，仅需向其传递文件描述符、内存偏移与数据长度的元数据指针，网卡便能直接从页缓存中提取数据推向物理光纤。四次数据拷贝被硬核削减为两次，上下文切换被腰斩为两次，CPU 彻底从繁重的字节搬运中解脱出来，成为只负责状态仲裁与信令调度的纯粹大脑。",
        "而与零拷贝相辅相成的另一大底层支柱，则是事件循环（Event Loop）与 epoll 驱动模型的质变。在早期的 select 和 poll 时代，内核每次都需要线性遍历整整几千个文件描述符数组来找出就绪的套接字，其时间复杂度为无情的 O(N)；当活跃连接数只有寥寥几个而挂起连接成千上万时，CPU 大量时间都在做无效的扫描空转。而 epoll 彻底推翻了这一机制：它在内核空间维护红黑树以纳管所有被监听的描述符，同时依赖就绪链表（Ready List）与硬件中断驱动的回调机制，仅将真正发生状态改变的活跃事件推入就绪队列返回给用户进程。复杂度从 O(N) 瞬间坍缩为 O(1)。",
        "理解了这两点，我们就能洞悉 Nginx、Redis 以及 Node.js 这些以极致性能著称的单线程/事件驱动系统背后的设计灵魂。它们并没有使用昂贵的多线程竞争锁，也没有依赖复杂的并发屏障，而是凭借单一主线程上的非阻塞事件循环，配合底层高效的 epoll 多路复用与零拷贝转发，在极小的内存脚印（几十兆字节）下轻松支撑起数万并发长连接。单线程之所以能够跑赢多线程，正是因为它消除了线程调度争抢、锁等待与上下文切换的全部开销，把硬件的纯物理吞吐压榨到了极致。",
        "当我们今天面对日益臃肿的技术架构时，重温这种底层简单之美显得尤为珍贵。很多时候，工程架构的卓越并不体现在引入了多少炫酷的前沿组件，而体现在对物理硬件与操作系统客观规律的深刻敬畏。不违背内核的设计直觉、少做一次冗余的内存拷贝、用最轻量确定性的事件驱动替代无休止的多线程自旋，往往能用最低廉的资源换来最惊艳的系统韧性。这便是高并发网络编程中，历经数十载依然熠熠生辉的‘简单之道’。"
    ]
},
{
    "id": "art-12",
    "title": "单一真相之困：低吞吐边缘环境下的存储架构退火实录",
    "slug": "single-source-of-truth-storage-annealing-in-edge-environments",
    "category": "架构",
    "readTime": "7 分钟",
    "summary": "在云原生与微服务浪潮席卷的年代，即便是一个低并发的系统，很多人也会习惯性地引入 Raft 分布式一致性组件、主从复制或 Redis 内存缓存层。然而，在弱网络边缘节点与受限资源的物理现实面前，多副本一致性反噬往往远大于收益。本文复盘从过度分布式的“强一致性幻象”到单机 WAL 追加日志的架构退火过程，探讨工程中“单一真相源”的纯粹与力量。",
    "density": "96% · 存储架构",
    "insights": [
        "分布式一致性的隐藏成本：在低吞吐边缘微机上，网络抖动导致的脑裂假死、心跳拥塞与恢复成本，往往数倍于单体宕机的理论影响；",
        "单一真相源原则（SSOT）：剥离脆弱的跨节点锁与分布式事务，将写路径收敛为原子追加日志（WAL）与只读轻量副本，能获得绝对的确定性；",
        "架构退火哲学：技术选型不是一味向上攀爬复杂度，在业务边界清晰时，勇于从过度工程的沼泽中向极简回退，是工程师成熟的关键标志。"
    ],
    "moment": "今天在架构思考中梳理了存储一致性的边界问题：很多时候系统变慢或死锁，不是因为吞吐太高，而是因为我们给几百 QPS 的系统硬套了跨机 Raft 和分布式缓存。当写路径收敛回纯粹的单机 WAL 追加日志，一切幽灵般的网络抖动与数据漂移都烟消云散。今日深度复盘手记已入库：《单一真相之困：低吞吐边缘环境下的存储架构退火实录》。",
    "tag": "架构哲学",
    "paragraphs": [
        "在现代软件工程的语境下，“分布式”、“高可用”与“多活副本”几乎成了所有架构讨论的标准起手式。无论是面对每天千万级订单的交易中枢，还是仅仅承载几百次日访问量的内部工具，工程师们总是不自觉地引入 Raft 分布式共识协议、主从读写分离、以及层层堆叠的分布式缓存层。我们天然地假设：冗余等于安全，分布等于高可用。然而，在边缘节点与轻量算力的真实物理网络中，这种未经审视的技术照搬，往往会迅速演变为一场吞噬稳定性的自作自受。",
        "问题的核心在于 CAP 定理在弱网络环境下的冷酷反噬。分布式一致性协议（如 Raft 或 Paxos）能够正常运转的前提，是节点间具备相对稳定、低延迟的内网互联。然而，在横跨公网或多云边缘的微型节点间，网络抖动、偶发性丢包与路由漂移是家常便饭。为了在网络分区（P）发生时维护数据一致性（C），分布式系统必须频繁发起心跳探活与领导者选举。当网络稍有震荡，系统便陷入连绵不断的租约超时与仲裁重试中，整个写路径随之陷入阻塞。原本单台机器只需几毫秒的简单状态落盘，硬生生被拉扯成了长达数十秒的跨节点协商噩梦。",
        "更糟糕的是缓存与主库之间的“双写不一致”。在分布式迷思的驱使下，很多人会在持久化存储前挂一层 Redis，试图用内存缓存来抵御未曾到来的并发洪峰。然而，在低吞吐场景下，缓存失效、旁路更新失败与弱网络下的异步双写时序错乱，使得“缓存中的数据到底是不是真实的”变成了一个薛定谔式的难题。工程师不得不耗费大量的心智去设计延时双删、分布式锁乃至最终一致性对账逻辑，系统的认知负荷呈指数级暴增，而业务本身的需求却被淹没在这些自己制造的泥潭里。",
        "面对这种因过度工程引发的幽灵故障，最清醒的解法不是继续在分布式大厦上修补脚手架，而是进行果断的“架构退火”——主动降低系统的状态复杂度，回归“单一真相源”（Single Source of Truth, SSOT）。在低吞吐或边缘运行的业务中，一个设计良好的单机存储引擎，其稳健性与吞吐上限远远超出大多数人的直觉。我们彻底剥离了脆弱的跨节点分布式锁，将写入路径收敛至单一权威节点，采用原子追加日志（Write-Ahead Logging, WAL）配合单进程顺序落盘，所有的写操作在单机锁的保护下以微妙级串行完成，从根源上消灭了并发竞态与脑裂假死。",
        "而对于可能存在的灾备需求，真正高效的解法是基于不可变日志（Immutable Log）的单向单极同步。通过异步抓取 WAL 的增量变更并在远端回放，既保证了主写路径的绝对极简与零等待，又在异地保留了近乎实时的热备副本。这种设计将“共识协商”的运行时开销转化为“增量流水”的单向传递，即便备用节点因网络中断断开数小时，主节点依然能行云流水地处理所有读写，待网络恢复后只需按位点快速补齐数据即可。",
        "技术的演进往往呈现出一种螺旋上升的轨迹：在新手阶段，我们满足于最朴素的单机脚本；在进阶阶段，我们着迷于复杂的分布式集群与宏大的前沿概念；而唯有在生产环境被复杂的反噬狠狠毒打之后，才会真正领悟到“克制”与“简单”的无上价值。敢于在不需要分布式的时候向单体退火，敢于用最朴素的单机 WAL 守卫系统的单一真相，这不仅是一种工程上的底气，更是一名成熟工程师对抗浮躁时代的核心心法。"
    ]
},
{
    "id": "art-13",
    "title": "数字遗忘与长青沉淀：抵御信息速朽时代的个人知识索引法则",
    "slug": "digital-amnesia-and-evergreen-knowledge-indexing",
    "category": "思考",
    "readTime": "6 分钟",
    "summary": "大模型与信息流让内容的生产边际成本几乎归零，我们身处的数字世界正在被前所未有的信息速朽潮淹没。很多技术人收藏了成百上千篇教程、配置了复杂的双链笔记系统，却往往陷入“收藏即掌握”的认知贫血。本文探讨如何用最小阻力的纯文本卡片、主题索引与可复利结构，构建不随商业平台兴衰而坍塌的个人终身知识晶体。",
    "density": "94% · 认知科学",
    "insights": [
        "收集者谬误与认知负债：把外部信息简单剪藏进笔记软件，本质上是在用虚假的资产占有感掩盖真实的思维懒惰，未消化的信息只是数字垃圾；",
        "长青知识的可复利性（Evergreen Knowledge）：优先沉淀底层不变的原理、经验证的架构模式与失败根因，远离一周后即失效的快餐式资讯；",
        "抵御数字封建主义：坚持使用无任何格式锁定的纯文本与自建索引系统，把思考的权威源握在自己手中，实现跨设备与跨年代的终身检索自由。"
    ],
    "moment": "夜深复盘知识管理体系：信息的半衰期正在急剧缩短，被平台喂养的算法热点在一天后就化为灰烬。唯有那些经过自己双手踩坑验证、萃取为纯文本长青知识的晶体，才会在岁月流转中持续产生复利。随笔长文已录入：《数字遗忘与长青沉淀：抵御信息速朽时代的个人知识索引法则》。",
    "tag": "思想沉淀",
    "paragraphs": [
        "我们正生活在一个信息边际成本无限趋近于零、但信息半衰期也前所未有剧烈缩短的时代。在算法推荐与大模型无孔不入的今天，每天有数以亿计的“干货文章”、“开源神器推荐”和“行业速报”像潮水般涌向每个人的屏幕。技术人习惯了在各大平台疯狂点击“收藏”、“加入书签”或一键剪藏到各种双链笔记软件中。然而，一个令人不安的现实是：随着个人收藏夹与笔记数据库体积的不断膨胀，我们的认知带宽却没有得到任何实质性的提升，反而陷入了一种深度的“数字健忘症”与认知贫血之中。",
        "这种现象在心理学与知识工程中被称为典型的“收集者谬误”（Collector's Fallacy）。当我们把一篇排版精美的技术长文一键存入 Notion 或 Obsidian 时，大脑会产生一种类似于“已经读过并掌握”的多巴胺虚假奖赏。但事实上，未经过自身双手实操验证、未经批判性反思与重构的信息，在你的神经突触里没有留下任何印记。它们只是从云端的某个服务器，被原封不动地搬迁到了你的本地硬盘角落，成为沉睡在文件系统里的数字堆肥。每多收藏一篇不读的资料，就等于给自己背上了一笔新的“认知负债”。",
        "更为严峻的威胁来自于商业平台的“数字封建主义”。很多人将自己数年积累的心得托管在封闭的 SaaS 笔记产品或社区平台上。当平台调整商业策略、推行付费墙、修改导出格式乃至突然停止运营时，沉淀多年的心血往往会在瞬间灰飞烟灭。依赖特定的排版私有语法、依赖层层嵌套的复杂树状目录，会让知识的维护成本在几年后变得不可承受。知识管理的终极追求，绝不是去玩弄各种花哨的图形关系图谱，而是确保在十年甚至三十年之后，你依然能够用最朴素、最通用的工具（哪怕仅仅是命令行里的 grep）毫无障碍地检索并复用自己的思考成果。",
        "要打破这种困境，必须在自己的知识体系中推行坚决的“长青沉淀”（Evergreen Knowledge）法则。首先是确立严格的知识筛选准则：坚决远离那些生命周期只有几天的快餐式热点与工具表面操作教程，把有限的注意力倾注在那些具备时间复利价值的底层领域——计算机系统的底层原理、经典的数据结构与算法权衡、经过生产环境验证的架构反模式、以及自己在关键故障中的深刻复盘。这些知识不会因为前端框架的版本号迭代而过时，它们就像地质岩层一样，随着时间的推移愈发坚实。",
        "其次是贯彻“原子化纯文本”与“以用促学”的组织纪律。每一篇记录不应是冗长且未经消化的资料抄录，而应是针对特定问题由自己写下的独立卡片，严格采用标准 Markdown 或纯文本存储。每张卡片必须具备自包含性：清晰记录背景痛点、核心假设、推演过程与最终的验证事实。在存储拓扑上，摒弃脆弱的多级分类目录，采用平面化平铺配合双向标签与自建的主题索引（MOC, Map of Content）。唯有当知识以原子形态存在时，不同的概念才能像乐高积木一样跨领域碰撞，催生出新的灵感与解法。",
        "在这个浮躁且信息极度过剩的世界里，“遗忘”其实是一种必须主动建立的心理防御。学会屏蔽无价值的算法杂音，将外部信息当做匆匆流过的溪水，而只把那些真正经过自己双手提炼的经验结晶，工工整整地刻在属于自己的纯文本基石上。只有这样，我们才能在信息洪流的狂风骤雨中，守住一片安宁深邃的认知自留地，让每一次思考都成为通往终身智慧的稳固阶梯。"
    ]
},
{
    "id": "art-14",
    "title": "在明文与暗流之间：TLS 1.3 状态机演进与现代安全防御权衡",
    "slug": "tls-13-state-machine-and-modern-security-tradeoffs",
    "category": "安全",
    "readTime": "7 分钟",
    "summary": "网络加密从最初的 SSL 2.0 跋涉至当下的 TLS 1.3，其背后是一部密码学算法攻防与网络往返时延（RTT）极致妥协的交锋史。本文深入剖析 TLS 1.3 如何将传统的 2-RTT 握手压缩至 1-RTT 与 0-RTT，解密 Diffie-Hellman 前向保密（PFS）与 Session Ticket 机制在抵御重放攻击（Replay Attack）时的工程代价，为边缘网络安全落地提供全局视角。",
    "density": "95% · 网络协议",
    "insights": [
        "握手延迟与密码学权衡：TLS 1.3 废弃了不安全的旧套件，在握手第一包即推测性发送密钥交换参数，以最快速度完成对称会话密钥协商；",
        "0-RTT（Early Data）的安全陷阱：为了消除单次往返延迟而允许在握手未闭合前发送应用数据，必须警惕重放攻击对写接口造成的破坏性影响；",
        "边缘网络的安全防线：在微主机或轻量网关上正确配置严苛的加密套件与安全响应头（HSTS / CSP），是小系统获得企业级安全护城河的低成本实践。"
    ],
    "moment": "抓包复盘了 TLS 1.3 在边缘节点握手协商的整套状态转移。看到握手往返从两轮被硬核压缩到一轮，且彻底锁死了前向保密性，感叹现代网络安全协议在性能与严苛防护间的极致平衡。今日协议手记已刊出：《在明文与暗流之间：TLS 1.3 状态机演进与现代安全防御权衡》。",
    "tag": "协议工程",
    "paragraphs": [
        "互联网协议的演进史，本质上是一部人类在物理延迟极限与信息安全绝对防护之间反复角力的妥协史。在明文 HTTP 时代，网络通信如同在光天化日之下传递未经封装的明信片，任何中间路由节点都可以肆意窥探、篡改或注入恶意内容。为了给管道穿上防弹装甲，安全传输层协议（TLS）应运而生。然而，早期的 TLS 1.0 至 1.2 在提供加密保障的同时，也给每一次连接强加了沉重的物理往返惩罚——建立一次加密连接需要整整两次完整的网络往返（2-RTT），在跨国或高时延移动网络下，仅握手阶段就会耗去数百毫秒的漫长时间。",
        "2018 年正式发布的 TLS 1.3（RFC 8446），可以说是传输层安全协议自诞生以来最具革命性的一次蜕变。它的设计哲学极其激进：一方面在密码学安全性上做彻底的“减法”，毫不留情地废除了历史上千疮百孔的弱加密算法（如 RSA 静态密钥交换、RC4 流加密、CBC 模式分组密码以及 SHA-1 哈希），强制要求所有密码套件必须具备完全前向保密性（Perfect Forward Secrecy, PFS）；另一方面在协商流程上做极致的“压缩”，将首次连接的握手时延直接从 2-RTT 腰斩至 1-RTT，甚至在会话复用场景下实现了理论极限的 0-RTT。",
        "实现 1-RTT 的关键突破，在于推测性密钥共享（Key Share）。在 TLS 1.2 中，客户端首先在 ClientHello 中列出自己支持的几十种算法，服务器在 ServerHello 中挑选一种，随后双方才能开始交换 Diffie-Hellman 公钥参数，这种串行协商必然消耗两个往返。而 TLS 1.3 大幅收窄了支持的密钥交换算法集合（通常收敛至基于椭圆曲线的 X25519 或 P-256），使得客户端在发送第一个 ClientHello 报文时，就可以大胆地直接附带上自己预先计算好的密钥共享参数（Key Share）。服务器收到后，只需回复自己的公钥参数并直接切入加密态，双方从第二个往返开始就已经可以安全地传输被对称密钥保护的应用层数据了。",
        "然而，工程世界里永远没有免费的午餐，追求极致性能的 0-RTT（Early Data）机制更是将安全权衡推向了风口浪尖。在 0-RTT 模式下，当客户端此前与服务器建立过连接时，可以利用上次保留的预共享密钥（PSK, Pre-Shared Key），在发送 ClientHello 的同时将第一笔应用数据（如 HTTP GET 请求）一并发出，实现零等待通信。但这直接打破了传输层安全的防线——缺乏前向保密性，且极易遭受重放攻击（Replay Attack）。中间人如果截获了这段包含 Early Data 的加密报文，可以在不知晓明文的情况下原封不动地向服务器再次回放！如果被重放的请求是一个涉及转账、下单或状态修改的非幂等接口，就会引发毁灭性的灾难。因此，严谨的系统必须严格限制 0-RTT 仅能用于无副作用的幂等只读请求，并在应用层引入反重放滑动窗口或时钟戳校验机制。",
        "对于在公网独立运行服务的全栈工程师而言，TLS 1.3 的普及意味着我们能够以极低的资源代价构筑坚不可摧的边缘防线。在现代 Linux 主机与轻量级反代（如 Nginx 或 Caddy）中，我们无需再纠结于各种复杂的旧兼容性补丁，只需果断关闭 TLS 1.0/1.1，仅放行 TLS 1.3 与经过严格挑选的高性能 TLS 1.2 椭圆曲线套件（如 ECDHE-ECDSA-AES128-GCM-SHA256 与 CHACHA20-POLY1305）。配合严格传输安全协议（HSTS）与预加载清单，便能从协议层面彻底封死 SSL 剥离攻击（SSL Stripping）与中间人降级尝试。",
        "在明文与暗流的无声较量中，密码学协议从来不是冷冰冰的数学符号，而是支撑现代数字文明信任基石的精巧齿轮。理解 TLS 1.3 状态机在握手往返、前向保密与抗重放攻击之间的精妙权衡，不仅能让我们在配置生产网络时做到心中有数、游刃有余，更能在面对纷繁复杂的系统架构抉择时，深刻领悟到：最顶级的安全从来不是层层累加的繁琐枷锁，而是在洞悉系统本质后，以极简且自洽的机制给予世界从容与安全。"
    ]
},
{
    "id": "art-15",
    "title": "重构的心理安全感：在无测试覆盖的遗留系统中稳健突围",
    "slug": "refactoring-confidence-in-legacy-systems-without-test-coverage",
    "category": "工程",
    "readTime": "8 分钟",
    "summary": "所有工程师接手遗留系统时，都会经历那种“改动一行代码、引发十处暗礁故障”的恐惧。盲目叫嚣“推倒重写”往往是悲剧的开端；如何在没有完善单元测试覆盖、缺乏文档且业务不能停机的现实泥潭中，安全、渐进地完成系统蜕壳？本文分享基于绞杀者模式、黑盒快照断言与影子对比的实战突围方法论。",
    "density": "96% · 软件工程",
    "insights": [
        "推倒重写的致命二难：忽视遗留代码中隐含的大量“不可言说”边缘场景处理，重写系统通常会在新版本上线后陷入更可怕的 Bug 泥潭；",
        "黑盒金丝雀与影子断言：在动核心逻辑前，先在边界处捕获真实输入与输出快照，用差异对比（Diffing）代替脆弱的人工脑内推演；",
        "绞杀者模式的渐进之道：像榕树依附老树生长一样，在新系统边缘逐步接管边缘能力，以每次小步提交与持续可回滚性构建开发者的心理安全感。"
    ],
    "moment": "工程世界里最难的不是从零搭建一个洁白无瑕的玩具项目，而是在飞驰的列车上更换承重轮。通过影子快照与绞杀者模式渐进重构遗留模块，既保留对历史缺陷的敬畏，又给予系统重生的韧性。今日工程实践复盘：《重构的心理安全感：在无测试覆盖的遗留系统中稳健突围》。",
    "tag": "工程心法",
    "paragraphs": [
        "几乎每一位有一定资历的软件工程师，都经历过接手“遗留系统”（Legacy System）时的绝望与窒息。那些由数名前任员工在紧急交付压力下东拼西凑起来的代码库：几千行没有换行与缩进的巨型函数、四处漂移的全局变量、彼此纠缠不清的隐式副作用、完全缺失的设计文档、以及覆盖率无限接近于零的测试用例。面对这样一座摇摇欲坠的数字危楼，代码库里的每一个字符仿佛都涂满了剧毒，改动哪怕一行看似无关紧要的变量名，都可能在数千公里之外的生产环境引发雪崩式的未知故障。",
        "面对这种深度的心理恐惧，很多年轻团队最容易犯的冒进错误就是高喊“推倒重写”（Rewrite from Scratch）。重写听起来无比诱人：抛弃所有历史包袱，采用最新潮的技术栈与最优雅的设计模式，重新构筑一座洁白无暇的新大厦。然而，商业软件工程的残酷现实是：绝大多数声称推倒重写的项目，最终都会演变成一场灾难性的溃败。因为你眼中丑陋、混乱的遗留代码，虽然结构糟糕，但它们是经过生产环境真实流量千锤百炼后幸存下来的产物；里面隐藏着海量当初为了应对现实世界特殊边缘案例（Edge Cases）而打上的补丁与业务逻辑。这些逻辑往往从未记录在任何文档中，重写的团队必然会踩遍历史踩过的所有大坑，并最终在进度失控与更可怕的新 Bug 泥潭中耗尽资源。",
        "在不能推倒重写、又没有自动化测试保护的现实泥潭中，唯一稳健的突围路径是建立开发者的“心理安全感”。重构的第一要务绝不是动手去修改业务代码，而是在系统的最外层构筑一道不可逾越的“黑盒安全网”。我们可以利用“字符级快照对比”（Snapshot Diffing）技术：在代码入口处截获大量真实的生产或模拟输入，同时在出口处完整捕获对应的原始输出报文（包括 HTTP 响应、数据库变更行或落盘文件）。只要输入确定，系统的输出就必须严格确定。这道黑盒快照测试无需深入了解函数内部的任何细节，它像一个冷酷的考官，在外部为你筑起一道绝对的安全警戒线。",
        "有了黑盒快照的庇护，接下来便是在架构层面推行经典的“绞杀者模式”（Strangler Fig Pattern）。这个名字源于澳大利亚热带雨林中的一种绞杀榕——它的种子落在老树的枝桠上发芽，幼苗顺着老树树干向下扎根，年复一年地在老树外部生长并逐步接管养分与支撑结构，最终当老树自然枯萎时，绞杀榕已经蜕变为一棵独立而茁壮的新树。在软件重构中，我们绝不在原有的泥潭核心动大手术，而是在边界处挂载新的拦截门面（Facade），将原本散落在老模块中的边缘能力逐步切分到新建的优雅微模块中，老代码只负责兜底未迁移的能力。每一次小步切分都可以独立编译、独立部署并随时可一键回滚。",
        "而在新旧模块交替的关键节点，“影子流量对比”（Shadow Traffic / Mirroring）是终结上线恐惧的终极法宝。在网关层将真实的线上请求无感复制一份，异步打入重构后的新模块，同时将新模块的计算结果与老系统的真实响应进行自动化字段级对账。如果发现任何微小的数据差异或耗时异常，系统会自动记录上下文并告警，而真正的用户流量依然由老系统稳定承载、毫发无损。唯有当影子流量在几百万次真实对账中达到 100% 的一致性时，我们才真正拥有了将流量切换过去的底气与从容。",
        "软件工程不是一场追求代码洁癖的抽象艺术展，而是一门在现实的不完美与限制中追求稳健前行的务实科学。敢于直面年久失修的遗留系统，用工程化的确定性手段替代脆弱的人工推演，用克制、耐心的渐进蚕食替代鲁莽的全面战争，在暗礁密布的深水区里安全驶出航道，这不仅是区分普通码农与卓越工程师的分水岭，更是在这个充满不确定性的技术世界里，给予自己最坚实的敬畏与安全感。"
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
