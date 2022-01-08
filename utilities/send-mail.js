"use strict";
const nodemailer = require("nodemailer");
const request = require("request");
const $ = require("cheerio");

let config = {
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

if (process.env.SMTP_SERVICE != null) {
  config.service = process.env.SMTP_SERVICE;
} else {
  config.host = process.env.SMTP_HOST;
  config.port = parseInt(process.env.SMTP_PORT);
  config.secure = process.env.SMTP_SECURE === "false" ? false : true;
}
const transporter = nodemailer.createTransport(config);
transporter.verify(function (error, success) {
  if (error) {
    console.log("SMTP邮箱配置异常：", error);
  }
  if (success) {
    console.log("SMTP邮箱配置正常！");
  }
});

exports.notice = (comment) => {
  let SITE_NAME = process.env.SITE_NAME;
  let NICK = comment.get("nick");
  let COMMENT = comment.get("comment");
  let POST_URL = process.env.SITE_URL + comment.get("url") + "#" + comment.get("objectId");
  let POST_URL_QMSG = comment.get("url") + "#" + comment.get("objectId");
  let SITE_URL = process.env.SITE_URL;

  let _template =
    process.env.MAIL_TEMPLATE_ADMIN ||
    '<div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;"><h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">        您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>上的文章有了新的评论</h2><p><strong>${NICK}</strong>回复说：</p><div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">            ${COMMENT}</div><p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a><br></p></div></div>';
  let _subject = process.env.MAIL_SUBJECT_ADMIN || "${SITE_NAME}上有新评论了";
  let emailSubject = eval("`" + _subject + "`");
  let emailContent = eval("`" + _template + "`");

  let mailOptions = {
    from: '"' + process.env.SENDER_NAME + '" <' + process.env.SENDER_EMAIL + ">",
    to: process.env.BLOGGER_EMAIL || process.env.SENDER_EMAIL,
    subject: emailSubject,
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) return console.log(error);
    console.log("博主通知邮件成功发送: %s", info.response);
    comment.set("isNotified", true);
    comment.save();
  });

  if (process.env.SC_KEY != null) {
    const ScDespTemplate = `
#### ${NICK} 给您的回复如下：
        
> ${COMMENT}
        
#### 您可以点击[查看回复的完整內容](${POST_URL})`;
    const ScTextTemplate = `您在 ${SITE_NAME} 上有新评论啦！`;

    const _DespTemplate = process.env.SC_DESP_TEMPLATE || ScDespTemplate;
    const _TextTemplate = process.env.SC_TEXT_TEMPLATE || ScTextTemplate;
    request(
      {
        url: `https://sctapi.ftqq.com/${process.env.SC_KEY}.send`,
        method: "POST",
        body: `title=${_TextTemplate}&desp=${_DespTemplate}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      },
      function (error, response, body) {
        if (error) return console.log("发送微信提醒异常：", error);
        if (body) body = JSON.parse(body);
        if (response.statusCode === 200 && body.errmsg === "success") console.log("已发送微信提醒");
        else console.warn("微信提醒失败:", body);
      }
    );
  }

  if (process.env.QMSG_KEY != null) {
    if (process.env.QQ_SHAKE != null) {
      var shakeTemplate = process.env.SHAKE_TEMPLATE || "79";
      request(
        `https://qmsg.zendee.cn/send/${process.env.QMSG_KEY}?msg=@face=${shakeTemplate}@`,
        function (error, response, body) {
          if (error) return console.log("调起QQ戳一戳功能异常：", error);
          if (body) body = JSON.parse(body);
          if (response.statusCode === 200 && body.success === true) console.log("已成功戳一戳！");
          else console.warn("QQ戳一戳失败:", body);
        }
      );
    }
    var comment = $(
      COMMENT.replace(/<img.*?src="(.*?)".*?>/g, "\n[图片]$1\n").replace(/<br>/g, "\n")
    )
      .text()
      .replace(/\n+/g, "\n")
      .replace(/\n+$/g, "");
    const QmsgTemplate = `您在 ${SITE_NAME} 上有新评论啦！
${NICK} 给您的回复如下：
           
    ${comment}
        
您可以点击 ${POST_URL_QMSG} 前去查看！`;

    // 自定义模板以及默认模板
    let _template = process.env.QMSG_TEMPLATE || QmsgTemplate;
    request(
      `https://qmsg.zendee.cn/send/${process.env.QMSG_KEY}?msg=${encodeURIComponent(_template)}`,
      function (error, response, body) {
        if (error) return console.log("发送QQ提醒异常：", error);
        console.log(body);
        if (body) body = JSON.parse(body);
        if (response.statusCode === 200 && body.success === true) console.log("已发送QQ提醒");
        else console.warn("QQ提醒失败:", body);
      }
    );
  }
};

