const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Redis = require('redis')
require('dotenv').config();

const DEFAULT_EXPIRATION = 3600; // 1 hour
const redisClient = Redis.createClient(); // run on local, so keep default

(async () => {    
    await redisClient.connect();
})();

redisClient.on('connect', () => console.log('::> Redis Client Connected'));
redisClient.on('error', (err) => console.log('<:: Redis Client Error', err));

const app = express();
app.use(cors());

app.get('/photos', async(req, res) => {
    const albumId = req.query.albumId;
    const key = (typeof albumId == 'undefined') ? "photos" : `photos?albumId=${albumId}`;

    const photos = await getOrSetCache(key, async() => {
        const { data } = await axios.get(
            "https://jsonplaceholder.typicode.com/photos",
            { params: { albumId } }
        );
        return data;
    });

    res.json(photos);
});

app.get('/photos/:id', async(req, res) => {
    const photo = await getOrSetCache(`photos:${req.params.id}`, async() => {
        const { data } = await axios.get(
            `https://jsonplaceholder.typicode.com/photos/${req.params.id}`
        );
        return data;
    });

    res.json(photo);
});

function getOrSetCache(key, cb) {
    return new Promise(async(resolve, reject) => {
        redisClient.get(key)
        .then(
            async(data) => {
                if (data != null) {
                    console.log("Cache Hit");
                    return resolve(JSON.parse(data));
                }
                console.log("Cache Miss");
                const freshData = await cb()
                redisClient.setEx(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
                resolve(freshData);
            },
            (err) => {
                return console.error(err);
            }
        );
    });
};

const port = process.env.PORT || 3000;
app.listen(port, function(err) {
    if (err) return console.log(err);
    console.log("server started on port", port);
});
