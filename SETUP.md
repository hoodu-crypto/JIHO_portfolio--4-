# JIHO 作品集

四种页面共用一个入口。首页、全部作品、作品详情、关于分别由浏览器地址中的 #/、#/work、#/project/…、#/about 表示。韩文和英文界面可切换，作品信息只需填写一套。关于可显示头像、Email 和 Instagram。

## 第一次设置 Supabase

1. 打开 `jiho-portfolio` 项目。进入 **Authentication → Users → Add user → Create new user**，输入 JIHO 的登录邮箱和他自己保管的密码。若界面提供 **Auto Confirm User**，由项目所有者确认邮箱归属后可以勾选。
2. 进入 **SQL Editor → New query**。打开本包里的 `schema.sql`，把完整内容粘贴进去。把 `jiho@example.com` 换成刚建立的登录邮箱，再点 **Run**。脚本会创建发布数据表、图片存储空间和管理权限。
3. config.js 已填入新项目的网址和公开密钥。数据库密码、Secret key 和 service_role 不应写进网站代码。

## 预览和发布

- 本地：解压后在 VS Code 中打开整个文件夹。从 Live Server 打开 index.html，或者在该文件夹内执行 `python3 -m http.server 8000`，然后访问 http://localhost:8000/。
- 上线：把 index.html、style.css、app.js、config.js 和 images 文件夹部署到同一静态网站目录。schema.sql 和这份说明只用于安装。
- Supabase 脚本执行前，访客页面显示随代码附带的示例图。要测试登录和发布，需要完成上述 Supabase 设置。
- 访问网站页脚，点 **관리자 로그인 / Owner sign in**。登录后编辑各页。上传区可点击选图，也可从电脑拖入。预览可在当前页面查看。
- 最后点页脚 **저장 및 공개 / Save & publish**。发布后，访客刷新即可看到更新。未发布的编辑在当前标签页保留，刷新前请先发布。
- 页面里的删除会从作品集移除图片。曾上传的旧文件仍留在 Supabase Storage，需要彻底清除时，在确认网站已不再引用该文件后由项目所有者到 Storage 删除。
- 上传支持 JPG、PNG、WebP、AVIF、GIF，单张最大 10 MB。网站使用的字体和 Supabase 客户端需要联网。

## 展墙和作品卡片版本

已配置 Supabase 的电脑只要替换 app.js 和 style.css，刷新原地址。现有作品和账号继续使用，不用重跑 schema.sql。
首页从四个相框旁直接上传、替换或删除。全部作品右上角可以新建系列，进入详情可批量加照片。点击照片翻到背面，管理员填写备注后点确认会发布当前草稿，包括同一草稿里的其他修改。关于页支持在编辑状态上传头像。旧标题继续显示，修改后使用一个标题字段。首页新相框和旧作品封面独立，初始留空。

作品详情按单列显示整张照片，点击正面或背面翻转。若已有 Nicolas Cochin 网页授权字体，把 WOFF2 文件放到 fonts/nicolas-cochin.woff2。没有字体文件时会先尝试电脑上已安装的 Nicolas Cochin，再使用 Cormorant Garamond。
