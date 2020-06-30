'use strict';
const router = require('express').Router();
const AV = require('leanengine');
const mail = require('../utilities/send-mail');
const spam = require('../utilities/check-spam');
const Crypto = require('crypto');
const Comment = AV.Object.extend('Comment');

// Comment 列表
router.get('/', async function (req, res, next) {
    var page = parseInt(req.query.page);
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        let count = await query.count()
        query.descending('createdAt');
        query.limit(10);
        query.skip(page * 10 - 10);
        query.find().then(function (results) {
            res.render('comments', {
                dataCount: count,
                title: process.env.SITE_NAME + '上的评论',
                comment_list: results,
                Crypto: Crypto,
                bloger_name: process.env.SENDER_EMAIL
            });
        }, function (err) {
            if (err.code === 101) {
                res.render('comments', {
                    dataCount: 0,
                    title: process.env.SITE_NAME + '上的评论',
                    comment_list: [],
                    Crypto: Crypto,
                    bloger_name: process.env.SENDER_EMAIL
                });
            } else {
                next(err);
            }
        }).catch(next);
    } else {
        res.redirect('/');
    }
});


router.get('/onlyBlogger', async function (req, res, next) {
    let adminMail = process.env.BLOGGER_EMAIL || process.env.SMTP_USER;
    var page = parseInt(req.query.page);
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        query.descending('createdAt');
        query.equalTo('mail', adminMail);
        let count = await query.count()
        query.limit(10);
        query.skip(page * 10 - 10);
        query.find().then(function (results) {
            res.render('comments', {
                dataCount: count,
                title: process.env.SITE_NAME + '上的评论',
                comment_list: results,
                Crypto: Crypto,
                bloger_name: process.env.SENDER_EMAIL
            });
        }, function (err) {
            if (err.code === 101) {
                res.render('comments', {
                    dataCount: 0,
                    title: process.env.SITE_NAME + '上的评论',
                    comment_list: [],
                    Crypto: Crypto,
                    bloger_name: process.env.SENDER_EMAIL
                });
            } else {
                next(err);
            }
        }).catch(next);
    } else {
        res.redirect('/');
    }
})

router.get('/resend-email', function (req, res, next) {
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        query.get(req.query.id).then(function (object) {
            query.get(object.get('rid')).then(function (parent) {
                mail.send(object, parent);
                res.redirect('/comments')
            }, function (err) {}).catch(next);
        }, function (err) {}).catch(next);
    } else {
        res.redirect('/');
    }
});

router.get('/delete', function (req, res, next) {
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        query.get(req.query.id).then(function (object) {
            object.destroy();
            res.redirect('/comments')
        }, function (err) {}).catch(next);
    } else {
        res.redirect('/');
    }
});

router.get('/not-spam', function (req, res, next) {
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        query.get(req.query.id).then(function (object) {
            object.set('isSpam', false);
            object.set('ACL', {
                "*": {
                    "read": true
                }
            });
            object.save();
            spam.submitHam(object);
            res.redirect('/comments')
        }, function (err) {}).catch(next);
    } else {
        res.redirect('/');
    }
});

router.get('/mark-spam', function (req, res, next) {
    if (req.currentUser) {
        let query = new AV.Query(Comment);
        query.get(req.query.id).then(function (object) {
            object.set('isSpam', true);
            object.set('ACL', {
                "*": {
                    "read": false
                }
            });
            object.save();
            spam.submitSpam(object);
            res.redirect('/comments')
        }, function (err) {}).catch(next);
    } else {
        res.redirect('/');
    }
});

module.exports = router;
