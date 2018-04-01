require('babel-polyfill');
const express = require('express');
const router = express.Router();
const conn = require('../server/db_connection');
const fs = require('fs');
//爬取新闻
const cheerio = require('cheerio');
const request = require('request-promise');
const iconv = require('iconv-lite');

let delayTime = 1000; //每轮间隔的时间
let currentUrl = 0; //成功写入的文章数数目
let noImgNum = 0; //剔除的没有图片的文章数目
let damagedArticle = 0; //无效链接文章数目
let noList = 0; //无效的链接列表数目
let writerFail = 0; //写入数据库失败的文章数目
let singal = false;

router.getArticleUrl = async (req, res, next)=>{
    if(singal) return res.send('未完成，拒绝重复访问');
    singal = true;
    let startTime = getNow();
    let start_page = 1;
    let end_page = 3;
    //getListPage(start_page, end_page, "校园"); 有兴趣的话里面的参数可以配置成客户端传进来，那样就可以动态爬取，用req.query来获取，
    let listPages = getListPage(start_page, end_page);
    let listUrlsArr = await asyncControl(listPages, getListUrl, 10, delayTime);
    let listUrls = listUrlsArr.reduce((a,b)=>a.concat(b));
    let listLen = listUrls.length;
    console.log('爬取列表页完成，共有文章：'+ listLen );
    let PageContent = await asyncControl(listUrls, getPageContent, 10, delayTime);
    let endTime = getNow();
    console.log('开始时间：' + startTime);
    console.log('结束时间：' + endTime);
    console.log('原有数据：' + '　' + listLen);
    console.log('剔除没有图片或者获取图片失败的文章数：' + '　' + noImgNum);
    console.log('文章获取失败数：' + '　' + damagedArticle);
    console.log('文章写入数据库失败数：' + '　' + writerFail);
    console.log('共爬取有效文章数：' + '　' + currentUrl);
    console.log('爬虫结束');
    singal = false;
    res.send('爬虫结束');
}

//取得所有的列表页
/**
 * 
 * @param {*} start_page 起始页面
 * @param {*} end_page 结束页面
 * @param {*} type 爬取的类型
 */
const getListPage = (start_page, end_page, type)=>{
    let listPages = [];
    let typeArray = [
         {
            url_type: 'redu',
            type: '热读',
            type_id: 1,
            start_page,
            end_page
        },
         {
            url_type: 'wenyuan',
            type: '文苑',
            type_id: 2,
            start_page,
            end_page
        },
         {
            url_type: 'qinggan',
            type: '情感',
            type_id: 3,
            start_page,
            end_page
        },
       {
            url_type: 'shehui',
            type: '社会',
            type_id: 4,
            start_page,
            end_page
        },
         {
            url_type: 'shenghuo',
            type: '生活',
            type_id: 5,
            start_page,
            end_page
        },
         {
            url_type: 'rensheng',
            type: '人生',
            type_id: 6,
            start_page,
            end_page
        },
        {
            url_type: 'renwu',
            type: '人物',
            type_id: 7,
            start_page,
            end_page
        },
        lizhi = {
            url_type: 'lizhi',
            type: '励志',
            type_id: 8,
            start_page,
            end_page
        },
        {
            url_type: 'shiye',
            type: '视野',
            type_id: 9,
            start_page,
            end_page
        },
         {
            url_type: 'xinling',
            type: '心灵',
            type_id: 10,
            start_page,
            end_page
        },
         {
            url_type: 'xiaoyuan',
            type: '校园',
            type_id: 11,
            start_page,
            end_page
        },
        {
            url_type: 'zhichang',
            type: '职场',
            type_id: 12,
            start_page,
            end_page
        }
    ];
    if(type){
        let match = typeArray.filter(item=>item.type === type);
        if(match.length) {
            let {url_type, type, type_id } = match[0];
            for(let i = start_page; i< end_page; i++){
                listPages.push({
                    url_type,
                    type,
                    link: `http://www.ledu365.com/${url_type}/list_${type_id}_${i}.html`
                })
            }
            return listPages;
        }
    }
    for (let n = 0; n < typeArray.length; n++) {
        for (let i = typeArray[n].start_page; i < typeArray[n].end_page; i++) {
            let url_type = typeArray[n].url_type;
            let type_id = typeArray[n].type_id;
            let type = typeArray[n].type;
            listPages.push({
                url_type,
                type,
                link: `http://www.ledu365.com/${url_type}/list_${type_id}_${i}.html`
            })
        }
    }
    return listPages;
}


//取得所有的列表页的所有列表链接
const getListUrl = async (liItem, count)=>{
    //爬取文章链接
    let articleUrl = [];
    let listOption = {
        url: liItem.link,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        encoding: null
    }
    let result = null;
    try {
        result = await request(listOption);
    } catch (error) {
        ++noList;
        console.log('错误链接列表地址：'+ liItem.link );
        console.log('错误链接列表：'+noList );
        return false;
    }
    console.log('请求列表页成功')
    console.log('数目：' +( count+1))
    let body = iconv.decode(result, 'gb2312');
    let $ = cheerio.load(body, {
        decodeEntities: false
    });
    let links = $('.listbox .title')
    links.map(function (index, item) {
        if(!$('.listbox .preview img')[index]){
            return false;
        }
        let imgSrc = $('.listbox .preview img')[index].attribs.src || '';
        if (!imgSrc) {
            ++noImgNum;
            return false;
        }
        if (imgSrc.indexOf('http') == -1) {
            imgSrc = 'http://www.ledu365.com' + imgSrc;
        }
        articleUrl.push({
            link:$('.listbox .title')[index].attribs.href,
            type: liItem.type,
            url_type: liItem.url_type,
            imgSrc
        });
        return true;
    })
    return articleUrl;
}

