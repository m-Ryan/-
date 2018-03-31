# 爬虫实例

打开 ./routes/index.js 
打开注释  /*  console.log('文章写入成功：' + (++currentUrl));*/

注释掉 下面这段话
  let sql = `INSERT INTO article(article_title ,article_date ,article_source ,article_writer ,article_img, article_content, article_type, article_url_type, article_summary,article_cutImg) VALUES(${conn.escape(title)},${conn.escape(date)},${conn.escape(source)},${conn.escape(writer)},${conn.escape(downImgSrc)},${conn.escape(contenText)},${conn.escape(type)},${conn.escape(url_type)},${conn.escape(summary)},${conn.escape(cutImgSrc)})`;
    try {
        insertRes = await conn.query(sql);
        console.log('写入数据库：' + (++currentUrl));
    } catch (error) {
        console.log("写入数据库：失败：" + err);
        ++writerFail;
        return false;
    }

## npm install
## npm start

打开 http://localhost:3001