exports.send = (currentComment, parentComment) => {
  let PARENT_NICK = parentComment.get("nick");
  let SITE_NAME = process.env.SITE_NAME;
  let NICK = currentComment.get("nick");
  let MAIL = currentComment.get("mail");
  let COMMENT = currentComment.get("comment");
  let PARENT_COMMENT = parentComment.get("comment");
  let POST_URL =
    process.env.SITE_URL + currentComment.get("url") + "#" + currentComment.get("objectId");
  let SITE_URL = process.env.SITE_URL;
  let BLOGGER_EMAIL = process.env.BLOGGER_EMAIL;
  let _subject, _template;

  if (MAIL == BLOGGER_EMAIL) {
    _subject =
      process.env.MAIL_SUBJECT_BLOGGER || "${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复";
    _template =
      process.env.MAIL_TEMPLATE_BLOGGER ||
      '<div style="border-radius: 10px 10px 10px 10px;font-size:13px;    color: #555555;width: 666px;font-family:"Century Gothic","Trebuchet MS","Hiragino Sans GB",微软雅黑,"Microsoft Yahei",Tahoma,Helvetica,Arial,"SimSun",sans-serif;margin:50px auto;border:1px solid #eee;max-width:100%;background: #ffffff repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 1px 5px rgba(0, 0, 0, 0.15);"><div style="width:100%;background:#49BDAD;color:#ffffff;border-radius: 10px 10px 0 0;background-image: -moz-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));background-image: -webkit-linear-gradient(0deg, rgb(67, 198, 184), rgb(255, 209, 244));height: 66px;"><p style="font-size:15px;word-break:break-all;padding: 23px 32px;margin:0;background-color: hsla(0,0%,100%,.4);border-radius: 10px 10px 0 0;">您在<a style="text-decoration:none;color: #ffffff;"href="${SITE_URL}">${SITE_NAME}</a>上的留言有新回复啦！</p></div><div style="margin:40px auto;width:90%"><p>${PARENT_NICK}同学，您曾在文章上发表评论：</p><div class="parentComment"style="background: #fafafa repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);margin:20px 0px;padding:15px;border-radius:5px;font-size:14px;color:#555555;">${PARENT_COMMENT}</div><p><span class="bloger">博主</span>给您的回复如下：</p><div class="comment"style="background: #fafafa repeating-linear-gradient(-45deg,#fff,#fff 1.125rem,transparent 1.125rem,transparent 2.25rem);box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);margin:20px 0px;padding:15px;border-radius:5px;font-size:14px;color:#555555;">${COMMENT}</div><p>您可以点击<a style="text-decoration:none; color:#12addb"href="${POST_URL}#comments">查看回复的完整內容</a>，欢迎光临<a style="text-decoration:none; color:#12addb"href="${SITE_URL}">${SITE_NAME}</a>。</p><p>此邮件由系统自动发送，如您从未操作，请忽略并删除！</p><style type="text/css">a:link{text-decoration:none}a:visited{text-decoration:none}a:hover{text-decoration:none}a:active{text-decoration:none}.comment,.parentComment{max-width:100%}.comment img,.parentComment img{width:100%}.vemoji{width:30px;margin:10px 0}.bloger{background-color:#ecf5ff;display:inline-block;height:22px;padding:0 10px;line-height:20px;font-size:12px;color:#409eff;border:1px solid#d9ecff;border-radius:4px;box-sizing:border-box;white-space:nowrap}</style></div></div>';
  } else {
    _subject = process.env.MAIL_SUBJECT || "${PARENT_NICK}，您在『${SITE_NAME}』上的评论收到了回复";
    _template =
      process.env.MAIL_TEMPLATE ||
      '<div style="border-top:2px solid #12ADDB;box-shadow:0 1px 3px #AAAAAA;line-height:180%;padding:0 15px 12px;margin:50px auto;font-size:12px;"><h2 style="border-bottom:1px solid #DDD;font-size:14px;font-weight:normal;padding:13px 0 10px 8px;">        您在<a style="text-decoration:none;color: #12ADDB;" href="${SITE_URL}" target="_blank">            ${SITE_NAME}</a>上的评论有了新的回复</h2>    ${PARENT_NICK} 同学，您曾发表评论：<div style="padding:0 12px 0 12px;margin-top:18px"><div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">            ${PARENT_COMMENT}</div><p><strong>${NICK}</strong>回复说：</p><div style="background-color: #f5f5f5;padding: 10px 15px;margin:18px 0;word-wrap:break-word;">            ${COMMENT}</div><p>您可以点击<a style="text-decoration:none; color:#12addb" href="${POST_URL}" target="_blank">查看回复的完整內容</a>，欢迎再次光临<a style="text-decoration:none; color:#12addb" href="${SITE_URL}" target="_blank">${SITE_NAME}</a>。<br></p></div></div>';
  }
  let emailSubject = eval("`" + _subject + "`");
  let emailContent = eval("`" + _template + "`");

  let mailOptions = {
    from: '"' + process.env.SENDER_NAME + '" <' + process.env.SENDER_EMAIL + ">", // sender address
    to: parentComment.get("mail"),
    subject: emailSubject,
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("AT通知邮件成功发送: %s", info.response);
    currentComment.set("isNotified", true);
    currentComment.save();
  });
};