//取得所有的文章
const getPageContent = async(article, count)=>{
    let articleOption = {
        url: 'http://www.ledu365.com' + article.link,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrom' +
                    'e/58.0.3029.110 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        encoding: null
    }
    //爬取文章
    let articleBody = null;
    try {
        articleBody = await request(articleOption);
    } catch (error) {
        ++damagedArticle;
        return false;
    }
    let body = iconv.decode(articleBody, 'gb2312');
    let $ = cheerio.load(body, {decodeEntities: false});
    let title = $('.title h2').text().trim();
    let info = $('.info').text();
    let pArray = $('p').toArray()
    let splitArray = info.split(' ');
    let date = '';
    let source = '';
    let writer = '';
    let type = article.type;
    let url_type = article.url_type;
    let cutImgUrl = article.imgSrc;
    console.log( `当前进行：${++count}, 文章：${title} `)
    if (splitArray[0] && splitArray[0].indexOf('时间:') != -1) {
        date = splitArray[0].split('时间:')[1]
    }
    if (splitArray[1] && splitArray[1].indexOf('来源:') != -1) {
        source = splitArray[1].split('来源:')[1]
    }
    if (splitArray[2] && splitArray[2].indexOf('作者:') != -1) {
        writer = splitArray[2].split('作者:')[1]
    }

    let summary = $('.content p').text();
    let contenText = '';

    $('.content p').each(function (index, item) {
        let trimText = $(this).text().trim();
        if (trimText != '' && (trimText != ('点击下载__乐读APP(Android)__每天更新好文章'))) {
            contenText += `<p>${trimText}</p>`;
        }
    })

    if (!cutImgUrl) {
        ++noImgNum;
        return false;
    }
    let cutExtName = ('.' + cutImgUrl.substr(-10).split('.')[1]).replace('!cut', '');
    let cutImgSrc = url_type + '_' + new Date().getTime().toString()  + '!cut' + cutExtName;
    let folder_exists = fs.existsSync('public/images/cut/');
    if(!folder_exists) fs.mkdirSync('public/images/cut/');
    let cutOutResult = await writeImg(cutImgUrl, 'cut/'+cutImgSrc);
    if(!cutOutResult) {
        ++noImgNum;
        return false;
    }


    let imgSrc = $('.content div img').attr('src') || '';
    if (!imgSrc) {
        ++noImgNum;
        return false;
    }
    if (imgSrc.indexOf('http') == -1) {
        imgSrc = 'http://www.ledu365.com' + imgSrc;
    }
    let extName = imgSrc.substr(-4);
    let downImgSrc = url_type + '_' + new Date().getTime().toString()  + extName;
    let imgOutResult = await writeImg(imgSrc, downImgSrc);
    if(!imgOutResult) {
        ++noImgNum;
        return false;
    }
    //如果不需要写入数据库，就把下面的注释打开
   /*  console.log('文章写入成功：' + (++currentUrl));*/
   


    //写入数据库，不需要写入就注释掉下面那一段
    let sql = `INSERT INTO article(article_title ,article_date ,article_source ,article_writer ,article_img, article_content, article_type, article_url_type, article_summary,article_cutImg) VALUES(${conn.escape(title)},${conn.escape(date)},${conn.escape(source)},${conn.escape(writer)},${conn.escape(`/images/essay/`+downImgSrc)},${conn.escape(contenText)},${conn.escape(type)},${conn.escape(url_type)},${conn.escape(summary)},${conn.escape(`/images/essay/cut`+cutImgSrc)})`;
    try {
        insertRes = await conn.query(sql);
        console.log('写入数据库：' + (++currentUrl));
    } catch (error) {
        console.log("写入数据库：失败：" + err);
        ++writerFail;
        return false;
    }
}

//写入图片
const writeImg = async(url, name)=>{
    let imgHeader = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrom' +
                'e/58.0.3029.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
    let cutImgOption = {
        url: url,
        headers: imgHeader,
        encoding: null
    }
    let cutResponse = null;
    try {
        cutResponse = await request(cutImgOption);
    } catch (error) {
        console.log('读取图片失败' ,error)
        return false;
    }
   let cutOutResult = null;
   try {
        let cutOut = fs.createWriteStream('public/images/' + name);
        cutOut.write(cutResponse);
        cutOutResult = await new Promise(resolve=>{
            cutOut.end('写入完成',  ()=> {
                if (cutOut.bytesWritten < 1) {
                    fs.unlink('public/images/' + name);
                    return resolve(false)
                }
                return resolve(true)
            });
        })
    } catch (error) {
        console.log('写入图片失败' ,error)
        return false;
    }
    return true;
}

//获取当前时间
const getNow = () => {
    let now = new Date().getHours() + '时' + new Date().getMinutes() + '分' + new Date().getSeconds() + '秒';
    return now;
}
/**
 *
 * @param {*} arr 传入需要控制的数组
 * @param {*} todo 单个元素需要执行的函数 function(item, index)
 * @param {*} limit 并发数
 * @param {*} delay 每轮并发的间隔时间
 */
const asyncControl = async(arr, todo, limit, delay) => {
    let count = arr.length
    let results = []
    let fn = async(arr, todo, limit, delay, results) => {
        if (!arr.length) 
            return results;
        let current = arr.splice(0, limit);
        let itemResults = await Promise.all(current.map((item, index) => todo(item, count - arr.length - (current.length - 1 - index) - 1)))
        results = results.concat(itemResults.filter(item => !!item));
        if (arr.length) {
            await new Promise(resolve => setTimeout(() => resolve(true), delay));
            return fn(arr, todo, limit, delay, results);
        } else {
            return results;
        }
    }
    return fn(arr, todo, limit, delay, results);
}


module.exports = router;
